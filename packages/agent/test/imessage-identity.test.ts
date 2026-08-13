import { describe, expect, mock, spyOn, test } from 'bun:test'

import app from '../src/app'
import { callImessageService } from '../src/shared/imessage-identity'

const env = {
  ELEVENLABS_API_KEY: 'unused',
  CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.test',
  CONVEX_URL: 'https://example.convex.cloud',
  CONVEX_SITE_URL: 'https://example.convex.site',
  AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
  BRIDGE_SECRET: 'bridge-secret',
  FLUE_BEE_V2_AGENT: {
    getByName() {
      return { async deleteAccountData() {} }
    },
  },
}

describe('iMessage identity service client', () => {
  test('forwards operations to the Convex broker with the server secret', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetcher = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(input), init })
      return Response.json({ userId: 'user_owner' })
    }

    const result = await callImessageService(
      'https://example.convex.cloud',
      {
        convexSiteUrl: 'https://example.convex.site/',
        brokerSecret: 'broker-secret',
      },
      'resolve',
      { address: '+15551234567' },
      fetcher,
    )

    expect(result).toEqual({ status: 200, body: { userId: 'user_owner' } })
    expect(calls[0]?.url).toBe('https://example.convex.site/internal/imessage')
    expect(calls[0]?.init?.headers).toEqual({
      authorization: 'Bearer broker-secret',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      operation: 'resolve',
      address: '+15551234567',
    })
  })
})

describe('the Worker /bridge/identity route', () => {
  test('resolves senders for the trusted bridge without a user header', async () => {
    const fetcher = mock(async (_input: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        operation: 'begin_link',
        address: '+15551234567',
      })
      return Response.json({
        url: 'https://beegreat.app/link/imessage?token=abc',
        expiresAt: 900,
      })
    })
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetcher as typeof fetch,
    )
    try {
      const response = await app.request(
        new Request('https://agent.example.test/bridge/identity', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-bridge-secret': 'bridge-secret',
          },
          body: JSON.stringify({
            action: 'begin_link',
            address: '+15551234567',
          }),
        }),
        undefined,
        env,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        url: 'https://beegreat.app/link/imessage?token=abc',
        expiresAt: 900,
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('rejects requests without the exact bridge secret', async () => {
    for (const headers of [
      { 'content-type': 'application/json' },
      { 'content-type': 'application/json', 'x-bridge-secret': 'wrong' },
    ]) {
      const response = await app.request(
        new Request('https://agent.example.test/bridge/identity', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'resolve', address: '+1555' }),
        }),
        undefined,
        env,
      )
      expect(response.status).toBe(403)
    }
  })

  test('rejects unknown identity actions', async () => {
    const response = await app.request(
      new Request('https://agent.example.test/bridge/identity', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bridge-secret': 'bridge-secret',
        },
        body: JSON.stringify({ action: 'status', address: '+1555' }),
      }),
      undefined,
      env,
    )
    expect(response.status).toBe(400)
  })
})

describe('the Worker /cli/imessage route', () => {
  // The Clerk JWT verification path is shared middleware covered by
  // channel-actions.test.ts; these tests pin this route's own boundaries.
  test('requires a session for unauthenticated requests', async () => {
    const response = await app.request(
      new Request('https://agent.example.test/cli/imessage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      }),
      undefined,
      env,
    )
    expect(response.status).toBe(401)
  })

  test('refuses the bridge secret on the CLI route', async () => {
    const response = await app.request(
      new Request('https://agent.example.test/cli/imessage', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bridge-secret': 'bridge-secret',
          'x-bridge-user': 'user_owner',
        },
        body: JSON.stringify({ action: 'status' }),
      }),
      undefined,
      env,
    )
    expect(response.status).toBe(403)
  })
})
