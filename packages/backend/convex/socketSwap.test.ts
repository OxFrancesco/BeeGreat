import { describe, expect, test, vi } from 'vitest'

import {
  SOCKET_CHAINS,
  createSocketApiConfig,
  getSocketQuote,
  getSocketStatus,
  parseTokenAmount,
} from './socketSwap'

const wallet = '0x00000000000000000000000000000000000000aa'
const spender = '0x00000000000000000000000000000000000000bb'
const router = '0x00000000000000000000000000000000000000cc'
const quoteId = `0x${'12'.repeat(32)}`
const config = { baseUrl: 'https://socket.example.test', headers: {} }

/** The subset of a Socket V3 route payload these tests exercise. */
type SocketRouteFixture = {
  quoteId: string
  expiresAt: number
  estimatedTime: number
  routeTags: string[]
  output: {
    amount: string
    minAmountOut: string
    token: { chainId: number; address: string }
  }
  approval: { spenderAddress: string; amount: string } | null
  txData: { kind: string; object: { to: string; data: string; value: string } }
  routeDetails: { bridgeDetails: { protocol: { displayName: string } } }
  statusCheck: { intervalSec: number; maxDurationSec: number }
}

function route(
  overrides: Partial<SocketRouteFixture> = {},
): SocketRouteFixture {
  return {
    quoteId,
    expiresAt: Math.floor(Date.now() / 1_000) + 300,
    estimatedTime: 45,
    routeTags: ['SUGGESTED'],
    output: {
      amount: '3000000000000000',
      minAmountOut: '2970000000000000',
      token: {
        chainId: SOCKET_CHAINS.arbitrum.chainId,
        address: SOCKET_CHAINS.arbitrum.tokens.eth.address,
      },
    },
    approval: {
      spenderAddress: spender,
      amount: '10000000',
    },
    txData: {
      kind: 'evm_tx',
      object: {
        to: router,
        data: '0x1234',
        value: '0',
      },
    },
    routeDetails: {
      bridgeDetails: { protocol: { displayName: 'Across' } },
    },
    statusCheck: { intervalSec: 5, maxDurationSec: 1_800 },
    ...overrides,
  }
}

