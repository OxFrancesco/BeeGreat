import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Predicate from 'effect/Predicate'
import { almStatePath } from './config'

/**
 * Persisted daemon state: when each position was last rebalanced and
 * compounded. This is what makes cooldowns and the daily rebalance cap
 * survive restarts. Timestamps are epoch milliseconds; rebalance history is
 * pruned to the last 24 hours on every record.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export type AlmPositionState = {
  /** Epoch ms of each rebalance in the last 24h (newest last). */
  rebalances: number[]
  lastCompoundAt?: number
}

export type AlmState = Record<string, AlmPositionState>

export function positionStateKey(chain: number, pool: string): string {
  return `${chain}:${pool.toLowerCase()}`
}

export function loadAlmState(path = almStatePath()) {
  if (!existsSync(path)) return {}
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!Predicate.isObject(raw) || Array.isArray(raw)) return {}
    const state: AlmState = {}
    for (const [key, value] of Object.entries(raw)) {
      if (!Predicate.isObject(value) || Array.isArray(value)) continue
      const rebalances = Array.isArray(value.rebalances) ? value.rebalances.filter(Predicate.isNumber) : []
      const lastCompoundAt = Predicate.isNumber(value.lastCompoundAt) ? value.lastCompoundAt : undefined
      state[key] = lastCompoundAt === undefined ? { rebalances } : { rebalances, lastCompoundAt }
    }
    return state
  } catch {
    // A corrupt state file must never brick the daemon; caps restart empty.
    return {}
  }
}

export function saveAlmState(state: AlmState, path = almStatePath()): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
}

export type RebalanceGate =
  | { allowed: true }
  | { allowed: false; reason: string }

/** Cooldown + rolling daily cap check for one position. */
export function checkRebalanceGate(
  state: AlmPositionState | undefined,
  now: number,
  cooldownMinutes: number,
  maxRebalancesPerDay: number,
): RebalanceGate {
  const recent = (state?.rebalances ?? []).filter((at) => now - at < DAY_MS)
  if (recent.length >= maxRebalancesPerDay) {
    return { allowed: false, reason: `daily cap reached (${recent.length}/${maxRebalancesPerDay} rebalances in the last 24h)` }
  }
  const last = recent.at(-1)
  if (last !== undefined && now - last < cooldownMinutes * 60_000) {
    const remaining = Math.ceil((cooldownMinutes * 60_000 - (now - last)) / 60_000)
    return { allowed: false, reason: `cooldown active (${remaining} min remaining of ${cooldownMinutes})` }
  }
  return { allowed: true }
}

export function recordRebalance(state: AlmState, key: string, now: number) {
  const entry = state[key] ?? { rebalances: [] }
  const rebalances = [...entry.rebalances.filter((at) => now - at < DAY_MS), now]
  return { ...state, [key]: { ...entry, rebalances } }
}

export function recordCompound(state: AlmState, key: string, now: number) {
  const entry = state[key] ?? { rebalances: [] }
  return { ...state, [key]: { ...entry, lastCompoundAt: now } }
}
