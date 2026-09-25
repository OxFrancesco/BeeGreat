import { jsonValueSchema } from "./json-contract";
import type { PolymarketToken } from "./integrations/polymarket/model-output";
import type { StockSnapshot } from "./stock-contract";
import type { AnalyticsResult } from "./analytics-contract";
import { stockBasketParameters, type StockBasketParameters } from "./stock-contract";
import { aaveIntentParameters, type AaveParameters } from "./integrations/aave";
import { validateSugarRequest } from "@beegreat/sugar";
import { isSugarTxAction, type SugarParameters, type SugarTxAction } from "@beegreat/sugar/contracts";
import { z } from "zod";
import type { PlannedCall } from "./domain";
import type { AgentQuestion, VerifiedMessage } from "./domain";
import { isEvmTxAction, validateEvmRequest, type EvmTxAction, type EvmTxParameters } from "./evm";

export type IntentState = "pending" | "executing" | "succeeded" | "failed" | "cancelled" | "expired";

export const depositRelayParameters = z.strictObject({
  depositId: z.string().min(1),
  recipient: z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]),
  usdcUnits: z.string().regex(/^[1-9]\d*$/),
  whopAccountId: z.string().min(1),
});
export type DepositRelayParameters = z.output<typeof depositRelayParameters>;

export type IntentAction =
  | Readonly<{ family: "aero"; action: SugarTxAction; parameters: SugarParameters }>
  | Readonly<{ family: "stocks"; action: "stock_basket"; parameters: StockBasketParameters }>
  | Readonly<{ family: "aave"; action: "aave_action"; parameters: AaveParameters }>
  | Readonly<{ family: "evm"; action: EvmTxAction; parameters: EvmTxParameters }>
  | Readonly<{ family: "deposit"; action: "deposit_relay"; parameters: DepositRelayParameters }>;

export type Intent = Readonly<{
  id: string;
  codeHash: string;
  senderId: string;
  conversationId: string;
  sourceEventId: string;
  state: IntentState;
  preview: string;
  planDigest: string;
  expiresAt: number;
  result?: string;
}> & IntentAction;

/** Rebuild the typed action from persisted columns, re-validating parameters at the boundary. */
export function parseIntentAction(action: string, parametersJson: string): IntentAction {
  const raw: unknown = JSON.parse(parametersJson);
  if (action === "aave_action") return { family: "aave", action, parameters: aaveIntentParameters.parse(raw) };
  if (action === "deposit_relay") return { family: "deposit", action, parameters: depositRelayParameters.parse(raw) };
  if (action === "stock_basket") return { family: "stocks", action, parameters: stockBasketParameters.parse(raw) };
  if (isSugarTxAction(action)) return { family: "aero", action, parameters: validateSugarRequest(action, raw) };
  if (isEvmTxAction(action)) return { family: "evm", action, parameters: validateEvmRequest(action, jsonValueSchema.parse(raw)) };
  throw new Error(`Stored intent has invalid action: ${action}`);
}

export type ExecutionStep = Readonly<{
  intentId: string;
  position: number;
  call: PlannedCall;
  state: "planned" | "prepared" | "submitted" | "succeeded" | "failed";
  transactionId?: string;
  hash?: string;
}>;

export const eventProcessingLeaseMs = 2 * 60 * 1_000;

