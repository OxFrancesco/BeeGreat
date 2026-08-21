import { executeSugarAction, type SugarExecutionOptions } from '../actions'
import { createSugarCacheStore } from '../cache'
import { SugarClient } from '../client'
import type { SugarAction, SugarParameters } from '../contracts'
import type { ChainSettings, SugarJson, Token } from '../types'

/**
 * One cache store for the whole TUI session: token catalogs and pool lists
 * are fetched once per chain (within the store TTL) and shared by every
 * action, instead of every keystroke paying the full catalog scan that a
 * fresh SugarClient would trigger.
 *
 * Quote tuning trades route exhaustiveness for latency: the headless CLI
 * keeps the default 3000 candidate paths in batches of 64, while the
 * interactive TUI quotes the 128 shortest ones in four light multicalls
 * (one concurrent wave, ~110ms measured on the public Base RPC with an
 * identical best route). Shortest paths carry nearly all real liquidity —
 * the SDK's own pruning prefers them. Longer price caching only affects
 * advisory USD context, never quoted amounts. Each tune is skipped when
 * the matching SUGAR_* env var is set, since settings overrides beat env.
 */
export const cacheStore = createSugarCacheStore()

const envPinned = (prefix: string) => Object.keys(process.env).some((name) => name.startsWith(prefix))

const tunedSettings: Partial<ChainSettings> = {}
if (!envPinned('SUGAR_QUOTE_MAX_PATHS')) tunedSettings.quoteMaxPaths = 128
if (!envPinned('SUGAR_QUOTE_BATCH_SIZE')) tunedSettings.quoteBatchSize = 32
if (!envPinned('SUGAR_PRICING_CACHE_TIMEOUT_SECONDS')) tunedSettings.pricingCacheTimeoutSeconds = 30

export const tuiExecution: SugarExecutionOptions = {
  cacheStore,
  settings: tunedSettings,
}

/**
 * Prefetched read results keyed by action + parameters. Screens consume an
 * in-flight or fresh entry instead of paying the scan again; entries expire
 * quickly because positions and epochs change with every transaction.
 */
const PREFETCH_TTL_MS = 60_000
const prefetched = new Map<string, { expiresAt: number; promise: Promise<SugarJson> }>()

function prefetchKey(action: SugarAction, parameters: SugarParameters): string {
  const sorted = Object.fromEntries(Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)))
  return `${action}:${JSON.stringify(sorted)}`
}

export function prefetchTuiAction(action: SugarAction, parameters: SugarParameters): void {
  const key = prefetchKey(action, parameters)
  const entry = prefetched.get(key)
  if (entry && entry.expiresAt > Date.now()) return
  const promise = executeSugarAction(action, parameters, tuiExecution)
  promise.catch(() => prefetched.delete(key))
  prefetched.set(key, { expiresAt: Date.now() + PREFETCH_TTL_MS, promise })
}

/** Run a read through the prefetch layer; `fresh` bypasses and refills it. */
export function runTuiAction(action: SugarAction, parameters: SugarParameters, options: { fresh?: boolean } = {}): Promise<SugarJson> {
  const key = prefetchKey(action, parameters)
  const entry = prefetched.get(key)
  if (!options.fresh && entry && entry.expiresAt > Date.now()) return entry.promise
  prefetched.delete(key)
  return executeSugarAction(action, parameters, tuiExecution)
}

/** After a broadcast the chain state moved; stale prefetches must not survive it. */
export function clearTuiPrefetch(): void {
  prefetched.clear()
}

/** Parameters the browse screens use, shared so prefetch keys line up. No
 * limit: the hydrated pool list is cache-backed, and the browse screen
 * fuzzy-filters the whole catalog client-side. */
export const POOLS_BROWSE_PARAMETERS = { full: true } as const

/** Fire-and-forget: pre-populate caches and the slowest scans at TUI start. */
export function warmChain(chain: number, wallet?: string): void {
  const warm = async () => {
    const client = new SugarClient(chain, { cacheStore })
    // Sequential on purpose: public RPCs rate-limit aggressively, and the
    // quote path needs tokens + swap pools + prices first anyway.
    await client.getAllTokens()
    await client.getPoolsForSwaps()
    const anchors = (await Promise.all([
      client.getToken(client.settings.nativeTokenSymbol),
      client.getToken(client.settings.stableTokenAddress),
    ])).filter((token): token is Token => token !== undefined)
    if (anchors.length > 0) await client.getPrices(anchors)
    await client.getPools()
    // The heaviest uncached scans, warmed so their screens open instantly.
    prefetchTuiAction('pools', { chain, ...POOLS_BROWSE_PARAMETERS })
    prefetchTuiAction('epochs_latest', { chain })
    if (wallet) prefetchTuiAction('positions', { chain, wallet })
    if (chain === 8453 || chain === 10) {
      void import('./analytics/dune').then(({ fetchDune }) => fetchDune(chain)).catch(() => undefined)
      void import('./analytics/llama').then(({ fetchLlama }) => fetchLlama(chain)).catch(() => undefined)
    }
  }
  warm().catch(() => {
    // Warming is best-effort; the action itself will surface real errors.
  })
}
