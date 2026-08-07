import { describe, expect, test } from "bun:test";

import { resolveBeeCliConfig } from "./config";

describe("Bee CLI configuration", () => {
  test("uses the local agent and Clerk OAuth public-client environment", () => {
    expect(
      resolveBeeCliConfig({
        CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test/",
        BEE_CLERK_CLIENT_ID: "oauth-client-id",
      }),
    ).toMatchObject({
      agentUrl: "http://localhost:3583",
      autoStartAgent: true,
      clerkIssuer: "https://clerk.example.test",
      clerkClientId: "oauth-client-id",
    });
  });

  test("allows local automatic startup to be disabled explicitly", () => {
    expect(
      resolveBeeCliConfig({
        CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test",
        BEE_CLERK_CLIENT_ID: "oauth-client-id",
        BEE_AGENT_AUTOSTART: "0",
        BEE_PROJECT_ROOT: "/opt/beegreat",
      }),
    ).toMatchObject({
      autoStartAgent: false,
      projectRoot: "/opt/beegreat",
    });
  });

  test("resolves a private diagnostics log for the self-started agent", () => {
    expect(
      resolveBeeCliConfig({
        CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test",
        BEE_CLERK_CLIENT_ID: "oauth-client-id",
        XDG_CONFIG_HOME: "/tmp/bee-config",
      }).agentLogPath,
    ).toBe("/tmp/bee-config/beegreat/agent.log");
    expect(
      resolveBeeCliConfig({
        CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test",
        BEE_CLERK_CLIENT_ID: "oauth-client-id",
        BEE_AGENT_LOG_PATH: "/tmp/custom-bee.log",
      }).agentLogPath,
    ).toBe("/tmp/custom-bee.log");
  });

  test("explains the required public OAuth configuration", () => {
    expect(() => resolveBeeCliConfig({})).toThrow("CLERK_JWT_ISSUER_DOMAIN");
    expect(() =>
      resolveBeeCliConfig({
        CLERK_JWT_ISSUER_DOMAIN: "https://clerk.example.test",
      }),
    ).toThrow("BEE_CLERK_CLIENT_ID");
  });
});
