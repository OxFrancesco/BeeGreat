import { z } from "zod";

/** Six symbols without I, O, 0 or 1, like confirmation codes. */
export const taskCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const taskModes = ["remind", "run", "heartbeat"] as const;
export const taskModeSchema = z.enum(taskModes);
export type TaskMode = z.infer<typeof taskModeSchema>;
export const taskStates = ["active", "paused", "completed", "cancelled"] as const;
export const taskStateSchema = z.enum(taskStates);
export type TaskState = z.infer<typeof taskStateSchema>;
export const grantScopes = ["trade", "liquidity"] as const;
export const grantScopeSchema = z.enum(grantScopes);
export type GrantScope = z.infer<typeof grantScopeSchema>;

export const minIntervalMinutes = 5;
export const maxIntervalMinutes = 31 * 24 * 60;
export const maxActiveTasks = 20;
export const maxGrantUsdPerRun = 10_000;
export const maxGrantDays = 90;
export const defaultGrantDays = 30;
/** Transactions one automated run may execute in sequence, e.g. unstake, withdraw, re-deposit, stake. */
export const maxRunSteps = 4;

export function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timeZoneSchema = z.string().min(1).max(64).refine(validTimeZone, "Unknown IANA time zone");
const clockSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const priceSchema = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,12})?$/).refine((value) => Number(value) > 0, "Price must be positive");
const tokenSchema = z.string().trim().min(1).max(64);

/** Stored and wire trigger. Times are epoch milliseconds; weekdays use 0 for Sunday. */
export const triggerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("once"), at: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("interval"), everyMinutes: z.number().int().min(minIntervalMinutes).max(maxIntervalMinutes), startAt: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("calendar"), time: clockSchema, weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7), timezone: timeZoneSchema }),
  z.strictObject({ kind: z.literal("price"), token: tokenSchema, direction: z.enum(["above", "below"]), priceUsd: priceSchema, checkMinutes: z.number().int().min(1).max(1440) }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

export const grantSchema = z.strictObject({
  scopes: z.array(grantScopeSchema).min(1).max(grantScopes.length),
  maxUsdPerRun: z.number().positive().max(maxGrantUsdPerRun),
  days: z.number().int().min(1).max(maxGrantDays),
  state: z.enum(["requested", "approved", "revoked"]),
  approvedAt: z.number().int().positive().nullable(),
  expiresAt: z.number().int().positive().nullable(),
});
export type Grant = z.infer<typeof grantSchema>;

const weekdayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** What the model sends. It is converted to a stored trigger once, with the current time. */
export const triggerInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("once"),
    at: z.iso.datetime({ offset: true }).optional().describe("ISO 8601 time with offset, for example 2026-10-01T15:00:00+02:00."),
    in_minutes: z.number().int().min(1).max(maxIntervalMinutes).optional().describe("Alternative to at: minutes from now."),
  }),
  z.strictObject({
    kind: z.literal("interval"),
    every_minutes: z.number().int().min(minIntervalMinutes).max(maxIntervalMinutes),
    start_at: z.iso.datetime({ offset: true }).optional().describe("First run. Omit to start one interval from now."),
  }),
  z.strictObject({
    kind: z.literal("calendar"),
    time: clockSchema.describe("24-hour local time, HH:MM."),
    weekdays: z.array(z.enum(weekdayNames)).min(1).max(7).optional().describe("Omit for every day."),
    timezone: timeZoneSchema.describe("The user's IANA time zone. Ask if unknown."),
  }),
  z.strictObject({
    kind: z.literal("price"),
    token: tokenSchema.describe("Symbol or Base contract address."),
    direction: z.enum(["above", "below"]),
    price_usd: priceSchema.describe("Decimal USD price, for example 1.25."),
    check_minutes: z.number().int().min(1).max(1440).optional().describe("How often to check. Default 5."),
  }),
]);
export type TriggerInput = z.infer<typeof triggerInputSchema>;

export const grantInputSchema = z.strictObject({
  scopes: z.array(grantScopeSchema).min(1).max(grantScopes.length).describe("trade: swaps, stock trades and index rebalances. liquidity: Aerodrome deposit, withdraw, stake, unstake and claims."),
  max_usd_per_run: z.number().positive().max(maxGrantUsdPerRun).describe("The most value one run may move, in USD."),
  days: z.number().int().min(1).max(maxGrantDays).optional().describe(`Validity after the user approves it. Default ${defaultGrantDays}.`),
});
export type GrantInput = z.infer<typeof grantInputSchema>;

