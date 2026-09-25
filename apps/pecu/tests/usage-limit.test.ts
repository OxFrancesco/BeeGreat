import { expect, test } from "bun:test";
import { chatError } from "../src/chat";
import { isUsageLimitError, parseUsageLimit, usageLimitActive, UsageLimitError, usageLimitText } from "../src/usage-limit";

const now = Date.parse("2026-09-17T16:10:47Z");
const body = JSON.stringify({ error: { type: "usage_limit_reached", plan_type: "plus", resets_at: Math.floor(now / 1000) + 3 * 3600 + 120, message: "The usage limit has been reached" } });

test("recognizes the Codex usage-limit 429 and its reset time", () => {
  const limit = parseUsageLimit(429, body, undefined, now);
  expect(limit).toEqual({ kind: "usage_limit_reached", planType: "plus", resetsAt: now + (3 * 3600 + 120) * 1000, observedAt: now });
  expect(usageLimitActive(limit!, now)).toBe(true);
  expect(usageLimitActive(limit!, now + 4 * 3600 * 1000)).toBe(false);
  expect(usageLimitText(limit!, now)).toBe("The usage limit on your ChatGPT plus plan has been reached. It resets in about 3 hours (19:12 UTC). Wallet commands such as /balance, /stocks and /quote still work.");
  expect(chatError(new UsageLimitError(limit!, now))).toBe(usageLimitText(limit!, now));
});

test("ignores ordinary rate limits, other statuses and non-JSON bodies", () => {
  expect(parseUsageLimit(429, JSON.stringify({ error: { type: "rate_limit_exceeded" } }), undefined, now)).toBeUndefined();
  expect(parseUsageLimit(500, body, undefined, now)).toBeUndefined();
  expect(parseUsageLimit(429, "<html>Just a moment</html>", undefined, now)).toBeUndefined();
  expect(isUsageLimitError({ status: 429, message: "Rate limit exceeded" })).toBe(false);
  expect(isUsageLimitError({ status: 429, message: "The usage limit has been reached" })).toBe(true);
  expect(isUsageLimitError({ status: 500, message: "The usage limit has been reached" })).toBe(false);
});

test("a limit without a reset time blocks briefly and reads retry-after when present", () => {
  const limit = parseUsageLimit(429, JSON.stringify({ error: { type: "usage_limit_reached" } }), undefined, now)!;
  expect(limit.resetsAt).toBeUndefined();
  expect(usageLimitActive(limit, now + 30_000)).toBe(true);
  expect(usageLimitActive(limit, now + 61_000)).toBe(false);
  expect(usageLimitText(limit, now)).toContain("Try again later.");
  for (const reset of [undefined, null, "invalid", "30", false, {}, []]) {
    const withHeader = parseUsageLimit(429, JSON.stringify({ error: { type: "usage_limit_reached", resets_in_seconds: reset } }), new Headers({ "retry-after": "900" }), now)!;
    expect(withHeader.resetsAt).toBe(now + 900_000);
    expect(usageLimitActive(withHeader, now + 61_000)).toBe(true);
    expect(usageLimitActive(withHeader, now + 900_000)).toBe(false);
    expect(usageLimitText(withHeader, now)).toContain("in 15 minutes");
  }
  const withReset = parseUsageLimit(429, JSON.stringify({ error: { type: "usage_limit_reached", resets_in_seconds: 30 } }), new Headers({ "retry-after": "900" }), now)!;
  expect(withReset.resetsAt).toBe(now + 30_000);
});

test("a plan without Codex usage is terminal for the day", () => {
  const limit = parseUsageLimit(429, JSON.stringify({ error: { type: "usage_not_included" } }), undefined, now)!;
  expect(usageLimitActive(limit, now + 3600_000)).toBe(true);
  expect(usageLimitText(limit, now)).toContain("doesn't include Codex usage");
});
