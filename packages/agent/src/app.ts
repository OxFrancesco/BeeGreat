import { dispatch } from '@flue/runtime'
import { createAgentRouter } from '@flue/runtime/routing'
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  toError,
} from '@beegreat/observability'
import * as Sentry from '@sentry/cloudflare'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { Bee } from './agents/bee.ts'
import { channel as githubChannel } from './channels/github.ts'
import { channel as linearChannel } from './channels/linear.ts'
import { channel as notionChannel } from './channels/notion.ts'
import {
  callChannelAction,
  type ChannelActionName,
} from './shared/channel-actions'
import { checkPaidSubscription } from './subscription-gate'

type Bindings = {
  ELEVENLABS_API_KEY: string
  ELEVENLABS_VOICE_ID?: string
  XAI_API_KEY?: string
  CLERK_JWT_ISSUER_DOMAIN: string
  CONVEX_URL?: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  REQUIRE_SUBSCRIPTION?: string
  // Shared secret for trusted service bridges (e.g. the iMessage bridge).
  BRIDGE_SECRET?: string
  SENTRY_DSN?: string
  SENTRY_ENVIRONMENT?: string
  SENTRY_RELEASE?: string
  WEB_ALLOWED_ORIGINS?: string
  FLUE_BEE_AGENT: {
    getByName(name: string): { deleteAccountData(): Promise<void> }
  }
  BEE_SITES_BUCKET: {
    list(options: {
      prefix: string
      limit?: number
    }): Promise<{ objects: Array<{ key: string }> }>
    delete(keys: string[]): Promise<void>
  }
}

type Variables = {
  userId: string
  authKind: 'bridge' | 'clerk'
}

function binding<K extends keyof Bindings>(env: Bindings, name: K): Bindings[K] | undefined {
  const configured = env[name]
  if (configured !== undefined) return configured
  return (
    globalThis as unknown as {
      process?: { env?: Partial<Record<keyof Bindings, string>> }
    }
  ).process?.env?.[name] as Bindings[K] | undefined
}

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
const XAI_REALTIME_CLIENT_SECRETS =
  'https://api.x.ai/v1/realtime/client_secrets'
// "Rachel" premade voice; override per-deployment with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const MAX_SPOKEN_CHARS = 2000
const LOCAL_WEB_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])
const STREAM_RESPONSE_HEADERS = [
  'Stream-Next-Offset',
  'Stream-Up-To-Date',
  'Location',
]

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function isAllowedWebOrigin(env: Bindings, origin: string) {
  const configured = binding(env, 'WEB_ALLOWED_ORIGINS')
    ?.split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return configured?.length
    ? configured.includes(origin)
    : LOCAL_WEB_ORIGINS.has(origin)
}

// Browser Flue clients use a Clerk bearer token, which triggers an OPTIONS
// preflight. Keep the origin policy ahead of auth so production SSE can connect
// while unknown browser origins fail closed. Native clients send no Origin.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  if (origin && !isAllowedWebOrigin(c.env, origin)) {
    c.header('Vary', 'Origin')
    return c.json({ error: 'Origin is not allowed.' }, 403)
  }
  await next()
})

app.use(
  '*',
  cors({
    origin: (origin, c) =>
      origin && isAllowedWebOrigin(c.env as Bindings, origin) ? origin : null,
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    exposeHeaders: STREAM_RESPONSE_HEADERS,
    maxAge: 86_400,
  }),
)

function captureWorkerFailure(
  error: unknown,
  operation: string,
  extra?: Record<string, unknown>,
) {
  Sentry.captureException(toError(error), {
    tags: { service: 'agent-worker', operation, handled: 'true' },
    extra,
  })
}

app.get('/health', (c) => c.json({ ok: true }))

/** Maps an ElevenLabs error body to a message the app can show as-is. */
function voiceErrorMessage(fallback: string, detail: string) {
  return detail.includes('quota_exceeded')
    ? 'ElevenLabs is out of voice credits. Raise the API key limit in the ElevenLabs dashboard.'
    : fallback
}

// Constant-time comparison so the bridge secret can't be probed byte-by-byte.
function secretsMatch(a: string, b: string) {
  const encoder = new TextEncoder()
  const [bytesA, bytesB] = [encoder.encode(a), encoder.encode(b)]
  if (bytesA.length !== bytesB.length) return false
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i]
  return diff === 0
}

// Every route below requires a valid Clerk session token, or the bridge
// shared secret plus the user the bridge is acting for.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

