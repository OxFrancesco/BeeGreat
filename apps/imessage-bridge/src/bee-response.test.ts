import { describe, expect, test } from 'bun:test'

import {
  extractBeeResponse,
  isFirstFocusConfirmation,
  isHighlightCompletion,
  latestFirstFocusPreview,
} from './bee-response'

describe('iMessage Bee response projection', () => {
  test('turns the complete beeui vocabulary into readable Messages content', () => {
    const response = extractBeeResponse(`Here is the useful part.

\`\`\`beeui
{
  "components": [
    {"type":"text","body":"Keep the written detail."},
    {"type":"metric","label":"Open tasks","value":"3","delta":"down 2"},
    {"type":"chart","kind":"bar","title":"This week","unit":"tasks","data":[{"label":"Mon","value":2},{"label":"Tue","value":1}]},
    {"type":"tasks","title":"Next up","items":[{"id":"j970123456789012345678901234567","title":"Ship the bridge","done":false,"due":"Friday"}]},
    {"type":"highlight","title":"Today","body":"Ship the bridge"},
    {"type":"bookmark","title":"Spectrum docs","url":"https://photon.codes/spectrum","note":"Messaging reference."},
    {"type":"devin","title":"Parity work","status":"running","statusDetail":"Implementing","sessionId":"devin-secret123","sessionUrl":"https://app.devin.ai/sessions/example","summary":"Working through the adapter.","pullRequests":[{"url":"https://github.com/example/repo/pull/1","state":"open"}]},
    {"type":"confirm","summary":"Send 5 USDC","action":"send_tokens","payload":{"recipient":"0x123"}}
  ]
}
\`\`\``)

    expect(response.spoken).toBe('Here is the useful part.')
    expect(response.markdown).toContain('**Open tasks:** 3 — down 2')
    expect(response.markdown).toContain('**This week**')
    expect(response.markdown).toContain('Mon: 2 tasks')
    expect(response.markdown).toContain('☐ Ship the bridge — Friday')
    expect(response.markdown).toContain('**Today**')
    expect(response.markdown).toContain('**Needs your confirmation**')
    expect(response.markdown).not.toContain('j970123456789012345678901234567')
    expect(response.markdown).not.toContain('devin-secret123')
    expect(response.links).toEqual([
      'https://photon.codes/spectrum',
      'https://app.devin.ai/sessions/example',
      'https://github.com/example/repo/pull/1',
    ])
  })

  test('preserves an actionable first-focus preview without exposing its request id', () => {
    const response = extractBeeResponse(`I made a starting point.
\`\`\`beeui
{"components":[{"type":"first_focus","requestId":"first-focus-secret","goalTitle":"Launch BeeGreat","projectTitle":"iMessage parity","taskTitle":"Finish the bridge"}]}
\`\`\``)

    expect(response.markdown).toContain('**Your first focus**')
    expect(response.markdown).toContain('Goal: Launch BeeGreat')
    expect(response.markdown).toContain('Reply **yes** to create it or **no** to cancel.')
    expect(response.markdown).not.toContain('first-focus-secret')
    expect(response.firstFocus).toEqual({
      type: 'first_focus',
      requestId: 'first-focus-secret',
      goalTitle: 'Launch BeeGreat',
      projectTitle: 'iMessage parity',
      taskTitle: 'Finish the bridge',
    })
  })

  test('drops malformed beeui without leaking raw JSON', () => {
    const response = extractBeeResponse(
      'The answer is still safe.\n```beeui\n{"components":[{"type":"metric"}]}\n```',
    )

    expect(response).toMatchObject({
      spoken: 'The answer is still safe.',
      markdown: 'The answer is still safe.',
      links: [],
    })
    expect(response.firstFocus).toBeUndefined()
    expect(response.markdown).not.toContain('components')
  })
})

describe('iMessage app-equivalent commands', () => {
  test('uses the same explicit confirmation and completion phrases as the apps', () => {
    expect(isFirstFocusConfirmation('Looks good!')).toBe(true)
    expect(isFirstFocusConfirmation('yes, but change it')).toBe(false)
    expect(isHighlightCompletion('I finished my highlight.')).toBe(true)
    expect(isHighlightCompletion('I am done thinking')).toBe(false)
  })

  test('finds only a first-focus preview in the latest assistant reply', () => {
    const preview = latestFirstFocusPreview([
      {
        id: 'assistant-old',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '```beeui\n{"components":[{"type":"first_focus","requestId":"old","goalTitle":"Old","projectTitle":"Old","taskTitle":"Old"}]}\n```',
            state: 'done',
          },
        ],
      },
      {
        id: 'user-next',
        role: 'user',
        parts: [{ type: 'text', text: 'No', state: 'done' }],
      },
      {
        id: 'assistant-latest',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Nothing was created.', state: 'done' }],
      },
    ])

    expect(preview).toBeUndefined()
  })
})
