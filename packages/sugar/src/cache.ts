import type { SugarCacheStore, SugarClientCaches } from './types'

export type SugarCacheStoreOptions = {
  /** How long one chain's caches stay shared before a fresh scan. */
  ttlMs?: number
}

const DEFAULT_TTL_MS = 120_000

function freshCaches(): SugarClientCaches {
  return { rawPoolCache: new Map(), poolCache: new Map() }
}

/**
 * Create a store that shares token and pool caches across SugarClient
 * instances for the same chain and RPC. Swap amounts always come from live
 * quoter calls, so a short TTL only delays seeing brand-new pools or tokens.
 */
export function createSugarCacheStore(
  options: SugarCacheStoreOptions = {},
): SugarCacheStore {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('cacheStore.ttlMs must be a positive number')
  }
  const entries = new Map<
    string,
    { caches: SugarClientCaches; expiresAt: number }
  >()
  return {
    cachesFor(chainId, rpcUrl) {
      const key = `${chainId}:${rpcUrl}`
      const entry = entries.get(key)
      if (entry && entry.expiresAt > Date.now()) return entry.caches
      const caches = freshCaches()
      entries.set(key, { caches, expiresAt: Date.now() + ttlMs })
      return caches
    },
  }
}
