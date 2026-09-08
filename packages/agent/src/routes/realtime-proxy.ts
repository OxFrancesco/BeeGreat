import type { Hono } from 'hono'
import * as v from 'valibot'
import { binding, captureWorkerFailure, type AppContext, type AppEnvironment } from '../app-env'
import { claimVoiceTicket, releaseUsage, reserveUsage, ticketHash, type PaidUsageRuntime } from '../shared/paid-usage'

export function voiceUsageRuntime(c: AppContext): PaidUsageRuntime {
  return { convexUrl: binding(c.env, 'CONVEX_URL'), convexSiteUrl: binding(c.env, 'CONVEX_SITE_URL'), brokerSecret: binding(c.env, 'AGENT_CREDENTIAL_BROKER_SECRET') }
}

export async function issueRealtimeTicket(c: AppContext) {
  if (!binding(c.env, 'XAI_API_KEY')?.trim()) return c.json({ error: 'Conversational voice is not configured.' }, 503)
  const ticket = crypto.randomUUID() + crypto.randomUUID()
  try {
    await reserveUsage(c.get('userId'), 'voice_realtime', 1, voiceUsageRuntime(c), c.req.raw.signal, await ticketHash(ticket))
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Voice is temporarily unavailable.' }, 429)
  }
  const websocketUrl = new URL('/voice/realtime', c.req.url)
  websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  c.header('cache-control', 'no-store')
  return c.json({ token: ticket, expiresAt: Math.floor(Date.now() / 1000) + 60, websocketUrl: websocketUrl.toString() })
}

export function connectVoiceSockets(client: WebSocket, provider: WebSocket, expiresAt: number, onClose: () => void, now = Date.now) {
  let closed = false
  let sentBytes = 0
  let receivedBytes = 0
  let sentMessages = 0
  let configured = false
  const close = (code = 1000, reason = 'Voice session ended') => {
    if (closed) return
    closed = true
    clearTimeout(timer)
    try { client.close(code, reason) } catch {}
    try { provider.close(code, reason) } catch {}
    onClose()
  }
  const timer = setTimeout(() => close(1000, 'Voice time limit reached'), Math.max(0, expiresAt - now()))
  client.addEventListener('message', event => {
    if (closed) return
    if (now() >= expiresAt) { close(1000, 'Voice time limit reached'); return }
    if (typeof event.data !== 'string' || event.data.length > 256 * 1024) { close(1009, 'Voice message is too large'); return }
    let parsed: unknown
    try { parsed = JSON.parse(event.data) } catch { close(1008, 'Invalid voice message'); return }
    if (!v.is(v.object({ type: v.string() }), parsed)) { close(1008, 'Invalid voice message'); return }
    if (parsed.type === 'session.update') {
      if (configured || event.data.length > 8192) { close(1008, 'Voice configuration limit reached'); return }
      configured = true
    } else if (parsed.type === 'input_audio_buffer.append') {
      if (!configured || !v.is(v.object({ audio: v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]*={0,2}$/)) }), parsed)) { close(1008, 'Invalid voice audio'); return }
    } else if (parsed.type !== 'pong') { close(1008, 'Unsupported voice event'); return }
    sentBytes += event.data.length
    sentMessages++
    if (sentBytes > 24 * 1024 * 1024 || sentMessages > 20_000) { close(1008, 'Voice session limit reached'); return }
    try { provider.send(event.data) } catch { close(1011, 'Voice connection failed') }
  })
  provider.addEventListener('message', event => {
    if (closed) return
    const size = typeof event.data === 'string' ? event.data.length : event.data.byteLength
    receivedBytes += size
    if (size > 2 * 1024 * 1024 || receivedBytes > 64 * 1024 * 1024) { close(1009, 'Voice response limit reached'); return }
    try { client.send(event.data) } catch { close(1011, 'Voice connection failed') }
  })
  for (const socket of [client, provider]) {
    socket.addEventListener('close', () => close())
    socket.addEventListener('error', () => close(1011, 'Voice connection failed'))
  }
  return close
}

export function registerRealtimeProxy(app: Hono<AppEnvironment>) {
  app.get('/voice/realtime', async c => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.json({ error: 'Expected a WebSocket connection.' }, 426)
    const protocols = c.req.header('sec-websocket-protocol')?.split(',').map(value => value.trim()) ?? []
    const ticketProtocol = protocols.find(value => value.startsWith('bee-voice.'))
    const ticket = ticketProtocol?.slice('bee-voice.'.length)
    if (!ticket || !/^[0-9a-f-]{72}$/.test(ticket)) return c.json({ error: 'Voice ticket is required.' }, 401)
    const runtime = voiceUsageRuntime(c)
    let permit: Awaited<ReturnType<typeof claimVoiceTicket>>
    try { permit = await claimVoiceTicket(await ticketHash(ticket), runtime) }
    catch { return c.json({ error: 'Voice ticket expired or already used.' }, 401) }
    const release = () => c.executionCtx.waitUntil(releaseUsage(permit.userId, permit.leaseId, runtime).catch(error => captureWorkerFailure(error, 'voice.release')))
    try {
      const apiKey = binding(c.env, 'XAI_API_KEY')?.trim()
      if (!apiKey) throw new Error('Voice provider is not configured')
      const upstream = await fetch('https://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0', {
        headers: { upgrade: 'websocket', authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
      })
      const provider = upstream.webSocket
      if (!provider || upstream.status !== 101) throw new Error('Voice provider connection failed')
      const pair = new WebSocketPair()
      const [client, server] = [pair[0], pair[1]]
      provider.accept()
      server.accept()
      connectVoiceSockets(server, provider, permit.expiresAt, release)
      return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': ticketProtocol! } })
    } catch (error) {
      release()
      captureWorkerFailure(error, 'voice.proxy')
      return c.json({ error: 'Conversational voice could not start. Try again.' }, 502)
    }
  })
}