app.use('*', async (c, next) => {
  // Provider webhook routes authenticate with the exact-body signature checks
  // in @flue/github, @flue/linear, and @flue/notion. They must reach Flue
  // without a Clerk token; no other channel route receives this exception.
  if (
    /^\/channels\/(github|linear|notion)\/webhook$/.test(c.req.path)
  ) {
    await next()
    return
  }
  // These routes authenticate their Convex caller with the same server-only
  // broker secret in their own handlers. Account deletion must remain
  // reachable after Clerk has deleted the user's identity and session, and
  // settled-action wake-ups arrive without any user session at all.
  if (
    c.req.path === '/internal/account-deletion' ||
    c.req.path === '/internal/web3-settled'
  ) {
    await next()
    return
  }
  const bridgeSecret = c.req.header('x-bridge-secret')
  const bridgeUser = c.req.header('x-bridge-user')
  const configuredBridgeSecret = binding(c.env, 'BRIDGE_SECRET')
  if (
    bridgeSecret &&
    bridgeUser &&
    configuredBridgeSecret &&
    secretsMatch(bridgeSecret, configuredBridgeSecret)
  ) {
    c.set('userId', bridgeUser)
    c.set('authKind', 'bridge')
  } else {
    const issuer = binding(c.env, 'CLERK_JWT_ISSUER_DOMAIN')
    if (!issuer) {
      console.error('CLERK_JWT_ISSUER_DOMAIN is not configured')
      captureWorkerFailure(
        new Error('CLERK_JWT_ISSUER_DOMAIN is not configured'),
        'auth.configuration',
      )
      return c.json({ error: 'Auth is not configured.' }, 500)
    }

    const token = c.req.header('authorization')?.replace(/^Bearer /i, '')
    if (!token) {
      return c.json({ error: 'Sign in to talk to Bee.' }, 401)
    }

    jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer })
      if (!payload.sub) throw new Error('Token has no subject')
      c.set('userId', payload.sub)
      c.set('authKind', 'clerk')
    } catch {
      return c.json({ error: 'Session expired. Sign in again.' }, 401)
    }
  }

  // Agent instances are keyed by Clerk user id (optionally suffixed with
  // `~<session>` for restarted conversations); users can only reach their own.
  const match = c.req.path.match(/^\/agents\/[^/]+\/([^/]+)/)
  if (match && decodeURIComponent(match[1]).split('~')[0] !== c.get('userId')) {
    return c.json({ error: "You can't access another user's agent." }, 403)
  }

  Sentry.setUser({ id: c.get('userId') })

  // BeeGreat Pro is optional: the hard gate only engages when a deployment
  // explicitly opts in with REQUIRE_SUBSCRIPTION=true.
  const requireSubscription =
    binding(c.env, 'REQUIRE_SUBSCRIPTION')?.trim().toLowerCase() === 'true'
  if (
    requireSubscription &&
    /^\/(?:agents(?:\/|$)|voice(?:\/|$))/.test(c.req.path)
  ) {
    const subscription = await checkPaidSubscription(c.get('userId'), {
      CONVEX_URL: binding(c.env, 'CONVEX_URL'),
      CONVEX_SITE_URL: binding(c.env, 'CONVEX_SITE_URL'),
      AGENT_CREDENTIAL_BROKER_SECRET: binding(
        c.env,
        'AGENT_CREDENTIAL_BROKER_SECRET',
      ),
    })
    if (subscription.status === 'inactive') {
      return c.json(
        {
          error:
            'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.',
          code: 'SUBSCRIPTION_REQUIRED',
          recovery: {
            action: 'subscribe_or_restore',
            platform: 'ios',
          },
        },
        402,
      )
    }
    if (subscription.status === 'unavailable') {
      captureWorkerFailure(
        new Error('Subscription verification is unavailable'),
        'subscription.verify',
        { reason: subscription.reason },
      )
      c.header('retry-after', '5')
      return c.json(
        {
          error: 'Subscription verification is temporarily unavailable.',
          code: 'SUBSCRIPTION_UNAVAILABLE',
        },
        503,
      )
    }
  }

  await next()
})

