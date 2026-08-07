import { describe, expect, test } from 'bun:test'
import type { Address, PublicClient } from 'viem'
import { SugarClient } from './client'
import { ADDRESS_ZERO } from './types'

const OWNER = '0x1000000000000000000000000000000000000001' as Address
const POSITION_POOL = '0x2000000000000000000000000000000000000001' as Address
const IRRELEVANT_POOL = '0x2000000000000000000000000000000000000002' as Address
const TOKEN_A = '0x3000000000000000000000000000000000000001' as Address
const TOKEN_B = '0x3000000000000000000000000000000000000002' as Address
const TOKEN_C = '0x3000000000000000000000000000000000000003' as Address
const TOKEN_D = '0x3000000000000000000000000000000000000004' as Address
const STABLE_TOKEN = '0x3000000000000000000000000000000000000005' as Address

function tokenTuple(address: Address, symbol: string, decimals = 18): unknown[] {
  return [address, symbol, decimals, 0n, true, false]
}

function poolTuple(lp: Address, token0: Address, token1: Address): unknown[] {
  return [
    lp,
    'pool',
    18,
    1_000n,
    -1,
    0,
    1n,
    token0,
    100n,
    0n,
    token1,
    100n,
    0n,
    ADDRESS_ZERO,
    0n,
    false,
    ADDRESS_ZERO,
    ADDRESS_ZERO,
    ADDRESS_ZERO,
    1n,
    token0,
    0n,
    30n,
    0n,
    1n,
    1n,
    0n,
    0n,
    0,
    ADDRESS_ZERO,
    ADDRESS_ZERO,
    ADDRESS_ZERO,
  ]
}

function positionTuple(lp: Address): unknown[] {
  return [
    42n,
    lp,
    100n,
    0n,
    50n,
    50n,
    0n,
    0n,
    1n,
    1n,
    1n,
    -100,
    100,
    1n,
    2n,
    ADDRESS_ZERO,
    0,
    ADDRESS_ZERO,
  ]
}

describe('Sugar positions', () => {
  test("hydrates and prices only the topology required by the owner's positions", async () => {
    const pricedTokenBatches: string[][] = []
    const sugar = new SugarClient(10, {
      account: OWNER,
      publicClient: {
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          const offset = Number(request.args?.[1] ?? 0)
          if (request.functionName === 'count') return 2n
          if (request.functionName === 'positions') {
            return offset === 0 ? [positionTuple(POSITION_POOL)] : []
          }
          if (request.functionName === 'all') {
            return offset === 0
              ? [poolTuple(POSITION_POOL, TOKEN_A, TOKEN_B), poolTuple(IRRELEVANT_POOL, TOKEN_C, TOKEN_D)]
              : []
          }
          if (request.functionName === 'tokens') {
            return offset === 0
              ? [
                  tokenTuple(STABLE_TOKEN, 'USDC', 6),
                  tokenTuple(TOKEN_A, 'A'),
                  tokenTuple(TOKEN_B, 'B'),
                  tokenTuple(TOKEN_C, 'C'),
                  tokenTuple(TOKEN_D, 'D'),
                ]
              : []
          }
          if (request.functionName === 'getManyRatesToEthWithCustomConnectors') {
            const addresses = [...(request.args?.[0] as string[])]
            pricedTokenBatches.push(addresses)
            return addresses.map(() => 10n ** 18n)
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      settings: { stableTokenAddress: STABLE_TOKEN },
    })

    const positions = await sugar.getPositions()

    expect(positions).toHaveLength(1)
    expect(positions[0]?.pool.lp).toBe(POSITION_POOL)
    const pricedTokens = pricedTokenBatches.flat().map((address) => address.toLowerCase())
    expect(pricedTokens).toEqual(expect.arrayContaining([
      sugar.settings.wrappedNativeTokenAddress.toLowerCase(),
      sugar.settings.stableTokenAddress.toLowerCase(),
      TOKEN_A.toLowerCase(),
      TOKEN_B.toLowerCase(),
    ]))
    expect(pricedTokens).toHaveLength(4)
    expect(pricedTokens).not.toContain(TOKEN_C.toLowerCase())
    expect(pricedTokens).not.toContain(TOKEN_D.toLowerCase())
  })
})
