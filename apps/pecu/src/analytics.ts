import type { TraceSpan } from "./trace-span";
import { PostHog } from "posthog-node";
import { analyticsIdentity, posthogHost, posthogProjectToken } from "./analytics-config";
import { log } from "./logger";

import type { GenerationAnalyticsEvent, ToolAnalyticsEvent } from "./inference-analytics";

export type AgentAnalyticsEvent =
  | { event: "$ai_trace"; timestamp: number; $ai_trace_id: string; $ai_session_id: string; $ai_span_name: string; $ai_latency: number; $ai_is_error: boolean; started_at: number; ended_at: number; first_answer_ms?: number }
  | GenerationAnalyticsEvent
  | ToolAnalyticsEvent
  | TraceSpan
  | { event: "pecu_message_received"; channel: "web" | "x"; $ai_trace_id?: string; $ai_session_id?: string }
  | { event: "pecu_message_completed" | "pecu_message_failed"; channel: "web" | "x"; $ai_trace_id?: string; $ai_session_id?: string; duration_ms: number }
  | { event: "pecu_wallet_provisioned" };

export type AgentAnalytics = (senderId: string, event: AgentAnalyticsEvent) => void;

export async function captureAgentEvent({ senderId, event, environment = "production" }: {
  senderId: string;
  event: AgentAnalyticsEvent;
  environment?: "production" | "verification";
}): Promise<void> {
  return captureAgentEvents([{ senderId, event }], environment);
}

export async function captureAgentEvents(events: readonly { senderId: string; event: AgentAnalyticsEvent }[], environment = "production"): Promise<void> {
  try {
    const client = new PostHog(posthogProjectToken, {
      host: posthogHost, flushAt: 100, flushInterval: 0,
      requestTimeout: 5000, fetchRetryCount: 0, disableGeoip: true,
    });
    for (const { senderId, event } of events) {
      const { event: name, timestamp, ...properties } = { timestamp: undefined, ...event };
      const capture: Parameters<PostHog["capture"]>[0] = { distinctId: await analyticsIdentity(senderId), event: name,
        properties: { ...properties, product: "pecu", environment } };
      if (timestamp !== undefined) capture.timestamp = new Date(timestamp);
      client.capture(capture);
    }
    await client.shutdown();
  } catch { log("warn", "analytics_delivery_failed", {}); }
}

/** One queue per Durable Object; no request state or clients shared between isolates. */
export function batchedAnalytics(waitUntil: (work: Promise<void>) => void): AgentAnalytics {
  let batch: { senderId: string; event: AgentAnalyticsEvent }[] = [];
  let pending: Promise<void> | undefined;
  return (senderId, event) => {
    batch.push({ senderId, event });
    if (pending) return;
    pending = new Promise<void>(resolve => setTimeout(resolve, 50)).then(async () => {
      const events = batch;
      batch = [];
      pending = undefined;
      await captureAgentEvents(events);
    });
    waitUntil(pending);
  };
}
