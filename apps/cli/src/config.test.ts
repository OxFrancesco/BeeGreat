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
      clerkIssuer: "https://clerk.example.test",
      clerkClientId: "oauth-client-id",
    });
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
