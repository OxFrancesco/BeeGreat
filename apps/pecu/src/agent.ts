import type { AaveService } from "./integrations/aave";
import type { PolymarketService } from "./integrations/polymarket";
import type { WhopService } from "./integrations/whop";
import type { NansenEndpointName, NansenService } from "./integrations/nansen";
import type { SugarAction, SugarParameters } from "@beegreat/sugar/contracts";
import type { Config } from "./config";
import { aeroHelpText, BASE_USDC_ADDRESS, depositAmountPattern, helpText, nansenHelpText, parseCommand, parseNaturalWalletCommand, plannedCallSchema, type PlannedCall, type VerifiedMessage } from "./domain";
import type { AgentCapabilities, AgentHarness } from "./harness";
import { log } from "./logger";
import { validateIntentPlan } from "./policy";
import type { DepositRecord, DepositState, FundingAccount, Intent, IntentAction, PecuStore } from "./state";
import { AerodromeService } from "./aerodrome";
import type { EvmReadResult, EvmService, EvmTxAction } from "./evm";
import type { UserOperationOutcome, UserOperationReference } from "./receipt";
import { treasurySenderId, WalletService } from "./wallet";
import { whopDepositForwardSchema, whopLedgerActivitySchema } from "./whop-webhook";
import { aeroPlanText, aeroReadText, chatError, depositInstructionsText, evmPlanText, evmReadText, verbosePage } from "./chat";
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
  if (intent.family === "aero") return `Aerodrome ${actionLabel(intent.action)}`;
  if (intent.family === "deposit") return "Deposit relay";
  return `EVM ${actionLabel(intent.action)}`;
}

function usdToUsdcUnits(usd: string): bigint {
  const negative = usd.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? usd.slice(1) : usd).split(".");
  const units = BigInt(whole || "0") * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  return negative ? -units : units;
}