app.post('/internal/account-deletion', async (c) => {
  const configuredSecret = binding(c.env, 'AGENT_CREDENTIAL_BROKER_SECRET')
  const suppliedSecret = c.req.header('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (
    !configuredSecret ||
    !suppliedSecret ||
    !secretsMatch(configuredSecret, suppliedSecret)
  ) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const body = (await c.req.json().catch(() => null)) as {
    userId?: unknown
    conversationIds?: unknown
  } | null
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    !Array.isArray(body.conversationIds) ||
    body.conversationIds.length > 250 ||
    body.conversationIds.some(
      (id) =>
        typeof id !== 'string' ||
        (id !== body.userId && !new RegExp(`^${body.userId}~[0-9]+$`).test(id)),
    )
  ) {
    return c.json({ error: 'Invalid deletion request' }, 400)
  }

  const conversationIds = [...new Set(body.conversationIds)]
  for (let index = 0; index < conversationIds.length; index += 20) {
    await Promise.all(
      conversationIds
        .slice(index, index + 20)
        .map((id) => c.env.FLUE_BEE_AGENT.getByName(id).deleteAccountData()),
    )
  }
  let siteObjectsDeleted = 0
  const prefix = `users/${body.userId}/`
  while (true) {
    const page = await c.env.BEE_SITES_BUCKET.list({ prefix, limit: 1_000 })
    const keys = page.objects.map((object) => object.key)
    if (!keys.length) break
    await c.env.BEE_SITES_BUCKET.delete(keys)
    siteObjectsDeleted += keys.length
    if (siteObjectsDeleted > 100_000) {
      throw new Error('Bee Site account cleanup exceeded its safety bound')
    }
  }
  return c.json({ deleted: conversationIds.length, siteObjectsDeleted })
})

/**
 * Convex wake-up for settled Web3 actions: injects a `web3.action_settled`
 * event into the user's active Bee conversation so long-running multi-step
 * plans (e.g. bridge, then open a pool position) continue without the user
 * nudging the chat. The event carries status only — Bee re-reads authoritative
 * details through its own Web3 tools and still cannot confirm or execute.
 */
app.post('/internal/web3-settled', async (c) => {
  const configuredSecret = binding(c.env, 'AGENT_CREDENTIAL_BROKER_SECRET')
  const suppliedSecret = c.req.header('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (
    !configuredSecret ||
    !suppliedSecret ||
    !secretsMatch(configuredSecret, suppliedSecret)
  ) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const body = (await c.req.json().catch(() => null)) as {
    userId?: unknown
    conversationId?: unknown
    actionId?: unknown
    kind?: unknown
    status?: unknown
    summary?: unknown
    detail?: unknown
    error?: unknown
    explorerLink?: unknown
  } | null
  const status = body?.status
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    typeof body.conversationId !== 'string' ||
    (body.conversationId !== body.userId &&
      !new RegExp(`^${body.userId}~[0-9]+$`).test(body.conversationId)) ||
    typeof body.actionId !== 'string' ||
    typeof body.summary !== 'string' ||
    (status !== 'executed' &&
      status !== 'failed' &&
      status !== 'refunded' &&
      status !== 'expired')
  ) {
    return c.json({ error: 'Invalid settled-action event' }, 400)
  }
  const attributes: Record<string, string> = { actionId: body.actionId, status }
  if (typeof body.kind === 'string') attributes.kind = body.kind
  if (typeof body.detail === 'string') attributes.detail = body.detail
  if (typeof body.error === 'string') attributes.error = body.error
  if (typeof body.explorerLink === 'string') {
    attributes.explorerLink = body.explorerLink
  }
  await dispatch(Bee, {
    id: body.conversationId,
    message: {
      kind: 'signal',
      type: 'web3.action_settled',
      body: body.summary,
      attributes,
    },
  })
  return c.json({ dispatched: true })
})

/**
 * Gives trusted text-channel adapters the same intent-level client actions as
 * the signed-in apps while keeping all writes inside Convex transactions.
 */
