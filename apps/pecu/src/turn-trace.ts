import type { TraceSpan } from "./trace-span";
import { AsyncLocalStorage } from "node:async_hooks";
import { analyticsIdentity } from "./analytics-config";

export type TurnTrace = { traceId: string; sessionId: string; startedAt: number; record?: (span: TraceSpan) => void };
export const turnTrace = new AsyncLocalStorage<TurnTrace>();
export async function turnTraceIdentity(senderId: string, eventId: string, conversationId: string): Promise<TurnTrace> {
  const [traceId, sessionId] = await Promise.all([
    analyticsIdentity(JSON.stringify(["trace", senderId, eventId])),
    analyticsIdentity(JSON.stringify(["session", senderId, conversationId])),
  ]);
  return { traceId, sessionId, startedAt: Date.now() };
}
