import { describe, expect, test } from 'bun:test'
import type { Address } from 'viem'
import { executeSugarAction, executeSugarActionJson } from './actions'
import { getChainSettings } from './config'
import { applySlippage, floatToUint256, getSalt, getUniqueString, nearestTick, parseEther, sqrtRatioX96FromPrice } from './helpers'
import { BaseChain, getChain, getSimnetChain } from './chains'
import { AsyncSuperswap, createSuperswapQuote, MockSuperswapRelayer, Superswap } from './superswap'
import type { LiquidityPoolForSwap, Quote, Token, UnsignedTransaction } from './types'
import { SugarClient } from './client'

describe('SDK parity helpers', () => {
  test('matches Python slippage rounding and tick helpers', () => {
    expect(applySlippage(232_165n, 0.0005)).toBe(232_049n)
    expect(applySlippage(232_165n, 0.01)).toBe(229_844n)
    expect(applySlippage(19_936n, 0.001)).toBe(19_917n)
    expect(nearestTick(-123, 10)).toBe(-120)
    expect(sqrtRatioX96FromPrice(1, 18, 18)).toBe(2n ** 96n)
  })

  test('uses the Python SDK environment variable contract', () => {
    const settings = getChainSettings(10, { env: {
      SUGAR_RPC_URI_10: 'https://example.invalid',
      SUGAR_SWAP_SLIPPAGE_10: '0.05',
      SUGAR_THREADING_MAX_WORKERS_10: '3',
    } })
    expect(settings.rpcUrl).toBe('https://example.invalid')
    expect(settings.swapSlippage).toBe(0.05)
    expect(settings.requestConcurrency).toBe(3)
  })

  test('exposes chain factories and precise helper equivalents', () => {
    expect(getChain(8453)).toBeInstanceOf(BaseChain)
    expect(BaseChain.usdc.symbol).toBe('USDC')
    expect(new BaseChain().eth.symbol).toBe('ETH')
    expect(getSimnetChain(1135).settings.rpcUrl).toBe('http://127.0.0.1:4445')
    expect(() => getSimnetChain(8453)).toThrow('Unsupported simnet chain ID')
    expect(parseEther('0.000000000000000001')).toBe(1n)
    expect(parseEther('1e-6')).toBe(1_000_000_000_000n)
    expect(floatToUint256('1.25', 6)).toBe(1_250_000n)
    expect(getUniqueString(12)).toMatch(/^\d{12}$/)
    expect(getSalt()).toMatch(/^0x\d{64}$/)
  })
})

