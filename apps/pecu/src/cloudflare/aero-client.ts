import { rpcTimingSchema } from "../trace-span";
import { turnTrace } from "../turn-trace";
import { log } from "../logger";
import { z } from "zod";
import type { SugarJson } from "@beegreat/sugar";
import type { AeroRequest } from "./aero-protocol";

export type AeroExecutor = (request: AeroRequest) => Promise<SugarJson>;

export function aeroWorkerExecutor(service: Pick<Fetcher, "fetch">): AeroExecutor {
  return async (request) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    log("info", "aero_worker_request", { request_id: requestId, action: request.action });
    const response = await service.fetch("https://aero.internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pecu-Request": requestId, "X-Pecu-Trace": turnTrace.getStore()?.traceId ?? "" },
      body: JSON.stringify(request),
    });
    log("info", "aero_worker_response", { request_id: requestId, action: request.action, duration_ms: Date.now() - startedAt, status: response.status });
    const trace = turnTrace.getStore();
    if (trace?.record) {
      const endedAt = Date.now();
      trace.record({ event: "$ai_span", timestamp: endedAt, started_at: startedAt, ended_at: endedAt,
        $ai_trace_id: trace.traceId, $ai_session_id: trace.sessionId, $ai_span_id: requestId,
        $ai_span_name: `Aero ${request.action}`, $ai_latency: (endedAt - startedAt) / 1000, $ai_is_error: !response.ok });
      try {
        const timings = z.array(rpcTimingSchema).max(64).parse(JSON.parse(response.headers.get("X-Pecu-Rpc") ?? "[]"));
        for (const [index, timing] of timings.entries()) trace.record({ event: "$ai_span", timestamp: timing.endedAt,
          started_at: timing.endedAt - (timing.durationMs ?? 0), ended_at: timing.endedAt,
          $ai_trace_id: trace.traceId, $ai_session_id: trace.sessionId, $ai_span_id: `${requestId}:${index}`, $ai_parent_id: requestId,
          $ai_span_name: `${timing.phase}: ${timing.operation}`, $ai_latency: (timing.durationMs ?? 0) / 1000,
          $ai_is_error: timing.status === "error", attempt_count: timing.attemptCount, item_count: timing.itemCount,
          page_count: timing.pageCount, failover_used: timing.failoverUsed });
      } catch { log("warn", "aero_timing_unavailable", {}); }
    }
    if (!response.ok) {
      const payload = z.object({ error: z.string() }).safeParse(await response.json());
      const detail = payload.success ? payload.data.error : `Aero Worker returned HTTP ${response.status}`;
      throw new Error(detail);
    }
    return response.json();
  };
}
