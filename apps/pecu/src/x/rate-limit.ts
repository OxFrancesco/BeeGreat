const minimumRateLimitBackoffMs = 60_000;
const maximumExponentialBackoffMs = 15 * 60_000;

function rateLimitReset(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const headers = Reflect.get(error, "headers");
  if (!headers || typeof headers !== "object") return undefined;
  const get = Reflect.get(headers, "get");
  if (typeof get !== "function") return undefined;
  const raw = Reflect.apply(get, headers, ["x-rate-limit-reset"]);
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const resetSeconds = Number(raw);
  return Number.isFinite(resetSeconds) ? resetSeconds * 1_000 : undefined;
}

export function nextXApiPollDelayMs(
  error: unknown,
  configuredIntervalMs: number,
  previousDelayMs: number,
  now = Date.now(),
): number {
  if (!error || typeof error !== "object" || Reflect.get(error, "status") !== 429) {
    return configuredIntervalMs;
  }
  const resetAt = rateLimitReset(error);
  if (resetAt !== undefined && resetAt > now) {
    return Math.max(configuredIntervalMs, resetAt - now + 1_000);
  }
  return Math.min(
    Math.max(minimumRateLimitBackoffMs, previousDelayMs * 2),
    maximumExponentialBackoffMs,
  );
}
