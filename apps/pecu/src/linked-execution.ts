import { z } from "zod";
import { intentTitle } from "./chat";
import type { LinkedStep, LinkedWalletRequest, LinkedWalletResult } from "./linked-wallet-contract";
import { LinkedWalletError, type LinkedWallets } from "./linked-wallets";
import { log } from "./logger";
import { digest, planDigest } from "./plan-digest";
import { validateIntentPlan } from "./policy";
import { verifyWalletTransaction, walletTransactionMatches, WalletTransactionMismatchError, type JsonRpc } from "./receipt";
import type { ExecutionStep, Intent, PecuStore } from "./state";
import { webConversation } from "./web-identity";

type Address = `0x${string}`;
type Store = Pick<
  PecuStore,
  "intentForCode" | "executingIntents" | "steps" | "transitionIntent" | "markStepPrepared" | "markStepSubmitted" | "markStepSucceeded" | "markStepFailed" | "releaseStep"
>;

const explorer = (hash: string) => `https://basescan.org/tx/${hash}`;
const transactionHash = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]);

function statusMessage(intent: Intent): string {
  switch (intent.state) {
    case "succeeded": return intent.result ?? "Confirmed on Base.";
    case "failed": return intent.result ?? "This transaction failed.";
    case "cancelled": return "Cancelled. Nothing was sent.";
    case "expired": return "This preview expired. Ask Pecu for a new one.";
    case "pending": return "Waiting for your confirmation.";
    case "executing": return "Waiting for Base to include the transaction.";
  }
}

/**
 * Client-signed execution for chat previews built for a linked wallet. The
 * browser wallet signs and broadcasts; Pecu hands out one exact persisted call
 * at a time, records the hash the wallet returned and settles each step only
 * after its own Base RPC shows that exact call from that wallet with a
 * successful canonical receipt. The Crossmint signer never runs these plans.
 */
export class LinkedExecution {
  private readonly active = new Set<string>();

  constructor(private readonly deps: Readonly<{ store: Store; wallets: Pick<LinkedWallets, "isLinked">; rpc: JsonRpc; enabled: boolean }>) {}

  /** Whether this sender has a linked-wallet plan in flight from `address`. */
  busy(senderId: string, address: string): boolean {
    return this.deps.store.executingIntents().some((intent) => intent.senderId === senderId && intent.signer?.toLowerCase() === address.toLowerCase());
  }

  step(senderId: string, conversationId: string, code: string, resend = false): Promise<LinkedStep> {
    return this.exclusive(senderId, conversationId, code, async ({ intent, steps, signer }) => {
      if (intent.state !== "pending" && intent.state !== "executing") return { kind: "status", state: intent.state, message: statusMessage(intent) };
      const calls = steps.map((step) => step.call);
      if (await planDigest(calls) !== intent.planDigest) {
        this.deps.store.transitionIntent(intent.id, intent.state, "failed", "Persisted plan digest mismatch");
        throw new LinkedWalletError("The saved plan failed its integrity check. Nothing was sent.");
      }
      validateIntentPlan(intent, signer, calls);
      if (intent.state === "executing") {
        const settled = await this.settle(intent, steps);
        if (settled) return settled;
      }
      const next = this.deps.store.steps(intent.id).find((step) => step.state !== "succeeded");
      if (!next || next.state === "failed" || next.state === "submitted") throw new LinkedWalletError("Pecu couldn't find the next transaction. Reload and try again.");
      if (next.state === "prepared" && !resend) return { kind: "unreported", position: next.position };
      if (!this.deps.enabled) throw new LinkedWalletError("Transactions are currently disabled. Nothing has been sent.");
      if (!this.deps.wallets.isLinked(senderId, signer)) throw new LinkedWalletError("Link this wallet again to confirm this preview.");
      if (Date.now() > intent.expiresAt) return this.expire(intent, next.position);
      if (intent.state === "pending" && !this.deps.store.transitionIntent(intent.id, "pending", "executing")) {
        throw new LinkedWalletError("This preview is already being processed.");
      }
      if (next.state === "planned") this.deps.store.markStepPrepared(intent.id, next.position, `wallet:${intent.id}:${next.position}`);
      const { from, to, data, value } = next.call;
      return { kind: "send", position: next.position, total: steps.length, chainId: 8453, transaction: { from, to, data, value } };
    });
  }

