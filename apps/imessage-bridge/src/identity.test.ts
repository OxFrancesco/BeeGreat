import { describe, expect, test } from 'bun:test'

import {
  createIdentityClient,
  normalizeAddress,
  type IdentityActionBody,
} from './identity'

function jsonResponse(body: IdentityActionBody, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('address normalization', () => {
  test('matches the Convex normalization for phones and emails', () => {
    expect(normalizeAddress(' +1 (555) 123-4567 ')).toBe('+15551234567')
    expect(normalizeAddress('Someone@iCloud.com')).toBe('someone@icloud.com')
  })
})

describe('sender resolution', () => {
  test('resolves through /bridge/identity and caches the linked user', async () => {
    const requests: { action: string; address: string }[] = []
    const client = createIdentityClient({
      agentUrl: 'https://agent.example/',
      bridgeSecret: 'secret',
      fetcher: async (input, init) => {
        expect(String(input)).toBe('https://agent.example/bridge/identity')
        expect(new Headers(init?.headers).get('x-bridge-secret')).toBe(
          'secret',
        )
        requests.push(JSON.parse(String(init?.body)))
        return jsonResponse({ userId: 'user_123' })
      },
    })

    await expect(client.resolve('+15551234567')).resolves.toBe('user_123')
    await expect(client.resolve('+15551234567')).resolves.toBe('user_123')
    expect(requests).toEqual([
      { action: 'resolve', address: '+15551234567' },
    ])
  })

  test('an unknown sender re-checks after the short negative TTL', async () => {
    let calls = 0
    let currentTime = 0
    const client = createIdentityClient({
      agentUrl: 'https://agent.example',
      bridgeSecret: 'secret',
      now: () => currentTime,
      fetcher: async () => {
        calls += 1
        return jsonResponse({ userId: calls === 1 ? null : 'user_123' })
      },
    })

    await expect(client.resolve('+15551234567')).resolves.toBeNull()
    await expect(client.resolve('+15551234567')).resolves.toBeNull()
    currentTime = 16_000
    await expect(client.resolve('+15551234567')).resolves.toBe('user_123')
    expect(calls).toBe(2)
  })

  test('a failed resolution throws instead of dropping the sender', async () => {
    const client = createIdentityClient({
      agentUrl: 'https://agent.example',
      bridgeSecret: 'secret',
      fetcher: async () => jsonResponse({ error: 'nope' }, 503),
    })
    await expect(client.resolve('+15551234567')).rejects.toThrow('nope')
  })
})

describe('magic links', () => {
  test('mints one link and throttles repeats within the window', async () => {
    let calls = 0
    let currentTime = 0
    const client = createIdentityClient({
      agentUrl: 'https://agent.example',
      bridgeSecret: 'secret',
      now: () => currentTime,
      fetcher: async () => {
        calls += 1
        return jsonResponse({
          url: 'https://beegreat.app/link/imessage?token=abc',
          expiresAt: 900_000,
        })
      },
    })

    await expect(client.beginLink('+15551234567')).resolves.toEqual({
      status: 'link',
      url: 'https://beegreat.app/link/imessage?token=abc',
      expiresAt: 900_000,
    })
    await expect(client.beginLink('+15551234567')).resolves.toEqual({
      status: 'throttled',
    })
    currentTime = 3 * 60 * 1000
    await expect(client.beginLink('+15551234567')).resolves.toMatchObject({
      status: 'link',
    })
    expect(calls).toBe(2)
  })

  test('surfaces Convex rate limiting distinctly', async () => {
    const client = createIdentityClient({
      agentUrl: 'https://agent.example',
      bridgeSecret: 'secret',
      fetcher: async () => jsonResponse({ error: 'slow down' }, 429),
    })
    await expect(client.beginLink('+15551234567')).resolves.toEqual({
      status: 'rate_limited',
    })
  })
})

describe('unlink', () => {
  test('forgets the cached user after unlinking', async () => {
    let resolves = 0
    const client = createIdentityClient({
      agentUrl: 'https://agent.example',
      bridgeSecret: 'secret',
      fetcher: async (_input, init) => {
        const body: { action: string } = JSON.parse(String(init?.body))
        if (body.action === 'resolve') {
          resolves += 1
          return jsonResponse({ userId: resolves === 1 ? 'user_123' : null })
        }
        return jsonResponse({ disconnected: true })
      },
    })

    await expect(client.resolve('+15551234567')).resolves.toBe('user_123')
    await expect(client.unlink('+15551234567')).resolves.toBe(true)
    await expect(client.resolve('+15551234567')).resolves.toBeNull()
    expect(resolves).toBe(2)
  })
})