app.post('/bridge/channel', async (c) => {
  if (c.get('authKind') !== 'bridge') {
    return c.json({ error: 'Trusted bridge authentication is required.' }, 403)
  }
  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  const action = body?.action
  if (typeof action !== 'string') {
    return c.json({ error: 'Send a channel action.' }, 400)
  }

  let channelAction: ChannelActionName
  let input: Record<string, unknown>
  if (action === 'context' || action === 'create_thread') {
    if (body?.source !== 'imessage') {
      return c.json({ error: 'Send a valid channel source.' }, 400)
    }
    channelAction = action
    input = { source: body.source }
  } else if (action === 'title_thread') {
    if (
      typeof body?.threadId !== 'number' ||
      !Number.isFinite(body.threadId) ||
      typeof body.title !== 'string'
    ) {
      return c.json({ error: 'Invalid conversation title.' }, 400)
    }
    channelAction = action
    input = { threadId: body.threadId, title: body.title }
  } else if (
    action === 'confirm_first_focus' ||
    action === 'cancel_first_focus'
  ) {
    if (
      typeof body?.requestId !== 'string' ||
      typeof body.goalTitle !== 'string' ||
      typeof body.projectTitle !== 'string' ||
      typeof body.taskTitle !== 'string' ||
      (body.highlightExpiresAt !== undefined &&
        (typeof body.highlightExpiresAt !== 'number' ||
          !Number.isFinite(body.highlightExpiresAt)))
    ) {
      return c.json({ error: 'Invalid first-focus action.' }, 400)
    }
    channelAction = action
    input = {
      requestId: body.requestId,
      goalTitle: body.goalTitle,
      projectTitle: body.projectTitle,
      taskTitle: body.taskTitle,
      ...(typeof body.highlightExpiresAt === 'number'
        ? { highlightExpiresAt: body.highlightExpiresAt }
        : {}),
    }
  } else if (action === 'complete_highlight') {
    if (
      typeof body?.requestId !== 'string' ||
      typeof body.taskId !== 'string'
    ) {
      return c.json({ error: 'Invalid Highlight completion.' }, 400)
    }
    channelAction = action
    input = { requestId: body.requestId, taskId: body.taskId }
  } else if (action === 'get_web3_action') {
    if (typeof body?.actionId !== 'string' || !body.actionId.trim()) {
      return c.json({ error: 'Invalid Web3 action.' }, 400)
    }
    channelAction = action
    input = { actionId: body.actionId }
  } else if (action === 'confirm_web3' || action === 'cancel_web3') {
    if (
      typeof body?.actionId !== 'string' ||
      !body.actionId.trim() ||
      typeof body.summary !== 'string' ||
      !body.summary.trim()
    ) {
      return c.json({ error: 'Invalid Web3 action.' }, 400)
    }
    channelAction = action
    input = { actionId: body.actionId, summary: body.summary }
  } else {
    return c.json({ error: 'Unknown channel action.' }, 400)
  }

  const convexUrl = binding(c.env, 'CONVEX_URL')
  const clerkIssuer = binding(c.env, 'CLERK_JWT_ISSUER_DOMAIN')
  if (!convexUrl || !clerkIssuer) {
    captureWorkerFailure(
      new Error('Channel actions are not configured'),
      'bridge.channel.configuration',
    )
    return c.json({ error: 'Channel actions are not configured.' }, 503)
  }
  try {
    const result = await callChannelAction(
      {
        convexUrl,
        convexSiteUrl: binding(c.env, 'CONVEX_SITE_URL'),
        brokerSecret:
          binding(c.env, 'AGENT_CREDENTIAL_BROKER_SECRET') ??
          binding(c.env, 'BRIDGE_SECRET'),
        clerkIssuer,
      },
      c.get('userId'),
      channelAction,
      input,
    )
    return c.body(JSON.stringify(result), 200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
  } catch (error) {
    captureWorkerFailure(error, `bridge.channel.${channelAction}`)
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Channel action failed.',
      },
      400,
    )
  }
})

// Speech-to-text: raw audio bytes in, proxied to ElevenLabs Scribe.
// The client sends raw bytes (React Native FormData is unreliable), and the
// worker wraps them in the multipart request ElevenLabs expects.
app.post('/voice/transcribe', async (c) => {
  const audio = await c.req.arrayBuffer()
  if (audio.byteLength === 0) {
    return c.json({ error: 'Send audio bytes in the request body.' }, 400)
  }
  const mimeType = c.req.header('content-type') ?? 'audio/m4a'
  const extension = mimeType.split('/')[1]?.split(';')[0] ?? 'm4a'
  const apiKey = binding(c.env, 'ELEVENLABS_API_KEY')
  if (!apiKey) {
    captureWorkerFailure(
      new Error('ELEVENLABS_API_KEY is not configured'),
      'voice.transcribe.configuration',
    )
    return c.json({ error: 'Voice transcription is not configured.' }, 500)
  }

  const upstream = new FormData()
  upstream.append(
    'file',
    new File([new Uint8Array(audio)], `voice-note.${extension}`, { type: mimeType }),
  )
  upstream.append('model_id', 'scribe_v2')

  const response = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: upstream,
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error('elevenlabs stt failed', response.status, detail)
    captureWorkerFailure(
      new Error(`ElevenLabs transcription returned HTTP ${response.status}`),
      'voice.transcribe.upstream',
      {
        status: response.status,
        upstreamRequestId:
          response.headers.get('request-id') ??
          response.headers.get('x-request-id') ??
          undefined,
      },
    )
    return c.json({ error: voiceErrorMessage('Transcription failed.', detail) }, 502)
  }

  const result = (await response.json()) as { text: string; language_code?: string }
  return c.json({ text: result.text, languageCode: result.language_code ?? null })
})

