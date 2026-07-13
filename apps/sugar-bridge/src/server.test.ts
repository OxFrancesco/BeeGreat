import { describe, expect, test } from 'bun:test'
import { createSugarBridge } from './server'

const options = { executable: 'sugar', secret: 'test-secret', timeoutMs: 1000 }

describe('Sugar bridge HTTP boundary', () => {
  test('authenticates and returns the CLI JSON without parsing large integers', async () => {
    const calls: string[][] = []
    const app = createSugarBridge(options, async (argv) => {
      calls.push(argv)
      return '[{"amount_in":1000000000000000000}]'
    })
    const response = await app(
      new Request('http://bridge.test/v1/execute', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'quote',
          parameters: {
            chain: 10,
            from_token: 'ETH',
            to_token: 'USDC',
            amount: '1',
          },
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      output: '[{"amount_in":1000000000000000000}]',
    })
    expect(calls).toEqual([
      [
        'sugar',
        'quote',
        '--chain=10',
        '--from-token=ETH',
        '--to-token=USDC',
        '--amount=1',
      ],
    ])
  })

  test('rejects unauthenticated requests without invoking Sugar', async () => {
    let invoked = false
    const app = createSugarBridge(options, async () => {
      invoked = true
      return '[]'
    })
    const response = await app(
      new Request('http://bridge.test/v1/execute', {
        method: 'POST',
        body: JSON.stringify({ action: 'pools', parameters: { chain: 8453 } }),
      }),
    )

    expect(response.status).toBe(401)
    expect(invoked).toBe(false)
  })
})
