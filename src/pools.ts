import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, normalizeAddress, tupleValues } from './helpers'
import type { ResolvedPoolLocator, SugarContext } from './internal/context'
import { paginate } from './internal/pagination'
import { epochFromTuple, poolForSwapFromTuple, preparePools, prepareTokens } from './models'
import {
  ADDRESS_ZERO,
  type LiquidityPool,
  type LiquidityPoolEpoch,
  type LiquidityPoolForSwap,
  type Price,
  type SugarPoolLocatorKey,
  type Token,
} from './types'

export function getRawPools(ctx: SugarContext, forSwaps = false): Promise<unknown[]> {
  let promise = ctx.caches.rawPoolCache.get(forSwaps)
  if (!promise) {
    const operation = forSwaps ? 'forSwaps' : 'all'
    promise = paginate(ctx, operation, (limit, offset) => ctx.readTask<unknown[]>(
      ctx.settings.sugarContractAddress,
      abis.sugar,
      forSwaps ? 'forSwaps' : 'all',
      forSwaps ? [limit, offset] : [limit, offset, 0],
    ))
    ctx.caches.rawPoolCache.set(forSwaps, promise)
    void promise.catch(() => {
      if (ctx.caches.rawPoolCache.get(forSwaps) === promise) ctx.caches.rawPoolCache.delete(forSwaps)
    })
  }
  return promise
}

export async function getPools(ctx: SugarContext): Promise<LiquidityPool[]>
export async function getPools(ctx: SugarContext, forSwaps: false): Promise<LiquidityPool[]>
export async function getPools(ctx: SugarContext, forSwaps: true): Promise<LiquidityPoolForSwap[]>
export async function getPools(ctx: SugarContext, forSwaps: boolean): Promise<LiquidityPool[] | LiquidityPoolForSwap[]>
export async function getPools(ctx: SugarContext, forSwaps = false): Promise<LiquidityPool[] | LiquidityPoolForSwap[]> {
  let promise = ctx.caches.poolCache.get(forSwaps)
  if (!promise) {
    promise = (async () => {
      const raw = await ctx.client.getRawPools(forSwaps)
      if (forSwaps) return raw.map((pool) => poolForSwapFromTuple(pool, ctx.settings))
      const tokens = await ctx.client.getAllTokens()
      return preparePools(raw, tokens, await ctx.client.getPrices(tokens), ctx.settings)
    })()
    ctx.caches.poolCache.set(forSwaps, promise)
    void promise.catch(() => {
      if (ctx.caches.poolCache.get(forSwaps) === promise) ctx.caches.poolCache.delete(forSwaps)
    })
  }
  return promise
}

export function getPoolsForSwaps(ctx: SugarContext): Promise<LiquidityPoolForSwap[]> {
  return ctx.client.getPools(true)
}

export async function getPoolByAddress(ctx: SugarContext, address: Address | string): Promise<LiquidityPool | undefined> {
  const resolved = await resolvePoolLocator(ctx, normalizeAddress(address))
  if (!resolved) return undefined
  const rawPool = resolved.rawPool

  const values = tupleValues(rawPool)
  const requestedAddresses = [
    String(values[7]),
    String(values[10]),
    String(values[20]),
    ctx.settings.stableTokenAddress,
  ]
    .filter((value) => /^0x[0-9a-fA-F]{40}$/.test(value))
    .map(normalizeAddress)
  const addresses = [
    ...new Map(requestedAddresses.map((value) => [addressKey(value), value])).values(),
  ]
  const rawTokens = await ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'tokens',
    [BigInt(addresses.length), 0n, ADDRESS_ZERO, addresses],
  )
  const tokens = prepareTokens(rawTokens, ctx.settings)
  const pools = preparePools(
    [rawPool],
    tokens,
    await ctx.client.getPrices(tokens),
    ctx.settings,
  )
  return pools[0]
}

function poolLocatorKey(ctx: SugarContext, poolAddress: Address): SugarPoolLocatorKey {
  return {
    chainId: ctx.settings.chainId,
    sugarContractAddress: ctx.settings.sugarContractAddress,
    poolAddress,
  }
}

async function rawPoolAtOffset(ctx: SugarContext, offset: number): Promise<unknown | undefined> {
  if (!Number.isSafeInteger(offset) || offset < 0) return undefined
  const page = await ctx.read<unknown[]>(
    ctx.settings.sugarContractAddress,
    abis.sugar,
    'all',
    [1, offset, 0],
  )
  return page[0]
}

function rawPoolMatches(rawPool: unknown, poolAddress: Address): boolean {
  return addressKey(String(tupleValues(rawPool)[0])) === addressKey(poolAddress)
}

