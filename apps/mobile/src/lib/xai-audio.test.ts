// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import {
  arrayBufferToBase64,
  base64ToBytes,
  concatBytes,
  pcm16ToWav,
} from '@/lib/xai-audio';

describe('xAI realtime audio helpers', () => {
  test('round-trips binary audio through base64', () => {
    const source = Uint8Array.from([0, 1, 127, 128, 254, 255]);

    expect(base64ToBytes(arrayBufferToBase64(source.buffer))).toEqual(source);
  });

  test('creates a valid mono PCM16 WAV header', () => {
    const pcm = Uint8Array.from([0, 0, 255, 127]);
    const wav = pcm16ToWav(pcm, 24_000);
    const view = new DataView(wav.buffer);

    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(pcm.byteLength);
    expect(wav.subarray(44)).toEqual(pcm);
  });

  test('concatenates streamed audio chunks in order', () => {
    expect(
      concatBytes([
        Uint8Array.from([1, 2]),
        Uint8Array.from([3]),
        Uint8Array.from([4, 5]),
      ]),
    ).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
  });
});
