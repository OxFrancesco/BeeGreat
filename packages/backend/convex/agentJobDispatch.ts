"use node";

import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction } from "./_generated/server";

const MAX_DISPATCH_ATTEMPTS = 5;

const dispatchResponseSchema = Schema.Struct({
  submissionId: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
const decodeDispatchResponse = Schema.decodeUnknownResult(
  dispatchResponseSchema,
);

type DispatchedRecord = {
  runId: Id<"agentJobRuns">;
  submissionId?: string;
};

export const dispatch = internalAction({
  args: { runId: v.id("agentJobRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(
      internal.agentJobRuns.claimDispatch,
      args,
    );
    if (!claimed) return null;
    const baseUrl = env.AGENT_URL?.trim();
    const secret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim();
    if (!baseUrl || !secret) {
      await ctx.runMutation(internal.agentJobRuns.recordDispatchFailure, {
        runId: args.runId,
        error: "Agent dispatch is not configured",
        retry: claimed.attempt < MAX_DISPATCH_ATTEMPTS,
      });
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(new URL("/internal/job-run", baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(claimed),
        signal: controller.signal,
      });
      const body = Result.getOrNull(
        decodeDispatchResponse(await response.json().catch(() => null)),
      );
      if (!response.ok) {
        throw new Error(
          body?.error ?? `Agent dispatch failed (HTTP ${response.status})`,
        );
      }
      const dispatched: DispatchedRecord = { runId: args.runId };
      if (body?.submissionId !== undefined) {
        dispatched.submissionId = body.submissionId;
      }
      await ctx.runMutation(internal.agentJobRuns.recordDispatched, dispatched);
    } catch (error) {
      await ctx.runMutation(internal.agentJobRuns.recordDispatchFailure, {
        runId: args.runId,
        error: error instanceof Error ? error.message : "Agent dispatch failed",
        retry: claimed.attempt < MAX_DISPATCH_ATTEMPTS,
      });
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },
});
