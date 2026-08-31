import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const TERMINAL = new Set(["succeeded", "failed", "skipped", "needs_attention"]);
const AUTO_PAUSE_FAILURES = 3;

const claimedRunValidator = v.union(
  v.null(),
  v.object({
    runId: v.id("agentJobRuns"),
    jobId: v.id("agentJobs"),
    userId: v.string(),
    threadId: v.number(),
    title: v.string(),
    instruction: v.string(),
    delivery: v.array(v.union(v.literal("app"), v.literal("telegram"))),
    scheduledFor: v.number(),
    dispatchId: v.string(),
    attempt: v.number(),
  }),
);

export const claimDispatch = internalMutation({
  args: { runId: v.id("agentJobRuns") },
  returns: claimedRunValidator,
  handler: async (ctx, args) => {
    const run = await ctx.db.get("agentJobRuns", args.runId);
    if (!run || run.status !== "queued") return null;
    const job = await ctx.db.get("agentJobs", run.jobId);
    if (!job || job.userId !== run.userId) {
      await ctx.db.patch("agentJobRuns", run._id, {
        status: "failed",
        error: "Job is missing",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return null;
    }
    const attempt = run.attempt + 1;
    const now = Date.now();
    await ctx.db.patch("agentJobRuns", run._id, {
      status: "dispatching",
      attempt,
      startedAt: run.startedAt ?? now,
      error: undefined,
      updatedAt: now,
    });
    return {
      runId: run._id,
      jobId: job._id,
      userId: job.userId,
      threadId: job.threadId,
      title: job.title,
      instruction: job.instruction,
      delivery: job.delivery,
      scheduledFor: run.scheduledFor,
      dispatchId: run.dispatchId,
      attempt,
    };
  },
});

export const recordDispatched = internalMutation({
  args: { runId: v.id("agentJobRuns"), submissionId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("agentJobRuns", args.runId);
    if (run?.status === "dispatching") {
      await ctx.db.patch("agentJobRuns", run._id, {
        status: "running",
        submissionId: args.submissionId,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const recordDispatchFailure = internalMutation({
  args: { runId: v.id("agentJobRuns"), error: v.string(), retry: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("agentJobRuns", args.runId);
    if (!run || run.status !== "dispatching") return null;
    const now = Date.now();
    if (args.retry) {
      await ctx.db.patch("agentJobRuns", run._id, {
        status: "queued",
        error: args.error.slice(0, 500),
        updatedAt: now,
      });
      const backoff = Math.min(
        15 * 60_000,
        30_000 * 2 ** Math.max(0, run.attempt - 1),
      );
      await ctx.scheduler.runAfter(
        backoff,
        internal.agentJobDispatch.dispatch,
        { runId: run._id },
      );
      return null;
    }
    await finishRun(ctx, run, "failed", undefined, args.error);
    return null;
  },
});

async function finishRun(
  ctx: MutationCtx,
  run: Doc<"agentJobRuns">,
  status: "succeeded" | "failed" | "needs_attention",
  summary?: string,
  error?: string,
) {
  const now = Date.now();
  await ctx.db.patch("agentJobRuns", run._id, {
    status,
    summary: summary?.trim().slice(0, 2_000),
    error: error?.trim().slice(0, 500),
    completedAt: now,
    updatedAt: now,
  });
  const job = await ctx.db.get("agentJobs", run.jobId);
  if (!job || job.activeRunId !== run._id) return;
  const failures = status === "succeeded" ? 0 : job.consecutiveFailures + 1;
  const autoPause = failures >= AUTO_PAUSE_FAILURES && job.status === "active";
  const jobPatch: Partial<Doc<"agentJobs">> = {
    activeRunId: undefined,
    consecutiveFailures: failures,
    updatedAt: now,
  };
  if (autoPause) {
    jobPatch.status = "paused";
    jobPatch.nextRunAt = undefined;
  }
  await ctx.db.patch("agentJobs", job._id, jobPatch);
}

export const finishForAgent = internalMutation({
  args: {
    userId: v.string(),
    runId: v.id("agentJobRuns"),
    status: v.union(
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("needs_attention"),
    ),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("agentJobRuns", args.runId);
    if (!run || run.userId !== args.userId)
      throw new Error("Job run not found");
    if (TERMINAL.has(run.status)) return null;
    await finishRun(ctx, run, args.status, args.summary, args.error);
    return null;
  },
});

export const markWaitingExternalForAgent = internalMutation({
  args: {
    userId: v.string(),
    runId: v.id("agentJobRuns"),
    summary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("agentJobRuns", args.runId);
    if (!run || run.userId !== args.userId)
      throw new Error("Job run not found");
    if (run.status === "running" || run.status === "dispatching") {
      await ctx.db.patch("agentJobRuns", run._id, {
        status: "waiting_external",
        summary: args.summary?.trim().slice(0, 2_000),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const watchdog = internalMutation({
  args: {},
  returns: v.object({ redispatched: v.number(), flagged: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const dispatchCutoff = now - 5 * 60_000;
    const executionCutoff = now - 2 * 60 * 60_000;
    const externalCutoff = now - 24 * 60 * 60_000;
    const [queued, dispatching, running, waitingExternal] = await Promise.all([
      ctx.db
        .query("agentJobRuns")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "queued").lt("updatedAt", dispatchCutoff),
        )
        .take(50),
      ctx.db
        .query("agentJobRuns")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "dispatching").lt("updatedAt", dispatchCutoff),
        )
        .take(50),
      ctx.db
        .query("agentJobRuns")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "running").lt("updatedAt", executionCutoff),
        )
        .take(50),
      ctx.db
        .query("agentJobRuns")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "waiting_external").lt("updatedAt", externalCutoff),
        )
        .take(50),
    ]);
    let redispatched = 0;
    for (const run of [...queued, ...dispatching]) {
      if (run.status === "dispatching") {
        await ctx.db.patch("agentJobRuns", run._id, {
          status: "queued",
          updatedAt: now,
        });
      }
      await ctx.scheduler.runAfter(0, internal.agentJobDispatch.dispatch, {
        runId: run._id,
      });
      redispatched += 1;
    }
    for (const run of running) {
      await finishRun(
        ctx,
        run,
        "needs_attention",
        undefined,
        "The agent run exceeded its two-hour execution window",
      );
    }
    for (const run of waitingExternal) {
      await finishRun(
        ctx,
        run,
        "needs_attention",
        undefined,
        "The external action did not settle within 24 hours",
      );
    }
    return { redispatched, flagged: running.length + waitingExternal.length };
  },
});
