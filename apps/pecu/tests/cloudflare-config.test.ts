import { describe, expect, test } from "bun:test";
import { loadWorkerConfig, runtimeConfigurationError } from "../src/cloudflare/config";

describe("Cloudflare configuration boundary", () => {
  test("defaults to locked Base mainnet", () => {
    const config = loadWorkerConfig({});
    expect(config.baseRpcUrl).toBe("https://mainnet.base.org");
    expect(config.enableMainnetExecution).toBe(false);
    expect(config.xchatPollingEnabled).toBe(false);
  });

  test("uses the Alchemy secret before the public Base fallback", () => {
    const config = loadWorkerConfig({
      ALCHEMY_RPC_URL: "https://base-mainnet.g.alchemy.com/v2/test-key",
      BASE_RPC_URL: "https://mainnet.base.org",
    });
    expect(config.baseRpcUrl).toBe("https://base-mainnet.g.alchemy.com/v2/test-key");
  });

  test("accepts only numeric XChat peer IDs", () => {
    const config = loadWorkerConfig({ CHAT_PEER_USER_IDS: "123, nope, 456" });
    expect(config.chatPeerUserIds).toEqual(["123", "456"]);
  });

  test("loads X realtime delivery secrets without exposing them as public variables", () => {
    const config = loadWorkerConfig({
      X_BEARER_TOKEN: "bearer",
      X_CONSUMER_SECRET: "consumer",
      X_WEBHOOK_URL: "https://pecu.example/x/webhook",
    });
    expect(config.xBearerToken).toBe("bearer");
    expect(config.xConsumerSecret).toBe("consumer");
    expect(config.xWebhookUrl).toBe("https://pecu.example/x/webhook");
  });

  test("reports the first missing production requirement", () => {
    expect(runtimeConfigurationError(loadWorkerConfig({}))).toContain("CROSSMINT_API_KEY");
    expect(runtimeConfigurationError(loadWorkerConfig({ CROSSMINT_API_KEY: "sk_staging_example" }))).toContain("production");
  });

  test("recognizes a complete locked runtime", () => {
    const config = loadWorkerConfig({
      CROSSMINT_API_KEY: "sk_production_example",
      CROSSMINT_WALLET_SECRET: "a-stable-secret-that-is-long-enough-123",
      X_ACCESS_TOKEN: "x-token",
      X_OAUTH_CLIENT_ID: "x-client",
      X_OAUTH_REFRESH_TOKEN: "x-refresh",
      CHAT_PIN: "8492",
    });
    expect(runtimeConfigurationError(config)).toBeUndefined();
    expect(config.enableMainnetExecution).toBe(false);
  });

  test("enables XChat polling only for the exact true value", () => {
    expect(loadWorkerConfig({ XCHAT_POLLING_ENABLED: "true" }).xchatPollingEnabled).toBe(true);
    expect(loadWorkerConfig({ XCHAT_POLLING_ENABLED: "false" }).xchatPollingEnabled).toBe(false);
  });

  test("loads Whop settings with safe defaults and optional secrets", () => {
    const config = loadWorkerConfig({});
    expect(config.whopApiUrl).toBe("https://api.whop.com/api/v1");
    expect(config.whopApiVersionDate).toBe("2026-09-13");
    expect(config.depositRelayMaxUsd).toBe(500);
    expect(config.depositRelayDailyMaxUsd).toBe(2000);
    expect(config.whopApiKey).toBeUndefined();
    expect(config.whopWebhookSecret).toBeUndefined();
    const sandbox = loadWorkerConfig({
      WHOP_API_KEY: "key",
      WHOP_WEBHOOK_SECRET: "ws_secret",
      WHOP_API_URL: "https://sandbox-api.whop.com/api/v1",
      DEPOSIT_RELAY_MAX_USD: "250",
      DEPOSIT_RELAY_DAILY_MAX_USD: "900",
    });
    expect(sandbox.whopApiKey).toBe("key");
    expect(sandbox.whopWebhookSecret).toBe("ws_secret");
    expect(sandbox.whopApiUrl).toBe("https://sandbox-api.whop.com/api/v1");
    expect(sandbox.depositRelayMaxUsd).toBe(250);
    expect(sandbox.depositRelayDailyMaxUsd).toBe(900);
  });

  test("requires refresh credentials when persistent XChat polling is enabled", () => {
    const base = {
      CROSSMINT_API_KEY: "sk_production_example",
      CROSSMINT_WALLET_SECRET: "a-stable-secret-that-is-long-enough-123",
      X_ACCESS_TOKEN: "x-token",
      CHAT_PIN: "8492",
      XCHAT_POLLING_ENABLED: "true",
    };
    expect(runtimeConfigurationError(loadWorkerConfig(base))).toContain("X_OAUTH_CLIENT_ID");
    expect(runtimeConfigurationError(loadWorkerConfig({ ...base, X_OAUTH_CLIENT_ID: "x-client" }))).toContain("X_OAUTH_REFRESH_TOKEN");
  });
});
