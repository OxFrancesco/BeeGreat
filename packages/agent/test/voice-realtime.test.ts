import { describe, expect, mock, spyOn, test } from 'bun:test'

import app from '../src/app'

function request() {
  return new Request('https://agent.example.test/voice/realtime-token', {
    method: 'POST',
    headers: {
      'x-bridge-secret': 'bridge-secret',
      'x-bridge-user': 'user_owner',
    },
  })
}

function env(xaiApiKey?: string) {
  return {
    ELEVENLABS_API_KEY: 'unused',
    XAI_API_KEY: xaiApiKey,
    CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.test',
    BRIDGE_SECRET: 'bridge-secret',
    FLUE_BEE_V2_AGENT: {
      getByName() {
        return { async deleteAccountData() {} }
      },
    },
  }
}

describe('xAI realtime client secrets', () => {
  test('keeps the long-lived key server-side and returns a short-lived token', async () => {
    const fetcher = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        'https://api.x.ai/v1/realtime/client_secrets',
      )
      expect(init?.headers).toEqual({
        authorization: 'Bearer long-lived-xai-key',
        'content-type': 'application/json',
      })
      expect(JSON.parse(String(init?.body))).toEqual({
        expires_after: { seconds: 300 },
      })
      return Response.json({
        value: 'xai-client-secret.short-lived',
        expires_at: 1_800_000_000,
      })
    })
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetcher as typeof fetch,
    )

    try {
      const response = await app.request(
        request(),
        undefined,
        env('long-lived-xai-key'),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({
        token: 'xai-client-secret.short-lived',
        expiresAt: 1_800_000_000,
      })
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('fails before contacting xAI when the Worker key is missing', async () => {
    const fetcher = mock(async () => Response.json({}))
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      fetcher as typeof fetch,
    )

    try {
      const response = await app.request(request(), undefined, env())

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Conversational voice is not configured.',
      })
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
