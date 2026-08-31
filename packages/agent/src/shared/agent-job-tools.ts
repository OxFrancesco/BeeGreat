import { defineTool, type JsonValue } from "@flue/runtime";
import * as v from "valibot";
import { isoTimestamp, type FocusServiceOptions } from "./focus-client.ts";
import { trustedCast } from "./trusted-cast.ts";

const serviceErrorSchema = v.object({ error: v.string() });

type JobDelivery =
  | { kind: "user"; body: string }
  | {
      kind: "signal";
      type: string;
      body: string;
      attributes?: Record<string, string>;
    };

function siteUrl(convexUrl: string, configured?: string) {
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(convexUrl);
  if (!url.hostname.endsWith(".convex.cloud")) {
    throw new Error("CONVEX_SITE_URL is required for non-Convex-cloud URLs.");
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  return url.origin;
}

export async function callAgentJobService<T extends JsonValue = JsonValue>(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
  operation: string,
  input: Record<string, JsonValue | undefined> = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const secret = options.brokerSecret?.trim();
  if (!secret)
    throw new Error("Bee Jobs are not configured on this deployment.");
  const response = await fetcher(
    `${siteUrl(convexUrl, options.convexSiteUrl)}/internal/jobs`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId, operation, ...input }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      v.is(serviceErrorSchema, body)
        ? body.error
        : `Job service failed (HTTP ${response.status})`,
    );
  }
  return trustedCast<T>(body);
}

const deliverySchema = v.pipe(
  v.array(v.picklist(["app", "telegram"])),
  v.minLength(1),
  v.description(
    "Where the result should appear. App keeps it in the Job thread; Telegram also sends it to the connected account.",
  ),
);

const scheduleSchema = v.union([
  v.object({
    kind: v.literal("once"),
    at: v.pipe(
      v.string(),
      v.description("ISO-8601 date and time including an explicit UTC offset"),
    ),
  }),
  v.object({
    kind: v.literal("interval"),
    everyMinutes: v.pipe(
      v.number(),
      v.minValue(15),
      v.maxValue(525_600),
      v.description("Repeat interval in whole minutes"),
    ),
    anchorAt: v.pipe(
      v.string(),
      v.description("First aligned occurrence as ISO-8601 with an offset"),
    ),
  }),
  v.object({
    kind: v.literal("calendar"),
    frequency: v.picklist(["daily", "weekly", "monthly", "yearly"]),
    interval: v.pipe(v.number(), v.minValue(1), v.maxValue(365)),
    firstOccurrenceAt: v.pipe(
      v.string(),
      v.description("First wall-clock occurrence as ISO-8601 with an offset"),
    ),
    timeZone: v.pipe(
      v.string(),
      v.description("IANA timezone, normally from current_time"),
    ),
  }),
]);

const web3GrantRequestSchema = v.object({
  kind: v.literal("aerodrome_pool"),
  poolAddress: v.pipe(
    v.string(),
    v.regex(/^0x[0-9a-fA-F]{40}$/),
    v.description(
      "Exact Aerodrome pool address resolved by the Web3 specialist",
    ),
  ),
  allowedActions: v.pipe(
    v.array(v.picklist(["claim_emissions", "claim_fees", "deposit"])),
    v.minLength(1),
    v.description("Smallest exact set of recurring actions the user requested"),
  ),
});

/** The exact schedule JSON the Convex Jobs service stores. */
type SerializedSchedule =
  | { kind: "once"; at: number }
  | { kind: "interval"; everyMs: number; anchorAt: number }
  | {
      kind: "calendar";
      frequency: "daily" | "weekly" | "monthly" | "yearly";
      interval: number;
      firstOccurrenceAt: number;
      timeZone: string;
    };

function serializedSchedule(
  schedule: v.InferOutput<typeof scheduleSchema>,
): SerializedSchedule {
  if (schedule.kind === "once") {
    return { kind: schedule.kind, at: isoTimestamp(schedule.at, "at") };
  }
  if (schedule.kind === "interval") {
    if (!Number.isSafeInteger(schedule.everyMinutes)) {
      throw new Error("everyMinutes must be a whole number.");
    }
    return {
      kind: schedule.kind,
      everyMs: schedule.everyMinutes * 60_000,
      anchorAt: isoTimestamp(schedule.anchorAt, "anchorAt"),
    };
  }
  return {
    kind: schedule.kind,
    frequency: schedule.frequency,
    interval: schedule.interval,
    firstOccurrenceAt: isoTimestamp(
      schedule.firstOccurrenceAt,
      "firstOccurrenceAt",
    ),
    timeZone: schedule.timeZone,
  };
}

