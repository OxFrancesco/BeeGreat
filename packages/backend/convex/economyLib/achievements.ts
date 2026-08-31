// Achievements reconciliation: unlock candidates, presentation, and the
// paginated backfill over historical verified-progress events. Plain
// TypeScript helpers only — the Convex function definitions live in
// economy.ts.

import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import {
  ACHIEVEMENT_SCORE_AWARD,
  COMPLETED_GOAL_ACHIEVEMENT_RANKS,
  GENIUS_WINDOW_MS,
  GOAL_TASK_ACHIEVEMENT_RANKS,
} from '../economyPolicy'
import { MAX_ACTIVE_GOALS } from '../focusConstants'
import { ensureGoalStats, ensureHive, type IdentityKeys } from './core'

type AchievementPresentation = {
  id: string
  title: string
  rank?: number
  kind: 'goliebee' | 'hive'
}

export function achievementPresentation(
  unlock: Doc<'achievementUnlocks'>,
): AchievementPresentation {
  const match = unlock.achievementKey.match(/:(\d+)$/)
  const rank = match ? Number(match[1]) : undefined
  const title = unlock.achievementKey.includes(':tasks:')
    ? `GolieBee Task ${rank}`
    : unlock.achievementKey.startsWith('hive:completed-goals:')
      ? `Completed Goals ${rank}`
      : 'Genius State'
  const presentation: AchievementPresentation = {
    id: unlock.achievementKey,
    title,
    kind: unlock.scope === 'goal' ? 'goliebee' : 'hive',
  }
  if (rank !== undefined) presentation.rank = rank
  return presentation
}

function goalWasKnownActiveAt(goal: Doc<'goals'>, occurredAt: number) {
  const activatedAt = goal.activatedAt ?? goal._creationTime
  if (occurredAt < activatedAt) return false
  if (goal.status === 'active') return true
  const endedAt =
    goal.completedAt ?? goal.abandonedAt ?? goal.lifecycleUpdatedAt
  return endedAt !== undefined && occurredAt <= endedAt
}

type AchievementCandidate = {
  key: string
  scope: 'goal' | 'hive'
  goalId?: Id<'goals'>
}

async function currentAchievementCandidates(
  ctx: MutationCtx,
  keys: IdentityKeys,
  goalStats: Doc<'goalEconomyStats'>[],
  geniusActivatedAt?: number,
) {
  const candidates: AchievementCandidate[] = []
  for (const stats of goalStats) {
    for (const rank of GOAL_TASK_ACHIEVEMENT_RANKS) {
      if (stats.taskProgressCount >= rank) {
        candidates.push({
          key: `goal:${stats.goalId}:tasks:${rank}`,
          scope: 'goal',
          goalId: stats.goalId,
        })
      }
    }
  }
  const completedGoals = await ctx.db
    .query('goals')
    .withIndex('by_user', (q) =>
      q.eq('userId', keys.userId).eq('status', 'completed'),
    )
    .take(
      COMPLETED_GOAL_ACHIEVEMENT_RANKS[
        COMPLETED_GOAL_ACHIEVEMENT_RANKS.length - 1
      ],
    )
  for (const rank of COMPLETED_GOAL_ACHIEVEMENT_RANKS) {
    if (completedGoals.length >= rank) {
      candidates.push({ key: `hive:completed-goals:${rank}`, scope: 'hive' })
    }
  }
  if (geniusActivatedAt !== undefined) {
    candidates.push({ key: 'hive:first-genius', scope: 'hive' })
  }
  return candidates
}

async function unlockAchievementCandidates(
  ctx: MutationCtx,
  keys: IdentityKeys,
  hive: Doc<'hives'>,
  candidates: AchievementCandidate[],
  now: number,
) {
  let unlocked = 0
  for (const candidate of candidates) {
    const existing = await ctx.db
      .query('achievementUnlocks')
      .withIndex('by_owner_key_and_achievement_key', (q) =>
        q.eq('ownerKey', keys.ownerKey).eq('achievementKey', candidate.key),
      )
      .unique()
    if (existing) continue
    await ctx.db.insert('achievementUnlocks', {
      ...keys,
      achievementKey: candidate.key,
      scope: candidate.scope,
      goalId: candidate.goalId,
      scoreAwarded: ACHIEVEMENT_SCORE_AWARD,
      unlockedAt: now,
    })
    unlocked += 1
  }
  const scoreAwarded = unlocked * ACHIEVEMENT_SCORE_AWARD
  if (scoreAwarded > 0) {
    await ctx.db.patch('hives', hive._id, {
      honeycombScore: hive.honeycombScore + scoreAwarded,
    })
  }
  return { unlocked, scoreAwarded }
}

export async function ensureAchievementBackfillScheduled(
  ctx: MutationCtx,
  keys: IdentityKeys,
  now: number,
) {
  const existing = await ctx.db
    .query('achievementBackfillStates')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', keys.ownerKey))
    .unique()
  if (existing) return existing
  const stateId = await ctx.db.insert('achievementBackfillStates', {
    ...keys,
    cursor: null,
    recentGoalProgress: [],
    geniusDetected: false,
    updatedAt: now,
  })
  await ctx.scheduler.runAfter(
    0,
    internal.economy.continueAchievementBackfill,
    { ...keys, cursor: null },
  )
  return await ctx.db.get('achievementBackfillStates', stateId)
}

