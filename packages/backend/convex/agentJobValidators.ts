import { v } from "convex/values";

export const agentJobScheduleValidator = v.union(
  v.object({ kind: v.literal("once"), at: v.number() }),
  v.object({
    kind: v.literal("interval"),
    everyMs: v.number(),
    anchorAt: v.number(),
  }),
  v.object({
    kind: v.literal("calendar"),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly"),
    ),
    interval: v.number(),
    firstOccurrenceAt: v.number(),
    timeZone: v.string(),
  }),
);

export const agentJobStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("cancelled"),
  v.literal("completed"),
);

export const agentJobRunStatusValidator = v.union(
  v.literal("queued"),
  v.literal("dispatching"),
  v.literal("running"),
  v.literal("waiting_external"),
  v.literal("needs_attention"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("skipped"),
);

export const agentJobDeliveryValidator = v.union(
  v.literal("app"),
  v.literal("telegram"),
);
