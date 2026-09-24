import { PostHog } from "posthog-node";
import { analyticsIdentity, posthogHost, posthogProjectToken } from "./analytics-config";
import { log } from "./logger";

import type { GenerationAnalyticsEvent, ToolAnalyticsEvent } from "./inference-analytics";

export type AgentAnalyticsEvent =
  | GenerationAnalyticsEvent
  | ToolAnalyticsEvent
  | { event: "pecu_message_received"; channel: "web" | "x" }
  | { event: "pecu_message_completed" | "pecu_message_failed"; channel: "web" | "x"; duration_ms: number }
  | { event: "pecu_wallet_provisioned" };

export type AgentAnalytics = (senderId: string, event: AgentAnalyticsEvent) => void;

export async function captureAgentEvent({ senderId, event, environment = "production" }: {
  senderId: string;
  event: AgentAnalyticsEvent;
  environment?: "production" | "verification";
}): Promise<void> {
  try {
    const client = new PostHog(posthogProjectToken, {
      host: posthogHost,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 5000,
      fetchRetryCount: 0,
      disableGeoip: true,
    });
    const { event: name, timestamp, ...properties } = { timestamp: undefined, ...event };
    client.capture({
      distinctId: await analyticsIdentity(senderId),
      event: name,
      ...(timestamp !== undefined ? { timestamp: new Date(timestamp) } : {}),
      properties: { ...properties, product: "pecu", environment },
    });
    await client.shutdown();
  } catch {
    log("warn", "analytics_delivery_failed", {});
  }
}