function usdcUnitsText(units: bigint): string {
  const whole = units / 1_000_000n;
  const fraction = (units % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

const depositHoldText: Record<string, string> = {
  over_limit: "above the automatic limit",
  daily_limit: "daily limit reached, retrying tomorrow",
  insufficient_treasury: "waiting for treasury funds",
  execution_locked: "transactions are paused",
  pending_settlement: "waiting for Whop to release the funds",
  risk_review: "under review at Whop",
  unsupported_currency: "currency not supported",
  unknown_account: "no matching wallet",
};

const terminalDepositHolds = new Set(["unknown_account", "unsupported_currency", "risk_review"]);

function depositStateText(deposit: DepositRecord): string {
  switch (deposit.state) {
    case "received": return "received, sending USDC…";
    case "relaying": return "sending USDC…";
    case "relayed": {
      const link = deposit.result?.match(/https:\/\/basescan\.org\/tx\/0x[0-9a-fA-F]{64}/)?.[0];
      const sent = deposit.relayUsdcUnits ? usdcUnitsText(BigInt(deposit.relayUsdcUnits)) : "?";
      return `sent ${sent} USDC${link ? ` ${link}` : ""}`;
    }
    case "held": return `on hold (${depositHoldText[deposit.holdReason ?? ""] ?? deposit.holdReason ?? "under review"})`;
    case "failed": return "failed; the team has been notified";
  }
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

type AgentWallets = Pick<WalletService, "balances" | "prepare" | "approve" | "transaction" | "usdcBalanceUnits"> & {
  getOrCreate(senderId: string): Promise<{ address: string }>;
};

export type UserOperationVerifier = (reference: UserOperationReference) => Promise<UserOperationOutcome>;

export type AgentServices = Readonly<{
  aave?: Pick<AaveService, "call" | "propose">;
  polymarket?: Pick<PolymarketService, "research">;
  whop?: Pick<WhopService, "createAccount" | "createDeposit">;
  nansen?: Pick<NansenService, "call">;
  aerodrome: Pick<AerodromeService, "run">;
  evm: Pick<EvmService, "tokenBalance" | "allowance" | "read" | "inspect" | "decode" | "propose">;
  verifyUserOperation: UserOperationVerifier;
}>;

export class PecuAgent {
  private readonly executing = new Set<string>();
  private readonly relayingDeposits = new Set<string>();

  constructor(
    private readonly config: Pick<Config, "enableMainnetExecution" | "maxSlippageBps" | "quoteTtlSeconds" | "depositRelayMaxUsd" | "depositRelayDailyMaxUsd">,
    private readonly store: PecuStore,
    private readonly wallets: AgentWallets,
    private readonly services: AgentServices,
    private readonly harness: AgentHarness,
  ) {}

  async resumeExecuting(): Promise<void> {
    if (!this.config.enableMainnetExecution) return;
    for (const intent of this.store.executingIntents()) await this.recoverIntent(intent);
  }

  private async recoverIntent(intent: Intent): Promise<void> {
    const depositId = intent.family === "deposit" ? intent.parameters.depositId : undefined;
    if (this.executing.has(intent.id) || (depositId !== undefined && this.relayingDeposits.has(depositId))) return;
    this.executing.add(intent.id);
    if (depositId !== undefined) this.relayingDeposits.add(depositId);
    try {
      const steps = this.store.steps(intent.id);
      if (steps.length === 0) {
        this.store.transitionIntent(intent.id, "executing", "failed", "Transaction plan was not persisted before shutdown");
        return;
      }
      try {
        const started = steps.some((step) => step.transactionId !== undefined);
        if (!started && Date.now() > intent.expiresAt) throw new Error("Transaction plan expired; recovery stopped");
        const calls = steps.map((step) => step.call);
        if (await planDigest(calls) !== intent.planDigest) {
          throw new Error("Persisted plan digest mismatch; recovery stopped");
        }
        const executor = intent.family === "deposit" ? treasurySenderId : intent.senderId;
        const wallet = await this.walletAddress(executor);
        validateIntentPlan(intent, wallet, calls);
        const links = await this.executeSteps(executor, intent.id, wallet, intent.expiresAt);
        const result = intent.family === "deposit"
          ? ["Deposit relay confirmed on Base mainnet.", ...links].join("\n")
          : [`Recovered and completed the interrupted ${familyLabel(intent)} action on Base.`, ...links].join("\n");
        this.store.transitionIntent(intent.id, "executing", "succeeded", result);
        if (intent.family === "deposit") this.depositRelaySucceeded(intent.id, result);
        log("info", "intent_recovered", { intentId: intent.id, action: intent.action, steps: steps.length });
      } catch (error) {
        if (isTransactionReadPermissionError(error)) {
          log("warn", "intent_recovery_permission_blocked", { intentId: intent.id });
          return;
        }
        if (error instanceof PendingInclusionError) {
          log("warn", "intent_recovery_pending", { intentId: intent.id, action: intent.action, hash: error.hash });
          return;
        }
        this.store.transitionIntent(intent.id, "executing", "failed", errorMessage(error));
        if (intent.family === "deposit") this.depositRelayFailed(intent.id, errorMessage(error));
        log("error", "intent_recovery_failed", { intentId: intent.id, action: intent.action, error: errorMessage(error) });
      }
    } finally {
      this.executing.delete(intent.id);
      if (depositId !== undefined) this.relayingDeposits.delete(depositId);
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
    if (message.senderId === treasurySenderId) throw new Error("This sender ID is reserved for the Pecu treasury.");
    if (!this.store.wallet(message.senderId)) await this.walletAddress(message.senderId);
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
    if (naturalWalletCommand?.type === "deposit") return this.depositReply(message);

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
      case "deposit": return this.depositReply(message, command.amount);
      case "deposit-setup": return this.depositSetup(message, command.email);
      case "deposit-status": return this.depositStatusReply(message);
      case "nansen-help": return nansenHelpText;
      case "nansen": return this.nansenReply(message, command.endpoint, command.input);
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
      depositInstructions: (amount) => this.depositReply(message, amount),
      depositSetup: (email) => this.depositSetup(message, email),
      depositStatus: async () => this.depositStatusReply(message),
      nansenCall: (endpoint, input) => this.nansenReply(message, endpoint, input),
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

  private async nansenReply(message: VerifiedMessage, endpoint: NansenEndpointName, input: unknown): Promise<string> {
    const nansen = this.services.nansen;
    if (!nansen) return "Nansen analytics is not configured yet.";
    const result = await nansen.call(endpoint, input, { wallet: await this.walletAddress(message.senderId) });
    this.saveDetails(message, result.data);
    return result.text;
  }

  private async depositReply(message: VerifiedMessage, amount?: string): Promise<string> {
    const whop = this.services.whop;
    if (!whop) return "Adding funds is not configured yet.";
    if (amount !== undefined && (!depositAmountPattern.test(amount) || Number(amount) < 10 || Number(amount) > 100_000)) {
      throw new Error("Usage: /deposit or /deposit 50 (USD, minimum 10)");
    }
    const account = this.store.fundingAccount(message.senderId);
    if (!account) {
      return "To add money by bank transfer or crypto, I need to set up a funding account with Whop for you. It needs an email address (Whop uses it for deposit receipts). Send /deposit setup you@example.com to continue.";
    }
    return this.depositInstructions(message, account, whop, amount);
  }

  private async depositSetup(message: VerifiedMessage, email: string): Promise<string> {
    const whop = this.services.whop;
    if (!whop) return "Adding funds is not configured yet.";
    let account = this.store.fundingAccount(message.senderId);
    if (!account) {
      const created = await whop.createAccount({
        email,
        title: `Pecu wallet ${message.senderId}`,
        metadata: { pecu_sender_id: message.senderId },
        idempotencyKey: `pecu-account-${message.senderId}`,
      });
      account = {
        senderId: message.senderId,
        whopAccountId: created.id,
        email,
        conversationId: message.conversationId,
        encodedEvent: message.encodedEvent,
      };
      this.store.saveFundingAccount(account);
    }
    return this.depositInstructions(message, account, whop);
  }

  private async depositInstructions(message: VerifiedMessage, account: FundingAccount, whop: Pick<WhopService, "createDeposit">, amount?: string): Promise<string> {
    this.store.touchFundingAccount(message.senderId, message.conversationId, message.encodedEvent);
    const deposit = await whop.createDeposit({
      destination: account.whopAccountId,
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
      idempotencyKey: `pecu-deposit-${message.eventId}`,
    });
    this.saveDetails(message, deposit);
    return depositInstructionsText(deposit, await this.walletAddress(message.senderId), this.config.depositRelayMaxUsd);
  }

  private depositStatusReply(message: VerifiedMessage): string {
    const deposits = this.store.depositsForSender(message.senderId, 5);
    if (deposits.length === 0) return "No deposits yet. Send /deposit to get your funding details.";
    return deposits.map((deposit) => `${new Date(deposit.createdAt).toISOString().slice(0, 10)} $${deposit.usdAmount ?? "?"} ${deposit.currency.toUpperCase()} · ${depositStateText(deposit)}`).join("\n");
  }

  recordWhopDeposit(input: unknown): { status: "recorded" | "duplicate" | "ignored"; depositId?: string } {
    const forwarded = whopDepositForwardSchema.parse(input);
    const activity = whopLedgerActivitySchema.parse(forwarded.data);
    const usd = activity.usd_amount;
    const usdUnits = usd !== null && /^-?\d+(?:\.\d+)?$/.test(usd) ? usdToUsdcUnits(usd) : undefined;
    if (usdUnits !== undefined && usdUnits <= 0n) return { status: "ignored" };
    const account = forwarded.accountId ? this.store.fundingAccountByWhopId(forwarded.accountId) : undefined;
    let state: DepositState = "received";
    let holdReason: string | undefined;
    if (usd === null || usdUnits === undefined) { state = "held"; holdReason = "unsupported_currency"; }
    else if (activity.source?.risk_review_hold === true) { state = "held"; holdReason = "risk_review"; }
    else if (!account) { state = "held"; holdReason = "unknown_account"; }
    const postedAt = Date.parse(activity.posted_at);
    const availableAt = activity.available_at === null ? undefined : Date.parse(activity.available_at);
    const inserted = this.store.recordDeposit({
      id: activity.id,
      webhookId: forwarded.webhookId,
      whopAccountId: forwarded.accountId ?? "",
      ...(account ? { senderId: account.senderId } : {}),
      amount: activity.amount,
      currency: activity.currency.code.toLowerCase(),
      precision: activity.currency.precision,
      ...(usd === null ? {} : { usdAmount: usd }),
      ...(availableAt !== undefined && !Number.isNaN(availableAt) ? { availableAt } : {}),
      state,
      ...(holdReason ? { holdReason } : {}),
      postedAt: Number.isNaN(postedAt) ? Date.now() : postedAt,
    });
    if (!inserted) return { status: "duplicate" };
    return { status: "recorded", depositId: activity.id };
  }

  async relayDeposit(depositId: string): Promise<void> {
    const deposit = this.store.deposit(depositId);
    if (deposit) await this.evaluateDeposit(deposit);
  }

  async relayPendingDeposits(): Promise<void> {
    if (this.config.enableMainnetExecution) {
      for (const intent of this.store.executingIntents()) {
        if (intent.family === "deposit") await this.recoverIntent(intent);
      }
    }
    for (const deposit of this.store.pendingDeposits()) {
      if (deposit.holdReason !== undefined && terminalDepositHolds.has(deposit.holdReason)) continue;
      if (deposit.state === "held" && deposit.holdReason === "insufficient_treasury" && Date.now() - deposit.updatedAt < 10 * 60_000) continue;
      try {
        await this.evaluateDeposit(deposit);
      } catch (error) {
        log("error", "deposit_relay_failed", { depositId: deposit.id, error: errorMessage(error) });
      }
    }
  }

  async depositAdminSummary(): Promise<{ treasury: { address: string; usdc: string }; deposits: DepositRecord[] }> {
    const wallet = await this.wallets.getOrCreate(treasurySenderId);
    const units = await this.wallets.usdcBalanceUnits(treasurySenderId);
    return { treasury: { address: wallet.address, usdc: usdcUnitsText(units) }, deposits: this.store.recentDeposits(50) };
  }

  async forceRelay(depositId: string): Promise<DepositRecord | undefined> {
    const deposit = this.store.deposit(depositId);
    if (!deposit) return undefined;
    if (deposit.state === "held" && ["over_limit", "daily_limit", "insufficient_treasury", "execution_locked"].includes(deposit.holdReason ?? "")) {
      await this.evaluateDeposit(deposit, true);
    }
    return this.store.deposit(depositId);
  }

  private async evaluateDeposit(deposit: DepositRecord, ignoreCaps = false): Promise<void> {
    if (deposit.state !== "received" && deposit.state !== "held") return;
    if (deposit.holdReason !== undefined && terminalDepositHolds.has(deposit.holdReason)) return;
    const holdReason = await this.depositHoldReason(deposit, ignoreCaps);
    if (holdReason) {
      const changed = this.store.transitionDeposit(deposit.id, deposit.state, "held", { holdReason });
      if (changed && (deposit.state === "received" || deposit.holdReason !== holdReason) && !terminalDepositHolds.has(holdReason)) {
        this.notifyDeposit(this.store.deposit(deposit.id) ?? deposit, this.depositHoldNotice(deposit, holdReason));
      }
      return;
    }
    if (!deposit.senderId || !deposit.usdAmount || this.relayingDeposits.has(deposit.id)) return;
    const account = this.store.fundingAccount(deposit.senderId);
    if (!account) return;
    const units = usdToUsdcUnits(deposit.usdAmount);
    const recipient = await this.walletAddress(deposit.senderId);
    const treasury = await this.walletAddress(treasurySenderId);
    const action = {
      family: "deposit",
      action: "deposit_relay",
      parameters: { depositId: deposit.id, recipient, usdcUnits: units.toString(), whopAccountId: deposit.whopAccountId },
    } as const;
    const call: PlannedCall = {
      role: "action",
      from: treasury,
      to: BASE_USDC_ADDRESS,
      data: `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64, "0")}${units.toString(16).padStart(64, "0")}`,
      value: "0",
    };
    validateIntentPlan(action, treasury, [call]);
    const intentId = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1_000;
    this.store.createIntent({
      id: intentId,
      codeHash: await digest(intentId),
      senderId: deposit.senderId,
      conversationId: account.conversationId,
      sourceEventId: `deposit:${deposit.id}`,
      state: "executing",
      ...action,
      preview: `Send ${usdcUnitsText(units)} USDC to ${recipient} for Whop deposit ${deposit.id}`,
      planDigest: await planDigest([call]),
      expiresAt,
    }, [call]);
    if (!this.store.transitionDeposit(deposit.id, deposit.state, "relaying", { intentId, relayUsdcUnits: units.toString() })) return;
    this.relayingDeposits.add(deposit.id);
    try {
      const links = await this.executeSteps(treasurySenderId, intentId, treasury, expiresAt);
      const result = ["Deposit relay confirmed on Base mainnet.", ...links].join("\n");
      this.store.transitionIntent(intentId, "executing", "succeeded", result);
      this.depositRelaySucceeded(intentId, result);
    } catch (error) {
      if (!(error instanceof PendingInclusionError)) {
        const failed = this.store.steps(intentId).find((step) => step.state !== "succeeded");
        if (failed) this.store.markStepFailed(intentId, failed.position, errorMessage(error));
        this.store.transitionIntent(intentId, "executing", "failed", errorMessage(error));
        log("error", "deposit_relay_failed", { depositId: deposit.id, error: errorMessage(error) });
        this.depositRelayFailed(intentId, errorMessage(error));
      } else {
        log("warn", "deposit_relay_pending", { depositId: deposit.id });
      }
    } finally {
      this.relayingDeposits.delete(deposit.id);
    }
  }

  private async depositHoldReason(deposit: DepositRecord, ignoreCaps: boolean): Promise<string | undefined> {
    if (!this.config.enableMainnetExecution) return "execution_locked";
    if (!["usd", "usdc", "usdt"].includes(deposit.currency) || !deposit.usdAmount) return "unsupported_currency";
    if (!deposit.senderId) return "unknown_account";
    if (deposit.availableAt !== undefined && deposit.availableAt > Date.now()) return "pending_settlement";
    const units = usdToUsdcUnits(deposit.usdAmount);
    if (!ignoreCaps) {
      if (units > BigInt(this.config.depositRelayMaxUsd) * 1_000_000n) return "over_limit";
      if (this.store.relayedUsdcUnitsSince(Date.now() - 24 * 60 * 60 * 1_000) + units > BigInt(this.config.depositRelayDailyMaxUsd) * 1_000_000n) return "daily_limit";
    }
    if (await this.wallets.usdcBalanceUnits(treasurySenderId) < units) return "insufficient_treasury";
    return undefined;
  }

  private depositHoldNotice(deposit: DepositRecord, reason: string): string {
    const usd = deposit.usdAmount ?? "?";
    if (reason === "pending_settlement") return `Your deposit of $${usd} was received. Pecu will send USDC to your wallet once Whop releases the funds.`;
    if (reason === "over_limit") return `Your deposit of $${usd} arrived and is above the automatic limit of $${this.config.depositRelayMaxUsd}. It is waiting for a manual review.`;
    return `Your deposit of $${usd} arrived and is on hold (${depositHoldText[reason] ?? reason}). It will be retried automatically.`;
  }

  private depositRelaySucceeded(intentId: string, result: string): void {
    const deposit = this.store.depositForIntent(intentId);
    if (!deposit) return;
    this.store.transitionDeposit(deposit.id, "relaying", "relayed", { result });
    const updated = this.store.deposit(deposit.id) ?? deposit;
    const link = result.match(/https:\/\/basescan\.org\/tx\/0x[0-9a-fA-F]{64}/)?.[0];
    const sent = updated.relayUsdcUnits ? `${usdcUnitsText(BigInt(updated.relayUsdcUnits))} USDC` : "USDC";
    this.notifyDeposit(updated, `Your deposit of $${deposit.usdAmount ?? "?"} arrived. I sent ${sent} to your Base wallet.${link ? `\n${link}` : ""}`);
  }

  private depositRelayFailed(intentId: string, message: string): void {
    const deposit = this.store.depositForIntent(intentId);
    if (!deposit) return;
    this.store.transitionDeposit(deposit.id, "relaying", "failed", { result: message });
    const updated = this.store.deposit(deposit.id) ?? deposit;
    this.notifyDeposit(updated, `Your deposit of $${deposit.usdAmount ?? "?"} arrived but sending USDC failed. The team has been notified; nothing further is needed from you.`);
  }

  private notifyDeposit(deposit: DepositRecord, text: string): void {
    const account = this.store.fundingAccountByWhopId(deposit.whopAccountId);
    if (!account || account.encodedEvent === "") return;
    this.store.enqueueReply(`deposit:${deposit.id}:${deposit.state}:${deposit.holdReason ?? ""}`, account.conversationId, account.encodedEvent, text);
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
    if (intent.family === "deposit") return "This is an automatic deposit relay and cannot be confirmed or cancelled here.";
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
    if (intent.family === "deposit") return "This is an automatic deposit relay and cannot be confirmed or cancelled here.";
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
