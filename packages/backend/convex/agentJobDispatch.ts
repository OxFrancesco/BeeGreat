"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";

const MAX_DISPATCH_ATTEMPTS = 5;

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
      const body = (await response.json().catch(() => null)) as {
        submissionId?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : `Agent dispatch failed (HTTP ${response.status})`,
        );
      }
      await ctx.runMutation(internal.agentJobRuns.recordDispatched, {
        runId: args.runId,
        ...(typeof body?.submissionId === "string"
          ? { submissionId: body.submissionId }
          : {}),
      });
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