export async function reconcileAchievementsForOwner(
  ctx: MutationCtx,
  keys: IdentityKeys,
  now = Date.now(),
  goalId?: Id<'goals'>,
) {
  const hive = await ensureHive(ctx, keys)
  const stats = goalId ? [await ensureGoalStats(ctx, keys, goalId)] : []
  const candidates = await currentAchievementCandidates(
    ctx,
    keys,
    stats,
    hive.geniusActivatedAt,
  )
  const result = await unlockAchievementCandidates(
    ctx,
    keys,
    hive,
    candidates,
    now,
  )
  await ensureAchievementBackfillScheduled(ctx, keys, now)
  return result
}

export async function continueAchievementBackfillPage(
  ctx: MutationCtx,
  args: { ownerKey: string; userId: string; cursor: string | null },
) {
  const keys = { ownerKey: args.ownerKey, userId: args.userId }
  const state = await ctx.db
    .query('achievementBackfillStates')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', keys.ownerKey))
    .unique()
  if (
    !state ||
    state.completedAt !== undefined ||
    state.cursor !== args.cursor
  ) {
    return { processed: 0, isDone: true }
  }

  const page = await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_occurred_at', (q) =>
      q.eq('ownerKey', keys.ownerKey),
    )
    .order('asc')
    .paginate({ cursor: args.cursor, numItems: 128 })
  const now = Date.now()
  const uncounted = page.page.filter(
    (event) => event.achievementBackfilledAt === undefined,
  )
  const pageStats = new Map<
    string,
    { goalId: Id<'goals'>; count: number; lastProgressAt: number }
  >()
  for (const event of uncounted) {
    const current = pageStats.get(event.goalId)
    pageStats.set(event.goalId, {
      goalId: event.goalId,
      count: (current?.count ?? 0) + 1,
      lastProgressAt: Math.max(
        current?.lastProgressAt ?? 0,
        event.occurredAt,
      ),
    })
  }

  const affectedStats: Doc<'goalEconomyStats'>[] = []
  for (const pageStat of pageStats.values()) {
    const stats = await ensureGoalStats(ctx, keys, pageStat.goalId)
    const backfilledProgressCount =
      (stats.backfilledProgressCount ?? 0) + pageStat.count
    const taskProgressCount = Math.max(
      stats.taskProgressCount,
      backfilledProgressCount,
    )
    const lastVerifiedProgressAt = Math.max(
      stats.lastVerifiedProgressAt ?? 0,
      pageStat.lastProgressAt,
    )
    await ctx.db.patch('goalEconomyStats', stats._id, {
      backfilledProgressCount,
      taskProgressCount,
      lastVerifiedProgressAt,
      updatedAt: now,
    })
    affectedStats.push({
      ...stats,
      backfilledProgressCount,
      taskProgressCount,
      lastVerifiedProgressAt,
    })
  }
  for (const event of uncounted) {
    await ctx.db.patch('verifiedProgressEvents', event._id, {
      achievementBackfilledAt: now,
    })
  }

  let geniusDetected = state.geniusDetected
  let geniusActivatedAt: number | undefined
  const recent = new Map(
    state.recentGoalProgress.map((entry) => [entry.goalId, entry.occurredAt]),
  )
  const goalCache = new Map<string, Doc<'goals'> | null>()
  if (!geniusDetected) {
    for (const event of page.page) {
      recent.set(event.goalId, event.occurredAt)
      const threshold = event.occurredAt - GENIUS_WINDOW_MS
      for (const [goalId, occurredAt] of recent) {
        let goal = goalCache.get(goalId)
        if (goal === undefined) {
          goal = await ctx.db.get('goals', goalId)
          goalCache.set(goalId, goal)
        }
        if (
          occurredAt < threshold ||
          !goal ||
          !goalWasKnownActiveAt(goal, event.occurredAt)
        ) {
          recent.delete(goalId)
        }
      }
      if (recent.size >= MAX_ACTIVE_GOALS) {
        geniusDetected = true
        geniusActivatedAt = event.occurredAt
        recent.clear()
        break
      }
    }
  }

  const hive = await ensureHive(ctx, keys)
  if (
    geniusActivatedAt !== undefined &&
    hive.geniusActivatedAt === undefined
  ) {
    await ctx.db.patch('hives', hive._id, { geniusActivatedAt })
  }
  const candidates = await currentAchievementCandidates(
    ctx,
    keys,
    affectedStats,
    hive.geniusActivatedAt ?? geniusActivatedAt,
  )
  await unlockAchievementCandidates(ctx, keys, hive, candidates, now)

  await ctx.db.patch('achievementBackfillStates', state._id, {
    cursor: page.continueCursor,
    recentGoalProgress: [...recent].map(([goalId, occurredAt]) => ({
      goalId,
      occurredAt,
    })),
    geniusDetected,
    completedAt: page.isDone ? now : undefined,
    updatedAt: now,
  })
  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.economy.continueAchievementBackfill,
      { ...keys, cursor: page.continueCursor },
    )
  }
  return { processed: page.page.length, isDone: page.isDone }
}
