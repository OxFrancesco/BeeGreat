import type { OpenCodeWorkerd } from "@opencode-ai/sdk/workerd";
import { z } from "zod";
import { analyticsIdentity } from "./analytics-config";
import type { InferenceRequest } from "./inference-timings";

type LogStream = ReturnType<OpenCodeWorkerd.Interface["sessions"]["log"]>;
export type InferenceLogEntry = LogStream extends AsyncIterable<infer Entry> ? Entry : never;
type Started = Extract<InferenceLogEntry, { type: "session.step.started" }>;

export type GenerationAnalyticsEvent = {
  event: "$ai_generation";
  timestamp: number;
  $ai_trace_id: string;
  $ai_session_id: string;
  $ai_span_id: string;
  $ai_model: string;
  $ai_provider: string;
  $ai_latency: number;
  $ai_time_to_first_token?: number;
  stream_duration_ms: number;
  latency_source: "http_request" | "stream_only";
  request_count: number;
  http_response_ms?: number;
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
}, requests: readonly InferenceRequest[] = []): Promise<GenerationAnalyticsEvent[]> {
  const [trace, session] = await Promise.all([
    analyticsIdentity(JSON.stringify(["trace", turn.senderId, turn.eventId])),
    analyticsIdentity(JSON.stringify(["session", turn.senderId, turn.conversationId])),
  ]);
  const started = new Map<string, Started>();
  const streamed = new Map<string, number>();
  const firstOutput = new Map<string, number>();
  const events: GenerationAnalyticsEvent[] = [];
  const consumedRequests = new Set<string>();
  let previousEnd = turn.startedAt - 1;
  for (const entry of entries) {
    if (entry.type === "session.step.started" && entry.created >= turn.startedAt) {
      started.set(entry.data.assistantMessageID, entry);
    }
    if (entry.type === "session.step.streamed") streamed.set(entry.data.assistantMessageID, entry.created);
    if (entry.type === "session.text.started" || entry.type === "session.reasoning.started" || entry.type === "session.tool.input.started") {
      if (!firstOutput.has(entry.data.assistantMessageID)) firstOutput.set(entry.data.assistantMessageID, entry.created);
    }
    if (entry.type !== "session.step.ended" && entry.type !== "session.step.failed") continue;
    const start = started.get(entry.data.assistantMessageID);
    if (!start) continue;
    started.delete(entry.data.assistantMessageID);
    const { tokens, cost } = entry.data;
    const priced = tokens !== undefined && cost !== undefined && Number.isFinite(cost) && cost > 0;
    const attempts = requests.filter((request) => !consumedRequests.has(request.id) && request.started_at >= previousEnd && request.started_at <= start.created
      && request.session_id === start.data.sessionID && request.provider === start.data.model.providerID && request.model === start.data.model.id);
    for (const request of attempts) consumedRequests.add(request.id);
    const requestStart = attempts[0]?.started_at;
    const lastRequest = attempts.at(-1);
    const firstToken = firstOutput.get(entry.data.assistantMessageID);
    const finishedAt = streamed.get(entry.data.assistantMessageID) ?? entry.created;
    previousEnd = entry.created;
    const event: GenerationAnalyticsEvent = {
      event: "$ai_generation",
      timestamp: requestStart ?? start.created,
      $ai_trace_id: trace,
      $ai_session_id: session,
      $ai_span_id: await analyticsIdentity(JSON.stringify(["span", turn.senderId, entry.data.assistantMessageID])),
      $ai_model: start.data.model.id,
      $ai_provider: start.data.model.providerID,
      $ai_latency: Math.max(0, (finishedAt - (requestStart ?? start.created)) / 1000),
      stream_duration_ms: Math.max(0, finishedAt - start.created),
      latency_source: requestStart !== undefined ? "http_request" : "stream_only",
      request_count: attempts.length,
      $ai_cache_reporting_exclusive: false,
      $ai_stream: true,
      $ai_is_error: entry.type === "session.step.failed",
      billing: start.data.model.providerID === "openrouter" ? "openrouter_api" : "chatgpt_subscription",
      cost_source: priced ? "runtime_model_estimate" : "posthog_model_estimate",
      cost_is_estimate: true,
      usage_available: tokens !== undefined,
    };
    if (requestStart !== undefined && firstToken !== undefined) event.$ai_time_to_first_token = Math.max(0, (firstToken - requestStart) / 1000);
    if (lastRequest?.response_at != null) event.http_response_ms = Math.max(0, lastRequest.response_at - lastRequest.started_at);
    if (tokens) {
      event.$ai_input_tokens = tokens.input + tokens.cache.read + tokens.cache.write;
      event.$ai_output_tokens = tokens.output + tokens.reasoning;
      event.$ai_cache_read_input_tokens = tokens.cache.read;
      event.$ai_cache_creation_input_tokens = tokens.cache.write;
      event.$ai_reasoning_tokens = tokens.reasoning;
    }
    if (priced) event.$ai_total_cost_usd = cost;
    events.push(event);
  }
  return events;
}

