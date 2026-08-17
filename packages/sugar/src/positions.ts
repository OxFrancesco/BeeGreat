import * as Effect from 'effect/Effect'
import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, normalizeAddress, tupleValues } from './helpers'
import type { SugarContext } from './internal/context'
import { clientCall } from './internal/interop'
import { paginate } from './internal/pagination'
import { positionFromTuple, preparePools, prepareTokens } from './models'
import { resolvePoolLocator } from './pools'
import { ADDRESS_ZERO, type Position } from './types'

const hydratePositions = Effect.fn('Sugar.Positions.hydratePositions')(function* (
  ctx: SugarContext,
  raw: unknown[],
  rawPools: unknown[],
) {
  const poolAddresses = new Set(raw.map((position) => addressKey(String(tupleValues(position)[1]))))
  const positionPools = rawPools.filter((pool) => poolAddresses.has(addressKey(String(tupleValues(pool)[0]))))
  const neededTokenAddresses = new Map<string, Address>([
    [addressKey(ctx.settings.stableTokenAddress), normalizeAddress(ctx.settings.stableTokenAddress)],
  ])
  positionPools.forEach((pool) => {
    const values = tupleValues(pool)
    ;[values[7], values[10], values[20]].forEach((address) => {
      const normalized = normalizeAddress(String(address))
      neededTokenAddresses.set(addressKey(normalized), normalized)
    })
  })
  const addresses = [...neededTokenAddresses.values()]
  const rawTokens = yield* ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'tokens',
    [BigInt(addresses.length), 0n, ADDRESS_ZERO, addresses],
  )
  const tokens = prepareTokens(rawTokens, ctx.settings)
  const prices = yield* clientCall(() => ctx.client.getPrices(tokens))
  const pools = preparePools(positionPools, tokens, prices, ctx.settings)
  const poolMap = new Map(pools.map((pool) => [addressKey(pool.lp), pool]))
  return raw.map((position) => positionFromTuple(position, poolMap, ctx.settings)).filter((position): position is Position => position !== undefined)
})

export const getPositions = Effect.fn('Sugar.Positions.getPositions')(function* (
  ctx: SugarContext,
  owner?: Address,
) {
  if (!owner) throw new Error('Owner address is required to list positions')
  const [raw, rawPools] = yield* Effect.all([
    // `positions` scans pool offsets and returns only matches for the owner,
    // so an empty/short response cannot safely terminate pagination: a later
    // pool may still contain a position. Use the configured maximum scan
    // window to preserve complete results with far fewer sparse RPC reads.
    paginate(
      ctx,
      'positions',
      (limit, offset) => ctx.readTask<unknown[]>(
        ctx.settings.sugarContractAddress,
        abis.sugar,
        'positions',
        [limit, offset, owner],
      ),
      ctx.rpc.deadline('positions'),
      ctx.settings.poolPaginationMaxSize,
    ),
    clientCall(() => ctx.client.getRawPools(false)),
  ], { concurrency: 'unbounded' })
  return yield* hydratePositions(ctx, raw, rawPools)
})

export const getPositionByPool = Effect.fn('Sugar.Positions.getPositionByPool')(function* (
  ctx: SugarContext,
  poolAddress: Address,
  owner?: Address,
) {
  if (!owner) throw new Error('Owner address is required to get a position')
  const normalizedPool = normalizeAddress(poolAddress)
  const resolved = yield* resolvePoolLocator(ctx, normalizedPool)
  if (!resolved) return undefined

  // Sugar's offset is the pool index. Once the pool catalog is cached, a
  // known basic-pool position is one bounded read instead of a global scan.
  const raw = yield* ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'positions',
    [1, resolved.offset, owner],
  )
  const matches = raw.filter((position) =>
    addressKey(String(tupleValues(position)[1])) === addressKey(normalizedPool),
  )
  if (matches.length === 0) return undefined
  return (yield* hydratePositions(ctx, matches, [resolved.rawPool]))[0]
})
