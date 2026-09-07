import { describe, expect, spyOn, test } from 'bun:test'
import app from '../src/app'

const env = {
  CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.test',
  CONVEX_URL: 'https://example.convex.cloud',
  CONVEX_SITE_URL: 'https://example.convex.site',
  AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
  BRIDGE_SECRET: 'bridge-secret',
}

function request(path: string, secret?: string) {
  return new Request(`https://agent.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-bridge-secret': secret } : {}) },
    body: JSON.stringify({ action: 'claim_delivery', leaseId: 'test-lease' }),
  })
}

describe('iMessage outbox authentication', () => {
  test('forwards a trusted background poll without a user header', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe('https://example.convex.site/internal/imessage')
        expect(init?.headers).toEqual({ authorization: 'Bearer broker-secret', 'content-type': 'application/json' })
        expect(JSON.parse(String(init?.body))).toEqual({ operation: 'claim_delivery', leaseId: 'test-lease' })
        return Response.json(null)
      },
      { preconnect: globalThis.fetch.preconnect },
    ))
    try {
      const response = await app.request(request('/bridge/outbox', 'bridge-secret'), undefined, env)
      expect(response.status).toBe(200)
      expect(await response.json()).toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('rejects missing or invalid bridge secrets before reaching Convex', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch')
    try {
      for (const secret of [undefined, 'wrong-secret']) {
        const response = await app.request(request('/bridge/outbox', secret), undefined, env)
        expect(response.status).toBe(403)
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('does not exempt other bridge routes or outbox subpaths from user authentication', async () => {
    for (const path of ['/bridge/channel', '/bridge/outbox/extra']) {
      const response = await app.request(request(path, 'bridge-secret'), undefined, env)
      expect(response.status).toBe(401)
    }
  })
})
