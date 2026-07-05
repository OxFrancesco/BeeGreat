import { File, Paths } from 'expo-file-system';

import { AGENT_URL, getAuthHeaders } from '@/lib/flue';

export async function transcribeRecording(uri: string): Promise<string> {
  // Raw bytes instead of FormData: Expo's WinterCG fetch rejects RN-style
  // `{ uri }` form parts, so the worker builds the multipart request itself.
  const bytes = new File(uri).bytesSync();

  const response = await fetch(`${AGENT_URL}/voice/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'audio/m4a', ...(await getAuthHeaders()) },
    // RN's fetch types lag behind Expo's WinterCG fetch, which accepts typed arrays.
    body: bytes as unknown as BodyInit,
  });
  if (!response.ok) {
    throw new Error('Transcription failed. Check that the agent server is running.');
  }
  const { text } = (await response.json()) as { text: string };
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
    throw new Error('Speech synthesis failed.');
  }
  const { audio } = (await response.json()) as { audio: string };

  const file = new File(Paths.cache, `bee-tts-${Date.now()}.mp3`);
  file.create();
  file.write(base64ToBytes(audio));
  return file.uri;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
