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

  test('scrubs machine ids from user-facing copy', () => {
    const result =
      extractBeeUI(`Done, goal j970mfwm36h24y655hz3pcke3s8apxap is active.
\`\`\`beeui
{"components":[{"type":"highlight","title":"Goal created","body":"Become wealthy · Active · ID: j970mfwm36h24y655hz3pcke3s8apxap"}]}
\`\`\``)

    expect(result).toEqual({
      spoken: 'Done, goal is active.',
      components: [
        {
          type: 'highlight',
          title: 'Goal created',
          body: 'Become wealthy · Active',
        },
      ],
    })
  })

  test('accepts a bookmark card and keeps markdown line breaks in the reply', () => {
    const result = extractBeeUI(`Yes — you saved one:

- open source
- great for RAG
\`\`\`beeui
{"components":[{"type":"bookmark","title":"Firecrawl web data API for AI agents","url":"https://firecrawl.com/","kind":"website","labels":["web-scraping","AI agents"]}]}
\`\`\``)

    expect(result.spoken).toBe(
      'Yes — you saved one:\n\n- open source\n- great for RAG',
    )
    expect(result.components).toEqual([
      {
        type: 'bookmark',
        title: 'Firecrawl web data API for AI agents',
        url: 'https://firecrawl.com/',
        kind: 'website',
        labels: ['web-scraping', 'AI agents'],
      },
    ])
  })

  test('accepts a Devin session card with follow-up and PR links', () => {
    const result = extractBeeUI(`Devin is working on it.
\`\`\`beeui
{"components":[{"type":"devin","title":"Repair login","status":"running","statusDetail":"working","sessionId":"devin-abc123","sessionUrl":"https://app.devin.ai/sessions/devin-abc123","pullRequests":[{"url":"https://github.com/acme/app/pull/42","state":"open"}]}]}
\`\`\``)

    expect(result.components).toEqual([
      {
        type: 'devin',
        title: 'Repair login',
        status: 'running',
        statusDetail: 'working',
        sessionId: 'devin-abc123',
        sessionUrl: 'https://app.devin.ai/sessions/devin-abc123',
        pullRequests: [
          { url: 'https://github.com/acme/app/pull/42', state: 'open' },
        ],
      },
    ])
  })
})
