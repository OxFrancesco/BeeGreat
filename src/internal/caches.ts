import * as Cache from 'effect/Cache'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { SugarRpcError } from '../errors'
import type { SugarClientCaches } from '../types'
import type { SugarContext } from './context'

/** Successes live for the cache's lifetime; failures are never retained. */
const successOnly = <A>(exit: Exit.Exit<A, SugarRpcError>) =>
  Exit.isSuccess(exit) ? Duration.infinity : Duration.zero

/**
 * Keyed dedupe cache for chain reads owned by a single client: concurrent
 * lookups of a missing key share one in-flight read and failed lookups are
 * never retained.
 */
export function makeReadCache<Key, A>(
  lookup: (key: Key) => Effect.Effect<A, SugarRpcError>,
  capacity = 16,
): Effect.Effect<Cache.Cache<Key, A, SugarRpcError>> {
  return Cache.makeWith(lookup, { capacity, timeToLive: successOnly })
}

/**
 * Keyed dedupe cache shared across SugarClient instances through a cache
 * store entry. The lookup is late-bound to the client currently driving the
 * read (`activeContext`), so a client with a broken transport can never
 * poison the store for healthy clients: its failed lookup is not retained,
 * and the next client retries with its own transport.
 */
export function makeSharedReadCache<Key, A>(
  caches: SugarClientCaches,
  lookup: (ctx: SugarContext, key: Key) => Effect.Effect<A, SugarRpcError>,
  capacity = 16,
): Effect.Effect<Cache.Cache<Key, A, SugarRpcError>> {
  return Cache.makeWith(
    (key: Key) => Effect.suspend(() => {
      const ctx = caches.activeContext
      if (!ctx) return Effect.die(new Error('shared Sugar cache lookup without an active client context'))
      return lookup(ctx, key)
    }),
    { capacity, timeToLive: successOnly },
  )
}

/** Read through a shared cache on behalf of `ctx` (see makeSharedReadCache). */
export function sharedCacheGet<Key, A>(
  ctx: SugarContext,
  cache: Cache.Cache<Key, A, SugarRpcError>,
  key: Key,
): Effect.Effect<A, SugarRpcError> {
  return Effect.suspend(() => {
    ctx.caches.activeContext = ctx
    return Cache.get(cache, key)
  })
}
