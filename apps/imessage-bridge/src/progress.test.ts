import { describe, expect, test } from 'bun:test'
import type { ConversationStreamChunk } from '@flue/sdk'

import { createIMessageProgressProjector } from './progress'

const position = { batch: 1, index: 0 }

type WithoutContext<T> = T extends unknown
  ? Omit<T, 'conversationId' | 'position'>
  : never

function event(
  value: WithoutContext<ConversationStreamChunk>,
): ConversationStreamChunk {
  return {
    conversationId: 'conversation-1',
    position,
    ...value,
  } as ConversationStreamChunk
}

describe('iMessage agent progress projection', () => {
  test('projects safe tool activity but never model reasoning or raw payloads', () => {
    const progress = createIMessageProgressProjector(0)

    expect(
      progress.event(
        event({
          type: 'message-delta',
          messageId: 'message-1',
          kind: 'reasoning',
          delta: 'private chain of thought with action rd7_secret',
        }),
        1_000,
      ),
    ).toBeUndefined()

    expect(
      progress.event(
        event({
          type: 'tool-input',
          messageId: 'message-1',
          toolCallId: 'tool-1',
          toolName: 'task',
          input: {
            agent: 'web3',
            prompt: 'Swap using private action rd7_secret and raw payload',
          },
        }),
        2_000,
      ),
    ).toBe('Web3: At work…')

    expect(
      progress.event(
        event({
          type: 'tool-output',
          toolCallId: 'tool-1',
          output: { actionId: 'rd7_secret', transaction: '0xprivate' },
        }),
        3_000,
      ),
    ).toBe('Web3: Finished')
  })

  test('coalesces repeats and emits bounded silence heartbeats', () => {
    const progress = createIMessageProgressProjector(0)
    const toolInput = event({
      type: 'tool-input',
      messageId: 'message-1',
      toolCallId: 'tool-1',
      toolName: 'sugar_quote',
      input: { token: 'USDC' },
    })

    expect(progress.heartbeat(3_999)).toBeUndefined()
    expect(progress.heartbeat(4_000)).toBe('Still working on it…')
    expect(progress.heartbeat(5_000)).toBeUndefined()
    expect(progress.event(toolInput, 6_000)).toBe('Web3: Getting a swap quote…')
    expect(progress.event(toolInput, 7_000)).toBeUndefined()
    expect(progress.heartbeat(18_000)).toBe(
      'This is taking a little longer — I’m still working on it.',
    )
    expect(progress.heartbeat(30_000)).toBeUndefined()
  })
})
