import { STOCKS } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import { z } from "zod";
import { jsonFieldsSchema, type JsonInput, type JsonFields } from "./json-contract";
import { projectPolymarket, polymarketModelOutput, polymarketDiscovery } from "./integrations/polymarket/model-output";
import { polymarketRead } from "./integrations/polymarket/client";
import { polymarketEndpoints, polymarketEndpointNames, type PolymarketEndpointName } from "./integrations/polymarket/catalog.generated";
import { polymarketText } from "./integrations/polymarket/presentation";
import { polymarketAnalytics } from "./integrations/polymarket/analytics";
import type { LiquidityRequest } from "./liquidity-contract";
import { stocksSchema, type StockTrade } from "./stock-contract";
import type { AgentAnalytics, AgentAnalyticsEvent } from "./analytics";
import type { AaveService } from "./integrations/aave";
import type { PolymarketService } from "./integrations/polymarket";
import type { WhopService } from "./integrations/whop";
import { nansenQuerySchema, type NansenQuery, type NansenEndpointName, type NansenService } from "./integrations/nansen";
import type { SugarAction, SugarParameters } from "@beegreat/sugar/contracts";
import type { Config } from "./config";
import { aeroHelpText, BASE_USDC_ADDRESS, depositAmountPattern, helpText, nansenHelpText, parseCommand, parseNaturalWalletCommand, type PlannedCall, type VerifiedMessage } from "./domain";
import { digest, planDigest } from "./plan-digest";
import type { AgentCapabilities, AgentHarness } from "./harness";
import { log } from "./logger";
import { executeSteps, type OutcomeUnknown, type InclusionPending, type Reverted, type StepFailed } from "./execution";
import { requiresExplicitConfirmation, validateIntentPlan } from "./policy";
import type { DepositRecord, DepositState, FundingAccount, Intent, IntentAction, PecuStore } from "./state";
import { AerodromeService } from "./aerodrome";
import type { EvmReadResult, EvmService, EvmTxAction } from "./evm";
import type { SafeReadCommand } from "./safe";
import type { UserOperationOutcome, UserOperationReference } from "./receipt";
import { treasurySenderId, WalletService } from "./wallet";
import { isWebConversation } from "./web-identity";
import { whopDepositForwardSchema, whopLedgerActivitySchema } from "./whop-webhook";
import { aeroPlanText, aeroReadText, chatError, depositInstructionsText, evmPlanText, evmReadText, verbosePage } from "./chat";
import { planSummary, tokenHints, transactionPlan } from "./transaction-plan";
import { isTransactionReadPermissionError } from "./wallet-errors";
import type { RequestClassifier, RequestRoute } from "./request-classifier";
import { turnTraceIdentity, turnTrace } from "./turn-trace";
import type { ParagraphSink } from "./web-stream";
import { analyticsText, type PnlSnapshot } from "./analytics-contract";

/** 32 symbols without I, O, 0, 1; 256 is a multiple of 32 so a byte modulo stays uniform. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function confirmationCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]!).join("");
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function actionLabel(action: string): string {
  return action.replaceAll("_", " ");
}

function familyLabel(intent: IntentAction): string {
  if (intent.family === "aave") return `Aave ${intent.parameters.stage === "approval" ? "token approval" : intent.parameters.action}`;
  if (intent.family === "aero") return `Aerodrome ${actionLabel(intent.action)}`;
  if (intent.family === "liquidity") return "Aerodrome liquidity";
  if (intent.family === "stocks") return "Stock trades";
  if (intent.family === "deposit") return "Deposit relay";
  if (intent.action === "safe_create") return "Organization wallet creation";
  if (intent.action === "safe_approve") return "Your organization wallet approval";
  if (intent.action === "safe_budget_spend") return "Organization budget payment";
  if (intent.action === "safe_role_execute") return "Organization role transaction";
  if (intent.action === "safe_roles_deploy") return "Organization permissions module";
  if (intent.action === "safe_passkey_deploy") return "Organization passkey signer";
  if (intent.action === "safe_execute_signatures") return "Organization wallet transaction";
  if (intent.action === "safe_execute") return "Organization wallet transaction";
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

const depositHoldText = new Map(Object.entries({
  over_limit: "above the automatic limit",
  daily_limit: "daily limit reached, retrying tomorrow",
  insufficient_treasury: "waiting for treasury funds",
  execution_locked: "transactions are paused",
  pending_settlement: "waiting for Whop to release the funds",
  risk_review: "under review at Whop",
  unsupported_currency: "currency not supported",
  unknown_account: "no matching wallet",
}));

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
    case "held": return `on hold (${depositHoldText.get(deposit.holdReason ?? "") ?? deposit.holdReason ?? "under review"})`;
    case "failed": return "failed; the team has been notified";
  }
}

function explorerLink(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

export type AgentWallets = Pick<WalletService, "balances" | "prepareBatch" | "prepare" | "approve" | "transaction" | "usdcBalanceUnits"> & {
  getOrCreate(senderId: string): Promise<{ address: string }>;
};

export type UserOperationVerifier = (reference: UserOperationReference) => Promise<UserOperationOutcome>;

export type AgentServices = Readonly<{
  analytics?: AgentAnalytics;
  aave?: Pick<AaveService, "call" | "propose">;
  polymarket?: Pick<PolymarketService, "research">;
  polymarketRead?: typeof polymarketRead;
  whop?: Pick<WhopService, "createAccount" | "createDeposit">;
  nansen?: Pick<NansenService, "call">;
  aerodrome: Pick<AerodromeService, "run" | "basket" | "liquidity">;
  evm: Pick<EvmService, "tokenBalance" | "allowance" | "read" | "inspect" | "decode" | "propose" | "safeRead">;
  verifyUserOperation: UserOperationVerifier;
  safeQueue?: Readonly<{
    share(senderId: string, command: SafeReadCommand, output: JsonInput): Promise<void>;
    pending(senderId: string, safe: string): Promise<JsonInput>;
  }>;
  /** The linked wallet a web thread acts with; absent means the Pecu wallet. */
  linkedWallets?: Readonly<{ signer(senderId: string, conversationId: string): `0x${string}` | undefined }>;
}>;

