import { z } from "zod";

export type TraceSpan = {
  event: "$ai_span"; timestamp: number; started_at: number; ended_at: number;
  $ai_trace_id: string; $ai_session_id: string; $ai_span_id: string;
  $ai_parent_id?: string; $ai_span_name: string; $ai_latency: number; $ai_is_error: boolean;
  attempt_count?: number; item_count?: number; page_count?: number; failover_used?: boolean;
};
export const rpcTimingSchema = z.object({
  operation: z.string().max(100), phase: z.enum(["batch", "pagination", "read", "transport"]),
  status: z.enum(["error", "success"]), attemptCount: z.number(), durationMs: z.number().optional(),
  itemCount: z.number().optional(), pageCount: z.number().optional(), failoverUsed: z.boolean().optional(),
  endedAt: z.number(),
});
