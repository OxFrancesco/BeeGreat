import { z } from "zod";

const minimumRateLimitBackoffMs = 60_000;
const maximumExponentialBackoffMs = 15 * 60_000;

const rateLimitError = z.object({
  status: z.literal(429),
  headers: z.instanceof(Headers).optional().catch(undefined),
});

function rateLimitReset(headers: Headers | undefined): number | undefined {
  const raw = headers?.get("x-rate-limit-reset");
  if (!raw) return undefined;
  const resetSeconds = Number(raw);
  return Number.isFinite(resetSeconds) ? resetSeconds * 1_000 : undefined;
}

export function nextXApiPollDelayMs(
  cause: unknown,
  configuredIntervalMs: number,
  previousDelayMs: number,
  now = Date.now(),
): number {
  const error = rateLimitError.safeParse(cause);
  if (!error.success) {
    return configuredIntervalMs;
  }
  const resetAt = rateLimitReset(error.data.headers);
  if (resetAt !== undefined && resetAt > now) {
    return Math.max(configuredIntervalMs, resetAt - now + 1_000);
  }
  return Math.min(
    Math.max(minimumRateLimitBackoffMs, previousDelayMs * 2),
    maximumExponentialBackoffMs,
  );
}
