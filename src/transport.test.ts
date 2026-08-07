import { describe, expect, spyOn, test } from 'bun:test'
import { createSugarFailoverTransport } from './transport'
import type { SugarRpcEvent } from './types'

describe('Sugar failover transport observability', () => {
  test('reports backup endpoint use without exposing URLs or request parameters', async () => {
    const requests: string[] = []
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input)
      requests.push(url)
      if (url.includes('primary')) {
        return new Response(JSON.stringify({ error: { code: -32_005, message: 'rate limited' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 429,
        })
      }
      return new Response(JSON.stringify({ id: 1, jsonrpc: '2.0', result: '0xa' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }) as typeof fetch
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const events: SugarRpcEvent[] = []

    try {
      const transport = createSugarFailoverTransport(
        ['https://primary.invalid', 'https://backup.invalid'],
        { onRpcEvent: (event) => events.push(event) },
      )({})

      await expect(transport.request({ method: 'eth_chainId' })).resolves.toBe('0xa')

      expect(requests).toHaveLength(2)
      expect(events).toEqual([
        {
          attemptCount: 1,
          failoverUsed: false,
          operation: 'eth_chainId',
          phase: 'transport',
          status: 'error',
        },
        {
          attemptCount: 2,
          failoverUsed: true,
          operation: 'eth_chainId',
          phase: 'transport',
          status: 'success',
        },
      ])
      expect(events.every((event) => !('url' in event) && !('params' in event))).toBe(true)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
