import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, normalizeAddress, tupleValues } from './helpers'
import type { SugarContext } from './internal/context'
import { paginate } from './internal/pagination'
import { positionFromTuple, preparePools, prepareTokens } from './models'
import { resolvePoolLocator } from './pools'
import { ADDRESS_ZERO, type Position } from './types'

async function hydratePositions(
  ctx: SugarContext,
  raw: unknown[],
  rawPools: unknown[],
): Promise<Position[]> {
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
  const rawTokens = await ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'tokens',
    [BigInt(addresses.length), 0n, ADDRESS_ZERO, addresses],
  )
  const tokens = prepareTokens(rawTokens, ctx.settings)
  const prices = await ctx.client.getPrices(tokens)
  const pools = preparePools(positionPools, tokens, prices, ctx.settings)
  const poolMap = new Map(pools.map((pool) => [addressKey(pool.lp), pool]))
  return raw.map((position) => positionFromTuple(position, poolMap, ctx.settings)).filter((position): position is Position => position !== undefined)
}

export async function getPositions(ctx: SugarContext, owner?: Address): Promise<Position[]> {
  if (!owner) throw new Error('Owner address is required to list positions')
  const [raw, rawPools] = await Promise.all([
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
    ctx.client.getRawPools(false),
  ])
  return hydratePositions(ctx, raw, rawPools)
}

export async function getPositionByPool(
  ctx: SugarContext,
  poolAddress: Address,
  owner?: Address,
): Promise<Position | undefined> {
  if (!owner) throw new Error('Owner address is required to get a position')
  const normalizedPool = normalizeAddress(poolAddress)
  const resolved = await resolvePoolLocator(ctx, normalizedPool)
  if (!resolved) return undefined

  // Sugar's offset is the pool index. Once the pool catalog is cached, a
  // known basic-pool position is one bounded read instead of a global scan.
  const raw = await ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'positions',
    [1, resolved.offset, owner],
  )
  const matches = raw.filter((position) =>
    addressKey(String(tupleValues(position)[1])) === addressKey(normalizedPool),
  )
  if (matches.length === 0) return undefined
  return (await hydratePositions(ctx, matches, [resolved.rawPool]))[0]
}
