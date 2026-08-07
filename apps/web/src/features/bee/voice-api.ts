// BeeGreat keeps its Flue worker on a dedicated local port to avoid Vite collisions.
export const AGENT_URL =
  import.meta.env.VITE_AGENT_URL ?? 'http://localhost:3583'

type GetToken = () => Promise<string | null>

async function authHeaders(getToken: GetToken) {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string
  } | null
  return body?.error ?? `${fallback} (HTTP ${response.status})`
}

export async function transcribeBlob(blob: Blob, getToken: GetToken) {
  const response = await fetch(`${AGENT_URL}/voice/transcribe`, {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'audio/webm',
      ...(await authHeaders(getToken)),
    },
    body: blob,
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'Transcription failed.'))
  }
  const result = (await response.json()) as { text: string }
  return result.text.trim()
}

export async function synthesizeSpeech(text: string, getToken: GetToken) {
  const response = await fetch(`${AGENT_URL}/voice/speak`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await authHeaders(getToken)),
    },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'Speech synthesis failed.'))
  }
  return (await response.json()) as { audio: string; mimeType?: string }
}

export async function createRealtimeVoiceToken(getToken: GetToken) {
  const response = await fetch(`${AGENT_URL}/voice/realtime-token`, {
    method: 'POST',
    headers: await authHeaders(getToken),
  })
  if (!response.ok) {
    throw new Error(
      await readError(response, 'Conversational voice could not start.'),
    )
  }
  return (await response.json()) as { token: string; expiresAt: number }
}
