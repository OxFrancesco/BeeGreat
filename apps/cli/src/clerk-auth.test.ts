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

test('transient refresh errors preserve credentials and never open a browser', async () => {
  for (const status of [0, 429, 500, 200]) {
    let cleared = false
    let opened = false
    const auth = createClerkCliAuth({ issuer: 'https://clerk.example.test', clientId: 'client' }, {
      store: { load: async () => ({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0, userId: 'owner' }), save: async () => {}, clear: async () => { cleared = true } },
      fetch: async () => { if (!status) throw new Error('offline'); return Response.json({}, { status }) },
      openBrowser: async () => { opened = true },
    })
    await expect(auth.session()).rejects.toThrow()
    expect(cleared).toBe(false)
    expect(opened).toBe(false)
  }
})

test('a failed save retries persistence of the rotated token without refreshing it again', async () => {
  let calls = 0
  let saves = 0
  let saved: ClerkCredentials | undefined
  const auth = createClerkCliAuth({ issuer: 'https://clerk.example.test', clientId: 'client' }, {
    store: {
      load: async () => ({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0, userId: 'owner' }),
      save: async value => { if (++saves === 1) throw new Error('store locked'); saved = value },
      clear: async () => { throw new Error('must preserve credentials') },
    },
    fetch: async () => { calls++; return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }) },
    openBrowser: async () => { throw new Error('must not open') },
  })
  await expect(auth.session()).rejects.toThrow('store locked')
  await expect(auth.session()).resolves.toMatchObject({ refreshToken: 'new-refresh' })
  expect(calls).toBe(1)
  expect(saved?.refreshToken).toBe('new-refresh')
})