describe('Socket V3 helpers', () => {
  test('uses the public API without a key and the dedicated API with one', () => {
    expect(createSocketApiConfig()).toEqual({
      baseUrl: 'https://public-backend.socket.tech',
      headers: {},
    })
    expect(createSocketApiConfig(' socket-secret ')).toEqual({
      baseUrl: 'https://dedicated-backend.socket.tech',
      headers: { 'x-api-key': 'socket-secret' },
    })
  })

  test('parses decimal token amounts without floating-point loss', () => {
    expect(parseTokenAmount('10.25', 6)).toBe('10250000')
    expect(parseTokenAmount('0.000001', 6)).toBe('1')
    expect(() => parseTokenAmount('0.0000001', 6)).toThrow('at most 6')
    expect(() => parseTokenAmount('0', 6)).toThrow('greater than zero')
  })

  test('quotes Base USDC to native Arbitrum ETH and preserves Socket calldata', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async (request: string | URL | Request) => {
        const url = new URL(String(request))
        expect(url.pathname).toBe('/v3/swap/quote')
        expect(url.searchParams.get('originChainId')).toBe('8453')
        expect(url.searchParams.get('destinationChainId')).toBe('42161')
        expect(url.searchParams.get('inputAmount')).toBe('10000000')
        expect(url.searchParams.get('outputToken')).toBe(
          SOCKET_CHAINS.arbitrum.tokens.eth.address,
        )
        return new Response(
          JSON.stringify({ success: true, result: { routes: [route()] } }),
          {
            status: 200,
          },
        )
      },
    )

    const quote = await getSocketQuote(
      {
        originChain: 'base',
        destinationChain: 'arbitrum',
        inputToken: 'usdc',
        outputToken: 'eth',
        inputAmount: '10',
        userAddress: wallet,
        receiverAddress: wallet,
      },
      config,
      fetchImpl,
    )

    expect(quote.outputAmount).toBe('0.003')
    expect(quote.minimumOutputAmount).toBe('0.00297')
    expect(quote.provider).toBe('Across')
    expect(quote.approval?.amount).toBe('10000000')
    expect(quote.transaction).toEqual({
      to: router,
      data: '0x1234',
      value: '0',
    })
  })

  test('quotes native Base ETH to native Arbitrum ETH without an approval', async () => {
    const inputAmount = '0.001'
    const inputAmountUnits = '1000000000000000'
    const fetchImpl: typeof fetch = vi.fn(
      async (request: string | URL | Request) => {
        const url = new URL(String(request))
        expect(url.pathname).toBe('/v3/swap/quote')
        expect(url.searchParams.get('userOps')).toBe('tx')
        expect(url.searchParams.get('originChainId')).toBe('8453')
        expect(url.searchParams.get('destinationChainId')).toBe('42161')
        expect(url.searchParams.get('inputToken')).toBe(
          SOCKET_CHAINS.base.tokens.eth.address,
        )
        expect(url.searchParams.get('outputToken')).toBe(
          SOCKET_CHAINS.arbitrum.tokens.eth.address,
        )
        expect(url.searchParams.get('inputAmount')).toBe(inputAmountUnits)
        expect(url.searchParams.has('refuel')).toBe(false)
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              routes: [
                route({
                  approval: null,
                  txData: {
                    kind: 'evm_tx',
                    object: {
                      to: router,
                      data: '0xabcd',
                      value: inputAmountUnits,
                    },
                  },
                }),
              ],
            },
          }),
          { status: 200 },
        )
      },
    )

    const quote = await getSocketQuote(
      {
        originChain: 'base',
        destinationChain: 'arbitrum',
        inputToken: 'eth',
        outputToken: 'eth',
        inputAmount,
        userAddress: wallet,
        receiverAddress: wallet,
      },
      config,
      fetchImpl,
    )

    expect(quote.approval).toBeUndefined()
    expect(quote.transaction).toEqual({
      to: router,
      data: '0xabcd',
      value: inputAmountUnits,
    })
  })

  test('rejects routes whose destination token does not match the request', async () => {
    const unsafeRoute = route({
      output: {
        amount: '1000000',
        minAmountOut: '990000',
        token: {
          chainId: SOCKET_CHAINS.arbitrum.chainId,
          address: SOCKET_CHAINS.arbitrum.tokens.usdc.address,
        },
      },
    })
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, result: { routes: [unsafeRoute] } }),
          {
            status: 200,
          },
        ),
    )

    await expect(
      getSocketQuote(
        {
          originChain: 'base',
          destinationChain: 'arbitrum',
          inputToken: 'usdc',
          outputToken: 'eth',
          inputAmount: '10',
          userAddress: wallet,
          receiverAddress: wallet,
        },
        config,
        fetchImpl,
      ),
    ).rejects.toThrow('no safe route')
  })

  test('parses terminal destination status and transaction hashes', async () => {
    const destinationTxHash = `0x${'ab'.repeat(32)}`
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            origin: { txHash: `0x${'cd'.repeat(32)}` },
            destination: { txHash: destinationTxHash },
          }),
          { status: 200 },
        ),
    )

    const status = await getSocketStatus(quoteId, config, fetchImpl)
    expect(status.status).toBe('COMPLETED')
    expect(status.destinationTxHash).toBe(destinationTxHash)
  })

  test('retries transient status failures and returns the recovered result', async () => {
    const fetchImpl: typeof fetch = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('upstream error', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'PENDING' }), { status: 200 }),
      )

    const status = await getSocketStatus(quoteId, config, fetchImpl)
    expect(status.status).toBe('PENDING')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  test('does not retry deterministic Socket rejections', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: false, message: 'No routes available' }),
          { status: 400 },
        ),
    )

    await expect(
      getSocketQuote(
        {
          originChain: 'base',
          destinationChain: 'arbitrum',
          inputToken: 'usdc',
          outputToken: 'eth',
          inputAmount: '10',
          userAddress: wallet,
          receiverAddress: wallet,
        },
        config,
        fetchImpl,
      ),
    ).rejects.toThrow('No routes available')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('surfaces the last transient response after retries are exhausted', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () => new Response('service unavailable', { status: 503 }),
    )

    await expect(getSocketStatus(quoteId, config, fetchImpl)).rejects.toThrow(
      'Socket status is temporarily unavailable',
    )
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
