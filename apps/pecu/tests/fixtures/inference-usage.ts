import type { InferenceLogEntry } from "../../src/inference-analytics";

export const verificationTurn = { senderId: "analytics-inference-verification-20260919", eventId: "usage-verification-1", conversationId: "verification", startedAt: 1000 };
export function usageStep(id: string, providerID = "openai", created = 1000): InferenceLogEntry[] {
  const base = { id: `evt_${id}`, created, durable: { aggregateID: "session-test", seq: 1, version: 1 as const } };
  const data = { sessionID: "session-test", assistantMessageID: id };
  return [
    { ...base, type: "session.step.started", data: { ...data, agent: "pecu", model: { providerID, id: providerID === "openrouter" ? "openai/gpt-5.6-sol" : "gpt-5.6-sol" } } },
    { ...base, created: created + 1500, type: "session.step.streamed", data },
    { ...base, created: created + 5000, type: "session.step.ended", data: { ...data, finish: "tool-calls", cost: 0.00123, tokens: { input: 100, output: 20, reasoning: 30, cache: { read: 40, write: 0 } }, providerState: { secret: "do not capture" } } },
  ];
}
