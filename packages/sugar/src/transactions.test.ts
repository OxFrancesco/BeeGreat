import { describe, expect, test } from 'bun:test'
import type { Address, PublicClient } from 'viem'
import { SugarClient } from './client'
import { withdrawalFromPosition } from './models'
import { ADDRESS_ZERO, type LiquidityPool, type Position, type Token } from './types'

const account = '0x1111111111111111111111111111111111111111' as Address
const token0: Token = { chainId: 10, chainName: 'OP', tokenAddress: '0x2222222222222222222222222222222222222222', symbol: 'A', decimals: 18, listed: true, emerging: false }
const token1: Token = { chainId: 10, chainName: 'OP', tokenAddress: '0x3333333333333333333333333333333333333333', symbol: 'B', decimals: 6, listed: true, emerging: false }

function pool(isCl = false): LiquidityPool {
  return {
    chainId: 10, chainName: 'OP', lp: '0x4444444444444444444444444444444444444444',
    factory: '0x5555555555555555555555555555555555555555', symbol: isCl ? 'CL100-A/B' : 'vAMM-A/B',
    type: isCl ? 100 : -1, isStable: false, isCl, tick: 0, sqrtRatio: 2n ** 96n,
    totalSupply: 1000n, decimals: 18, token0, token1, poolFee: 30n,
    gauge: '0x6666666666666666666666666666666666666666', gaugeAlive: true, gaugeTotalSupply: 0n,
    nfpm: isCl ? '0x7777777777777777777777777777777777777777' : ADDRESS_ZERO,
    alm: ADDRESS_ZERO, tvl: 0, totalFees: 0, volume: 0, token0Volume: 0, token1Volume: 0, apr: 0,
  }
}

function position(target = pool(false)): Position {
  return {
    chainId: 10, chainName: 'OP', id: target.isCl ? 42n : 0n, pool: target,
    liquidity: 1000n, staked: 0n, amountToken0: 500n, amountToken1: 750n,
    stakedToken0: 0n, stakedToken1: 0n, unstakedEarned0: 0n, unstakedEarned1: 0n,
    emissionsEarned: 0n, tickLower: -100, tickUpper: 100, sqrtRatioLower: 0n, sqrtRatioUpper: 0n,
    alm: ADDRESS_ZERO, isCl: target.isCl, isAlm: false, isInRange: target.isCl,
  }
}

function client(readContract: (request: { functionName: string }) => Promise<unknown> = async () => 0n) {
  return new SugarClient(10, { account, publicClient: { readContract } as unknown as PublicClient })
}

describe('unsigned transaction builders', () => {
  test('returns both ERC20 approvals before a basic deposit', async () => {
    const transactions = await client().deposit({ pool: pool(), amountToken0: 100n, amountToken1: 200n, sqrtPriceX96: 0n })
    expect(transactions).toHaveLength(3)
    expect(transactions.map((transaction) => transaction.to)).toEqual([
      token0.tokenAddress as Address, token1.tokenAddress as Address, client().settings.routerContractAddress,
    ])
    expect(transactions.every((transaction) => transaction.from === account)).toBe(true)
  })

  test('builds approval then bridge transfer with the quoted message fee', async () => {
    const sugar = client(async ({ functionName }) => functionName === 'quoteGasPayment' ? 123n : 0n)
    const transactions = await sugar.bridge(token0, 1_000n, 130)
    expect(transactions).toHaveLength(2)
    expect(transactions[1].to).toBe(sugar.settings.bridgeContractAddress)
    expect(transactions[1].value).toBe(123n)
  })

  test('builds a partial basic withdrawal and CL approval/stake sequence', async () => {
    const basic = position()
    const withdrawal = withdrawalFromPosition(basic, { fraction: 0.5 })
    expect(withdrawal.liquidity).toBe(500n)
    expect(await client().withdraw(withdrawal)).toHaveLength(2)

    const concentrated = position(pool(true))
    const stake = await client().stake(concentrated)
    expect(stake).toHaveLength(2)
    expect(stake[0].to).toBe(concentrated.pool.nfpm)
    expect(stake[1].to).toBe(concentrated.pool.gauge)
  })

  test('scales large partial withdrawals without losing bigint precision', () => {
    const basic = position()
    basic.liquidity = 123_456_789_012_345_678_901_234_567_890n
    basic.amountToken0 = 98_765_432_109_876_543_210n
    const withdrawal = withdrawalFromPosition(basic, { fraction: '0.1' })
    expect(withdrawal.liquidity).toBe(12_345_678_901_234_567_890_123_456_789n)
    expect(withdrawal.amountToken0).toBe(9_876_543_210_987_654_321n)
    expect(() => withdrawalFromPosition(basic, { burn: true })).toThrow('burn is CL-only')
    expect(() => withdrawalFromPosition(basic, { fraction: '1e-1001' })).toThrow('fraction exponent is too large')
  })
})