export function createAgentJobTools(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
) {
  const manage = (operation: "pause" | "resume" | "cancel" | "run_now") =>
    defineTool({
      name: `${operation}_agent_job`,
      description: `${operation.replace("_", " ")} one of the user's existing Agent Jobs. Resolve its id with list_agent_jobs first.`,
      input: v.object({ jobId: v.string() }),
      async run({ data }) {
        return {
          output: await callAgentJobService(
            userId,
            convexUrl,
            options,
            operation,
            data,
          ),
        };
      },
    });

  return [
    defineTool({
      name: "create_agent_job",
      description:
        "Create a durable scheduled Bee Job from an explicit user request. Use current_time first. Keep the instruction self-contained because it will run later in its own persistent thread. Never create a financial Job unless the user explicitly requested that exact recurring action.",
      input: v.object({
        title: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
        instruction: v.pipe(v.string(), v.minLength(1), v.maxLength(8_000)),
        schedule: scheduleSchema,
        delivery: deliverySchema,
        web3GrantRequest: v.optional(
          v.pipe(
            web3GrantRequestSchema,
            v.description(
              "Request a pending pool-scoped grant only for an explicit recurring Aerodrome smart-wallet instruction. The signed-in user must approve it in BeeGreat before funds can move.",
            ),
          ),
        ),
      }),
      async run({ data }) {
        return {
          output: await callAgentJobService(
            userId,
            convexUrl,
            options,
            "create",
            { ...data, schedule: serializedSchedule(data.schedule) },
          ),
        };
      },
    }),
    defineTool({
      name: "list_agent_jobs",
      description:
        "List the user’s Agent Jobs with their schedule, state, next run, and private ids for follow-up tools.",
      input: v.object({}),
      async run() {
        return {
          output: await callAgentJobService(userId, convexUrl, options, "list"),
        };
      },
    }),
    defineTool({
      name: "update_agent_job",
      description:
        "Update an existing Agent Job’s title, self-contained instruction, schedule, or delivery after an explicit user request. Resolve its private id with list_agent_jobs first. Omitted fields stay unchanged.",
      input: v.object({
        jobId: v.string(),
        title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(80))),
        instruction: v.optional(
          v.pipe(v.string(), v.minLength(1), v.maxLength(8_000)),
        ),
        schedule: v.optional(scheduleSchema),
        delivery: v.optional(deliverySchema),
      }),
      async run({ data }) {
        const { schedule, ...rest } = data;
        return {
          output: await callAgentJobService(
            userId,
            convexUrl,
            options,
            "update",
            {
              ...rest,
              // JSON.stringify drops the key entirely when there is no
              // schedule update, exactly like the omitted property did.
              schedule: schedule ? serializedSchedule(schedule) : undefined,
            },
          ),
        };
      },
    }),
    manage("pause"),
    manage("resume"),
    manage("cancel"),
    manage("run_now"),
  ];
}

export function createAgentJobCompletionTool(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
  delivery: JobDelivery,
) {
  return defineTool({
    name: "complete_agent_job_run",
    description:
      "Required final ledger update for a scheduled Agent Job. Call exactly once after doing the instruction and any requested Telegram delivery. Use needs_attention when approval or user input is required; use failed only for a terminal failure.",
    input: v.object({
      status: v.picklist(["succeeded", "failed", "needs_attention"]),
      summary: v.pipe(v.string(), v.minLength(1), v.maxLength(2_000)),
      error: v.optional(v.pipe(v.string(), v.maxLength(500))),
    }),
    async run({ data }) {
      const runId =
        delivery.kind === "signal"
          ? delivery.type === "job.scheduled"
            ? delivery.attributes?.runId
            : delivery.type === "web3.action_settled"
              ? delivery.attributes?.jobRunId
              : undefined
          : undefined;
      if (!runId)
        throw new Error("No scheduled Job run is active in this turn.");
      return {
        output: await callAgentJobService(
          userId,
          convexUrl,
          options,
          "finish",
          { runId, ...data },
        ),
      };
    },
  });
}

export function createAgentJobWaitingTool(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
  delivery: JobDelivery,
) {
  return defineTool({
    name: "wait_for_agent_job_external",
    description:
      "Mark a scheduled Job run as waiting for an already-started Web3 settlement. Use only after a prepare tool returned confirmed/in_progress and the backend will send a settlement signal. Do not use for a pending user approval.",
    input: v.object({
      summary: v.pipe(v.string(), v.minLength(1), v.maxLength(2_000)),
    }),
    async run({ data }) {
      const runId =
        delivery.kind === "signal" && delivery.type === "job.scheduled"
          ? delivery.attributes?.runId
          : undefined;
      if (!runId)
        throw new Error("No scheduled Job run is active in this turn.");
      return {
        output: await callAgentJobService(
          userId,
          convexUrl,
          options,
          "waiting_external",
          { runId, summary: data.summary },
        ),
      };
    },
  });
}