export interface AgentStateStore {
  saveStockSnapshot(eventId: string, snapshot: StockSnapshot): void;
  stockSnapshot(eventId: string): StockSnapshot | undefined;
  savePolymarketTokens(eventId: string, tokens: readonly PolymarketToken[]): void;
  polymarketToken(eventId: string, tokenId: string): PolymarketToken | undefined;
  saveAnalytics(eventId: string, result: AnalyticsResult): void;
  analytics(eventId: string): AnalyticsResult[];
  saveQuestion(message: VerifiedMessage, question: AgentQuestion): void;
  questionForEvent(eventId: string): AgentQuestion | undefined;
  answerPendingQuestion(message: VerifiedMessage): boolean;
  yoloEnabled(senderId: string, conversationId: string): boolean;
  setYolo(senderId: string, conversationId: string, enabled: boolean): void;
  chatDetails(senderId: string, conversationId: string): string | undefined;
  saveChatDetails(senderId: string, conversationId: string, json: string): void;
  claimEvent(eventId: string, conversationId: string, senderId: string, retryUnanswered?: boolean, now?: number): "claimed" | "completed" | "busy";
  completeEvent(eventId: string, replyText: string): void;
  eventReply(eventId: string): string | undefined;
  createIntent(intent: Intent, calls: readonly PlannedCall[]): void;
  intentForSource(eventId: string): Intent | undefined;
  /** Resolve a confirmation code for one sender in one conversation; a code from another scope is not found. */
  intentForCode(codeHash: string, senderId: string, conversationId: string): Intent | undefined;
  executingIntents(): Intent[];
  transitionIntent(id: string, from: IntentState, to: IntentState, result?: string): boolean;
  steps(intentId: string): ExecutionStep[];
  markStepPrepared(intentId: string, position: number, transactionId: string): void;
  markStepSubmitted(intentId: string, position: number, hash: string): void;
  markStepSucceeded(intentId: string, position: number, hash?: string): void;
  markStepFailed(intentId: string, position: number, error: string): void;
}

export interface WalletStateStore {
  wallet(senderId: string): { locator: string; address: string } | undefined;
  saveWallet(senderId: string, locator: string, address: string): void;
}

export interface TransportStateStore {
  outgoingReplyText(messageId: string, conversationId: string): string | undefined;
  ignoreEvent(eventId: string, conversationId: string, senderId: string): void;
  enqueueReply(correlationKey: string, conversationId: string, replyToEvent: string, text: string): void;
  pendingReplies(): Array<{
    id: string;
    conversationId: string;
    replyToEvent: string;
    text: string;
    payloadJson?: string;
  }>;
  prepareReply(id: string, payloadJson: string): void;
  sentReply(id: string): void;
  failReply(id: string, error: string): void;
  transportInitialized(conversationId: string, bootstrapVersion?: string): boolean;
  savePaginationToken(conversationId: string, token?: string): void;
}

export interface HarnessStateStore {
  agentSession(senderId: string, conversationId: string): string | undefined;
  saveAgentSession(senderId: string, conversationId: string, sessionId: string): void;
  saveAgentTurn(sessionId: string, message: VerifiedMessage): void;
  agentTurn(sessionId: string): VerifiedMessage | undefined;
}

export type FundingAccount = Readonly<{
  senderId: string;
  whopAccountId: string;
  email: string;
  conversationId: string;
  encodedEvent: string;
}>;

export type DepositState = "received" | "relaying" | "relayed" | "held" | "failed";

export type DepositRecord = Readonly<{
  id: string;
  webhookId: string;
  whopAccountId: string;
  senderId?: string;
  amount: string;
  currency: string;
  precision: string;
  usdAmount?: string;
  availableAt?: number;
  relayUsdcUnits?: string;
  state: DepositState;
  holdReason?: string;
  intentId?: string;
  result?: string;
  postedAt: number;
  createdAt: number;
  updatedAt: number;
}>;

export interface DepositStateStore {
  fundingAccount(senderId: string): FundingAccount | undefined;
  fundingAccountByWhopId(whopAccountId: string): FundingAccount | undefined;
  saveFundingAccount(account: FundingAccount): void;
  touchFundingAccount(senderId: string, conversationId: string, encodedEvent: string): void;
  recordDeposit(deposit: Omit<DepositRecord, "createdAt" | "updatedAt">): boolean;
  deposit(id: string): DepositRecord | undefined;
  depositForIntent(intentId: string): DepositRecord | undefined;
  depositsForSender(senderId: string, limit: number): DepositRecord[];
  recentDeposits(limit: number): DepositRecord[];
  pendingDeposits(): DepositRecord[];
  transitionDeposit(id: string, from: DepositState, to: DepositState, patch?: Partial<Pick<DepositRecord, "holdReason" | "intentId" | "relayUsdcUnits" | "result" | "senderId">>): boolean;
  relayedUsdcUnitsSince(sinceMs: number): bigint;
}

export type PecuStore = AgentStateStore & WalletStateStore & TransportStateStore & HarnessStateStore & DepositStateStore;
