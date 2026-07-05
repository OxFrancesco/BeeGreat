import { flue } from '@flue/runtime/routing'
import { Hono } from 'hono'
import { createRemoteJWKSet, jwtVerify } from 'jose'

type Bindings = {
  ELEVENLABS_API_KEY: string
  ELEVENLABS_VOICE_ID?: string
  CLERK_JWT_ISSUER_DOMAIN: string
}

type Variables = {
  userId: string
}

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
// "Rachel" premade voice; override per-deployment with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const MAX_SPOKEN_CHARS = 2000

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

app.get('/health', (c) => c.json({ ok: true }))

/** Maps an ElevenLabs error body to a message the app can show as-is. */
function voiceErrorMessage(fallback: string, detail: string) {
  return detail.includes('quota_exceeded')
    ? 'ElevenLabs is out of voice credits. Raise the API key limit in the ElevenLabs dashboard.'
    : fallback
}

// Every route below requires a valid Clerk session token.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

app.use('*', async (c, next) => {
  const issuer = c.env.CLERK_JWT_ISSUER_DOMAIN
  if (!issuer) {
    console.error('CLERK_JWT_ISSUER_DOMAIN is not configured')
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

  // Agent instances are keyed by Clerk user id; users can only reach their own.
  const match = c.req.path.match(/^\/agents\/[^/]+\/([^/]+)/)
  if (match && decodeURIComponent(match[1]) !== c.get('userId')) {
    return c.json({ error: "You can't access another user's agent." }, 403)
  }

  await next()
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

  const upstream = new FormData()
  upstream.append(
    'file',
    new File([new Uint8Array(audio)], `voice-note.${extension}`, { type: mimeType }),
  )
  upstream.append('model_id', 'scribe_v2')

  const response = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': c.env.ELEVENLABS_API_KEY },
    body: upstream,
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error('elevenlabs stt failed', response.status, detail)
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

  const voiceId = c.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID
  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': c.env.ELEVENLABS_API_KEY,
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
    return c.json({ error: voiceErrorMessage('Speech synthesis failed.', detail) }, 502)
  }

  return c.json({ audio: toBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' })
})

app.route('/', flue())

export default app