// Short-lived xAI credential for direct mobile → xAI realtime audio.
// The long-lived API key stays in the Worker; the returned client secret
// expires automatically and is scoped to realtime connections.
app.post('/voice/realtime-token', async (c) => {
  const apiKey = binding(c.env, 'XAI_API_KEY')
  if (!apiKey) {
    captureWorkerFailure(
      new Error('XAI_API_KEY is not configured'),
      'voice.realtime.configuration',
    )
    return c.json({ error: 'Conversational voice is not configured.' }, 500)
  }

  const response = await fetch(XAI_REALTIME_CLIENT_SECRETS, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('xai realtime token failed', response.status, detail)
    captureWorkerFailure(
      new Error(`xAI realtime token returned HTTP ${response.status}`),
      'voice.realtime.upstream',
      {
        status: response.status,
        upstreamRequestId:
          response.headers.get('request-id') ??
          response.headers.get('x-request-id') ??
          undefined,
      },
    )
    return c.json(
      { error: 'Conversational voice could not start. Try again.' },
      502,
    )
  }

  const result = (await response.json()) as {
    value?: string
    expires_at?: number
  }
  if (!result.value || typeof result.expires_at !== 'number') {
    captureWorkerFailure(
      new Error('xAI realtime token response was malformed'),
      'voice.realtime.response',
    )
    return c.json(
      { error: 'Conversational voice could not start. Try again.' },
      502,
    )
  }

  c.header('cache-control', 'no-store')
  return c.json({ token: result.value, expiresAt: result.expires_at })
})

// Text-to-speech: `{ text }` in, base64 mp3 out (React Native writes it to a file to play).
app.post('/voice/speak', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { text?: string } | null
  const text = body?.text?.trim()
  if (!text) {
    return c.json({ error: 'Send `text` to speak.' }, 400)
  }

  const apiKey = binding(c.env, 'ELEVENLABS_API_KEY')
  if (!apiKey) {
    captureWorkerFailure(
      new Error('ELEVENLABS_API_KEY is not configured'),
      'voice.speak.configuration',
    )
    return c.json({ error: 'Voice synthesis is not configured.' }, 500)
  }
  const voiceId = binding(c.env, 'ELEVENLABS_VOICE_ID') ?? DEFAULT_VOICE_ID
  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: text.slice(0, MAX_SPOKEN_CHARS),
        model_id: 'eleven_flash_v2_5',
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text()
    console.error('elevenlabs tts failed', response.status, detail)
    captureWorkerFailure(
      new Error(`ElevenLabs synthesis returned HTTP ${response.status}`),
      'voice.speak.upstream',
      {
        status: response.status,
        upstreamRequestId:
          response.headers.get('request-id') ??
          response.headers.get('x-request-id') ??
          undefined,
      },
    )
    return c.json({ error: voiceErrorMessage('Speech synthesis failed.', detail) }, 502)
  }

  return c.json({ audio: toBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' })
})

// Flue 2.0 routing is explicit: the agent router serves POST/GET/abort/
// attachments under /agents/bee/:id, and each channel mounts its own webhook
// routes at the paths registered with the providers.
app.route('/agents/bee', createAgentRouter(Bee))
app.route('/channels/github', githubChannel.route())
app.route('/channels/linear', linearChannel.route())
app.route('/channels/notion', notionChannel.route())

export default Sentry.withSentry<Bindings>(
  (env) => {
    const dsn = binding(env, 'SENTRY_DSN')?.trim()
    return {
      dsn,
      enabled: Boolean(dsn),
      environment: binding(env, 'SENTRY_ENVIRONMENT') ?? 'production',
      release: binding(env, 'SENTRY_RELEASE'),
      sendDefaultPii: false,
      beforeSend: sanitizeSentryEvent,
      beforeBreadcrumb: sanitizeSentryBreadcrumb,
      initialScope: { tags: { service: 'agent-worker' } },
      tracesSampleRate: 0.2,
    }
  },
  app,
)
