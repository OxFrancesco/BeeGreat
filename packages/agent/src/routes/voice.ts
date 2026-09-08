import type { Hono } from 'hono'
import { BodyTooLargeError, readLimitedBody } from '../shared/limited-body'
import { reserveUsage, releaseUsage } from '../shared/paid-usage'
import { issueRealtimeTicket, registerRealtimeProxy, voiceUsageRuntime } from './realtime-proxy'
import * as v from 'valibot'
import {
  binding,
  captureWorkerFailure,
  type AppEnvironment,
  type AppContext,
} from '../app-env.ts'
import { trustedCast } from '../shared/trusted-cast.ts'

/** ElevenLabs Scribe transcription (documented 200-response shape). */
type ScribeTranscription = {
  text: string
  language_code?: string
}

const speakBodySchema = v.object({ text: v.optional(v.string()) })

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

/** Maps an ElevenLabs error body to a message the app can show as-is. */
function voiceErrorMessage(fallback: string, detail: string) {
  return detail.includes('quota_exceeded')
    ? 'ElevenLabs is out of voice credits. Raise the API key limit in the ElevenLabs dashboard.'
    : fallback
}

async function readVoiceBody(c: AppContext, maxBytes: number) {
  try { return await readLimitedBody(c.req.raw, maxBytes) }
  catch (error) { if (error instanceof BodyTooLargeError) return c.json({ error: error.message }, 413); throw error }
}

async function voiceReservation(c: AppContext, operation: 'voice_transcribe' | 'voice_speak', units: number) {
  try { return await reserveUsage(c.get('userId'), operation, units, voiceUsageRuntime(c), c.req.raw.signal) }
  catch (error) { return c.json({ error: error instanceof Error ? error.message : 'Voice is temporarily unavailable.' }, 429) }
}

export function registerVoiceRoutes(app: Hono<AppEnvironment>) {
  // Speech-to-text: raw audio bytes in, proxied to ElevenLabs Scribe.
  // The client sends raw bytes (React Native FormData is unreliable), and the
  // worker wraps them in the multipart request ElevenLabs expects.
  app.post('/voice/transcribe', async (c) => {
    const apiKey = binding(c.env, 'ELEVENLABS_API_KEY')
    if (!apiKey) {
      captureWorkerFailure(
        new Error('ELEVENLABS_API_KEY is not configured'),
        'voice.transcribe.configuration',
      )
      return c.json({ error: 'Voice transcription is not configured.' }, 500)
    }

    const reservation = await voiceReservation(c, 'voice_transcribe', 1)
    if (reservation instanceof Response) return reservation
    try {
    const audio = await readVoiceBody(c, 5 * 1024 * 1024)
    if (audio instanceof Response) return audio
    if (audio.byteLength === 0) {
      return c.json({ error: 'Send audio bytes in the request body.' }, 400)
    }
    const mimeType = c.req.header('content-type') ?? 'audio/m4a'
    const extension = mimeType.split('/')[1]?.split(';')[0] ?? 'm4a'
    const upstream = new FormData()
    upstream.append(
      'file',
      new File([new Uint8Array(audio)], `voice-note.${extension}`, {
        type: mimeType,
      }),
    )
    upstream.append('model_id', 'scribe_v2')

    const response = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
      signal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(55_000)]),
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
    } finally { c.executionCtx.waitUntil(releaseUsage(c.get('userId'), reservation.leaseId, voiceUsageRuntime(c)).catch(error => captureWorkerFailure(error, 'voice.release'))) }
  })

  app.post('/voice/realtime-token', issueRealtimeTicket)
  registerRealtimeProxy(app)

  // Text-to-speech: `{ text }` in, base64 mp3 out (React Native writes it to a file to play).
  app.post('/voice/speak', async (c) => {
    const bytes = await readVoiceBody(c, 16 * 1024)
    if (bytes instanceof Response) return bytes
    let rawBody: unknown
    try { rawBody = JSON.parse(new TextDecoder().decode(bytes)) } catch { rawBody = null }
    const body = v.is(speakBodySchema, rawBody) ? rawBody : null
    const text = body?.text?.trim().slice(0, MAX_SPOKEN_CHARS)
    if (!text) {
      return c.json({ error: 'Send text of up to 2,000 characters to speak.' }, 400)
    }

    const apiKey = binding(c.env, 'ELEVENLABS_API_KEY')
    if (!apiKey) {
      captureWorkerFailure(
        new Error('ELEVENLABS_API_KEY is not configured'),
        'voice.speak.configuration',
      )
      return c.json({ error: 'Voice synthesis is not configured.' }, 500)
    }
    const reservation = await voiceReservation(c, 'voice_speak', text.length)
    if (reservation instanceof Response) return reservation
    try {
    const voiceId = binding(c.env, 'ELEVENLABS_VOICE_ID') ?? DEFAULT_VOICE_ID
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        signal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(55_000)]),
      method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          text,
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
    } finally { c.executionCtx.waitUntil(releaseUsage(c.get('userId'), reservation.leaseId, voiceUsageRuntime(c)).catch(error => captureWorkerFailure(error, 'voice.release'))) }
  })
}
