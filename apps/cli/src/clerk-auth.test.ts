import { describe, expect, test } from "bun:test";

import { createClerkCliAuth } from "./clerk-auth";
import type { ClerkCredentials, CredentialStore } from "./credential-store";

describe("Clerk CLI session", () => {
  test("refreshes an expired OAuth session without asking for a user id", async () => {
    let credentials: ClerkCredentials | undefined = {
      accessToken: "expired-access",
      refreshToken: "refresh-1",
      expiresAt: 0,
      userId: "user_from_clerk",
    };
    const store: CredentialStore = {
      load: async () => credentials,
      save: async (value) => {
        credentials = value;
      },
      clear: async () => {
        credentials = undefined;
      },
    };
    const requests: URLSearchParams[] = [];
    const auth = createClerkCliAuth(
      {
        issuer: "https://clerk.example.test",
        clientId: "public-client",
      },
      {
        store,
        fetch: async (_input, init) => {
          if (init?.body instanceof URLSearchParams) requests.push(init.body);
          return Response.json({
            access_token: "fresh-access",
            refresh_token: "refresh-2",
            expires_in: 3600,
          });
        },
        openBrowser: async () => {
          throw new Error("browser should not open");
        },
      },
    );

    await expect(auth.session()).resolves.toMatchObject({
      accessToken: "fresh-access",
      refreshToken: "refresh-2",
      userId: "user_from_clerk",
    });
    expect(Object.fromEntries(requests[0]!)).toEqual({
      grant_type: "refresh_token",
      client_id: "public-client",
      refresh_token: "refresh-1",
    });
  });
});
