import { describe, expect, test } from 'bun:test'
import { mergeConvexMessages, messagesForConvexSync } from './chat-history'
import type { FlueConversationMessage } from '@flue/sdk'

function message(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  submissionId?: string,
): FlueConversationMessage {
  return {
    id,
    role,
    ...(submissionId ? { submissionId } : {}),
    parts: [{ type: 'text', text, state: 'done' }],
  }
}

describe('chat history', () => {
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
})