export async function resolvePoolLocator(
  ctx: SugarContext,
  poolAddress: Address,
): Promise<ResolvedPoolLocator | undefined> {
  const cacheKey = addressKey(poolAddress)
  const cached = ctx.resolvedPoolLocators.get(cacheKey)
  if (cached) return cached

  const pending = (async () => {
    const key = poolLocatorKey(ctx, poolAddress)
    let storedOffset: number | undefined
    try {
      storedOffset = (await ctx.poolLocatorStore?.get(key))?.offset
    } catch {
      // A cache outage must not make on-chain reads unavailable.
    }
    if (storedOffset !== undefined) {
      const storedPool = await rawPoolAtOffset(ctx, storedOffset)
      if (storedPool && rawPoolMatches(storedPool, poolAddress)) {
        return { offset: storedOffset, rawPool: storedPool }
      }
      try {
        await ctx.poolLocatorStore?.delete(key)
      } catch {
        // Best-effort invalidation; the verified fallback below is safe.
      }
    }

    const rawPools = await ctx.client.getRawPools(false)
    const offset = rawPools.findIndex((pool) =>
      rawPoolMatches(pool, poolAddress),
    )
    if (offset < 0) return undefined
    const verifiedPool = await rawPoolAtOffset(ctx, offset)
    if (!verifiedPool || !rawPoolMatches(verifiedPool, poolAddress)) {
      throw new Error(
        `Sugar pool ${poolAddress} could not be verified at its discovered offset`,
      )
    }
    try {
      await ctx.poolLocatorStore?.set(key, { offset })
    } catch {
      // Persistence is an optimization; verified reads remain correct.
    }
    return { offset, rawPool: verifiedPool }
  })()
  ctx.resolvedPoolLocators.set(cacheKey, pending)
  void pending.catch(() => {
    if (ctx.resolvedPoolLocators.get(cacheKey) === pending) {
      ctx.resolvedPoolLocators.delete(cacheKey)
    }
  })
  return pending
}

function epochMaps(pools: LiquidityPool[], tokens: Token[], prices: Price[]) {
  return {
    pools: new Map(pools.map((pool) => [addressKey(pool.lp), pool])),
    tokens: new Map(tokens.map((token) => [addressKey(token.tokenAddress), token])),
    prices: new Map(prices.map((price) => [addressKey(price.token.tokenAddress), price])),
  }
}

export async function getPoolEpochs(ctx: SugarContext, lp: Address | string, offset = 0, limit = 10): Promise<LiquidityPoolEpoch[]> {
  const [tokens, pools, raw] = await Promise.all([
    ctx.client.getAllTokens(),
    ctx.client.getPools(),
    ctx.read<unknown[]>(ctx.settings.sugarRewardsContractAddress, abis.sugarRewards, 'epochsByAddress', [limit, offset, normalizeAddress(lp)]),
  ])
  const maps = epochMaps(pools, tokens, await ctx.client.getPrices(tokens))
  return raw.map((epoch) => epochFromTuple(epoch, maps.pools, maps.tokens, maps.prices))
}

export async function getLatestPoolEpochs(ctx: SugarContext): Promise<LiquidityPoolEpoch[]> {
  const rawEpochs = await paginate(ctx, 'epochsLatest', (limit, offset) => ctx.readTask<unknown[]>(ctx.settings.sugarRewardsContractAddress, abis.sugarRewards, 'epochsLatest', [limit, offset]))
  if (rawEpochs.length === 0) return []
  const tokens = await ctx.client.getAllTokens()
  const poolAddresses = new Set(rawEpochs.map((epoch) => addressKey(String(tupleValues(epoch)[1]))))
  const rawPools = (await ctx.client.getRawPools(false)).filter((pool) => poolAddresses.has(addressKey(String(tupleValues(pool)[0]))))
  const needed = new Set<string>([addressKey(ctx.settings.stableTokenAddress), ctx.settings.nativeTokenSymbol])
  rawPools.forEach((pool) => {
    const p = tupleValues(pool)
    ;[p[7], p[10], p[20]].forEach((address) => needed.add(addressKey(String(address))))
  })
  rawEpochs.forEach((epoch) => {
    const e = tupleValues(epoch)
    ;[...(e[4] as unknown[]), ...(e[5] as unknown[])].forEach((reward) => needed.add(addressKey(String(tupleValues(reward)[0]))))
  })
  const priceTokens = tokens.filter((token) => needed.has(addressKey(token.tokenAddress)) && (token.wrappedTokenAddress || token.listed || token.emerging))
  const prices = await ctx.client.getPrices(priceTokens)
  const pools = preparePools(rawPools, tokens, prices, ctx.settings)
  const maps = epochMaps(pools, tokens, prices)
  return rawEpochs.map((epoch) => epochFromTuple(epoch, maps.pools, maps.tokens, maps.prices))
}
