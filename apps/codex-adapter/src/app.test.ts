import { describe, expect, test } from 'bun:test'
import { zstdCompressSync } from 'node:zlib'
import { proxyCodexRequest } from '../app/api/codex/responses/route'

describe('Flue-Codex adapter', () => {
  test('rejects missing and incorrect adapter secrets', async () => {
    const options = {
      adapterSecret: 'correct-secret',
      upstreamFetch: async () => new Response('must not run'),
    }

    const missing = await proxyCodexRequest(
      new Request('https://adapter.test/api/codex/responses', {
        method: 'POST',
        body: '{}',
      }),
      options,
    )
    const incorrect = await proxyCodexRequest(
      new Request('https://adapter.test/api/codex/responses', {
        method: 'POST',
        headers: { 'x-flue-codex-adapter-secret': 'incorrect-secret' },
        body: '{}',
      }),
      options,
    )

    expect(missing.status).toBe(401)
    expect(incorrect.status).toBe(401)
  })

  test('forwards only the exact route and allowlisted headers', async () => {
    let forwardedRequest: Request | undefined
    const response = await proxyCodexRequest(
      new Request('https://adapter.test/api/codex/responses', {
        method: 'POST',
        headers: {
          authorization: 'Bearer oauth-token',
          'chatgpt-account-id': 'account-1',
          'content-type': 'application/json',
          cookie: 'never-forward-this=1',
          'x-flue-codex-adapter-secret': 'correct-secret',
        },
        body: '{"model":"gpt-5.6-sol"}',
      }),
      {
        adapterSecret: 'correct-secret',
        upstreamFetch: async (input, init) => {
          forwardedRequest = new Request(input, init)
          return new Response('data: done\n\n', {
            headers: {
              'content-type': 'text/event-stream',
              'set-cookie': 'never-forward-this=1',
              'x-request-id': 'request-1',
            },
          })
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('request-1')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(forwardedRequest?.url).toBe(
      'https://chatgpt.com/backend-api/codex/responses',
    )
    expect(forwardedRequest?.headers.get('authorization')).toBe(
      'Bearer oauth-token',
    )
    expect(forwardedRequest?.headers.get('cookie')).toBeNull()
    expect(
      forwardedRequest?.headers.get('x-flue-codex-adapter-secret'),
    ).toBeNull()
    expect(await forwardedRequest?.text()).toBe('{"model":"gpt-5.6-sol"}')
  })

  test('decompresses Pi zstd bodies before forwarding', async () => {
    let forwardedRequest: Request | undefined
    const json = '{"model":"gpt-5.6-sol"}'
    const response = await proxyCodexRequest(
      new Request('https://adapter.test/api/codex/responses', {
        method: 'POST',
        headers: {
          'content-encoding': 'zstd',
          'content-type': 'application/json',
          'x-flue-codex-adapter-secret': 'correct-secret',
        },
        body: zstdCompressSync(json),
      }),
      {
        adapterSecret: 'correct-secret',
        upstreamFetch: async (input, init) => {
          forwardedRequest = new Request(input, init)
          return new Response('ok')
        },
      },
    )

    expect(response.status).toBe(200)
    expect(forwardedRequest?.headers.get('content-encoding')).toBeNull()
    expect(await forwardedRequest?.text()).toBe(json)
  })
})
