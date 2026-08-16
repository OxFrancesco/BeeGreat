// Brain Fatigue settlement: continuous per-goal Honey drain with focus-shield
// and Genius-state protection, plus the daily batch sweep over every Hive.
// Plain TypeScript helpers only — the Convex function definitions live in
// economy.ts.

import type { Doc } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import {
  GENIUS_WINDOW_MS,
  coveredDurationMs,
  fatigueDailyRateForRank,
  materializeFatigue,
} from '../economyPolicy'
import { MAX_ACTIVE_GOALS } from '../focusConstants'
import {
  activeEconomyGoals,
  ensureGoalStats,
  ensureHive,
  focusShieldsOverlapping,
  type IdentityKeys,
} from './core'
import { ensureAchievementBackfillScheduled } from './achievements'

/**
 * Settles continuous Brain Fatigue through `now`. Fractional Honey×milliseconds
 * remains Goal-scoped; whole debits that cannot be collected are discarded.
 */
export async function settleFatigueForOwner(
  ctx: MutationCtx,
  keys: IdentityKeys,
  now = Date.now(),
) {
  const hive = await ensureHive(ctx, keys)
  const from = hive.fatigueSettledAt
  if (from === undefined || from >= now) {
    if (from === undefined)
      await ctx.db.patch('hives', hive._id, { fatigueSettledAt: now })
    return { honeyRemoved: 0, honeyBalance: hive.honeyBalance }
  }

  const goals = await activeEconomyGoals(ctx, keys)
  const shields = await focusShieldsOverlapping(ctx, keys.ownerKey, from)
  const statsByGoal = new Map<string, Doc<'goalEconomyStats'>>()
  for (const goal of goals) {
    statsByGoal.set(goal._id, await ensureGoalStats(ctx, keys, goal._id))
  }
  const wasGeniusAtStart =
    goals.length === MAX_ACTIVE_GOALS &&
    goals.every((goal) => {
      const progressAt = statsByGoal.get(goal._id)?.lastVerifiedProgressAt
      return (
        progressAt !== undefined &&
        progressAt >= from - GENIUS_WINDOW_MS &&
        progressAt <= from
      )
    })
  const geniusProtectedUntil = wasGeniusAtStart
    ? Math.min(
        now,
        ...goals.map(
          (goal) =>
            (statsByGoal.get(goal._id)?.lastVerifiedProgressAt ?? from) +
            GENIUS_WINDOW_MS,
        ),
      )
    : from
  let balance = Math.max(0, hive.honeyBalance)
  let totalRemoved = 0

  for (let index = 0; index < goals.length; index += 1) {
    const goal = goals[index]
    const stats = statsByGoal.get(goal._id)
    if (!stats)
      throw new Error('Goal economy stats missing during fatigue settlement')
    const protectedIntervals = shields
      .filter(
        (shield) => shield.goalId === goal._id && shield.activatedAt < now,
      )
      .map((shield) => ({ from: shield.activatedAt, to: shield.expiresAt }))
    if (geniusProtectedUntil > from) {
      protectedIntervals.push({ from, to: geniusProtectedUntil })
    }
    const protectedMs = coveredDurationMs(from, now, protectedIntervals)
    const chargeableMs = Math.max(0, now - from - protectedMs)
    const dailyRate = fatigueDailyRateForRank(index + 1)
    const materialized = materializeFatigue(
      chargeableMs,
      dailyRate,
      stats.fatigueRemainderMs,
    )
    const removed = Math.min(balance, materialized.wholeHoney)
    balance -= removed
    totalRemoved += removed
    await ctx.db.patch('goalEconomyStats', stats._id, {
      fatigueRemainderMs: materialized.remainderHoneyMs,
      honeyFatigueRemoved: stats.honeyFatigueRemoved + removed,
      updatedAt: now,
    })
    if (removed > 0) {
      await ctx.db.insert('honeyEconomyEntries', {
        ...keys,
        receiptKey: `fatigue:${from}:${now}:${goal._id}`,
        goalId: goal._id,
        kind: 'fatigue',
        delta: -removed,
        balanceAfter: balance,
        occurredAt: now,
      })
    }
  }

  await ctx.db.patch('hives', hive._id, {
    honeyBalance: balance,
    fatigueSettledAt: now,
  })
  return { honeyRemoved: totalRemoved, honeyBalance: balance }
}

export async function settleFatigueBatchPage(
  ctx: MutationCtx,
  args: { cursor: string | null; now?: number },
) {
  const now = args.now ?? Date.now()
  const page = await ctx.db.query('hives').paginate({
    cursor: args.cursor,
    numItems: 32,
  })
  for (const hive of page.page) {
    const keys = { ownerKey: hive.ownerKey, userId: hive.userId }
    await settleFatigueForOwner(ctx, keys, now)
    await ensureAchievementBackfillScheduled(ctx, keys, now)
  }
  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.economy.settleFatigueBatch, {
      cursor: page.continueCursor,
      now,
    })
  }
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    processed: page.page.length,
  }
}
