import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AgentMessage } from './message'
import type { FlueConversationMessage } from '@flue/sdk'

function streamingAssistant(text: string): FlueConversationMessage {
  return {
    id: 'assistant:turn-1',
    role: 'assistant',
    parts: [{ type: 'text', text, state: 'streaming' }],
  }
}

describe('AgentMessage', () => {
  test('renders each successive streaming text snapshot immediately', () => {
    const first = renderToStaticMarkup(
      <AgentMessage
        message={streamingAssistant('Hello')}
        isLast
        busy
        onReply={() => Promise.resolve()}
      />,
    )
    const second = renderToStaticMarkup(
      <AgentMessage
        message={streamingAssistant('Hello Francesco')}
        isLast
        busy
        onReply={() => Promise.resolve()}
      />,
    )

    expect(first).toContain('<p>Hello</p>')
    expect(first).not.toContain('Hello Francesco')
    expect(second).toContain('<p>Hello Francesco</p>')
  })
})
