import { describe, expect, test } from 'bun:test'

import { extractBeeUI } from './bee-ui'

describe('extractBeeUI', () => {
  test('keeps the reply and validates generated components', () => {
    const result = extractBeeUI(`Here is your focus.
\n\`\`\`beeui
{"components":[{"type":"highlight","title":"Now","body":"Ship the web twin"}]}
\`\`\``)

    expect(result).toEqual({
      spoken: 'Here is your focus.',
      components: [
        { type: 'highlight', title: 'Now', body: 'Ship the web twin' },
      ],
    })
  })

  test('drops malformed generated UI without exposing JSON', () => {
    const result = extractBeeUI(
      'Keep going.\n```beeui\n{"components":[{"type":"unknown"}]}\n```',
    )

    expect(result).toEqual({ spoken: 'Keep going.', components: [] })
  })
})
