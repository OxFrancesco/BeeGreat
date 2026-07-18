import { describe, expect, test } from 'bun:test'
import { checkPaidSubscription } from '../src/subscription-gate'

const env = {
  CONVEX_SITE_URL: 'https://example.convex.site/',
  AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
}

describe('checkPaidSubscription', () => {
  test('sends the Clerk user id over the authenticated broker boundary', async () => {
    const expiresAt = Date.now() + 60_000
    const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        'https://example.convex.site/internal/subscription/status',
      )
      expect(init?.headers).toEqual({
        authorization: 'Bearer broker-secret',
        'content-type': 'application/json',
      })
      expect(JSON.parse(String(init?.body))).toEqual({ userId: 'user_owner' })
      return Response.json({ active: true, expiresAt })
    }

    await expect(checkPaidSubscription('user_owner', env, fetchMock)).resolves.toEqual({
      status: 'active',
      expiresAt,
    })
  })

  test('fails closed for inactive, missing, and malformed upstream state', async () => {
    await expect(
      checkPaidSubscription('user_owner', env, async () =>
        Response.json({ active: false, expiresAt: null }),
      ),
    ).resolves.toEqual({ status: 'inactive' })
    await expect(checkPaidSubscription('user_owner', {})).resolves.toEqual({
      status: 'unavailable',
      reason: 'configuration',
    })
    await expect(
      checkPaidSubscription('user_owner', env, async () =>
        Response.json({ active: true, expiresAt: null }),
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'invalid_response' })
    await expect(
      checkPaidSubscription('user_owner', env, async () =>
        Response.json({ active: true, expiresAt: Date.now() - 1 }),
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'invalid_response' })
    await expect(
      checkPaidSubscription('user_owner', env, async () =>
        new Response('no', { status: 503 }),
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'upstream' })
  })
})