  submitted(senderId: string, conversationId: string, code: string, position: number, hash: `0x${string}`): Promise<LinkedStep> {
    return this.exclusive(senderId, conversationId, code, async ({ intent, steps }) => {
      if (intent.state !== "executing") return { kind: "status", state: intent.state, message: statusMessage(intent) };
      const step = steps[position];
      if (step?.state === "submitted" && step.hash?.toLowerCase() === hash.toLowerCase()) return { kind: "waiting", position, hash };
      const next = steps.find((candidate) => candidate.state !== "succeeded");
      if (!step || next?.position !== position || step.state !== "prepared") throw new LinkedWalletError("Wallet transactions must follow the order in the preview.");
      const matches = await walletTransactionMatches(this.deps.rpc, hash, step.call).catch(() => null);
      if (matches === false) throw new LinkedWalletError(new WalletTransactionMismatchError().message);
      this.deps.store.markStepSubmitted(intent.id, position, hash);
      return { kind: "waiting", position, hash };
    });
  }

  /** The wallet refused before sending. Nothing from this step reached Base. */
  declined(senderId: string, conversationId: string, code: string, position: number): Promise<LinkedStep> {
    return this.exclusive(senderId, conversationId, code, async ({ intent }) => {
      if (intent.state !== "executing") return { kind: "status", state: intent.state, message: statusMessage(intent) };
      if (!this.deps.store.releaseStep(intent.id, position)) throw new LinkedWalletError("This transaction was already sent from your wallet.");
      const started = this.deps.store.steps(intent.id).some((step) => step.hash !== undefined);
      if (started) {
        return { kind: "status", state: "executing", message: `You declined transaction ${position + 1} in your wallet. Earlier transactions stay on Base. Confirm again before the preview expires to continue.` };
      }
      this.deps.store.transitionIntent(intent.id, "executing", "pending");
      return { kind: "status", state: "pending", message: "You declined in your wallet. Nothing was sent." };
    });
  }

  /** Settle linked plans nobody is watching: verify sent steps from Base and close plans that expired before their next step. */
  async sweep(): Promise<void> {
    for (const intent of this.deps.store.executingIntents()) {
      if (!intent.signer || this.active.has(intent.id)) continue;
      this.active.add(intent.id);
      try {
        if (await this.settle(intent, this.deps.store.steps(intent.id))) continue;
        const next = this.deps.store.steps(intent.id).find((step) => step.state !== "succeeded");
        if (next?.state === "planned" && Date.now() > intent.expiresAt) this.expire(intent, next.position);
      } catch (error) {
        log("warn", "linked_wallet_sweep_failed", { intentId: intent.id, error: error instanceof Error ? error.message : String(error) });
      } finally {
        this.active.delete(intent.id);
      }
    }
  }

  private async exclusive(senderId: string, conversationId: string, code: string, run: (plan: { intent: Intent; steps: ExecutionStep[]; signer: Address }) => Promise<LinkedStep>): Promise<LinkedStep> {
    const intent = this.deps.store.intentForCode(await digest(code), senderId, conversationId);
    if (!intent || intent.senderId !== senderId || intent.conversationId !== conversationId) throw new LinkedWalletError("This confirmation isn't available in this thread.");
    const steps = this.deps.store.steps(intent.id);
    const signer = intent.signer;
    if (!signer) throw new LinkedWalletError("This preview uses your Pecu wallet. Confirm it in the chat.");
    if (this.active.has(intent.id)) throw new LinkedWalletError("Pecu is already checking this preview. Try again in a moment.");
    this.active.add(intent.id);
    try {
      return await run({ intent, steps, signer });
    } finally {
      this.active.delete(intent.id);
    }
  }

