import type { Hono } from 'hono'
import * as v from 'valibot'
import {
  binding,
  captureWorkerFailure,
  type AppEnvironment,
} from '../app-env.ts'
import { trustedCast } from '../shared/trusted-cast.ts'

/** ElevenLabs Scribe transcription (documented 200-response shape). */
type ScribeTranscription = {
  text: string
  language_code?: string
}

const realtimeTokenSchema = v.object({
  value: v.pipe(v.string(), v.minLength(1)),
  expires_at: v.number(),
})

const speakBodySchema = v.object({ text: v.optional(v.string()) })

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
const XAI_REALTIME_CLIENT_SECRETS =
  'https://api.x.ai/v1/realtime/client_secrets'
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

/** Maps an ElevenLabs error body to a message the app can show as-is. */
function voiceErrorMessage(fallback: string, detail: string) {
  return detail.includes('quota_exceeded')
    ? 'ElevenLabs is out of voice credits. Raise the API key limit in the ElevenLabs dashboard.'
    : fallback
}

export function registerVoiceRoutes(app: Hono<AppEnvironment>) {
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
      new File([new Uint8Array(audio)], `voice-note.${extension}`, {
        type: mimeType,
      }),
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
      return c.json(
        { error: voiceErrorMessage('Transcription failed.', detail) },
        502,
      )
    }

    // ElevenLabs guarantees the Scribe response shape on HTTP 200.
    const result = trustedCast<ScribeTranscription>(await response.json())
    return c.json({
      text: result.text,
      languageCode: result.language_code ?? null,
    })
  })

  // Short-lived xAI credential for direct mobile → xAI realtime audio.
  // The long-lived API key stays in the Worker; the returned client secret
  // expires automatically and is scoped to realtime connections.
  app.post('/voice/realtime-token', async (c) => {
    // Secrets pasted with line breaks or smart quotes make `Bearer ${key}` an
    // invalid header value, which used to crash the route. Strip whitespace and
    // fail with a clear message if the remainder still can't go in a header.
    const apiKey = binding(c.env, 'XAI_API_KEY')?.replace(/\s+/g, '')
    if (!apiKey || !/^[\x21-\x7e]+$/.test(apiKey)) {
      captureWorkerFailure(
        new Error(
          apiKey
            ? 'XAI_API_KEY contains characters that are invalid in a header — re-set the secret'
            : 'XAI_API_KEY is not configured',
        ),
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

    const result = v.safeParse(realtimeTokenSchema, await response.json())
    if (!result.success) {
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
    return c.json({
      token: result.output.value,
      expiresAt: result.output.expires_at,
    })
  })

  // Text-to-speech: `{ text }` in, base64 mp3 out (React Native writes it to a file to play).
  app.post('/voice/speak', async (c) => {
    const rawBody = await c.req.json().catch(() => null)
    const body = v.is(speakBodySchema, rawBody) ? rawBody : null
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
      return c.json(
        { error: voiceErrorMessage('Speech synthesis failed.', detail) },
        502,
      )
    }

    return c.json({
      audio: toBase64(await response.arrayBuffer()),
      mimeType: 'audio/mpeg',
    })
  })
}
