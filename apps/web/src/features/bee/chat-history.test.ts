import { describe, expect, test } from 'bun:test'
import {
  changedMessagesForConvexSync,
  mergeConvexMessages,
  messagesForConvexSync,
} from '@beegreat/chat-sync'
import type { FlueConversationMessage } from '@flue/sdk'

function message(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  submissionId?: string,
  state: 'streaming' | 'done' = 'done',
): FlueConversationMessage & { role: 'user' | 'assistant' } {
  return {
    id,
    role,
    purpose: role,
    display: 'visible',
    ...(submissionId ? { submissionId } : {}),
    parts: [{ type: 'text', text, state }],
  }
}

describe('chat history', () => {
  test('keeps the user and assistant when Flue gives both the same submission id', () => {
    const user = message('user:1', 'user', 'Hello', 's1')
    const assistant = message('assistant:1', 'assistant', 'Hi!', 's1')

    expect(mergeConvexMessages([], [user, assistant])).toEqual([
      user,
      assistant,
    ])
  })

  test('does not persist a local echo until Flue admits the send', () => {
    const pending = message('local:1', 'user', 'Hello')

    expect(messagesForConvexSync([pending])).toEqual([])

    const admitted = message('local:1', 'user', 'Hello', 's1')
    expect(messagesForConvexSync([admitted])).toEqual([
      message('submission:s1', 'user', 'Hello', 's1'),
    ])
  })

  test('syncs an admitted user turn by submission id', () => {
    expect(
      messagesForConvexSync([message('local:1', 'user', 'Hello', 's1')]),
    ).toEqual([message('submission:s1', 'user', 'Hello', 's1')])
  })

  test('lets the live streaming envelope replace the durable copy', () => {
    const stored = message('assistant:1', 'assistant', 'Old')
    const live = message('assistant:1', 'assistant', 'Streaming now')
    const result = mergeConvexMessages(
      [{ id: stored.id, contentJson: JSON.stringify(stored), createdAt: 1 }],
      [live],
    )

    expect(result).toEqual([live])
  })

  test('keeps each successive streaming snapshot ahead of stale durability', () => {
    const stored = message('assistant:1', 'assistant', 'Hello')
    const row = {
      id: stored.id,
      contentJson: JSON.stringify(stored),
      createdAt: 1,
    }
    const first = message(
      'assistant:1',
      'assistant',
      'Hello from',
      undefined,
      'streaming',
    )
    const second = message(
      'assistant:1',
      'assistant',
      'Hello from Bee',
      undefined,
      'streaming',
    )

    expect(mergeConvexMessages([row], [first])).toEqual([first])
    expect(mergeConvexMessages([row], [second])).toEqual([second])
  })

  test('keeps repeated unadmitted text distinct from earlier canonical turns', () => {
    const timestamp = '2026-07-16T08:00:00.000Z'
    const repeated = {
      ...message('local:1', 'user', 'Hello'),
      metadata: { timestamp },
    }
    const first = {
      ...message('message:1', 'user', 'Hello', 's1'),
      metadata: { timestamp },
    }
    const result = mergeConvexMessages(
      [{ id: first.id, contentJson: JSON.stringify(first), createdAt: 1 }],
      [repeated],
    )

    expect(result).toEqual([first, repeated])
  })

  test('creates a delta batch for an incrementally streaming assistant turn', () => {
    const user = message('user:1', 'user', 'Hello', 's1')
    const partial = message('assistant:1', 'assistant', 'Hel')
    const initial = changedMessagesForConvexSync([user, partial], new Map())
    const known = new Map(initial.map((entry) => [entry.id, entry.contentJson]))
    const next = message('assistant:1', 'assistant', 'Hello')

    expect(changedMessagesForConvexSync([user, partial], known)).toEqual([])
    expect(changedMessagesForConvexSync([user, next], known)).toEqual([
      expect.objectContaining({
        id: next.id,
        contentJson: JSON.stringify(next),
      }),
    ])
  })
})
