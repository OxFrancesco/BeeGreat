import { describe, expect, test } from 'bun:test'

import { floatToPcm16, pcm16ToFloat } from './realtime-audio'

describe('realtime voice audio conversion', () => {
  test('downsamples browser audio and preserves PCM polarity', () => {
    const pcm = floatToPcm16(
      new Float32Array([-1, -1, 0.5, 0.5, 1, 1, 0, 0]),
      48_000,
      24_000,
    )
    const decoded = pcm16ToFloat(pcm)
    expect(decoded.length).toBe(4)
    expect(decoded[0]).toBeCloseTo(-1, 3)
    expect(decoded[1]).toBeCloseTo(0.5, 3)
    expect(decoded[2]).toBeCloseTo(1, 3)
    expect(decoded[3]).toBeCloseTo(0, 3)
  })
})
