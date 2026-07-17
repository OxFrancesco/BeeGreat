import { describe, expect, test } from 'bun:test'
import { TranscriptSyncQueue } from '@beegreat/chat-sync'
import type { FlueConversationMessage } from '@flue/sdk'

describe('TranscriptSyncQueue', () => {
  test('survives a Strict Mode effect replay', async () => {
    const batches: Array<Array<string>> = []
    const queue = new TranscriptSyncQueue(
      (messages) => {
        batches.push(messages.map((message) => message.contentJson))
        return Promise.resolve()
      },
      () => undefined,
    )
    const partial: FlueConversationMessage = {
      id: 'assistant:strict-mode',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Stream', state: 'streaming' }],
    }

    queue.activate()
    queue.enqueue([partial])
    queue.dispose()
    queue.activate()
    queue.enqueue([partial])
    await new Promise((resolve) => setTimeout(resolve, 180))
    queue.dispose()

    expect(batches).toEqual([[JSON.stringify(partial)]])
  })

  test('isolates a permanently rejected envelope without blocking valid deltas', async () => {
    const persisted: Array<string> = []
    const attempts: Array<Array<string>> = []
    const errors: Array<unknown> = []
    const queue = new TranscriptSyncQueue(
      (messages) => {
        attempts.push(messages.map((message) => message.id))
        if (messages.some((message) => message.id === 'assistant:too-large')) {
          return Promise.reject({ data: { code: 'TOO_LARGE' } })
        }
        persisted.push(...messages.map((message) => message.id))
        return Promise.resolve()
      },
      (error) => errors.push(error),
    )
    const valid: FlueConversationMessage = {
      id: 'assistant:valid',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Saved', state: 'done' }],
    }
    const rejected: FlueConversationMessage = {
      id: 'assistant:too-large',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Oversized', state: 'done' }],
    }

    queue.activate()
    queue.enqueue([valid, rejected])
    await new Promise((resolve) => setTimeout(resolve, 180))
    queue.enqueue([valid, rejected])
    await new Promise((resolve) => setTimeout(resolve, 180))
    queue.dispose()

    expect(persisted).toEqual(['assistant:valid'])
    expect(attempts).toEqual([
      ['assistant:valid', 'assistant:too-large'],
      ['assistant:valid'],
      ['assistant:too-large'],
    ])
    expect(errors).toHaveLength(1)
  })
})
