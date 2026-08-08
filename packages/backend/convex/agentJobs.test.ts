import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";
import { nextAgentJobRunAt } from "./agentJobs";

const createJob = makeFunctionReference<
  "mutation",
  {
    title: string;
    instruction: string;
    schedule: { kind: "interval"; everyMs: number; anchorAt: number };
    delivery: Array<"app" | "telegram">;
  },
  { id: string; threadId: number; nextRunAt: number }
>("agentJobs:create");

const listJobs = makeFunctionReference<
  "query",
  Record<string, never>,
  Array<{ id: string; title: string; status: string; threadId: number }>
>("agentJobs:list");

const materialize = makeFunctionReference<
  "mutation",
  { jobId: string; occurrenceAt: number },
  null
>("agentJobs:materialize");

const createGrantedJob = makeFunctionReference<
  "mutation",
  {
    title: string;
    instruction: string;
    schedule: { kind: "interval"; everyMs: number; anchorAt: number };
    delivery: Array<"app" | "telegram">;
    web3GrantRequest: {
      kind: "aerodrome_pool";
      poolAddress: string;
      allowedActions: Array<"claim_emissions" | "claim_fees" | "deposit">;
    };
  },
  { id: Id<"agentJobs">; threadId: number; nextRunAt: number }
>("agentJobs:create");

const approveGrant = makeFunctionReference<
  "mutation",
  { jobId: Id<"agentJobs"> },
  number
>("agentJobGrants:approve");

const createWeb3Action = makeFunctionReference<
  "mutation",
  {
    userId: string;
    jobRunId: Id<"agentJobRuns">;
    jobSugarAction: string;
    jobPoolAddress: string;
    summary: string;
    payload: {
      kind: "execute_plan";
      chainId: number;
      transactions: Array<{ to: string; data: string; value: string }>;
    };
  },
  { id: Id<"web3Actions">; expiresAt: number; autoConfirmed: boolean }
>("web3Actions:create");

const dispatchRun = makeFunctionReference<
  "action",
  { runId: Id<"agentJobRuns"> },
  null
>("agentJobDispatch:dispatch");

const identity = {
  subject: "user_jobs_owner",
  tokenIdentifier: "https://issuer.example.test|user_jobs_owner",
};
const originalAgentUrl = process.env.AGENT_URL;
const originalBrokerSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalAgentUrl === undefined) delete process.env.AGENT_URL;
  else process.env.AGENT_URL = originalAgentUrl;
  if (originalBrokerSecret === undefined) {
    delete process.env.AGENT_CREDENTIAL_BROKER_SECRET;
  } else {
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = originalBrokerSecret;
  }
});

