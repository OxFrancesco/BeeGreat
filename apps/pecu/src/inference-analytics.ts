import type { OpenCodeWorkerd } from "@opencode-ai/sdk/workerd";
import { analyticsIdentity } from "./analytics-config";

type LogStream = ReturnType<OpenCodeWorkerd.Interface["sessions"]["log"]>;
export type InferenceLogEntry = LogStream extends AsyncIterable<infer Entry> ? Entry : never;
type Started = Extract<InferenceLogEntry, { type: "session.step.started" }>;

export type GenerationAnalyticsEvent = {
  event: "$ai_generation";
  $ai_trace_id: string;
  $ai_session_id: string;
  $ai_span_id: string;
  $ai_model: string;
  $ai_provider: string;
  $ai_latency: number;
  $ai_cache_reporting_exclusive: false;
  $ai_stream: true;
  $ai_is_error: boolean;
  $ai_input_tokens?: number;
  $ai_output_tokens?: number;
  $ai_cache_read_input_tokens?: number;
  $ai_cache_creation_input_tokens?: number;
  $ai_reasoning_tokens?: number;
  $ai_total_cost_usd?: number;
  billing: "chatgpt_subscription" | "openrouter_api";
  cost_source: "runtime_model_estimate" | "posthog_model_estimate";
  cost_is_estimate: true;
  usage_available: boolean;
};

export async function generationEvents(entries: readonly InferenceLogEntry[], turn: {
  senderId: string; eventId: string; conversationId: string; startedAt: number;
}): Promise<GenerationAnalyticsEvent[]> {
  const [trace, session] = await Promise.all([
    analyticsIdentity(JSON.stringify(["trace", turn.senderId, turn.eventId])),
    analyticsIdentity(JSON.stringify(["session", turn.senderId, turn.conversationId])),
  ]);
  const started = new Map<string, Started>();
  const streamed = new Map<string, number>();
  const events: GenerationAnalyticsEvent[] = [];
  for (const entry of entries) {
    if (entry.type === "session.step.started" && entry.created >= turn.startedAt) {
      started.set(entry.data.assistantMessageID, entry);
    }
    if (entry.type === "session.step.streamed") streamed.set(entry.data.assistantMessageID, entry.created);
    if (entry.type !== "session.step.ended" && entry.type !== "session.step.failed") continue;
    const start = started.get(entry.data.assistantMessageID);
    if (!start) continue;
    started.delete(entry.data.assistantMessageID);
    const { tokens, cost } = entry.data;
    const priced = tokens !== undefined && cost !== undefined && Number.isFinite(cost) && cost > 0;
    events.push({
      event: "$ai_generation",
      $ai_trace_id: trace,
      $ai_session_id: session,
      $ai_span_id: await analyticsIdentity(JSON.stringify(["span", turn.senderId, entry.data.assistantMessageID])),
      $ai_model: start.data.model.id,
      $ai_provider: start.data.model.providerID,
      $ai_latency: Math.max(0, ((streamed.get(entry.data.assistantMessageID) ?? entry.created) - start.created) / 1000),
      $ai_cache_reporting_exclusive: false,
      $ai_stream: true,
      $ai_is_error: entry.type === "session.step.failed",
      ...(tokens ? {
        $ai_input_tokens: tokens.input + tokens.cache.read + tokens.cache.write,
        $ai_output_tokens: tokens.output + tokens.reasoning,
        $ai_cache_read_input_tokens: tokens.cache.read,
        $ai_cache_creation_input_tokens: tokens.cache.write,
        $ai_reasoning_tokens: tokens.reasoning,
      } : {}),
      ...(priced ? { $ai_total_cost_usd: cost } : {}),
      billing: start.data.model.providerID === "openrouter" ? "openrouter_api" : "chatgpt_subscription",
      cost_source: priced ? "runtime_model_estimate" : "posthog_model_estimate",
      cost_is_estimate: true,
      usage_available: tokens !== undefined,
    });
  }
  return events;
}