  /** Settle submitted steps from Base. Returns undefined when the next step still needs the wallet. */
  private async settle(intent: Intent, steps: readonly ExecutionStep[]): Promise<LinkedStep | undefined> {
    const hashes: string[] = [];
    for (const step of steps) {
      if (step.state === "succeeded") {
        if (step.hash) hashes.push(step.hash);
        continue;
      }
      const hash = transactionHash.safeParse(step.hash);
      if (step.state !== "submitted" || !hash.success) return undefined;
      let outcome;
      try {
        outcome = await verifyWalletTransaction(this.deps.rpc, hash.data, step.call);
      } catch (error) {
        if (error instanceof WalletTransactionMismatchError) return this.fail(intent, step.position, error.message);
        log("warn", "linked_wallet_receipt_unavailable", { intentId: intent.id, position: step.position, error: error instanceof Error ? error.message : String(error) });
        return { kind: "waiting", position: step.position, hash: hash.data };
      }
      if (outcome.status === "pending") return { kind: "waiting", position: step.position, hash: hash.data };
      if (outcome.status === "reverted") return this.fail(intent, step.position, `Transaction ${step.position + 1} reverted on Base.\n${explorer(outcome.hash)}`);
      this.deps.store.markStepSucceeded(intent.id, step.position, outcome.hash);
      hashes.push(outcome.hash);
    }
    const result = [`${intentTitle(intent)} confirmed on Base mainnet from your wallet.`, ...hashes.map(explorer)].join("\n");
    this.deps.store.transitionIntent(intent.id, "executing", "succeeded", result);
    return { kind: "status", state: "succeeded", message: result };
  }

  private fail(intent: Intent, position: number, message: string): LinkedStep {
    this.deps.store.markStepFailed(intent.id, position, message);
    this.deps.store.transitionIntent(intent.id, "executing", "failed", message);
    return { kind: "status", state: "failed", message };
  }

  private expire(intent: Intent, position: number): LinkedStep {
    if (intent.state === "pending") {
      this.deps.store.transitionIntent(intent.id, "pending", "expired");
      return { kind: "status", state: "expired", message: "This preview expired. Ask Pecu for a new one." };
    }
    return this.fail(intent, position, `This preview expired before transaction ${position + 1} was sent. Earlier transactions stay on Base. Ask Pecu for a new preview.`);
  }
}

/** Dispatch one verified web request about the sender's linked wallets. */
export async function linkedWalletRequest(
  deps: Readonly<{ wallets: LinkedWallets; execution: LinkedExecution }>,
  { identity, origin, action }: LinkedWalletRequest,
): Promise<LinkedWalletResult> {
  const { senderId } = identity;
  const conversation = (threadId: string | null) => webConversation({ ...identity, threadId });
  switch (action.op) {
    case "challenge":
      return { kind: "challenge", ...deps.wallets.challenge(senderId, action.address, origin) };
    case "link":
      return { kind: "wallets", wallets: await deps.wallets.link(senderId, action.challenge, action.signature) };
    case "rename":
      return { kind: "wallets", wallets: deps.wallets.rename(senderId, action.address, action.name) };
    case "unlink":
      if (deps.execution.busy(senderId, action.address)) throw new LinkedWalletError("A transaction from this wallet is still in progress. Unlink it once that finishes.");
      return { kind: "wallets", wallets: deps.wallets.unlink(senderId, action.address) };
    case "use":
      deps.wallets.use(senderId, conversation(action.threadId), action.address);
      return { kind: "wallets", wallets: deps.wallets.list(senderId) };
    case "step":
      return { kind: "step", step: await deps.execution.step(senderId, conversation(action.threadId), action.code, action.resend ?? false) };
    case "submitted":
      return { kind: "step", step: await deps.execution.submitted(senderId, conversation(action.threadId), action.code, action.position, action.hash) };
    case "declined":
      return { kind: "step", step: await deps.execution.declined(senderId, conversation(action.threadId), action.code, action.position) };
    default: {
      const _exhaustive: never = action;
      throw new LinkedWalletError(`Unsupported wallet action ${String(_exhaustive)}`);
    }
  }
}
