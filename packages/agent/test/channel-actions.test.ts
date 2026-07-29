import { describe, expect, mock, spyOn, test } from 'bun:test'

import app from '../src/app'
import {
  callChannelAction,
  channelOwnerKey,
} from '../src/shared/channel-actions'

describe('trusted app-equivalent channel actions', () => {
  test('derives the same stable owner key as Clerk authentication', () => {
    expect(
      channelOwnerKey(
        'https://issuer.example.test/',
        'user_owner',
      ),
    ).toBe('https://issuer.example.test|user_owner')
  })

  test('forwards only server-owned identity and action data to Convex', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetcher = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(input), init })
      return Response.json({
        threadId: 42,
        activeHighlight: null,
      })
    }

    await expect(
      callChannelAction(
        {
          convexUrl: 'https://example.convex.cloud',
          convexSiteUrl: 'https://example.convex.site/',
          brokerSecret: 'broker-secret',
          clerkIssuer: 'https://issuer.example.test',
        },
        'user_owner',
        'context',
        {},
        fetcher,
      ),
    ).resolves.toEqual({ threadId: 42, activeHighlight: null })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://example.convex.site/internal/focus')
    expect(calls[0]?.init?.headers).toEqual({
      authorization: 'Bearer broker-secret',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      userId: 'user_owner',
      operation: 'channel_context',
      ownerKey: 'https://issuer.example.test|user_owner',
    })
  })

  test('the Worker exposes actions only through authenticated bridge identity', async () => {
    const fetcher = mock(async (_input: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        userId: 'user_owner',
        operation: 'channel_complete_highlight',
        requestId: 'complete-highlight:highlight-id',
        taskId: 'task-id',
        ownerKey: 'https://issuer.example.test|user_owner',
      })
      return Response.json({
        status: 'completed',
        taskId: 'task-id',
        honeyAwarded: 5,
        scoreAwarded: 1,
        honeyBalance: 5,
        honeycombScore: 1,
      })
    })
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetcher as typeof fetch,
    )
    const env = {
      ELEVENLABS_API_KEY: 'unused',
      CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.test',
      CONVEX_URL: 'https://example.convex.cloud',
      CONVEX_SITE_URL: 'https://example.convex.site',
      AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
      BRIDGE_SECRET: 'bridge-secret',
      FLUE_BEE_AGENT: {
        getByName() {
          return { async deleteAccountData() {} }
        },
      },
    }
    try {
      const response = await app.request(
        new Request('https://agent.example.test/bridge/channel', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-bridge-secret': 'bridge-secret',
            'x-bridge-user': 'user_owner',
          },
          body: JSON.stringify({
            action: 'complete_highlight',
            requestId: 'complete-highlight:highlight-id',
            taskId: 'task-id',
          }),
        }),
        undefined,
        env,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        status: 'completed',
        honeyAwarded: 5,
      })

      const unauthenticated = await app.request(
        new Request('https://agent.example.test/bridge/channel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'context' }),
        }),
        undefined,
        env,
      )
      expect(unauthenticated.status).toBe(401)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
