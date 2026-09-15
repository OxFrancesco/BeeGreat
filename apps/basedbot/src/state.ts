import { aaveIntentParameters, type AaveParameters } from "./integrations/aave";
import { validateSugarRequest } from "@beegreat/sugar";
import { isSugarTxAction, type SugarParameters, type SugarTxAction } from "@beegreat/sugar/contracts";
import type { PlannedCall } from "./domain";
import type { VerifiedMessage } from "./domain";
import { isEvmTxAction, validateEvmRequest, type EvmTxAction, type EvmTxParameters } from "./evm";

export type IntentState = "pending" | "executing" | "succeeded" | "failed" | "cancelled" | "expired";

export type IntentAction =
  | Readonly<{ family: "aero"; action: SugarTxAction; parameters: SugarParameters }>
  | Readonly<{ family: "aave"; action: "aave_action"; parameters: AaveParameters }>
  | Readonly<{ family: "evm"; action: EvmTxAction; parameters: EvmTxParameters }>;

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
  if (isSugarTxAction(action)) return { family: "aero", action, parameters: validateSugarRequest(action, raw) };
  if (isEvmTxAction(action)) return { family: "evm", action, parameters: validateEvmRequest(action, raw) };
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
  yoloEnabled(senderId: string, conversationId: string): boolean;
  setYolo(senderId: string, conversationId: string, enabled: boolean): void;
  chatDetails(senderId: string, conversationId: string): string | undefined;
  saveChatDetails(senderId: string, conversationId: string, json: string): void;
  claimEvent(eventId: string, conversationId: string, senderId: string, retryUnanswered?: boolean, now?: number): "claimed" | "completed" | "busy";
  completeEvent(eventId: string, replyText: string): void;
  eventReply(eventId: string): string | undefined;
  createIntent(intent: Intent, calls: readonly PlannedCall[]): void;
  intentForSource(eventId: string): Intent | undefined;
  intentForCode(codeHash: string): Intent | undefined;
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

export type BasedBotStore = AgentStateStore & WalletStateStore & TransportStateStore & HarnessStateStore;
