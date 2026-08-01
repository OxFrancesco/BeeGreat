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

function route(overrides: Record<string, unknown> = {}) {
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
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
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
    }) as typeof fetch

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
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, result: { routes: [unsafeRoute] } }),
          {
            status: 200,
          },
        ),
    ) as typeof fetch

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
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            origin: { txHash: `0x${'cd'.repeat(32)}` },
            destination: { txHash: destinationTxHash },
          }),
          { status: 200 },
        ),
    ) as typeof fetch

    const status = await getSocketStatus(quoteId, config, fetchImpl)
    expect(status.status).toBe('COMPLETED')
    expect(status.destinationTxHash).toBe(destinationTxHash)
  })
})