describe('native action seam', () => {
  test('executes a CLI-compatible action without a Python process', async () => {
    const pool: LiquidityPoolForSwap = {
      chainId: 8453,
      chainName: 'Base',
      lp: '0x2222222222222222222222222222222222222222',
      type: -1,
      token0Address: '0x3333333333333333333333333333333333333333',
      token1Address: '0x4444444444444444444444444444444444444444',
      isCl: false,
      isStable: false,
      isBasic: true,
    }
    const fake = { getPoolsForSwaps: async () => [pool] } as SugarClient
    const result = await executeSugarAction('pools', { chain: 8453, limit: 1 }, {
      clientFactory: () => fake,
    })
    const expected = [{
      chain_id: 8453, chain_name: 'Base', lp: pool.lp, type: -1,
      token0_address: pool.token0Address, token1_address: pool.token1Address,
      factory: null, is_cl: false, is_stable: false, type_label: 'volatile',
    }]
    expect(result).toEqual(expected)
    await expect(executeSugarActionJson('pools', { chain: 8453, limit: 1 }, {
      clientFactory: () => fake,
    })).resolves.toBe(JSON.stringify(expected, null, 2))
  })

  test('returns swap transactions with quote context and applies the oracle sanity guard', async () => {
    const wallet = '0x1111111111111111111111111111111111111111'
    const from: Token = { chainId: 8453, chainName: 'Base', tokenAddress: '0x2222222222222222222222222222222222222222', symbol: 'AERO', decimals: 18, listed: true, emerging: false }
    const to: Token = { chainId: 8453, chainName: 'Base', tokenAddress: '0x3333333333333333333333333333333333333333', symbol: 'USDC', decimals: 6, listed: true, emerging: false }
    const pool: LiquidityPoolForSwap = {
      chainId: 8453, chainName: 'Base', lp: '0x4444444444444444444444444444444444444444',
      type: -1, token0Address: from.tokenAddress as Address, token1Address: to.tokenAddress as Address,
      isCl: false, isStable: false, isBasic: true,
    }
    const transaction: UnsignedTransaction = { from: wallet, to: pool.lp, data: '0x00', value: 0n }
    const makeClient = (amountOut: bigint) => ({
      settings: { nativeTokenSymbol: 'ETH', stableTokenAddress: to.tokenAddress, swapSlippage: 0.01 },
      getToken: async (reference: string) =>
        [from, to].find((token) => token.tokenAddress.toLowerCase() === String(reference).toLowerCase()),
      // 1 AERO is worth 2 USDC at the oracle, so outputs >= 4 USDC are suspect.
      getPrices: async (tokens: Token[]) => tokens.map((token) => ({ token, price: token.symbol === 'AERO' ? 2 : 1 })),
      getQuote: async (_f: Token, _t: Token, amountIn: bigint, filter?: (quote: Quote) => boolean) => {
        const quote: Quote = { input: { fromToken: from, toToken: to, path: [{ pool, reversed: false }], amountIn }, amountOut }
        return filter && !filter(quote) ? undefined : quote
      },
      swapFromQuote: async () => [transaction],
    }) as unknown as SugarClient
    const parameters = {
      chain: 8453, wallet, from_token: from.tokenAddress, to_token: to.tokenAddress,
      amount: '1', use_decimals: true,
    }

    const result = await executeSugarAction('swap', parameters, { clientFactory: () => makeClient(2_000_000n) }) as {
      transactions: unknown[]
      quote: { min_amount_out: string; min_amount_out_decimal: number; slippage: number; to_token: { symbol: string } }
    }
    expect(result.transactions).toHaveLength(1)
    expect(result.quote.to_token.symbol).toBe('USDC')
    expect(result.quote.slippage).toBe(0.01)
    expect(result.quote.min_amount_out).toBe(String(applySlippage(2_000_000n, 0.01)))

    await expect(executeSugarAction('swap', parameters, { clientFactory: () => makeClient(5_000_000n) }))
      .rejects.toThrow('no quote found')
  })

  test('keeps only pools whose two sides can appear on a vetted route', () => {
    const sugar = new SugarClient(10)
    const from: Token = { chainId: 10, chainName: 'OP', tokenAddress: '0x2222222222222222222222222222222222222222', symbol: 'FROM', decimals: 18, listed: true, emerging: false }
    const to: Token = { chainId: 10, chainName: 'OP', tokenAddress: '0x3333333333333333333333333333333333333333', symbol: 'TO', decimals: 18, listed: true, emerging: false }
    const template: LiquidityPoolForSwap = {
      chainId: 10, chainName: 'OP', lp: '0x4444444444444444444444444444444444444444',
      type: -1, token0Address: from.tokenAddress as Address, token1Address: to.tokenAddress as Address,
      isCl: false, isStable: false, isBasic: true,
    }
    const connector = sugar.settings.connectorTokenAddresses[0]
    const longTail = '0x9999999999999999999999999999999999999999' as Address
    const kept = [
      template,
      { ...template, token1Address: connector },
      { ...template, token0Address: connector, token1Address: to.tokenAddress as Address },
    ]
    const dropped = [
      { ...template, token1Address: longTail },
      { ...template, token0Address: connector, token1Address: longTail },
      { ...template, token0Address: longTail, token1Address: longTail },
    ]
    expect(sugar.filterPoolsForSwap([...kept, ...dropped], from, to)).toEqual(kept)
  })

  test('rejects concentrated-liquidity flags for basic deposits', async () => {
    const basicPool = {
      isCl: false,
      lp: '0x2222222222222222222222222222222222222222',
      token0: { symbol: 'A', decimals: 18 },
      token1: { symbol: 'B', decimals: 18 },
    }
    const fake = { getPoolByAddress: async () => basicPool } as unknown as SugarClient
    await expect(executeSugarAction('deposit', {
      chain: 8453,
      wallet: '0x1111111111111111111111111111111111111111',
      pool: basicPool.lp,
      amount0: '1',
      price_lower: 1,
    }, { clientFactory: () => fake })).rejects.toThrow('basic deposits do not accept CL flags')
  })
})

describe('Superswap surface', () => {
  const bridge = (chainId: 1135 | 130): Token => ({
    chainId,
    chainName: chainId === 1135 ? 'Lisk' : 'Uni',
    tokenAddress: '0x1217BfE6c773EEC6cc4A38b5Dc45B92292B6E189',
    symbol: 'oUSDT', decimals: 6, listed: true, emerging: false,
  })

  test('builds a pure bridge quote and exposes an awaitable mock relayer', async () => {
    expect(AsyncSuperswap).toBe(Superswap)
    const quote = createSuperswapQuote({
      fromToken: bridge(1135), toToken: bridge(130),
      fromBridgeToken: bridge(1135), toBridgeToken: bridge(130), amountIn: 1_000_000n,
    })
    expect(quote.isBridge).toBe(true)
    expect(quote.amountOut).toBe(1_000_000n)
    const relayer = new MockSuperswapRelayer()
    await relayer.shareCalls({ calls: [], salt: `0x${'0'.repeat(64)}`, commitmentDispatchTx: `0x${'1'.repeat(64)}`, originDomain: 1135 })
    expect(relayer.callCount).toBe(1)
  })
})
