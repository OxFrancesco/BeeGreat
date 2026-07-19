import { flue } from '@flue/runtime/routing'
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  toError,
} from '@beegreat/observability'
import * as Sentry from '@sentry/cloudflare'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { checkPaidSubscription } from './subscription-gate'

type Bindings = {
  ELEVENLABS_API_KEY: string
  ELEVENLABS_VOICE_ID?: string
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
}

type Variables = {
  userId: string
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
  // This route authenticates its Convex caller with the same server-only
  // broker secret in its own handler. It must remain reachable after Clerk
  // has deleted the user's identity and session.
  if (c.req.path === '/internal/account-deletion') {
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
  return c.json({ deleted: conversationIds.length })
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

app.route('/', flue())

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