export class PecuAgent {
  private readonly pendingPolymarketReads = new Map<string, Promise<string>>();
  private readonly previewOnly = new Set<string>();
  private readonly executing = new Set<string>();
  private readonly relayingDeposits = new Set<string>();

  constructor(
    private readonly config: Pick<Config, "enableMainnetExecution" | "maxSlippageBps" | "quoteTtlSeconds" | "depositRelayMaxUsd" | "depositRelayDailyMaxUsd">,
    private readonly store: PecuStore,
    private readonly wallets: AgentWallets,
    private readonly services: AgentServices,
    private readonly harness: AgentHarness,
    private readonly classifier?: RequestClassifier,
  ) {}

  private track(senderId: string, event: AgentAnalyticsEvent): void {
    try {
      this.services.analytics?.(senderId, event);
    } catch {
      log("warn", "analytics_delivery_failed", {});
    }
  }

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
      // A linked wallet signs its own plan; its web client resumes it and Base settles it.
      if (intent.signer) return;
      const executor = intent.family === "deposit" ? treasurySenderId : intent.senderId;
      let wallet: `0x${string}`;
      try {
        const started = steps.some((step) => step.transactionId !== undefined);
        if (!started && Date.now() > intent.expiresAt) throw new Error("Transaction plan expired; recovery stopped");
        const calls = steps.map((step) => step.call);
        if (await planDigest(calls) !== intent.planDigest) {
          throw new Error("Persisted plan digest mismatch; recovery stopped");
        }
        wallet = await this.walletAddress(executor);
        validateIntentPlan(intent, wallet, calls);
      } catch (error) {
        this.store.transitionIntent(intent.id, "executing", "failed", errorMessage(error));
        if (intent.family === "deposit") this.depositRelayFailed(intent.id, errorMessage(error));
        log("error", "intent_recovery_failed", { intentId: intent.id, action: intent.action, error: errorMessage(error) });
        return;
      }
      const run = await this.runSteps(executor, intent, wallet);
      switch (run.outcome) {
        case "succeeded": {
          const links = run.hashes.map(explorerLink);
          const result = intent.family === "deposit"
            ? ["Deposit relay confirmed on Base mainnet.", ...links].join("\n")
            : [`Recovered and completed the interrupted ${familyLabel(intent)} action on Base.`, ...links].join("\n");
          this.store.transitionIntent(intent.id, "executing", "succeeded", result);
          if (intent.family === "deposit") this.depositRelaySucceeded(intent.id, result);
          log("info", "intent_recovered", { intentId: intent.id, action: intent.action, steps: steps.length });
          return;
        }
        case "unsettled":
          log("warn", "intent_recovery_unsettled", { intentId: intent.id, action: intent.action, failure: run.failure._tag, hash: run.failure.hash || undefined });
          return;
        case "failed":
          this.failIntent(intent.id, run.failure);
          if (intent.family === "deposit") this.depositRelayFailed(intent.id, run.failure.message);
          log("error", "intent_recovery_failed", { intentId: intent.id, action: intent.action, error: run.failure.message });
          return;
      }
    } finally {
      this.executing.delete(intent.id);
      if (depositId !== undefined) this.relayingDeposits.delete(depositId);
    }
  }

  async handle(message: VerifiedMessage, retryUnanswered = false, progress?: ParagraphSink): Promise<string | undefined> {
    const trace = await turnTraceIdentity(message.senderId, message.eventId, message.conversationId);
    trace.record = span => this.track(message.senderId, span);
    return turnTrace.run(trace, () => this.handleTurn(message, retryUnanswered, progress));
  }

  private async handleTurn(message: VerifiedMessage, retryUnanswered: boolean, progress?: ParagraphSink): Promise<string | undefined> {
    const claim = this.store.claimEvent(
      message.eventId,
      message.conversationId,
      message.senderId,
      retryUnanswered,
    );
    if (claim === "completed") return this.store.eventReply(message.eventId);
    if (claim === "busy") return undefined;
    const startedAt = Date.now();
    progress?.stage?.({ id: "routing", label: "Understanding your request", startedAt, status: "running" });
    const trace = turnTrace.getStore()!;
    progress?.trace?.(trace.traceId);
    const correlation = { $ai_trace_id: trace.traceId, $ai_session_id: trace.sessionId };
    let firstAnswer: number | undefined;
    let failed = false;
    const sink: ParagraphSink | undefined = progress ? text => { firstAnswer ??= Date.now(); progress(text); } : undefined;
    if (sink) { sink.live = progress?.live; sink.stage = progress?.stage; }
    const channel = message.conversationId.startsWith("stocks:") ? "web" : "x";
    this.track(message.senderId, { event: "pecu_message_received", channel, ...correlation });
    try {
      const answeringQuestion = message.retryContext === undefined && !message.replyConfirmationCode && !/^(?:b)?\//.test(message.text.trim()) && this.store.answerPendingQuestion(message);
      if (message.retryContext !== undefined || answeringQuestion) this.previewOnly.add(message.eventId);
      if (answeringQuestion && /^cancel$/i.test(message.text.trim())) {
        const reply = "Cancelled. No new transaction was sent.";
        this.store.completeEvent(message.eventId, reply);
        this.track(message.senderId, { event: "pecu_message_completed", channel, ...correlation, duration_ms: Date.now() - startedAt });
        return reply;
      }
      const reply = await this.execute(message, sink);
      this.store.completeEvent(message.eventId, reply);
      this.track(message.senderId, { event: "pecu_message_completed", channel, ...correlation, duration_ms: Date.now() - startedAt });
      return reply;
    } catch (error) {
      failed = true;
      const reply = chatError(error);
      this.store.completeEvent(message.eventId, reply);
      log("warn", "command_failed", { eventId: message.eventId, senderId: message.senderId, error: errorMessage(error) });
      this.track(message.senderId, { event: "pecu_message_failed", channel, ...correlation, duration_ms: Date.now() - startedAt });
      return reply;
    } finally {
      const endedAt = Date.now();
      this.track(message.senderId, { event: "$ai_trace", timestamp: endedAt, ...correlation,
        $ai_span_name: "Pecu request", $ai_latency: (endedAt - startedAt) / 1000, $ai_is_error: failed,
        started_at: startedAt, ended_at: endedAt, first_answer_ms: firstAnswer === undefined ? endedAt - startedAt : firstAnswer - startedAt });
      this.previewOnly.delete(message.eventId);
    }
  }

  private async execute(message: VerifiedMessage, progress?: ParagraphSink): Promise<string> {
    if (message.senderId === treasurySenderId) throw new Error("This sender ID is reserved for the Pecu treasury.");
    if (!this.store.wallet(message.senderId)) {
      await this.walletAddress(message.senderId);
      this.track(message.senderId, { event: "pecu_wallet_provisioned" });
    }
    if (/^(?:confirm|cancel)$/i.test(message.text.trim())) {
      if (!message.replyConfirmationCode) return 'Reply to the transaction preview with "confirm" or "cancel", or use the code shown in that preview.';
      const codeHash = await digest(message.replyConfirmationCode);
      return message.text.trim().toLowerCase() === "confirm" ? this.confirm(message, codeHash) : this.cancel(message, codeHash);
    }
    const naturalWalletCommand = message.text.trim().startsWith("/")
      ? undefined
      : parseNaturalWalletCommand(message.text);
    if (naturalWalletCommand?.type === "aero") return this.runAero(message, naturalWalletCommand.action, naturalWalletCommand.parameters);
    if (naturalWalletCommand?.type === "wallet") return this.walletReply(message);
    if (naturalWalletCommand?.type === "balance") return this.balanceReply(message);
    if (naturalWalletCommand?.type === "deposit") return this.depositReply(message);

    let command;
    try {
      command = parseCommand(message.text);
    } catch (error) {
      if (/^(?:b)?\//i.test(message.text.trim())) throw error;
      try {
        // Wake the user's runtime while the classifier chooses the route.
        const routingStartedAt = Date.now();
        const warming = this.harness.warm?.(message.senderId).catch(() => undefined);
        const route: RequestRoute = this.previewOnly.has(message.eventId)
          ? { kind: "fallback" }
          : await this.classifier?.classify(message.text) ?? { kind: "fallback" };
        const routingEnd = Date.now();
        const trace = turnTrace.getStore();
        trace?.record?.({ event: "$ai_span", timestamp: routingEnd, started_at: routingStartedAt, ended_at: routingEnd,
          $ai_trace_id: trace.traceId, $ai_session_id: trace.sessionId, $ai_span_id: `${trace.traceId}_routing`,
          $ai_span_name: "Request routing", $ai_latency: (routingEnd - routingStartedAt) / 1000, $ai_is_error: false });
        log("info", "request_routed", { eventId: message.eventId, route: route.kind, command: route.kind === "command" ? route.command : undefined });
        if (route.kind === "command") {
          switch (route.command) {
            case "wallet": return this.walletReply(message);
            case "balance": return this.balanceReply(message);
            case "stocks": return this.runAero(message, "stocks", {});
            case "positions": return this.runAero(message, "positions", {});
            case "deposit_status": return this.depositStatusReply(message);
            case "help": return helpText;
          }
        }
        const mode = (route.kind === "mixed" || route.kind === "fallback") && route.family ? { kind: route.kind, family: route.family } : route.kind === "response" || route.kind === "mixed" ? route.kind : undefined;
        await warming;
        progress?.stage?.({ id: "routing", label: "Understanding your request", startedAt: routingStartedAt, endedAt: Date.now(), status: "complete" });
        const response = await this.harness.respond(message, this.capabilitiesFor(message), mode, progress);
        return this.questionText(message.eventId) ?? response;
      } catch (error) {
        const question = this.questionText(message.eventId);
        if (question) return question;
        throw error;
      }
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
      case "polymarket-help": return "Ask about Polymarket in chat, or search with /polymarket QUESTION. Advanced reads: /polymarket read ENDPOINT JSON.\n" + polymarketEndpointNames.map(name => `${name}: ${polymarketEndpoints[name].description.split(". ")[0]}`).join("\n");
      case "polymarket-read": return this.polymarketReadReply(message, command.endpoint, command.input, false);
      case "aero-help": return aeroHelpText;
      case "wallet": return this.walletReply(message);
      case "balance": return this.balanceReply(message);
      case "confirm": return this.confirm(message, await digest(command.code));
      case "cancel": return this.cancel(message, await digest(command.code));
      case "token": return this.readReply(message, await this.services.evm.tokenBalance(await this.actingWallet(message), command.token));
      case "allowance": return this.readReply(message, await this.services.evm.allowance(await this.actingWallet(message), command.token, command.spender));
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
    const wallet = () => this.actingWallet(message);
    const trace = turnTrace.getStore();
    const bound = <Args extends unknown[]>(fn: (...args: Args) => Promise<string>) => (...args: Args) =>
      trace ? turnTrace.run(trace, () => fn(...args)) : fn(...args);
    const capabilities: AgentCapabilities = {
      askUser: async (question, options) => this.askUser(message, question, options),
      yoloEnabled: () => !this.previewOnly.has(message.eventId) && this.store.yoloEnabled(message.senderId, message.conversationId),
      aaveCall: (name, args) => this.runAave(message, name, args),
      polymarketResearch: (query) => this.polymarketReply(message, query),
      polymarketRead: (endpoint, input) => this.polymarketReadReply(message, endpoint, input, true),
      walletAddress: () => this.walletReply(message),
      walletBalances: () => this.balanceReply(message),
      aeroRead: (action, parameters) => this.runAero(message, action, parameters),
      aeroPropose: (action, parameters) => this.runAero(message, action, parameters),
      liquidity: (request) => this.runLiquidity(message, request),
      stockTrades: (trades, slippage) => this.runStockBasket(message, trades, slippage),
      evmToken: async (token) => this.readReply(message, await this.services.evm.tokenBalance(await wallet(), token)),
      evmAllowance: async (token, spender) => this.readReply(message, await this.services.evm.allowance(await wallet(), token, spender)),
      evmRead: async (input) => this.readReply(message, await this.services.evm.read(input)),
      evmInspect: async (input) => this.readReply(message, await this.services.evm.inspect(input)),
      evmDecode: async (input) => this.readReply(message, await this.services.evm.decode(input)),
      safeRead: async (command, input) => {
        const result = await this.services.evm.safeRead(command, input);
        this.saveDetails(message, result.output);
        try {
          await this.services.safeQueue?.share(message.senderId, command, result.output);
        } catch (error) {
          log("warn", "safe_queue_share_failed", { command, error: errorMessage(error) });
        }
        return JSON.stringify(result.output);
      },
      safeQueue: async (safe) => {
        if (!this.services.safeQueue) throw new Error("The shared Safe queue isn't available.");
        const view = await this.services.safeQueue.pending(message.senderId, safe);
        this.saveDetails(message, view);
        return JSON.stringify(view);
      },
      evmPropose: (action, parameters) => this.runEvm(message, action, parameters),
      depositInstructions: (amount) => this.depositReply(message, amount),
      depositSetup: (email) => this.depositSetup(message, email),
      depositStatus: async () => this.depositStatusReply(message),
      nansenCall: (endpoint, input) => this.nansenReply(message, endpoint, input),
    };
    return { ...capabilities,
      aeroRead: bound(capabilities.aeroRead), aeroPropose: bound(capabilities.aeroPropose),
      liquidity: bound(capabilities.liquidity), stockTrades: bound(capabilities.stockTrades),
    };
  }

  private askUser(message: VerifiedMessage, question: string, options: readonly string[] = []): string {
    if (this.store.intentForSource(message.eventId)) throw new Error("A transaction preview already exists. Return its confirmation controls before asking another question.");
    const existing = this.questionText(message.eventId);
    if (existing) return existing;
    this.store.saveQuestion(message, { question: question.trim(), options: [...options] });
    return this.questionText(message.eventId)!;
  }

  private questionText(eventId: string): string | undefined {
    const question = this.store.questionForEvent(eventId);
    if (!question) return undefined;
    return question.question + (question.options.length ? "\n\n" + question.options.map((option, index) => `${index + 1}. ${option}`).join("\n") : "");
  }

  private requireAnswer(message: VerifiedMessage): void {
    if (this.store.questionForEvent(message.eventId)) throw new Error("Wait for the user's reply before preparing another transaction.");
  }

  private async walletAddress(senderId: string): Promise<`0x${string}`> {
    const stored = this.store.wallet(senderId)?.address;
    const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
    const cached = address.safeParse(stored);
    if (cached.success) return cached.data;
    const wallet = await this.wallets.getOrCreate(senderId);
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address)) throw new Error("Wallet address is not a valid Base address");
    return address.parse(wallet.address);
  }

  /** The linked wallet chosen for this web thread, if any. X Chat and profile actions always use the Pecu wallet. */
  private linkedWallet(message: VerifiedMessage): `0x${string}` | undefined {
    return isWebConversation(message.conversationId) ? this.services.linkedWallets?.signer(message.senderId, message.conversationId) : undefined;
  }

  /** The wallet reads and plans use in this conversation. */
  private async actingWallet(message: VerifiedMessage): Promise<`0x${string}`> {
    return this.linkedWallet(message) ?? this.walletAddress(message.senderId);
  }

  private async walletReply(message: VerifiedMessage): Promise<string> {
    const linked = this.linkedWallet(message);
    const address = linked ?? await this.walletAddress(message.senderId);
    this.saveDetails(message, linked ? { address, chain: 8453, linked: true } : { address, chain: 8453 });
    return linked ? `This thread uses your linked wallet:\n${address}` : `Your Base wallet:\n${address}`;
  }

  private async balanceReply(message: VerifiedMessage): Promise<string> {
    const linked = this.linkedWallet(message);
    if (linked) {
      const results = await Promise.all(["ETH", "USDC", "AERO"].map((token) => this.services.evm.tokenBalance(linked, token)));
      this.saveDetails(message, results.map((result) => result.output));
      return results.map(evmReadText).join("\n");
    }
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

  private saveDetails(message: VerifiedMessage, value: JsonInput): void {
    this.store.saveChatDetails(message.senderId, message.conversationId, JSON.stringify(value, null, 2) ?? "null");
  }

  private async runAero(message: VerifiedMessage, action: SugarAction, parameters: SugarParameters): Promise<string> {
    const wallet = await this.actingWallet(message);
    this.requireAnswer(message);
    let result;
    try {
      result = await this.services.aerodrome.run(wallet, action, parameters);
    } catch (error) {
      if (action !== "stock_buy" || !/insufficient USDC\b/i.test(errorMessage(error))) throw error;
      return this.insufficientUsdcReply(message);
    }
    this.saveDetails(message, result.kind === "read" ? result.output : result);
    if (result.kind === "read") {
      if (result.action === "stocks") {
        const stocks = stocksSchema.safeParse(result.output);
        if (stocks.success) this.store.saveStockSnapshot(message.eventId, { stocks: stocks.data, observedAt: Date.now() });
      }
      return aeroReadText(result.action, result.output);
    }
    if (result.kind === "unchanged") {
      return "Your index already matches these allocations. No transaction plan was created.";
    }
    return this.persistProposal(message, wallet, { family: "aero", action: result.action, parameters: result.parameters }, result.calls, aeroPlanText(result), result.context);
  }

  private async insufficientUsdcReply(message: VerifiedMessage): Promise<string> {
    const balances = await this.balanceReply(message);
    const tokens = balances.split("\n").flatMap((line) => {
      const match = /^([A-Za-z0-9]+):\s*(\d+(?:\.\d+)?)$/.exec(line.trim());
      return match && match[1] !== "USDC" && /[1-9]/.test(match[2]!) ? [match[1]!] : [];
    });
    const question = tokens.length
      ? `You don't have enough USDC for this stock purchase.\n\n${balances}\n\nWould you like to swap one of your tokens to USDC to fund it? Choose a token, deposit USDC, or cancel. A quote is needed to check how much it can cover and leave ETH for fees.`
      : "You don't have enough USDC for this stock purchase, and I found no other funded tokens in the wallet balance list. Would you like to deposit USDC, check another token, or cancel?";
    return this.askUser(message, question, [...tokens, "Deposit USDC", "Cancel"]);
  }

  private async runLiquidity(message: VerifiedMessage, request: LiquidityRequest): Promise<string> {
    this.requireAnswer(message);
    if (this.linkedWallet(message)) throw new Error("Liquidity funding batches currently require your Pecu smart wallet. Select Pecu wallet in this thread to prepare the complete batch. No transaction was prepared.");
    const wallet = await this.actingWallet(message);
    const result = await this.services.aerodrome.liquidity(wallet, request);
    this.saveDetails(message, result);
    return this.persistProposal(message, wallet, { family: "liquidity", action: "liquidity_budget", parameters: result.parameters }, result.calls, result.preview, { tokens: result.tokens });
  }

  private async runStockBasket(message: VerifiedMessage, trades: readonly StockTrade[], slippage?: number): Promise<string> {
    const wallet = await this.actingWallet(message);
    this.requireAnswer(message);
    let result;
    try {
      result = await this.services.aerodrome.basket(wallet, trades, slippage);
    } catch (error) {
      if (!/insufficient USDC\b/i.test(errorMessage(error))) throw error;
      return this.insufficientUsdcReply(message);
    }
    this.saveDetails(message, { ...result });
    return this.persistProposal(message, wallet, { family: "stocks", action: "stock_basket", parameters: result.parameters }, result.calls, aeroPlanText(result), result.context);
  }

  private async runEvm(message: VerifiedMessage, action: EvmTxAction, parameters: JsonInput): Promise<string> {
    return (await this.proposeAction(message, action, parameters)).text;
  }

  async proposeAction(message: VerifiedMessage, action: EvmTxAction, parameters: JsonInput): Promise<{ text: string; context: Readonly<JsonFields> }> {
    const wallet = await this.actingWallet(message);
    const result = await this.services.evm.propose(wallet, action, parameters);
    this.saveDetails(message, { ...result });
    const text = await this.persistProposal(message, wallet, { family: "evm", action: result.action, parameters: result.parameters }, result.calls, evmPlanText(result), result.context);
    return { text, context: result.context };
  }

  private async runAave(message: VerifiedMessage, name: string, args: JsonFields): Promise<string> {
    if (!this.services.aave) throw new Error("Aave is not configured yet.");
    const wallet = await this.actingWallet(message);
    if (name === "prepare_action") {
      const plan = await this.services.aave.propose(args, wallet);
      this.saveDetails(message, plan.details);
      return this.persistProposal(message, wallet, { family: "aave", action: "aave_action", parameters: plan.parameters }, plan.calls, plan.preview, plan.details);
    }
    const result = await this.services.aave.call(name, args, wallet);
    this.saveDetails(message, result);
    return JSON.stringify(result);
  }

  private async polymarketReadReply(message: VerifiedMessage, endpoint: PolymarketEndpointName, input: JsonInput, structured: boolean): Promise<string> {
    const key = JSON.stringify([message.senderId, message.conversationId, message.eventId, endpoint, input, structured]);
    const pending = this.pendingPolymarketReads.get(key);
    if (pending) return pending;
    const read = this.fetchPolymarketReply(message, endpoint, input, structured);
    this.pendingPolymarketReads.set(key, read);
    try { return await read; }
    finally { this.pendingPolymarketReads.delete(key); }
  }

  private async fetchPolymarketReply(message: VerifiedMessage, endpoint: PolymarketEndpointName, input: JsonInput, structured: boolean): Promise<string> {
    const result = await (this.services.polymarketRead ?? polymarketRead)(endpoint, input);
    this.saveDetails(message, { ...result });
    const projected = projectPolymarket(result, input);
    this.store.savePolymarketTokens(message.eventId, projected.tokens);
    const args = jsonFieldsSchema.safeParse(input).data ?? {};
    const tokenId = z.string().safeParse(args.token_id);
    const selected = tokenId.success ? this.store.polymarketToken(message.eventId, tokenId.data) : undefined;
    const snapshot = structured && polymarketDiscovery(endpoint) ? undefined : polymarketAnalytics(args, result, selected);
    const text = snapshot && analyticsText(snapshot);
    if (snapshot && text) this.store.saveAnalytics(message.eventId, { snapshot, text });
    return structured ? polymarketModelOutput(result, projected.data) : text || polymarketText(result);
  }

  private async polymarketReply(message: VerifiedMessage, query?: string): Promise<string> {
    if (!this.services.polymarket) throw new Error("Polymarket research is not configured yet.");
    const result = await this.services.polymarket.research(`${message.senderId}:${message.conversationId}`, message.eventId, query);
    this.saveDetails(message, result.details);
    return result.text;
  }

  private async nansenReply(message: VerifiedMessage, endpoint: NansenEndpointName, input: NansenQuery): Promise<string> {
    const nansen = this.services.nansen;
    if (!nansen) return "Nansen analytics is not configured yet.";
    const result = await nansen.call(endpoint, nansenQuerySchema.parse(input), { wallet: await this.actingWallet(message) });
    this.saveDetails(message, result.data);
    if (result.analytics) this.store.saveAnalytics(message.eventId, result.analytics);
    return result.text;
  }

  async portfolioBalance(wallet: `0x${string}`, reference: string) {
    const key = reference.toLowerCase();
    const stock = STOCKS.find((stock) => stock.symbol.toLowerCase() === key || stock.symbol.slice(0, -1).toLowerCase() === key);
    const token = stock?.address ?? (key === "weth" ? "0x4200000000000000000000000000000000000006" : reference);
    return this.services.evm.tokenBalance(wallet, token);
  }

  async portfolioStocks(wallet: `0x${string}`) {
    const result = await this.services.aerodrome.run(wallet, "stocks", {});
    if (result.kind !== "read") throw new Error("Could not load stock positions.");
    return { stocks: stocksSchema.parse(result.output), observedAt: Date.now() };
  }

  async walletPnl(wallet: `0x${string}`, days: number): Promise<PnlSnapshot> {
    const nansen = this.services.nansen;
    if (!nansen) throw new Error("Nansen analytics is not configured yet.");
    const { analytics } = await nansen.call("wallet_pnl_breakdown", { chain: "base", days }, { wallet });
    if (analytics?.snapshot.kind !== "pnl") throw new Error("Nansen returned analytics in an unsupported format. Try again later.");
    return analytics.snapshot;
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
      amount: amount === undefined ? undefined : Number(amount),
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

  recordWhopDeposit(input: JsonInput) {
    const forwarded = whopDepositForwardSchema.parse(input);
    const activity = whopLedgerActivitySchema.parse(forwarded.data);
    const usd = activity.usd_amount;
    const usdUnits = usd !== null && /^-?\d+(?:\.\d+)?$/.test(usd) ? usdToUsdcUnits(usd) : undefined;
    if (usdUnits !== undefined && usdUnits <= 0n) return { status: "ignored" as const };
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
      senderId: account?.senderId,
      amount: activity.amount,
      currency: activity.currency.code.toLowerCase(),
      precision: activity.currency.precision,
      usdAmount: usd ?? undefined,
      availableAt: availableAt !== undefined && !Number.isNaN(availableAt) ? availableAt : undefined,
      state,
      holdReason: holdReason || undefined,
      postedAt: Number.isNaN(postedAt) ? Date.now() : postedAt,
    });
    if (!inserted) return { status: "duplicate" as const };
    return { status: "recorded" as const, depositId: activity.id };
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
      const run = await this.runSteps(treasurySenderId, { id: intentId, expiresAt }, treasury);
      switch (run.outcome) {
        case "succeeded": {
          const result = ["Deposit relay confirmed on Base mainnet.", ...run.hashes.map(explorerLink)].join("\n");
          this.store.transitionIntent(intentId, "executing", "succeeded", result);
          this.depositRelaySucceeded(intentId, result);
          return;
        }
        case "unsettled":
          log("warn", "deposit_relay_unsettled", { depositId: deposit.id, failure: run.failure._tag });
          return;
        case "failed":
          this.failIntent(intentId, run.failure);
          log("error", "deposit_relay_failed", { depositId: deposit.id, error: run.failure.message });
          this.depositRelayFailed(intentId, run.failure.message);
          return;
      }
    } finally {
      this.relayingDeposits.delete(deposit.id);
    }
  }

  private runSteps(senderId: string, intent: Pick<Intent, "id" | "expiresAt"> & { family?: Intent["family"] }, wallet: `0x${string}`) {
    return executeSteps(
      { wallets: this.wallets, journal: this.store, verifyUserOperation: this.services.verifyUserOperation },
      { intentId: intent.id, senderId, wallet, expiresAt: intent.expiresAt, batch: intent.family === "liquidity" },
    );
  }

  /** Record a terminal step failure on the exact step that produced it and close the intent. */
  private failIntent(intentId: string, failure: StepFailed | Reverted): void {
    this.store.markStepFailed(intentId, failure.position, failure.message);
    this.store.transitionIntent(intentId, "executing", "failed", failure.message);
  }

  private unsettledReply(intent: Intent, failure: OutcomeUnknown | InclusionPending): string {
    if (failure._tag === "InclusionPending") {
      return [
        `${familyLabel(intent)} was submitted but its inclusion is not verified yet.`,
        ...(failure.hash ? [explorerLink(failure.hash)] : []),
        "Send the same /confirm code again to re-check. Nothing will be resubmitted.",
      ].join("\n");
    }
    log("warn", "intent_outcome_unknown", { intentId: intent.id, action: intent.action, transactionId: failure.transactionId, error: failure.reason });
    if (isTransactionReadPermissionError(failure.reason)) {
      return "I couldn't check this transaction because a wallet permission is missing. The bot administrator needs to fix it. This request is saved; don't create another swap. Once fixed, confirm this same preview again to check or continue it.";
    }
    return [
      `I couldn't confirm the status of this ${familyLabel(intent)} with the wallet provider.`,
      ...(failure.hash ? [explorerLink(failure.hash)] : []),
      "The request is saved and nothing will be resubmitted. Send the same /confirm code again to re-check.",
    ].join("\n");
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
    return `Your deposit of $${usd} arrived and is on hold (${depositHoldText.get(reason) ?? reason}). It will be retried automatically.`;
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

  private async persistProposal(message: VerifiedMessage, wallet: `0x${string}`, intent: IntentAction, calls: readonly PlannedCall[], preview: string, context?: JsonInput): Promise<string> {
    this.requireAnswer(message);
    validateIntentPlan(intent, wallet, calls);
    const previous = this.store.intentForSource(message.eventId);
    if (previous) return "A transaction request is already saved for this message. Use its original preview to confirm or check it; no second request was created.";
    const code = confirmationCode();
    const expiresAt = Date.now() + this.config.quoteTtlSeconds * 1_000;
    const fingerprint = await planDigest(calls);
    const id = crypto.randomUUID();
    const selected = this.linkedWallet(message);
    const linked = selected && selected.toLowerCase() === wallet.toLowerCase() ? selected : undefined;
    const described = linked ? `${preview}\nWallet: ${linked}\nYour wallet pays the Base network fee.` : preview;
    const record: Intent = {
      id,
      codeHash: await digest(code),
      senderId: message.senderId,
      conversationId: message.conversationId,
      sourceEventId: message.eventId,
      state: "pending",
      ...intent,
      preview: described,
      planDigest: fingerprint,
      expiresAt,
    };
    this.store.createIntent(linked ? { ...record, signer: linked } : record, calls);
    const plan = transactionPlan(calls, { intent, tokens: tokenHints(context) });
    if (plan) this.store.saveTransactionPlan(id, plan);
    const steps = planSummary(plan);
    const shown = steps ? `${described}\n\n${steps}` : described;
    const minutes = Math.floor(this.config.quoteTtlSeconds / 60);

    const yolo = this.config.enableMainnetExecution && !this.previewOnly.has(message.eventId) && this.store.yoloEnabled(message.senderId, message.conversationId);
    if (linked) {
      // The linked wallet is the signer, so neither YOLO nor a typed confirmation can execute this plan.
      const execution = this.config.enableMainnetExecution
        ? `Confirm in this preview to sign with your wallet${yolo ? ". YOLO doesn't apply to your own wallet" : ""}.\nCancel: /cancel ${code}\nExpires in ${minutes} minutes.`
        : `Transactions are currently disabled. Nothing has been sent.\nCancel: /cancel ${code}`;
      return `${shown}\n\n${execution}`;
    }
    if (yolo && !requiresExplicitConfirmation(intent)) {
      return `${shown}\n\nYOLO is on.\n${await this.confirm(message, await digest(code))}\nCheck this request: /confirm ${code}`;
    }
    const execution = this.config.enableMainnetExecution
      ? `${yolo ? "YOLO is on, but a contract call always needs your confirmation.\n" : ""}Reply to this message with "confirm" to proceed or "cancel" to cancel.\nYou can also send /confirm ${code} or /cancel ${code}.\nExpires in ${minutes} minutes.`
      : `Transactions are currently disabled. Nothing has been sent.\nCancel: /cancel ${code}`;
    return `${shown}\n\n${execution}`;
  }

  private async confirm(message: VerifiedMessage, codeHash: string): Promise<string> {
    if (!this.config.enableMainnetExecution) {
      return "Mainnet execution is locked by configuration. Aero reads, previews, and wallets are available, but no transaction was sent.";
    }
    const intent = this.authorizedIntent(message, codeHash);
    if (intent.family === "deposit") return "This is an automatic deposit relay and cannot be confirmed or cancelled here.";
    if (intent.state === "succeeded") return intent.result ?? "This proposal already succeeded.";
    if (intent.state !== "pending" && intent.state !== "executing") return `This proposal is ${intent.state} and cannot be executed.`;

    if (intent.signer) return `This preview signs with your wallet ${intent.signer}. Confirm it in the preview on the Pecu web app with that wallet connected.`;
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
      const run = await this.runSteps(message.senderId, intent, wallet);
      switch (run.outcome) {
        case "succeeded": {
          const result = [`${familyLabel(intent)} confirmed on Base mainnet.`, ...run.hashes.map(explorerLink)].join("\n");
          this.store.transitionIntent(intent.id, "executing", "succeeded", result);
          return result;
        }
        case "unsettled":
          return this.unsettledReply(intent, run.failure);
        case "failed":
          this.failIntent(intent.id, run.failure);
          throw new Error(run.failure.message);
      }
    } finally {
      this.executing.delete(intent.id);
    }
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
    const intent = this.store.intentForCode(codeHash, message.senderId, message.conversationId);
    if (!intent || intent.senderId !== message.senderId || intent.conversationId !== message.conversationId) {
      throw new Error("Confirmation code not found for this X account and conversation.");
    }
    return intent;
  }

}
