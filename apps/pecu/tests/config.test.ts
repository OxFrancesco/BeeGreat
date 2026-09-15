import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

const base = {
  CROSSMINT_API_KEY: "sk_production_example",
  CROSSMINT_WALLET_SECRET: "a-stable-secret-that-is-long-enough-123",
  CHAT_PIN: "better-pin-8492",
};

describe("configuration boundary", () => {
  test("defaults to locked Base execution", () => expect(loadConfig(base).enableMainnetExecution).toBe(false));
  test("rejects staging keys for Base mainnet", () => expect(() => loadConfig({ ...base, CROSSMINT_API_KEY: "sk_staging_example" })).toThrow("production"));
  test("enables execution only for the exact true value", () => expect(loadConfig({ ...base, ENABLE_MAINNET_EXECUTION: "true" }).enableMainnetExecution).toBe(true));
  test("accepts blank optional values from a copied env file", () => expect(loadConfig({ ...base, X_ACCESS_TOKEN: "", XURL_APP: "", CHAT_BOT_USER_ID: "" }).xAccessToken).toBeUndefined());
});
