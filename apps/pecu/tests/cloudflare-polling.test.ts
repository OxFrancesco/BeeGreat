import { describe, expect, test } from "bun:test";
import { shouldRunScheduledPoll } from "../src/cloudflare/polling";

describe("Cloudflare polling schedule", () => {
  test("honors persisted rate-limit backoff even without a successful poll", () => {
    expect(shouldRunScheduledPoll(undefined, 100_000, 60_000, 200_000)).toBe(false);
    expect(shouldRunScheduledPoll(undefined, 200_000, 60_000, 200_000)).toBe(true);
    expect(shouldRunScheduledPoll(0, 199_999, 30_000, 200_000)).toBe(false);
  });

  test("uses cron when no durable alarm poll has completed", () => {
    expect(shouldRunScheduledPoll(undefined, 100_000, 60_000)).toBe(true);
  });

  test("skips a cron tick immediately after a successful alarm poll", () => {
    expect(shouldRunScheduledPoll(50_000, 100_000, 60_000)).toBe(false);
    expect(shouldRunScheduledPoll(45_000, 100_000, 60_000)).toBe(true);
  });
});
