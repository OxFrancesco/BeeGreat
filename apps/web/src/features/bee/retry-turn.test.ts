import { describe, expect, test } from 'bun:test'

import { getRetryableTurn } from './retry-turn'

describe('retryable chat turn', () => {
  test('replays the latest user text and tombstones everything after it', () => {
    expect(
      getRetryableTurn([
        {
          id: 'older',
          role: 'assistant',
          purpose: 'assistant',
          display: 'visible',
          parts: [{ type: 'text', text: 'Earlier', state: 'done' }],
        },
        {
          id: 'user-envelope',
          submissionId: 'submission-id',
          role: 'user',
          purpose: 'user',
          display: 'visible',
          parts: [{ type: 'text', text: '  Try this again  ', state: 'done' }],
        },
        {
          id: 'assistant-envelope',
          role: 'assistant',
          purpose: 'assistant',
          display: 'visible',
          parts: [{ type: 'text', text: 'First answer', state: 'done' }],
        },
      ]),
    ).toEqual({
      text: 'Try this again',
      messageIds: [
        'user-envelope',
        'submission:submission-id',
        'assistant-envelope',
      ],
    })
  })

  test('ignores turns without user text', () => {
    expect(
      getRetryableTurn([
        {
          id: 'tool-user',
          role: 'user',
          purpose: 'user',
          display: 'visible',
          parts: [],
        },
      ]),
    ).toBeUndefined()
  })
})