describe("Agent Jobs", () => {
  test("preserves wall-clock time across daylight-saving changes", () => {
    expect(
      nextAgentJobRunAt(
        {
          kind: "calendar",
          frequency: "daily",
          interval: 1,
          firstOccurrenceAt: Date.parse("2026-03-28T09:00:00+01:00"),
          timeZone: "Europe/Rome",
        },
        Date.parse("2026-03-28T12:00:00Z"),
      ),
    ).toBe(Date.parse("2026-03-29T09:00:00+02:00"));
  });

  test("creates one detached Bee thread and exposes only the owner job", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("telegramConnections", {
        userId: identity.subject,
        status: "connected",
        telegramUserId: "123456",
        displayName: "Jobs Owner",
        connectedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const owner = t.withIdentity(identity);
    const created = await owner.mutation(createJob, {
      title: "Hydration reminder",
      instruction: "Ping me on Telegram to drink water.",
      schedule: {
        kind: "interval",
        everyMs: 2 * 60 * 60 * 1_000,
        anchorAt: Date.parse("2026-10-01T13:00:00Z"),
      },
      delivery: ["telegram"],
    });

    expect(created.threadId).toBeGreaterThan(0);
    expect(created.nextRunAt).toBe(Date.parse("2026-10-01T13:00:00Z"));
    await expect(owner.query(listJobs, {})).resolves.toMatchObject([
      {
        id: created.id,
        title: "Hydration reminder",
        status: "active",
        threadId: created.threadId,
      },
    ]);
    await expect(
      t
        .withIdentity({
          subject: "someone_else",
          tokenIdentifier: "https://issuer.example.test|someone_else",
        })
        .query(listJobs, {}),
    ).resolves.toEqual([]);
  });

  test("materializes an occurrence exactly once and advances the schedule", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(identity);
    const created = await owner.mutation(createJob, {
      title: "Check the dashboard",
      instruction: "Inspect the dashboard and summarize changes.",
      schedule: {
        kind: "interval",
        everyMs: 60 * 60 * 1_000,
        anchorAt: Date.parse("2026-10-01T13:00:00Z"),
      },
      delivery: ["app"],
    });

    await t.mutation(materialize, {
      jobId: created.id,
      occurrenceAt: created.nextRunAt,
    });
    await t.mutation(materialize, {
      jobId: created.id,
      occurrenceAt: created.nextRunAt,
    });

    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(created.id as never),
      runs: await ctx.db.query("agentJobRuns" as never).collect(),
    }));
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({
      scheduledFor: created.nextRunAt,
      status: "queued",
    });
    expect(state.job).toMatchObject({
      nextRunAt: created.nextRunAt + 60 * 60 * 1_000,
    });
  });

  test("requires an app-approved exact-pool grant instead of inheriting YOLO", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(identity);
    await t.run(async (ctx) => {
      await ctx.db.insert("powerups", {
        userId: identity.subject,
        powerupId: "web3",
        enabled: true,
      });
      await ctx.db.insert("web3Prefs", {
        userId: identity.subject,
        yoloEnabled: true,
        updatedAt: Date.now(),
      });
    });
    const pool = "0x1111111111111111111111111111111111111111";
    const created = await owner.mutation(createGrantedJob, {
      title: "Compound Aerodrome rewards",
      instruction: "Claim emissions and deposit them back into the pool.",
      schedule: {
        kind: "interval",
        everyMs: 60 * 60 * 1_000,
        anchorAt: Date.parse("2026-10-01T13:00:00Z"),
      },
      delivery: ["app"],
      web3GrantRequest: {
        kind: "aerodrome_pool",
        poolAddress: pool,
        allowedActions: ["claim_emissions", "deposit"],
      },
    });
    await t.mutation(materialize, {
      jobId: created.id,
      occurrenceAt: created.nextRunAt,
    });
    const runId = await t.run(async (ctx) => {
      const run = await ctx.db
        .query("agentJobRuns")
        .withIndex("by_job_id_and_scheduled_for", (q) =>
          q.eq("jobId", created.id).eq("scheduledFor", created.nextRunAt),
        )
        .unique();
      await ctx.db.patch("agentJobRuns", run!._id, { status: "running" });
      return run!._id;
    });
    const request = {
      userId: identity.subject,
      jobRunId: runId,
      jobSugarAction: "claim_emissions",
      jobPoolAddress: pool,
      summary: "Claim rewards",
      payload: {
        kind: "execute_plan" as const,
        chainId: 8453,
        transactions: [],
      },
    };

    await expect(t.mutation(createWeb3Action, request)).rejects.toThrow(
      "Approve this Job’s scoped Aerodrome access",
    );
    await owner.mutation(approveGrant, { jobId: created.id });
    await expect(
      t.mutation(createWeb3Action, {
        ...request,
        jobPoolAddress: "0x2222222222222222222222222222222222222222",
      }),
    ).rejects.toThrow("outside the Job’s approved scope");
    await expect(t.mutation(createWeb3Action, request)).resolves.toMatchObject({
      autoConfirmed: true,
    });
  });

  test("dispatches the materialized occurrence with a stable idempotency key", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(identity);
    const created = await owner.mutation(createJob, {
      title: "Hourly check",
      instruction: "Check the connected service and summarize changes.",
      schedule: {
        kind: "interval",
        everyMs: 60 * 60 * 1_000,
        anchorAt: Date.parse("2026-10-01T13:00:00Z"),
      },
      delivery: ["app"],
    });
    await t.mutation(materialize, {
      jobId: created.id,
      occurrenceAt: created.nextRunAt,
    });
    const run = await t.run((ctx) =>
      ctx.db
        .query("agentJobRuns")
        .withIndex("by_job_id_and_scheduled_for", (q) =>
          q
            .eq("jobId", created.id as Id<"agentJobs">)
            .eq("scheduledFor", created.nextRunAt),
        )
        .unique(),
    );
    process.env.AGENT_URL = "https://agent.example.test";
    process.env.AGENT_CREDENTIAL_BROKER_SECRET = "jobs-test-secret";
    const fetchMock = vi.fn(
      async (_url: URL | RequestInfo, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body.dispatchId).toBe(`job:${created.id}:${created.nextRunAt}`);
        expect(init?.headers).toMatchObject({
          authorization: "Bearer jobs-test-secret",
        });
        return new Response(JSON.stringify({ submissionId: "submission_1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await t.action(dispatchRun, { runId: run!._id });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(
      t.run((ctx) => ctx.db.get("agentJobRuns", run!._id)),
    ).resolves.toMatchObject({
      status: "running",
      attempt: 1,
      submissionId: "submission_1",
    });
  });
});
