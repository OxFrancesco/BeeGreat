import { describe, expect, test } from "bun:test";
import { isInvalidXChatPinError } from "../src/x/errors";

describe("X Chat unlock failures", () => {
  test("recognizes invalid PIN errors that must never be retried", () => {
    expect(isInvalidXChatPinError(new Error("Juicebox recovery failed: reason=InvalidPin guesses_remaining=16"))).toBe(true);
    expect(isInvalidXChatPinError(new Error("Juicebox recovery failed: reason=Transient"))).toBe(false);
    expect(isInvalidXChatPinError({ status: 429 })).toBe(false);
  });
});
