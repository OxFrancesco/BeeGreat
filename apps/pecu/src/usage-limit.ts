import { z } from "zod";

/**
 * ChatGPT's Codex backend answers an exhausted subscription with HTTP 429 and
 * `{"error":{"type":"usage_limit_reached","resets_at":<unix seconds>}}`.
 * OpenCode classifies every 429 as a transient rate limit and retries with
 * exponential backoff, so without this module a spent plan costs ~30 s per
 * message before the same error surfaces. Codex CLI treats the same body as
 * terminal (`codex-api/src/api_bridge.rs`), and so do we.
 */
export type UsageLimit = Readonly<{
  kind: "usage_limit_reached" | "usage_not_included";
  planType?: string;
  /** Unix milliseconds when the provider says the limit lifts. */
  resetsAt?: number;
  observedAt: number;
}>;

/** A limit with no reset time blocks requests only briefly; one with a reset time blocks until then, at most a day. */
const unknownResetWindowMs = 60_000;
const maxTrustedResetMs = 24 * 60 * 60 * 1_000;

export const usageLimitTypes = new Set(["usage_limit_reached", "usage_not_included"]);

const usageLimitResponse = z.object({
  error: z.object({
    type: z.enum(["usage_limit_reached", "usage_not_included"]),
    plan_type: z.string().optional().catch(undefined),
    resets_at: z.number().optional().catch(undefined),
    resets_in_seconds: z.number().nullish().catch(undefined),
  }),
});

export function parseUsageLimit(status: number, body: string, headers?: Headers, now = Date.now()): UsageLimit | undefined {
  if (status !== 429) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return undefined; }
  const response = usageLimitResponse.safeParse(parsed);
  if (!response.success) return undefined;
  const error = response.data.error;
  const resetsAtSeconds = error.resets_at;
  const resetsInSeconds = error.resets_in_seconds ?? Number(headers?.get("retry-after") ?? NaN);
  const resetsAt = resetsAtSeconds !== undefined
    ? resetsAtSeconds * 1000
    : Number.isFinite(resetsInSeconds) && resetsInSeconds > 0
      ? now + resetsInSeconds * 1000
      : undefined;
  let limit: UsageLimit = {
    kind: error.type,
    observedAt: now,
  };
  if (error.plan_type !== undefined) limit = { ...limit, planType: error.plan_type };
  if (resetsAt !== undefined && resetsAt > now) limit = { ...limit, resetsAt };
  return limit;
}

export function usageLimitActive(limit: UsageLimit, now = Date.now()): boolean {
  if (limit.kind === "usage_not_included") return now - limit.observedAt < maxTrustedResetMs;
  if (limit.resetsAt === undefined) return now - limit.observedAt < unknownResetWindowMs;
  return now < Math.min(limit.resetsAt, limit.observedAt + maxTrustedResetMs);
}

export function isUsageLimitError(error: { status?: number | undefined; message: string }): boolean {
  return (error.status === undefined || error.status === 429) && /usage[ _]limit|usage_not_included/i.test(error.message);
}

const walletFallback = "Wallet commands such as /balance, /stocks and /quote still work.";

export function usageLimitText(limit: UsageLimit, now = Date.now()): string {
  if (limit.kind === "usage_not_included") return `Your ChatGPT plan doesn't include Codex usage, so AI replies aren't available. ${walletFallback}`;
  const plan = limit.planType ? ` on your ChatGPT ${limit.planType} plan` : " on your ChatGPT plan";
  const reset = limit.resetsAt === undefined
    ? "Try again later."
    : `It resets ${describeDelay(limit.resetsAt - now)} (${new Date(limit.resetsAt).toISOString().slice(11, 16)} UTC).`;
  return `The usage limit${plan} has been reached. ${reset} ${walletFallback}`;
}

function describeDelay(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in about ${days} days`;
}

export class UsageLimitError extends Error {
  constructor(readonly limit: UsageLimit, now = Date.now()) {
    super(usageLimitText(limit, now));
    this.name = "UsageLimitError";
  }
}
