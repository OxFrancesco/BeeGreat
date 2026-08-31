import { File, Paths } from 'expo-file-system';
import { z } from 'zod';

import { AGENT_URL, getAuthHeaders } from '@/lib/flue';

const transcriptionResponseSchema = z.object({ text: z.string() });
const speechResponseSchema = z.object({ audio: z.string() });
const realtimeTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.number(),
});
const errorResponseSchema = z.object({ error: z.string().optional() });

export async function transcribeRecording(uri: string): Promise<string> {
  // Raw bytes instead of FormData: Expo's WinterCG fetch rejects RN-style
  // `{ uri }` form parts, so the worker builds the multipart request itself.
  const bytes = new File(uri).bytesSync();

  const response = await fetch(`${AGENT_URL}/voice/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'audio/m4a', ...(await getAuthHeaders()) },
    // Re-wrap: bytesSync() is typed over ArrayBufferLike, BodyInit wants ArrayBuffer.
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Transcription failed.'));
  }
  const { text } = transcriptionResponseSchema.parse(await response.json());
  return text.trim();
}

/** Synthesizes speech for `text` and returns a local file URI ready for playback. */
export async function synthesizeSpeech(text: string): Promise<string> {
  const response = await fetch(`${AGENT_URL}/voice/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Speech synthesis failed.'));
  }
  const { audio } = speechResponseSchema.parse(await response.json());

  const file = new File(Paths.cache, `bee-tts-${Date.now()}.mp3`);
  file.create();
  file.write(base64ToBytes(audio));
  return file.uri;
}

export async function createRealtimeVoiceToken(): Promise<{
  token: string;
  expiresAt: number;
}> {
  const response = await fetch(`${AGENT_URL}/voice/realtime-token`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Conversational voice could not start.'),
    );
  }
  return realtimeTokenResponseSchema.parse(await response.json());
}

/** Prefers the worker's `{ error }` message so the UI shows the real cause. */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  return (body.success ? body.data.error : undefined) ?? `${fallback} (HTTP ${response.status})`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
