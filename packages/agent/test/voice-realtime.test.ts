import { describe, expect, mock, spyOn, test } from 'bun:test'
import app from '../src/app'

function request() {
  return new Request('https://agent.example.test/voice/realtime-token', {
    method: 'POST', headers: { 'x-bridge-secret': 'bridge-secret', 'x-bridge-user': 'user_owner' },
  })
}
function env(xaiApiKey?: string) {
  return {
    ELEVENLABS_API_KEY: 'unused', XAI_API_KEY: xaiApiKey,
    CLERK_JWT_ISSUER_DOMAIN: 'https://issuer.example.test', BRIDGE_SECRET: 'bridge-secret',
    CONVEX_SITE_URL: 'https://bee.convex.site', AGENT_CREDENTIAL_BROKER_SECRET: 'broker-secret',
    FLUE_BEE_V2_AGENT: { getByName() { return { async deleteAccountData() {} } } },
  }
}

describe('metered realtime voice admission', () => {
  test('returns a one-use proxy ticket while the provider key stays server-side', async () => {
    const fetcher = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://bee.convex.site/internal/paid-usage')
      expect(init?.headers).toMatchObject({ authorization: 'Bearer broker-secret' })
      expect(JSON.parse(String(init?.body))).toMatchObject({ action: 'reserve', userId: 'user_owner', operation: 'voice_realtime', units: 1 })
      return Response.json({ leaseId: 'lease', expiresAt: Date.now() + 360_000 })
    })
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(fetcher as typeof fetch)
    try {
      const response = await app.request(request(), undefined, env('long-lived-xai-key\n'))
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      const body = await response.json()
      expect(body.websocketUrl).toBe('wss://agent.example.test/voice/realtime')
      expect(body.token).toMatch(/^[a-f0-9-]{72}$/)
      expect(JSON.stringify(body)).not.toContain('long-lived-xai-key')
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally { fetchSpy.mockRestore() }
  })

  test('quota rejection returns no ticket and cannot contact xAI', async () => {
    const fetcher = mock(async () => Response.json({ error: 'Daily limit reached' }, { status: 429 }))
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(fetcher as typeof fetch)
    try {
      const response = await app.request(request(), undefined, env('key'))
      expect(response.status).toBe(429)
      expect(await response.json()).toEqual({ error: 'Daily limit reached' })
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally { fetchSpy.mockRestore() }
  })

  test('missing configuration and invalid websocket tickets fail before provider access', async () => {
    const fetcher = mock(async () => Response.json({}))
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(fetcher as typeof fetch)
    try {
      expect((await app.request(request(), undefined, env())).status).toBe(503)
      expect((await app.request(new Request('https://agent.example.test/voice/realtime', { headers: { upgrade: 'websocket' } }), undefined, env('key'))).status).toBe(401)
      expect(fetcher).not.toHaveBeenCalled()
    } finally { fetchSpy.mockRestore() }
  })
})

test('exhausted transcription requests are rejected without reading their audio streams', async () => {
  let pulls = 0
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ error: 'Daily limit reached' }, { status: 429 }))
  try {
    const responses = await Promise.all(Array.from({ length: 6 }, () => {
      const body = new ReadableStream({ pull() { pulls++ } }, { highWaterMark: 0 })
      return app.request(new Request('https://agent.example.test/voice/transcribe', { method: 'POST', headers: { 'x-bridge-secret': 'bridge-secret', 'x-bridge-user': 'user_owner' }, body }), undefined, env('key'))
    }))
    expect(responses.map(response => response.status)).toEqual(Array(6).fill(429))
    expect(pulls).toBe(0)
  } finally { fetchSpy.mockRestore() }
})

test('oversize admitted uploads release their slot without contacting the provider', async () => {
  const actions: string[] = []
  const pending: Promise<unknown>[] = []
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    expect(String(input)).toBe('https://bee.convex.site/internal/paid-usage')
    actions.push(JSON.parse(String(init?.body)).action)
    return Response.json({ leaseId: 'lease', expiresAt: Date.now() + 120_000 })
  })
  try {
    const response = await app.request(new Request('https://agent.example.test/voice/transcribe', { method: 'POST', headers: { 'x-bridge-secret': 'bridge-secret', 'x-bridge-user': 'user_owner' }, body: new Uint8Array(5 * 1024 * 1024 + 1) }), undefined, env('key'), { waitUntil(task: Promise<unknown>) { pending.push(task) }, passThroughOnException() {} } as ExecutionContext)
    await Promise.all(pending)
    expect(response.status).toBe(413)
    expect(actions).toEqual(['reserve', 'release'])
  } finally { fetchSpy.mockRestore() }
})

test('long replies preserve speech truncation and charge only submitted characters', async () => {
  const pending: Promise<unknown>[] = []
  const calls: unknown[] = []
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = JSON.parse(String(init?.body))
    calls.push(body)
    return String(input).startsWith('https://api.elevenlabs.io/') ? new Response(new Uint8Array([1, 2])) : Response.json({ leaseId: 'lease', expiresAt: Date.now() + 60_000 })
  })
  try {
    const response = await app.request(new Request('https://agent.example.test/voice/speak', { method: 'POST', headers: { 'x-bridge-secret': 'bridge-secret', 'x-bridge-user': 'user_owner', 'content-type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(2001) }) }), undefined, env('key'), { waitUntil(task: Promise<unknown>) { pending.push(task) }, passThroughOnException() {} } as ExecutionContext)
    await Promise.all(pending)
    expect(response.status).toBe(200)
    expect(calls[0]).toMatchObject({ action: 'reserve', units: 2000 })
    expect(calls[1]).toMatchObject({ text: 'a'.repeat(2000) })
    expect(calls[2]).toMatchObject({ action: 'release' })
  } finally { fetchSpy.mockRestore() }
})
