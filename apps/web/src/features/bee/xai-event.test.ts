import { expect, test } from 'bun:test'
import { xaiEventSchema } from './xai-event'

test.each([
  { type: 'response.created', response: { id: 'response-1' } },
  { type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hello' },
  { type: 'response.audio_transcript.delta', delta: 'Hello' },
  { type: 'response.audio.delta', delta: 'AAAA' },
  { type: 'response.done' },
  { type: 'error', error: { message: 'Session expired' } },
])('decodes $type without a ping timestamp', (event) => {
  expect(xaiEventSchema.parse(event)).toEqual(event)
})

test('preserves ping timestamps and tolerates unrelated malformed fields', () => {
  expect(xaiEventSchema.parse({ type: 'ping', ping_timestamp: 123 })).toEqual({ type: 'ping', ping_timestamp: 123 })
  expect(xaiEventSchema.parse({ type: 'ping', ping_timestamp: '123' })).toEqual({ type: 'ping', ping_timestamp: '123' })
  expect(xaiEventSchema.parse({ type: 'response.done', ping_timestamp: {}, transcript: 42 }).type).toBe('response.done')
  expect(xaiEventSchema.safeParse(null).success).toBe(false)
})
