import type { AaveService } from "./integrations/aave";
import type { PolymarketService } from "./integrations/polymarket";
import type { SugarAction, SugarParameters } from "@beegreat/sugar/contracts";
import type { Config } from "./config";
import { aeroHelpText, helpText, parseCommand, parseNaturalWalletCommand, plannedCallSchema, type PlannedCall, type VerifiedMessage } from "./domain";
import type { AgentCapabilities, AgentHarness } from "./harness";
import { log } from "./logger";
import { validateIntentPlan } from "./policy";
import type { AgentStateStore, Intent, IntentAction } from "./state";
import { AerodromeService } from "./aerodrome";
import type { EvmReadResult, EvmService, EvmTxAction } from "./evm";
import type { UserOperationOutcome, UserOperationReference } from "./receipt";
import { WalletService } from "./wallet";
import { aeroPlanText, aeroReadText, chatError, evmPlanText, evmReadText, verbosePage } from "./chat";
import { isTransactionReadPermissionError } from "./wallet-errors";

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function planDigest(calls: readonly PlannedCall[]): Promise<string> {
  return digest(JSON.stringify(calls.map((call) => plannedCallSchema.parse(call))));
}

function confirmationCode(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function actionLabel(action: string): string {
  return action.replaceAll("_", " ");
}

function familyLabel(intent: IntentAction): string {
  if (intent.family === "aave") return `Aave ${intent.parameters.stage === "approval" ? "token approval" : intent.parameters.action}`;
  return intent.family === "aero" ? `Aerodrome ${actionLabel(intent.action)}` : `EVM ${actionLabel(intent.action)}`;
}

function explorerLink(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

/** A step was submitted but its inclusion is not yet verifiable. The intent stays executing. */
class PendingInclusionError extends Error {
  constructor(readonly hash: string | undefined) {
    super(hash ? `Transaction ${hash} was submitted but is not yet included on Base` : "Transaction was submitted but has no hash yet");
    this.name = "PendingInclusionError";
  }
}

type AgentWallets = Pick<WalletService, "balances" | "prepare" | "approve" | "transaction"> & {
  getOrCreate(senderId: string): Promise<{ address: string }>;
};

export type UserOperationVerifier = (reference: UserOperationReference) => Promise<UserOperationOutcome>;

export type AgentServices = Readonly<{
  aave?: Pick<AaveService, "call" | "propose">;
  polymarket?: Pick<PolymarketService, "research">;
  aerodrome: Pick<AerodromeService, "run">;
  evm: Pick<EvmService, "tokenBalance" | "allowance" | "read" | "inspect" | "decode" | "propose">;
  verifyUserOperation: UserOperationVerifier;
}>;

export class BasedBotAgent {
  private readonly executing = new Set<string>();

  constructor(
    private readonly config: Pick<Config, "enableMainnetExecution" | "maxSlippageBps" | "quoteTtlSeconds">,
    private readonly store: AgentStateStore,
    private readonly wallets: AgentWallets,
    private readonly services: AgentServices,
    private readonly harness: AgentHarness,
  ) {}

  async resumeExecuting(): Promise<void> {
    if (!this.config.enableMainnetExecution) return;
    for (const intent of this.store.executingIntents()) {
      const steps = this.store.steps(intent.id);
      if (steps.length === 0) {
        this.store.transitionIntent(intent.id, "executing", "failed", "Transaction plan was not persisted before shutdown");
        continue;
      }
      try {
        const started = steps.some((step) => step.transactionId !== undefined);
        if (!started && Date.now() > intent.expiresAt) throw new Error("Transaction plan expired; recovery stopped");
        const calls = steps.map((step) => step.call);
        if (await planDigest(calls) !== intent.planDigest) {
          throw new Error("Persisted plan digest mismatch; recovery stopped");
        }
        const wallet = await this.walletAddress(intent.senderId);
        validateIntentPlan(intent, wallet, calls);
        const links = await this.executeSteps(intent.senderId, intent.id, wallet, intent.expiresAt);
        const result = [`Recovered and completed the interrupted ${familyLabel(intent)} action on Base.`, ...links].join("\n");
        this.store.transitionIntent(intent.id, "executing", "succeeded", result);
        log("info", "intent_recovered", { intentId: intent.id, action: intent.action, steps: steps.length });
      } catch (error) {
        if (isTransactionReadPermissionError(error)) {
          log("warn", "intent_recovery_permission_blocked", { intentId: intent.id });
          continue;
        }
        if (error instanceof PendingInclusionError) {
          log("warn", "intent_recovery_pending", { intentId: intent.id, action: intent.action, hash: error.hash });
          continue;
        }
        this.store.transitionIntent(intent.id, "executing", "failed", errorMessage(error));
        log("error", "intent_recovery_failed", { intentId: intent.id, action: intent.action, error: errorMessage(error) });
      }
    }
  }

  async handle(message: VerifiedMessage, retryUnanswered = false): Promise<string | undefined> {
    const claim = this.store.claimEvent(
      message.eventId,
      message.conversationId,
      message.senderId,
      retryUnanswered,
    );
    if (claim === "completed") return this.store.eventReply(message.eventId);
    if (claim === "busy") return undefined;
    try {
      const reply = await this.execute(message);
      this.store.completeEvent(message.eventId, reply);
      return reply;
    } catch (error) {
      const reply = chatError(error);
      this.store.completeEvent(message.eventId, reply);
      log("warn", "command_failed", { eventId: message.eventId, senderId: message.senderId, error: errorMessage(error) });
      return reply;
    }
  }

  private async execute(message: VerifiedMessage): Promise<string> {
    if (/^(?:confirm|cancel)$/i.test(message.text.trim())) {
      if (!message.replyConfirmationCode) return 'Reply to the transaction preview with "confirm" or "cancel", or use the code shown in that preview.';
      const codeHash = await digest(message.replyConfirmationCode);
      return message.text.trim().toLowerCase() === "confirm" ? this.confirm(message, codeHash) : this.cancel(message, codeHash);
    }
    const naturalWalletCommand = message.text.trim().startsWith("/")
      ? undefined
      : parseNaturalWalletCommand(message.text);
    if (naturalWalletCommand?.type === "wallet") return this.walletReply(message);
    if (naturalWalletCommand?.type === "balance") return this.balanceReply(message);

    let command;
    try {
      command = parseCommand(message.text);
    } catch (error) {
      if (/^(?:b)?\//i.test(message.text.trim())) throw error;
      return this.harness.respond(message, this.capabilitiesFor(message));
    }
    switch (command.type) {
      case "help": return helpText + (this.store.yoloEnabled(message.senderId, message.conversationId) ? "\n\nYOLO is currently on for you in this chat. Send /yolo off to require confirmation." : "");
      case "yolo": {
        if (command.enabled !== undefined) this.store.setYolo(message.senderId, message.conversationId, command.enabled);
        return this.store.yoloEnabled(message.senderId, message.conversationId)
          ? "YOLO is on for you in this chat. New transaction requests execute without a confirmation prompt. Existing previews still need confirmation. Send /yolo off to turn it off."
          : "YOLO is off. Transactions need your confirmation. Send /yolo on to execute new transaction requests without a confirmation prompt.";
      }
      case "verbose": return verbosePage(this.store.chatDetails(message.senderId, message.conversationId), command.page);
      case "aave-help": return 'Ask about Aave rates, positions, account history, or reducing debt. For example: "Check my Aave positions" or "Preview supplying 0.000001 ETH to Aave on Base". Supply, borrow, withdraw, and repay use the same confirmation and YOLO settings as other transactions.';
      case "polymarket": return this.polymarketReply(message, command.query);
      case "aero-help": return aeroHelpText;
      case "wallet": return this.walletReply(message);
      case "balance": return this.balanceReply(message);
      case "confirm": return this.confirm(message, await digest(command.code));
      case "cancel": return this.cancel(message, await digest(command.code));
      case "token": return this.readReply(message, await this.services.evm.tokenBalance(await this.walletAddress(message.senderId), command.token));
      case "allowance": return this.readReply(message, await this.services.evm.allowance(await this.walletAddress(message.senderId), command.token, command.spender));
      case "evm": return this.runEvm(message, command.action, command.parameters);
      case "aero": return this.runAero(message, command.action, command.parameters);
      default: {
        const _exhaustive: never = command;
        throw new Error(`Unhandled command ${String(_exhaustive)}`);
      }
    }
  }

  capabilitiesFor(message: VerifiedMessage): AgentCapabilities {
    const wallet = () => this.walletAddress(message.senderId);
    return {
      yoloEnabled: () => this.store.yoloEnabled(message.senderId, message.conversationId),
      aaveCall: (name, args) => this.runAave(message, name, args),
      polymarketResearch: (query) => this.polymarketReply(message, query),
      walletAddress: () => this.walletReply(message),
      walletBalances: () => this.balanceReply(message),
      aeroRead: (action, parameters) => this.runAero(message, action, parameters),
      aeroPropose: (action, parameters) => this.runAero(message, action, parameters),
      evmToken: async (token) => this.readReply(message, await this.services.evm.tokenBalance(await wallet(), token)),
      evmAllowance: async (token, spender) => this.readReply(message, await this.services.evm.allowance(await wallet(), token, spender)),
      evmRead: async (input) => this.readReply(message, await this.services.evm.read(input)),
      evmInspect: async (input) => this.readReply(message, await this.services.evm.inspect(input)),
      evmDecode: async (input) => this.readReply(message, await this.services.evm.decode(input)),
      evmPropose: (action, parameters) => this.runEvm(message, action, parameters),
    };
  }

  private async walletAddress(senderId: string): Promise<`0x${string}`> {
    const wallet = await this.wallets.getOrCreate(senderId);
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address)) throw new Error("Wallet address is not a valid Base address");
    return wallet.address as `0x${string}`;
  }

  private async walletReply(message: VerifiedMessage): Promise<string> {
    const address = await this.walletAddress(message.senderId);
    this.saveDetails(message, { address, chain: 8453 });
    return `Your Base wallet:\n${address}`;
  }

  private async balanceReply(message: VerifiedMessage): Promise<string> {
    const balances = await this.wallets.balances(message.senderId);
    this.saveDetails(message, Object.fromEntries(balances.split("\n").map((line) => {
      const colon = line.indexOf(":");
      return colon < 0 ? ["balance", line] : [line.slice(0, colon), line.slice(colon + 1).trim()];
    })));
    return balances.split("\n").filter((line) => !line.startsWith("Address:")).join("\n");
  }

  private readReply(message: VerifiedMessage, result: EvmReadResult): string {
    this.saveDetails(message, result.output);
    return evmReadText(result);
  }

  private saveDetails(message: VerifiedMessage, value: unknown): void {
    this.store.saveChatDetails(message.senderId, message.conversationId, JSON.stringify(value, null, 2) ?? "null");
  }

  private async runAero(message: VerifiedMessage, action: SugarAction, parameters: SugarParameters): Promise<string> {
    const wallet = await this.walletAddress(message.senderId);
    const result = await this.services.aerodrome.run(wallet, action, parameters);
    this.saveDetails(message, result.kind === "read" ? result.output : result);
    if (result.kind === "read") {
      return aeroReadText(result.action, result.output);
    }
    if (result.kind === "unchanged") {
      return "Your index already matches these allocations. No transaction plan was created.";
    }
    return this.persistProposal(message, wallet, { family: "aero", action: result.action, parameters: result.parameters }, result.calls, aeroPlanText(result));
  }

  private async runEvm(message: VerifiedMessage, action: EvmTxAction, parameters: unknown): Promise<string> {
    const wallet = await this.walletAddress(message.senderId);
    const result = await this.services.evm.propose(wallet, action, parameters);
    this.saveDetails(message, result);
    return this.persistProposal(message, wallet, { family: "evm", action: result.action, parameters: result.parameters }, result.calls, evmPlanText(result));
  }

  private async runAave(message: VerifiedMessage, name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.services.aave) throw new Error("Aave is not configured yet.");
    const wallet = await this.walletAddress(message.senderId);
    if (name === "prepare_action") {
      const plan = await this.services.aave.propose(args, wallet);
      this.saveDetails(message, plan.details);
      return this.persistProposal(message, wallet, { family: "aave", action: "aave_action", parameters: plan.parameters }, plan.calls, plan.preview);
    }
    const result = await this.services.aave.call(name, args, wallet);
    this.saveDetails(message, result);
    return JSON.stringify(result);
  }

  private async polymarketReply(message: VerifiedMessage, query?: string): Promise<string> {
    if (!this.services.polymarket) throw new Error("Polymarket research is not configured yet.");
    const result = await this.services.polymarket.research(`${message.senderId}:${message.conversationId}`, message.eventId, query);
    this.saveDetails(message, result.details);
    return result.text;
  }

  private async persistProposal(message: VerifiedMessage, wallet: `0x${string}`, intent: IntentAction, calls: readonly PlannedCall[], preview: string): Promise<string> {
    validateIntentPlan(intent, wallet, calls);
    const previous = this.store.intentForSource(message.eventId);
    if (previous) return "A transaction request is already saved for this message. Use its original preview to confirm or check it; no second request was created.";
    const code = confirmationCode();
    const expiresAt = Date.now() + this.config.quoteTtlSeconds * 1_000;
    const fingerprint = await planDigest(calls);
    this.store.createIntent({
      id: crypto.randomUUID(),
      codeHash: await digest(code),
      senderId: message.senderId,
      conversationId: message.conversationId,
      sourceEventId: message.eventId,
      state: "pending",
      ...intent,
      preview,
      planDigest: fingerprint,
      expiresAt,
    }, calls);

    if (this.config.enableMainnetExecution && this.store.yoloEnabled(message.senderId, message.conversationId)) {
      return `${preview}\n\nYOLO is on.\n${await this.confirm(message, await digest(code))}\nCheck this request: /confirm ${code}`;
    }
    const execution = this.config.enableMainnetExecution
      ? `Reply to this message with "confirm" to proceed or "cancel" to cancel.\nYou can also send /confirm ${code} or /cancel ${code}.\nExpires in ${Math.floor(this.config.quoteTtlSeconds / 60)} minutes.`
      : `Transactions are currently disabled. Nothing has been sent.\nCancel: /cancel ${code}`;
    return `${preview}\n\n${execution}`;
  }

  private async confirm(message: VerifiedMessage, codeHash: string): Promise<string> {
    if (!this.config.enableMainnetExecution) {
      return "Mainnet execution is locked by configuration. Aero reads, previews, and wallets are available, but no transaction was sent.";
    }
    const intent = this.authorizedIntent(message, codeHash);
    if (intent.state === "succeeded") return intent.result ?? "This proposal already succeeded.";
    if (intent.state !== "pending" && intent.state !== "executing") return `This proposal is ${intent.state} and cannot be executed.`;

    const steps = this.store.steps(intent.id);
    const started = steps.some((step) => step.transactionId !== undefined);
    if (!started && Date.now() > intent.expiresAt) {
      this.store.transitionIntent(intent.id, intent.state, "expired");
      return `That ${familyLabel(intent)} plan expired. Create a new proposal to continue.`;
    }

    const wallet = await this.walletAddress(message.senderId);
    const calls = steps.map((step) => step.call);
    if (await planDigest(calls) !== intent.planDigest) {
      this.store.transitionIntent(intent.id, intent.state, "failed", "Persisted plan digest mismatch");
      throw new Error("The persisted plan failed its integrity check; nothing was sent");
    }
    validateIntentPlan(intent, wallet, calls);
    if (this.executing.has(intent.id)) return "This proposal is already being processed.";
    if (intent.state === "pending" && !this.store.transitionIntent(intent.id, "pending", "executing")) {
      return "This proposal is already being processed.";
    }

    this.executing.add(intent.id);
    try {
      const links = await this.executeSteps(message.senderId, intent.id, wallet, intent.expiresAt);
      const result = [`${familyLabel(intent)} confirmed on Base mainnet.`, ...links].join("\n");
      this.store.transitionIntent(intent.id, "executing", "succeeded", result);
      return result;
    } catch (error) {
      if (isTransactionReadPermissionError(error)) {
        return "I couldn't check this transaction because a wallet permission is missing. The bot administrator needs to fix it. This request is saved; don't create another swap. Once fixed, confirm this same preview again to check or continue it.";
      }
      if (error instanceof PendingInclusionError) {
        return [
          `${familyLabel(intent)} was submitted but its inclusion is not verified yet.`,
          ...(error.hash ? [explorerLink(error.hash)] : []),
          "Send the same /confirm code again to re-check. Nothing will be resubmitted.",
        ].join("\n");
      }
      const failed = this.store.steps(intent.id).find((step) => step.state !== "succeeded");
      if (failed) this.store.markStepFailed(intent.id, failed.position, errorMessage(error));
      this.store.transitionIntent(intent.id, "executing", "failed", errorMessage(error));
      throw error;
    } finally {
      this.executing.delete(intent.id);
    }
  }

  /**
   * Execute persisted steps in order. Each step is idempotent: Crossmint is
   * only asked to approve while the transaction still awaits approval, and a
   * step only counts as succeeded once the receipt carries a matching
   * UserOperationEvent whose inner success flag is set.
   */
  private async executeSteps(senderId: string, intentId: string, wallet: `0x${string}`, expiresAt: number): Promise<string[]> {
    const links: string[] = [];
    for (const step of this.store.steps(intentId)) {
      if (step.state === "succeeded") continue;
      let transactionId = step.transactionId;
      if (!transactionId) {
        if (Date.now() > expiresAt) throw new Error("This transaction preview expired before the next step could be sent. Request a fresh preview.");
        const prepared = await this.wallets.prepare(senderId, step.call);
        transactionId = prepared.transactionId;
        this.store.markStepPrepared(intentId, step.position, transactionId);
      }
      let record = await this.wallets.transaction(senderId, transactionId);
      if (record.sender.toLowerCase() !== wallet.toLowerCase()) throw new Error("Crossmint transaction belongs to a different wallet");
      if (record.status === "awaiting-approval") {
        if (Date.now() > expiresAt) throw new Error("This transaction preview expired before approval. Request a fresh preview.");
        await this.wallets.approve(senderId, transactionId);
        record = await this.wallets.transaction(senderId, transactionId);
      }
      if (record.status === "failed") throw new Error("Crossmint reports that the transaction failed before inclusion");
      if (!record.hash) throw new PendingInclusionError(undefined);
      this.store.markStepSubmitted(intentId, step.position, record.hash);
      const outcome = await this.services.verifyUserOperation({ hash: record.hash, sender: record.sender, userOperationHash: record.userOperationHash });
      if (outcome.status === "pending") throw new PendingInclusionError(record.hash);
      if (outcome.status === "reverted") throw new Error(`Transaction ${record.hash} was included but the user operation reverted`);
      this.store.markStepSucceeded(intentId, step.position, outcome.hash);
      links.push(explorerLink(outcome.hash));
    }
    return links;
  }

  private cancel(message: VerifiedMessage, codeHash: string): string {
    const intent = this.authorizedIntent(message, codeHash);
    if (intent.state !== "pending") return `This proposal is already ${intent.state}.`;
    return this.store.transitionIntent(intent.id, "pending", "cancelled")
      ? "Proposal cancelled. Nothing was sent."
      : "Proposal state changed; no cancellation was applied.";
  }

  private authorizedIntent(message: VerifiedMessage, codeHash: string): Intent {
    const intent = this.store.intentForCode(codeHash);
    if (!intent || intent.senderId !== message.senderId || intent.conversationId !== message.conversationId) {
      throw new Error("Confirmation code not found for this X account and conversation.");
    }
    return intent;
  }

}
