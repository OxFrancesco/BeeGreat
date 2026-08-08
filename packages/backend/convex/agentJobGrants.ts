import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  agentJobGrantActionValidator,
  agentJobGrantStatusValidator,
} from "./agentJobGrantValidators";
import { requirePowerup } from "./powerups";

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_ACTIONS_PER_RUN = 3;

const grantViewValidator = v.object({
  jobId: v.id("agentJobs"),
  kind: v.literal("aerodrome_pool"),
  poolAddress: v.string(),
  allowedActions: v.array(agentJobGrantActionValidator),
  status: agentJobGrantStatusValidator,
  approvedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
});

export function normalizeGrantRequest(request: {
  kind: "aerodrome_pool";
  poolAddress: string;
  allowedActions: Array<"claim_emissions" | "claim_fees" | "deposit">;
}) {
  const poolAddress = request.poolAddress.trim().toLowerCase();
  if (!EVM_ADDRESS.test(poolAddress)) {
    throw new ConvexError(
      "The recurring Aerodrome grant needs an exact pool address",
    );
  }
  const allowedActions = [...new Set(request.allowedActions)];
  if (request.allowedActions.length > 3) {
    throw new ConvexError("Choose each Aerodrome grant action once");
  }
  if (allowedActions.length === 0) {
    throw new ConvexError(
      "Choose at least one Aerodrome action for this grant",
    );
  }
  return { ...request, poolAddress, allowedActions };
}

export async function insertPendingGrant(
  ctx: MutationCtx,
  args: {
    ownerKey: string;
    userId: string;
    jobId: Id<"agentJobs">;
    request: {
      kind: "aerodrome_pool";
      poolAddress: string;
      allowedActions: Array<"claim_emissions" | "claim_fees" | "deposit">;
    };
  },
) {
  const request = normalizeGrantRequest(args.request);
  const now = Date.now();
  await ctx.db.insert("agentJobGrants", {
    ownerKey: args.ownerKey,
    userId: args.userId,
    jobId: args.jobId,
    kind: request.kind,
    walletKind: "smart_wallet",
    chainId: 8453,
    poolAddress: request.poolAddress,
    allowedActions: request.allowedActions,
    maxActionsPerRun: MAX_ACTIONS_PER_RUN,
    status: "pending",
    requestedAt: now,
    updatedAt: now,
  });
}

export const list = query({
  args: {},
  returns: v.array(grantViewValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    const grants = await ctx.db
      .query("agentJobGrants")
      .withIndex("by_owner_key_and_requested_at", (q) =>
        q.eq("ownerKey", identity.tokenIdentifier),
      )
      .order("desc")
      .take(100);
    return grants.map((grant) => ({
      jobId: grant.jobId,
      kind: grant.kind,
      poolAddress: grant.poolAddress,
      allowedActions: grant.allowedActions,
      status: grant.status,
      approvedAt: grant.approvedAt,
      expiresAt: grant.expiresAt,
    }));
  },
});

export const approve = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    await requirePowerup(ctx, identity.subject, "web3");
    const job = await ctx.db.get("agentJobs", args.jobId);
    if (!job || job.ownerKey !== identity.tokenIdentifier) {
      throw new ConvexError("Job not found");
    }
    if (job.status === "cancelled")
      throw new ConvexError("Cancelled Jobs cannot receive grants");
    const grant = await ctx.db
      .query("agentJobGrants")
      .withIndex("by_job_id", (q) => q.eq("jobId", job._id))
      .unique();
    const effectiveStatus =
      grant?.status === "active" &&
      grant.expiresAt &&
      grant.expiresAt <= Date.now()
        ? "expired"
        : grant?.status;
    if (
      !grant ||
      (effectiveStatus !== "pending" && effectiveStatus !== "expired")
    ) {
      throw new ConvexError("This Job has no pending wallet grant");
    }
    const now = Date.now();
    const expiresAt = now + GRANT_TTL_MS;
    await ctx.db.patch("agentJobGrants", grant._id, {
      status: "active",
      approvedAt: now,
      expiresAt,
      updatedAt: now,
    });
    return expiresAt;
  },
});

export const revoke = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    const job = await ctx.db.get("agentJobs", args.jobId);
    if (!job || job.ownerKey !== identity.tokenIdentifier) {
      throw new ConvexError("Job not found");
    }
    const grant = await ctx.db
      .query("agentJobGrants")
      .withIndex("by_job_id", (q) => q.eq("jobId", job._id))
      .unique();
    if (grant && grant.status !== "revoked") {
      await ctx.db.patch("agentJobGrants", grant._id, {
        status: "revoked",
        revokedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export async function authorizeAgentJobWeb3Action(
  ctx: MutationCtx,
  args: {
    userId: string;
    jobRunId: Id<"agentJobRuns">;
    sugarAction: string;
    poolAddress?: string;
  },
) {
  const run = await ctx.db.get("agentJobRuns", args.jobRunId);
  if (
    !run ||
    run.userId !== args.userId ||
    (run.status !== "running" &&
      run.status !== "waiting_external" &&
      run.status !== "dispatching")
  ) {
    throw new ConvexError("This scheduled Job run is no longer active");
  }
  const job = await ctx.db.get("agentJobs", run.jobId);
  if (!job || job.userId !== args.userId || job.activeRunId !== run._id) {
    throw new ConvexError("This scheduled Job no longer owns the active run");
  }
  const grant = await ctx.db
    .query("agentJobGrants")
    .withIndex("by_job_id", (q) => q.eq("jobId", job._id))
    .unique();
  if (!grant || grant.status !== "active") {
    throw new ConvexError(
      "Approve this Job’s scoped Aerodrome access in BeeGreat before it can move funds",
    );
  }
  if (!grant.expiresAt || grant.expiresAt <= Date.now()) {
    await ctx.db.patch("agentJobGrants", grant._id, {
      status: "expired",
      updatedAt: Date.now(),
    });
    throw new ConvexError(
      "This Job’s scoped Aerodrome access expired; renew it in BeeGreat",
    );
  }
  if (!grant.allowedActions.includes(args.sugarAction as never)) {
    throw new ConvexError(
      "This Aerodrome action is outside the Job’s approved scope",
    );
  }
  const poolAddress = args.poolAddress?.trim().toLowerCase();
  if (!poolAddress || poolAddress !== grant.poolAddress) {
    throw new ConvexError(
      "This Aerodrome pool is outside the Job’s approved scope",
    );
  }
  const previous = await ctx.db
    .query("web3Actions")
    .withIndex("by_job_run", (q) => q.eq("jobRunId", run._id))
    .take(grant.maxActionsPerRun + 1);
  if (previous.length >= grant.maxActionsPerRun) {
    throw new ConvexError(
      "This Job reached its approved on-chain action limit for this run",
    );
  }
}