export type ToolAnalyticsEvent = {
  event: "$ai_span";
  timestamp: number;
  $ai_trace_id: string;
  $ai_session_id: string;
  $ai_span_id: string;
  $ai_parent_id: string;
  $ai_span_name: string;
  $ai_latency: number;
  $ai_is_error: boolean;
  tool_name: string;
  output_bytes?: number;
  source_output_bytes?: number;
  returned_output_bytes?: number;
  output_truncated?: boolean;
  output_partial?: boolean;
};

const outputSize = z.number().int().nonnegative().optional().catch(undefined);

export async function toolEvents(entries: readonly InferenceLogEntry[], turn: Parameters<typeof generationEvents>[1]): Promise<ToolAnalyticsEvent[]> {
  const trace = await analyticsIdentity(JSON.stringify(["trace", turn.senderId, turn.eventId]));
  const session = await analyticsIdentity(JSON.stringify(["session", turn.senderId, turn.conversationId]));
  const names = new Map<string, string>();
  const calls = new Map<string, Extract<InferenceLogEntry, { type: "session.tool.called" }>>();
  const events: ToolAnalyticsEvent[] = [];
  for (const entry of entries) {
    if (entry.type === "log.synced") continue;
    if (entry.created < turn.startedAt) continue;
    if (entry.type === "session.tool.input.started") names.set(entry.data.id, entry.data.name);
    if (entry.type === "session.tool.called") calls.set(entry.data.id, entry);
    if (entry.type !== "session.tool.success" && entry.type !== "session.tool.failed") continue;
    const call = calls.get(entry.data.id);
    const name = names.get(entry.data.id);
    if (!call || !name) continue;
    calls.delete(entry.data.id);
    const metadata = entry.type === "session.tool.success" ? entry.data.metadata : undefined;
    const outputBytes = outputSize.parse(metadata?.pecu_output_bytes);
    const sourceBytes = outputSize.parse(metadata?.pecu_source_bytes);
    const returned = entry.type === "session.tool.success" ? entry.data.content.flatMap(item => item.type === "text" ? [item.text] : []).join("\n") : undefined;
    const event: ToolAnalyticsEvent = {
      event: "$ai_span", timestamp: call.created,
      $ai_trace_id: trace, $ai_session_id: session,
      $ai_span_id: await analyticsIdentity(JSON.stringify(["tool", turn.senderId, entry.data.id])),
      $ai_parent_id: await analyticsIdentity(JSON.stringify(["span", turn.senderId, entry.data.assistantMessageID])),
      $ai_span_name: name, tool_name: name,
      $ai_latency: Math.max(0, (entry.created - call.created) / 1000),
      $ai_is_error: entry.type === "session.tool.failed",
    };
    if (returned !== undefined) {
      event.returned_output_bytes = new TextEncoder().encode(returned).length;
      event.output_truncated = metadata?.truncated === true;
      event.output_partial = metadata?.pecu_output_partial === true;
    }
    if (outputBytes !== undefined) event.output_bytes = outputBytes;
    if (sourceBytes !== undefined) event.source_output_bytes = sourceBytes;
    events.push(event);
  }
  return events;
}
