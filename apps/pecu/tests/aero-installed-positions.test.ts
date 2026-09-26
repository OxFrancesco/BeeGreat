import { describe, expect, test } from 'bun:test'
import type { Address } from 'viem'
import { SugarClient } from '@beegreat/sugar'
import { stringListArgument, stubPublicClient, type ReadContractStub } from '../../../packages/sugar/src/test-support'
import { ADDRESS_ZERO } from '../../../packages/sugar/src/types'

const OWNER: Address = '0x1000000000000000000000000000000000000001'
const TOKEN_A: Address = '0x3000000000000000000000000000000000000001'
const TOKEN_B: Address = '0x3000000000000000000000000000000000000002'
const STABLE_TOKEN: Address = '0x3000000000000000000000000000000000000005'

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

const CL_POOL: Address = '0x2000000000000000000000000000000000000003'
const NFPM: Address = '0x4000000000000000000000000000000000000001'

/** Pool tuple with type > 0 (index 4, concentrated) and its own NFPM (index 29). */
function clPoolTuple(lp: Address, token0: Address, token1: Address): unknown[] {
  const pool = poolTuple(lp, token0, token1)
  pool[4] = 2000
  pool[29] = NFPM
  return pool
}

function clPositionTuple(lp: Address, id: bigint): unknown[] {
  const position = positionTuple(lp)
  position[0] = id
  return position
}

describe('Pecu installed Aero SDK positions', () => {
  const clReads = (overrides: { balanceOf?: bigint; unstaked?: unknown[] } = {}): ReadContractStub => async (request) => {
    if (request.functionName === 'count') return 1n
    if (request.functionName === 'all') return [clPoolTuple(CL_POOL, TOKEN_A, TOKEN_B)]
    if (request.functionName === 'positions') return []
    if (request.functionName === 'balanceOf') return overrides.balanceOf ?? 1n
    if (request.functionName === 'positionsUnstakedConcentrated') return overrides.unstaked ?? [clPositionTuple(CL_POOL, 77n)]
    if (request.functionName === 'tokens') {
      return [tokenTuple(STABLE_TOKEN, 'USDC', 6), tokenTuple(TOKEN_A, 'A'), tokenTuple(TOKEN_B, 'B')]
    }
    if (request.functionName === 'getManyRatesToEthWithCustomConnectors') return stringListArgument(request, 0).map(() => 10n ** 18n)
    throw new Error(`Unexpected read ${request.functionName}`)
  }

  test('lists an unstaked concentrated position the positions scan misses', async () => {
    const sugar = new SugarClient(10, {
      account: OWNER,
      settings: { stableTokenAddress: STABLE_TOKEN },
      publicClient: stubPublicClient({ readContract: clReads() }),
    })
    const positions = await sugar.getPositions()
    expect(positions).toHaveLength(1)
    expect(positions[0]?.id).toBe(77n)
    expect(positions[0]?.isCl).toBe(true)
    expect(positions[0]?.liquidity).toBeGreaterThan(0n)
    expect(positions[0]?.staked).toBe(0n)
  })

  test('skips the unstaked scan when the account holds no CL NFTs', async () => {
    const reads: string[] = []
    const sugar = new SugarClient(10, {
      account: OWNER,
      settings: { stableTokenAddress: STABLE_TOKEN },
      publicClient: stubPublicClient({ readContract: async (request) => {
        reads.push(request.functionName)
        return clReads({ balanceOf: 0n })(request)
      } }),
    })
    expect(await sugar.getPositions()).toEqual([])
    expect(reads).toContain('balanceOf')
    expect(reads).not.toContain('positionsUnstakedConcentrated')
  })

  test('finds an unstaked concentrated position through the pool-scoped lookup', async () => {
    const sugar = new SugarClient(10, {
      account: OWNER,
      settings: { stableTokenAddress: STABLE_TOKEN },
      poolLocatorStore: { get: async () => ({ offset: 0 }), set: async () => {}, delete: async () => {} },
      publicClient: stubPublicClient({ readContract: clReads() }),
    })
    const positions = await sugar.getPositionsByPool(CL_POOL)
    expect(positions).toHaveLength(1)
    expect(positions[0]?.id).toBe(77n)
    expect(positions[0]?.staked).toBe(0n)
    expect((await sugar.getPositionById(77n, OWNER, CL_POOL))?.pool.lp).toBe(CL_POOL)
  })

  test('returns a position listed by both reads only once', async () => {
    const sugar = new SugarClient(10, {
      account: OWNER,
      settings: { stableTokenAddress: STABLE_TOKEN },
      poolLocatorStore: { get: async () => ({ offset: 0 }), set: async () => {}, delete: async () => {} },
      publicClient: stubPublicClient({ readContract: async (request) => {
        if (request.functionName === 'positions') return [clPositionTuple(CL_POOL, 77n)]
        return clReads()(request)
      } }),
    })
    expect(await sugar.getPositionsByPool(CL_POOL)).toHaveLength(1)
  })
})