export function triggerFromInput(input: TriggerInput, now: number): Trigger {
  switch (input.kind) {
    case "once": {
      if ((input.at === undefined) === (input.in_minutes === undefined)) throw new Error("Give exactly one of at or in_minutes.");
      const at = input.at === undefined ? now + input.in_minutes! * 60_000 : Date.parse(input.at);
      if (!Number.isFinite(at) || at <= now) throw new Error("That time has already passed.");
      return { kind: "once", at };
    }
    case "interval": {
      const startAt = input.start_at === undefined ? now + input.every_minutes * 60_000 : Date.parse(input.start_at);
      if (!Number.isFinite(startAt)) throw new Error("Invalid start time.");
      return { kind: "interval", everyMinutes: input.every_minutes, startAt };
    }
    case "calendar":
      return {
        kind: "calendar",
        time: input.time,
        weekdays: [...new Set((input.weekdays ?? weekdayNames).map((day) => weekdayNames.indexOf(day)))].sort(),
        timezone: input.timezone,
      };
    case "price":
      return { kind: "price", token: input.token, direction: input.direction, priceUsd: input.price_usd, checkMinutes: input.check_minutes ?? 5 };
    default: {
      const _exhaustive: never = input;
      throw new Error(`Unsupported trigger ${String(_exhaustive)}`);
    }
  }
}

export function grantFromInput(input: GrantInput): Grant {
  return { scopes: [...new Set(input.scopes)], maxUsdPerRun: input.max_usd_per_run, days: input.days ?? defaultGrantDays, state: "requested", approvedAt: null, expiresAt: null };
}

export function grantActive(grant: Grant | null, now: number): grant is Grant & { state: "approved"; expiresAt: number } {
  return grant?.state === "approved" && grant.expiresAt !== null && grant.expiresAt > now;
}

export const grantViewSchema = grantSchema.extend({ active: z.boolean() });
export type GrantView = z.infer<typeof grantViewSchema>;

export const taskViewSchema = z.object({
  code: taskCodeSchema,
  title: z.string(),
  mode: taskModeSchema,
  instruction: z.string(),
  trigger: triggerSchema,
  schedule: z.string(),
  state: taskStateSchema,
  nextRunAt: z.number().nullable(),
  lastRunAt: z.number().nullable(),
  lastOutcome: z.string().nullable(),
  runCount: z.number().int().nonnegative(),
  channel: z.enum(["x", "web"]),
  /** Web thread id. Null for the original web conversation and for X chats. */
  threadId: z.string().nullable(),
  grant: grantViewSchema.nullable(),
  /** YOLO in the task's conversation. Unattended execution needs it on and an active grant. */
  yolo: z.boolean(),
  createdAt: z.number(),
});
export type TaskView = z.infer<typeof taskViewSchema>;
export const taskListSchema = z.object({ tasks: z.array(taskViewSchema) });

export const taskActionKinds = ["pause", "resume", "cancel", "run", "allow", "revoke"] as const;
export const taskActionSchema = z.strictObject({
  code: taskCodeSchema,
  kind: z.enum(taskActionKinds),
  maxUsd: z.number().positive().max(maxGrantUsdPerRun).optional(),
  scopes: z.array(grantScopeSchema).min(1).max(grantScopes.length).optional(),
});
export type TaskAction = z.infer<typeof taskActionSchema>;
export const taskActionResultSchema = z.object({ task: taskViewSchema, message: z.string() });

export const notificationKinds = ["reminder", "alert", "approval", "executed", "failed"] as const;
export const notificationSchema = z.object({
  id: z.string(),
  kind: z.enum(notificationKinds),
  title: z.string(),
  body: z.string(),
  taskCode: taskCodeSchema.nullable(),
  channel: z.enum(["x", "web"]),
  threadId: z.string().nullable(),
  createdAt: z.number(),
  readAt: z.number().nullable(),
});
export type NotificationView = z.infer<typeof notificationSchema>;
export type NotificationKind = NotificationView["kind"];
export const notificationListSchema = z.object({ notifications: z.array(notificationSchema), unread: z.number().int().nonnegative() });
export const notificationReadSchema = z.strictObject({ ids: z.array(z.string().min(1).max(64)).max(200).optional() });

/** A Firebase Installation ID, FCM's device target. Legacy registration tokens also match during FCM's transition. */
export const pushTokenSchema = z.string().regex(/^[A-Za-z0-9_:\-.]{20,4096}$/);
export const pushRegisterSchema = z.strictObject({ token: pushTokenSchema, platform: z.literal("android") });
export const pushUnregisterSchema = z.strictObject({ token: pushTokenSchema });

/** Marks a web history row created by a task run instead of a user message. */
export const messageOriginSchema = z.object({ kind: z.literal("task"), code: taskCodeSchema, title: z.string(), mode: taskModeSchema });
export type MessageOrigin = z.infer<typeof messageOriginSchema>;
