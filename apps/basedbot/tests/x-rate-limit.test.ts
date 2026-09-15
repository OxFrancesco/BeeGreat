import { describe, expect, test } from "bun:test";
import { nextXApiPollDelayMs } from "../src/x/rate-limit";

describe("X API polling backoff", () => {
  const now = 1_700_000_000_000;

  test("waits until the server-provided rate-limit reset", () => {
    const resetAt = now + 4 * 60_000;
    const error = {
      status: 429,
      headers: new Headers({ "x-rate-limit-reset": String(resetAt / 1_000) }),
    };

    expect(nextXApiPollDelayMs(error, 60_000, 60_000, now)).toBe(241_000);
  });

  test("backs off exponentially when a 429 has no reset header", () => {
    expect(nextXApiPollDelayMs({ status: 429 }, 60_000, 60_000, now)).toBe(120_000);
    expect(nextXApiPollDelayMs({ status: 429 }, 60_000, 8 * 60_000, now)).toBe(15 * 60_000);
  });

  test("uses the configured interval for non-rate-limit errors", () => {
    expect(nextXApiPollDelayMs({ status: 500 }, 60_000, 8 * 60_000, now)).toBe(60_000);
  });
});
