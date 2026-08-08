import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  createDetachedThreadForIdentity,
  titleThreadForIdentity,
  type ChatIdentity,
} from "./chat";
import {
  agentJobDeliveryValidator,
  agentJobRunStatusValidator,
  agentJobScheduleValidator,
  agentJobStatusValidator,
} from "./agentJobValidators";
import { nextOccurrenceAt } from "./recurrence";
import { agentJobGrantRequestValidator } from "./agentJobGrantValidators";
import { insertPendingGrant } from "./agentJobGrants";

export type AgentJobSchedule = Infer<typeof agentJobScheduleValidator>;

const MIN_INTERVAL_MS = 15 * 60 * 1_000;
const MAX_INTERVAL_MS = 365 * 24 * 60 * 60 * 1_000;
const MAX_ACTIVE_JOBS = 50;
const MAX_TITLE_LENGTH = 80;
const MAX_INSTRUCTION_LENGTH = 8_000;

const jobViewValidator = v.object({
  id: v.id("agentJobs"),
  title: v.string(),
  instruction: v.string(),
  schedule: agentJobScheduleValidator,
  status: agentJobStatusValidator,
  delivery: v.array(agentJobDeliveryValidator),
  threadId: v.number(),
  nextRunAt: v.optional(v.number()),
  lastRunAt: v.optional(v.number()),
  consecutiveFailures: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const runViewValidator = v.object({
  id: v.id("agentJobRuns"),
  scheduledFor: v.number(),
  trigger: v.union(v.literal("schedule"), v.literal("manual")),
  status: agentJobRunStatusValidator,
  attempt: v.number(),
  summary: v.optional(v.string()),
  error: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const createArgs = {
  title: v.string(),
  instruction: v.string(),
  schedule: agentJobScheduleValidator,
  delivery: v.array(agentJobDeliveryValidator),
  web3GrantRequest: v.optional(agentJobGrantRequestValidator),
};

const updateArgs = {
  jobId: v.id("agentJobs"),
  title: v.optional(v.string()),
  instruction: v.optional(v.string()),
  schedule: v.optional(agentJobScheduleValidator),
  delivery: v.optional(v.array(agentJobDeliveryValidator)),
};

function cleanText(value: string, label: string, maxLength: number) {
  const cleaned = value.trim();
  if (!cleaned) throw new ConvexError(`${label} is required`);
  if ([...cleaned].length > maxLength) {
    throw new ConvexError(
      `${label} must be ${maxLength.toLocaleString()} characters or fewer`,
    );
  }
  return cleaned;
}

function cleanDelivery(delivery: Array<"app" | "telegram">) {
  if (delivery.length > 2)
    throw new ConvexError("Choose each delivery destination once");
  const unique = [...new Set(delivery)];
  if (unique.length === 0)
    throw new ConvexError("Choose at least one delivery destination");
  return unique;
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new ConvexError("Use a valid IANA timezone, such as Europe/Rome");
  }
}

export function validateAgentJobSchedule(schedule: AgentJobSchedule) {
  if (schedule.kind === "interval") {
    if (
      !Number.isSafeInteger(schedule.everyMs) ||
      schedule.everyMs < MIN_INTERVAL_MS ||
      schedule.everyMs > MAX_INTERVAL_MS
    ) {
      throw new ConvexError(
        "Intervals must be between 15 minutes and 365 days",
      );
    }
  } else if (schedule.kind === "calendar") {
    if (
      !Number.isSafeInteger(schedule.interval) ||
      schedule.interval < 1 ||
      schedule.interval > 365
    ) {
      throw new ConvexError("Calendar intervals must be between 1 and 365");
    }
    assertTimeZone(schedule.timeZone);
  }
  return schedule;
}

/** Returns the first occurrence at or after `now`; recurring schedules never stop. */
export function nextAgentJobRunAt(schedule: AgentJobSchedule, now: number) {
  validateAgentJobSchedule(schedule);
  if (schedule.kind === "once") {
    if (!Number.isFinite(schedule.at) || schedule.at < now) {
      throw new ConvexError("The one-time Job must be scheduled in the future");
    }
    return schedule.at;
  }
  if (schedule.kind === "interval") {
    if (!Number.isFinite(schedule.anchorAt))
      throw new ConvexError("Invalid interval anchor");
    if (schedule.anchorAt >= now) return schedule.anchorAt;
    const elapsed = now - schedule.anchorAt;
    return (
      schedule.anchorAt +
      Math.ceil(elapsed / schedule.everyMs) * schedule.everyMs
    );
  }
  if (!Number.isFinite(schedule.firstOccurrenceAt)) {
    throw new ConvexError("Invalid first calendar occurrence");
  }
  let occurrence = schedule.firstOccurrenceAt;
  let advances = 0;
  while (occurrence < now) {
    if (advances >= 500) {
      throw new ConvexError("Choose a more recent first calendar occurrence");
    }
    occurrence = nextOccurrenceAt(occurrence, schedule, schedule.timeZone);
    advances += 1;
  }
  return occurrence;
}

function followingAgentJobRunAt(
  schedule: AgentJobSchedule,
  occurrenceAt: number,
) {
  if (schedule.kind === "once") return undefined;
  if (schedule.kind === "interval") return occurrenceAt + schedule.everyMs;
  return nextOccurrenceAt(occurrenceAt, schedule, schedule.timeZone);
}

function jobView(job: Doc<"agentJobs">) {
  return {
    id: job._id,
    title: job.title,
    instruction: job.instruction,
    schedule: job.schedule,
    status: job.status,
    delivery: job.delivery,
    threadId: job.threadId,
    nextRunAt: job.nextRunAt,
    lastRunAt: job.lastRunAt,
    consecutiveFailures: job.consecutiveFailures,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function runView(run: Doc<"agentJobRuns">) {
  return {
    id: run._id,
    scheduledFor: run.scheduledFor,
    trigger: run.trigger,
    status: run.status,
    attempt: run.attempt,
    summary: run.summary,
    error: run.error,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

async function authenticatedIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<ChatIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required");
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject };
}

async function identityForAgent(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<ChatIdentity> {
  const hive = await ctx.db
    .query("hives")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!hive)
    throw new ConvexError("Finish BeeGreat onboarding before creating a Job");
  return { ownerKey: hive.ownerKey, userId };
}

async function assertTelegramReady(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  delivery: Array<"app" | "telegram">,
) {
  if (!delivery.includes("telegram")) return;
  const connection = await ctx.db
    .query("telegramConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (connection?.status !== "connected") {
    throw new ConvexError(
      "Connect Telegram from Profile before using it for Job delivery",
    );
  }
}

async function createForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  args: {
    title: string;
    instruction: string;
    schedule: AgentJobSchedule;
    delivery: Array<"app" | "telegram">;
    web3GrantRequest?: {
      kind: "aerodrome_pool";
      poolAddress: string;
      allowedActions: Array<"claim_emissions" | "claim_fees" | "deposit">;
    };
  },
) {
  const title = cleanText(args.title, "Title", MAX_TITLE_LENGTH);
  const instruction = cleanText(
    args.instruction,
    "Instruction",
    MAX_INSTRUCTION_LENGTH,
  );
  const delivery = cleanDelivery(args.delivery);
  await assertTelegramReady(ctx, identity.userId, delivery);
  const [activeJobs, pausedJobs] = await Promise.all([
    ctx.db
      .query("agentJobs")
      .withIndex("by_owner_key_and_status_and_created_at", (q) =>
        q.eq("ownerKey", identity.ownerKey).eq("status", "active"),
      )
      .take(MAX_ACTIVE_JOBS + 1),
    ctx.db
      .query("agentJobs")
      .withIndex("by_owner_key_and_status_and_created_at", (q) =>
        q.eq("ownerKey", identity.ownerKey).eq("status", "paused"),
      )
      .take(MAX_ACTIVE_JOBS + 1),
  ]);
  if (activeJobs.length + pausedJobs.length >= MAX_ACTIVE_JOBS) {
    throw new ConvexError(
      `You can keep up to ${MAX_ACTIVE_JOBS} active or paused Jobs`,
    );
  }
  const now = Date.now();
  const schedule = validateAgentJobSchedule(args.schedule);
  const nextRunAt = nextAgentJobRunAt(schedule, now);
  const threadId = await createDetachedThreadForIdentity(ctx, identity);
  await titleThreadForIdentity(ctx, identity, threadId, `Job · ${title}`);
  const jobId = await ctx.db.insert("agentJobs", {
    ...identity,
    title,
    instruction,
    schedule,
    status: "active",
    delivery,
    threadId,
    nextRunAt,
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (args.web3GrantRequest) {
    await insertPendingGrant(ctx, {
      ...identity,
      jobId,
      request: args.web3GrantRequest,
    });
  }
  await ctx.scheduler.runAt(nextRunAt, internal.agentJobs.materialize, {
    jobId,
    occurrenceAt: nextRunAt,
  });
  return { id: jobId, threadId, nextRunAt };
}

async function ownedJob(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  jobId: Id<"agentJobs">,
) {
  const job = await ctx.db.get("agentJobs", jobId);
  if (!job || job.ownerKey !== ownerKey) throw new ConvexError("Job not found");
  return job;
}

export const create = mutation({
  args: createArgs,
  returns: v.object({
    id: v.id("agentJobs"),
    threadId: v.number(),
    nextRunAt: v.number(),
  }),
  handler: async (ctx, args) =>
    createForIdentity(ctx, await authenticatedIdentity(ctx), args),
});

export const createForAgent = internalMutation({
  args: { userId: v.string(), ...createArgs },
  returns: v.object({
    id: v.id("agentJobs"),
    threadId: v.number(),
    nextRunAt: v.number(),
  }),
  handler: async (ctx, args) =>
    createForIdentity(ctx, await identityForAgent(ctx, args.userId), args),
});

export const list = query({
  args: {},
  returns: v.array(jobViewValidator),
  handler: async (ctx) => {
    const identity = await authenticatedIdentity(ctx);
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_owner_key_and_created_at", (q) =>
        q.eq("ownerKey", identity.ownerKey),
      )
      .order("desc")
      .take(100);
    return jobs.map(jobView);
  },
});

export const listForAgent = internalQuery({
  args: { userId: v.string() },
  returns: v.array(jobViewValidator),
  handler: async (ctx, args) => {
    const identity = await identityForAgent(ctx, args.userId);
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_owner_key_and_created_at", (q) =>
        q.eq("ownerKey", identity.ownerKey),
      )
      .order("desc")
      .take(100);
    return jobs.map(jobView);
  },
});

export const listRuns = query({
  args: { jobId: v.id("agentJobs") },
  returns: v.array(runViewValidator),
  handler: async (ctx, args) => {
    const identity = await authenticatedIdentity(ctx);
    await ownedJob(ctx, identity.ownerKey, args.jobId);
    const runs = await ctx.db
      .query("agentJobRuns")
      .withIndex("by_job_id_and_created_at", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(50);
    return runs.map(runView);
  },
});

async function updateOwned(
  ctx: MutationCtx,
  ownerKey: string,
  args: {
    jobId: Id<"agentJobs">;
    title?: string;
    instruction?: string;
    schedule?: AgentJobSchedule;
    delivery?: Array<"app" | "telegram">;
  },
) {
  const job = await ownedJob(ctx, ownerKey, args.jobId);
  if (job.status === "cancelled")
    throw new ConvexError("Cancelled Jobs cannot be updated");
  if (
    args.title === undefined &&
    args.instruction === undefined &&
    args.schedule === undefined &&
    args.delivery === undefined
  ) {
    throw new ConvexError("Choose something to update");
  }
  const delivery = args.delivery ? cleanDelivery(args.delivery) : job.delivery;
  await assertTelegramReady(ctx, job.userId, delivery);
  const now = Date.now();
  const schedule = args.schedule
    ? validateAgentJobSchedule(args.schedule)
    : job.schedule;
  const shouldActivate =
    job.status === "completed" && args.schedule !== undefined;
  const status = shouldActivate ? ("active" as const) : job.status;
  const nextRunAt =
    status === "active" && args.schedule !== undefined
      ? nextAgentJobRunAt(schedule, now)
      : job.nextRunAt;
  await ctx.db.patch("agentJobs", job._id, {
    ...(args.title !== undefined
      ? { title: cleanText(args.title, "Title", MAX_TITLE_LENGTH) }
      : {}),
    ...(args.instruction !== undefined
      ? {
          instruction: cleanText(
            args.instruction,
            "Instruction",
            MAX_INSTRUCTION_LENGTH,
          ),
        }
      : {}),
    ...(args.schedule !== undefined ? { schedule, nextRunAt } : {}),
    ...(args.delivery !== undefined ? { delivery } : {}),
    ...(shouldActivate ? { status } : {}),
    updatedAt: now,
  });
  if (args.title !== undefined) {
    const thread = await ctx.db
      .query("chatThreads")
      .withIndex("by_owner_key_and_thread_id", (q) =>
        q.eq("ownerKey", job.ownerKey).eq("threadId", job.threadId),
      )
      .unique();
    if (thread) {
      await ctx.db.patch("chatThreads", thread._id, {
        title: `Job · ${cleanText(args.title, "Title", MAX_TITLE_LENGTH)}`,
        updatedAt: now,
      });
    }
  }
  if (
    status === "active" &&
    args.schedule !== undefined &&
    nextRunAt !== undefined
  ) {
    await ctx.scheduler.runAt(nextRunAt, internal.agentJobs.materialize, {
      jobId: job._id,
      occurrenceAt: nextRunAt,
    });
  }
  return jobView({
    ...job,
    ...(args.title !== undefined
      ? { title: cleanText(args.title, "Title", MAX_TITLE_LENGTH) }
      : {}),
    ...(args.instruction !== undefined
      ? {
          instruction: cleanText(
            args.instruction,
            "Instruction",
            MAX_INSTRUCTION_LENGTH,
          ),
        }
      : {}),
    ...(args.schedule !== undefined ? { schedule, nextRunAt } : {}),
    ...(args.delivery !== undefined ? { delivery } : {}),
    ...(shouldActivate ? { status } : {}),
    updatedAt: now,
  });
}

export const update = mutation({
  args: updateArgs,
  returns: jobViewValidator,
  handler: async (ctx, args) =>
    updateOwned(ctx, (await authenticatedIdentity(ctx)).ownerKey, args),
});

export const updateForAgent = internalMutation({
  args: { userId: v.string(), ...updateArgs },
  returns: jobViewValidator,
  handler: async (ctx, args) =>
    updateOwned(ctx, (await identityForAgent(ctx, args.userId)).ownerKey, args),
});

async function pauseOwned(
  ctx: MutationCtx,
  ownerKey: string,
  jobId: Id<"agentJobs">,
) {
  const job = await ownedJob(ctx, ownerKey, jobId);
  if (job.status === "cancelled" || job.status === "completed") {
    throw new ConvexError("This Job can no longer be paused");
  }
  await ctx.db.patch("agentJobs", jobId, {
    status: "paused",
    nextRunAt: undefined,
    updatedAt: Date.now(),
  });
}

async function resumeOwned(
  ctx: MutationCtx,
  ownerKey: string,
  jobId: Id<"agentJobs">,
) {
  const job = await ownedJob(ctx, ownerKey, jobId);
  if (job.status !== "paused")
    throw new ConvexError("Only a paused Job can be resumed");
  const now = Date.now();
  const nextRunAt = nextAgentJobRunAt(job.schedule, now);
  await ctx.db.patch("agentJobs", jobId, {
    status: "active",
    nextRunAt,
    updatedAt: now,
  });
  await ctx.scheduler.runAt(nextRunAt, internal.agentJobs.materialize, {
    jobId,
    occurrenceAt: nextRunAt,
  });
  return nextRunAt;
}

async function cancelOwned(
  ctx: MutationCtx,
  ownerKey: string,
  jobId: Id<"agentJobs">,
) {
  await ownedJob(ctx, ownerKey, jobId);
  await ctx.db.patch("agentJobs", jobId, {
    status: "cancelled",
    nextRunAt: undefined,
    updatedAt: Date.now(),
  });
  const grant = await ctx.db
    .query("agentJobGrants")
    .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
    .unique();
  if (grant && grant.status !== "revoked") {
    await ctx.db.patch("agentJobGrants", grant._id, {
      status: "revoked",
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

async function runNowOwned(
  ctx: MutationCtx,
  ownerKey: string,
  jobId: Id<"agentJobs">,
) {
  const job = await ownedJob(ctx, ownerKey, jobId);
  if (job.status === "cancelled")
    throw new ConvexError("Cancelled Jobs cannot be run");
  if (job.activeRunId) {
    const active = await ctx.db.get("agentJobRuns", job.activeRunId);
    if (
      active &&
      !["succeeded", "failed", "skipped", "needs_attention"].includes(
        active.status,
      )
    ) {
      throw new ConvexError("This Job already has a run in progress");
    }
  }
  let scheduledFor = Date.now();
  let collisions = 0;
  while (
    await ctx.db
      .query("agentJobRuns")
      .withIndex("by_job_id_and_scheduled_for", (q) =>
        q.eq("jobId", jobId).eq("scheduledFor", scheduledFor),
      )
      .unique()
  ) {
    if (collisions >= 100)
      throw new ConvexError("Try running this Job again in a moment");
    scheduledFor += 1;
    collisions += 1;
  }
  const runId = await ctx.db.insert("agentJobRuns", {
    ownerKey: job.ownerKey,
    userId: job.userId,
    jobId,
    scheduledFor,
    trigger: "manual",
    status: "queued",
    attempt: 0,
    dispatchId: `job:${jobId}:${scheduledFor}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await ctx.db.patch("agentJobs", jobId, {
    activeRunId: runId,
    lastRunAt: scheduledFor,
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.agentJobDispatch.dispatch, {
    runId,
  });
  return runId;
}

export const pause = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await pauseOwned(
      ctx,
      (await authenticatedIdentity(ctx)).ownerKey,
      args.jobId,
    );
    return null;
  },
});

export const resume = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.number(),
  handler: async (ctx, args) =>
    resumeOwned(ctx, (await authenticatedIdentity(ctx)).ownerKey, args.jobId),
});

export const cancel = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await cancelOwned(
      ctx,
      (await authenticatedIdentity(ctx)).ownerKey,
      args.jobId,
    );
    return null;
  },
});

export const runNow = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.id("agentJobRuns"),
  handler: async (ctx, args) =>
    runNowOwned(ctx, (await authenticatedIdentity(ctx)).ownerKey, args.jobId),
});

export const manageForAgent = internalMutation({
  args: {
    userId: v.string(),
    jobId: v.id("agentJobs"),
    operation: v.union(
      v.literal("pause"),
      v.literal("resume"),
      v.literal("cancel"),
      v.literal("run_now"),
    ),
  },
  returns: v.union(v.null(), v.number(), v.id("agentJobRuns")),
  handler: async (ctx, args) => {
    const { ownerKey } = await identityForAgent(ctx, args.userId);
    if (args.operation === "pause") {
      await pauseOwned(ctx, ownerKey, args.jobId);
      return null;
    }
    if (args.operation === "resume")
      return await resumeOwned(ctx, ownerKey, args.jobId);
    if (args.operation === "cancel") {
      await cancelOwned(ctx, ownerKey, args.jobId);
      return null;
    }
    return await runNowOwned(ctx, ownerKey, args.jobId);
  },
});

export const materialize = internalMutation({
  args: { jobId: v.id("agentJobs"), occurrenceAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("agentJobs", args.jobId);
    if (!job || job.status !== "active" || job.nextRunAt !== args.occurrenceAt)
      return null;
    const existing = await ctx.db
      .query("agentJobRuns")
      .withIndex("by_job_id_and_scheduled_for", (q) =>
        q.eq("jobId", job._id).eq("scheduledFor", args.occurrenceAt),
      )
      .unique();
    if (existing) return null;

    const now = Date.now();
    const following = followingAgentJobRunAt(job.schedule, args.occurrenceAt);
    const active = job.activeRunId
      ? await ctx.db.get("agentJobRuns", job.activeRunId)
      : null;
    const hasActiveRun =
      active &&
      !["succeeded", "failed", "skipped", "needs_attention"].includes(
        active.status,
      );
    const runId = await ctx.db.insert("agentJobRuns", {
      ownerKey: job.ownerKey,
      userId: job.userId,
      jobId: job._id,
      scheduledFor: args.occurrenceAt,
      trigger: "schedule",
      status: hasActiveRun ? "skipped" : "queued",
      attempt: 0,
      dispatchId: `job:${job._id}:${args.occurrenceAt}`,
      ...(hasActiveRun
        ? { error: "The previous run was still in progress", completedAt: now }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("agentJobs", job._id, {
      status: following === undefined ? "completed" : job.status,
      nextRunAt: following,
      lastRunAt: args.occurrenceAt,
      ...(!hasActiveRun ? { activeRunId: runId } : {}),
      updatedAt: now,
    });
    if (following !== undefined) {
      await ctx.scheduler.runAt(following, internal.agentJobs.materialize, {
        jobId: job._id,
        occurrenceAt: following,
      });
    }
    if (!hasActiveRun)
      await ctx.scheduler.runAfter(0, internal.agentJobDispatch.dispatch, {
        runId,
      });
    return null;
  },
});
