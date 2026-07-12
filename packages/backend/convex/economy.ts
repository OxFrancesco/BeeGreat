import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  ACHIEVEMENT_SCORE_AWARD,
  COMPLETED_GOAL_ACHIEVEMENT_RANKS,
  FOCUS_SHIELD_COST,
  FOCUS_SHIELD_DURATION_MS,
  GENIUS_WINDOW_MS,
  GOAL_TASK_ACHIEVEMENT_RANKS,
  RESURRECTION_COST,
  ROYAL_JELLY_WEEKLY_AWARD,
  TASK_HONEY_AWARD,
  TASK_REWARD_CAP,
  TASK_REWARD_WINDOW_MS,
  TASK_SCORE_AWARD,
  coveredDurationMs,
  fatigueDailyRateForRank,
  materializeFatigue,
  totalDailyFatigue,
} from './economyPolicy'
import { MAX_ACTIVE_GOALS } from './focusConstants'
import {
  canAccessGoalFocusLineage,
  requireGoalFocusOwner,
} from './focusDeletion'

export type IdentityKeys = { ownerKey: string; userId: string }

const achievementSummaryValidator = v.object({
  id: v.string(),
  title: v.string(),
  rank: v.optional(v.number()),
  kind: v.union(v.literal('goliebee'), v.literal('hive')),
})

const economySummaryValidator = v.object({
  royalJellyBalance: v.number(),
  brainFatigue: v.object({
    isActive: v.boolean(),
    dailyHoneyDrain: v.number(),
    rank: v.number(),
    affectedGoalCount: v.number(),
  }),
  geniusState: v.object({
    isActive: v.boolean(),
    verifiedGoalCount: v.number(),
    requiredGoalCount: v.number(),
  }),
  activeFocusShield: v.union(
    v.object({
      goalId: v.id('goals'),
      goalTitle: v.string(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  weeklyProgress: v.union(
    v.object({
      startedAt: v.number(),
      endsAt: v.number(),
      completedGoals: v.number(),
      requiredGoals: v.number(),
      completed: v.boolean(),
    }),
    v.null(),
  ),
  achievements: v.array(achievementSummaryValidator),
})

export async function requireEconomyIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<IdentityKeys> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    })
  }
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject }
}

function requiredRequestId(value: string) {
  const requestId = value.trim()
  if (!requestId) {
    throw new ConvexError({
      code: 'INVALID_REQUEST',
      message: 'Request id cannot be empty',
    })
  }
  return requestId
}

async function priorEconomyCommand(
  ctx: MutationCtx,
  keys: IdentityKeys,
  requestId: string,
  kind: Doc<'economyCommandReceipts'>['kind'],
  fingerprint: string,
) {
  const receipt = await ctx.db
    .query('economyCommandReceipts')
    .withIndex('by_owner_key_and_request_id', (q) =>
      q.eq('ownerKey', keys.ownerKey).eq('requestId', requestId),
    )
    .unique()
  if (
    receipt &&
    (receipt.kind !== kind || receipt.fingerprint !== fingerprint)
  ) {
    throw new ConvexError({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Request id was already used for a different economy command',
    })
  }
  return receipt
}

export async function findHive(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  return await ctx.db
    .query('hives')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .unique()
}

export async function ensureHive(ctx: MutationCtx, keys: IdentityKeys) {
  const existing = await findHive(ctx, keys.ownerKey)
  if (existing) return existing
  const hiveId = await ctx.db.insert('hives', {
    ...keys,
    honeyBalance: 0,
    honeycombScore: 0,
    royalJellyBalance: 0,
    fatigueSettledAt: Date.now(),
  })
  const hive = await ctx.db.get('hives', hiveId)
  if (!hive) throw new Error('Failed to create Hive')
  return hive
}

async function activeEconomyGoals(
  ctx: QueryCtx | MutationCtx,
  keys: IdentityKeys,
) {
  const candidates = await ctx.db
    .query('goals')
    .withIndex('by_user', (q) =>
      q.eq('userId', keys.userId).eq('status', 'active'),
    )
    .take(32)
  const goals: Doc<'goals'>[] = []
  for (const goal of candidates) {
    if (await canAccessGoalFocusLineage(ctx, keys.ownerKey, goal._id))
      goals.push(goal)
  }
  return goals
    .sort(
      (a, b) =>
        (a.activatedAt ?? a._creationTime) -
          (b.activatedAt ?? b._creationTime) ||
        a._creationTime - b._creationTime,
    )
    .slice(0, MAX_ACTIVE_GOALS)
}

async function findGoalStats(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  goalId: Id<'goals'>,
) {
  return await ctx.db
    .query('goalEconomyStats')
    .withIndex('by_owner_key_and_goal_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('goalId', goalId),
    )
    .unique()
}

async function ensureGoalStats(
  ctx: MutationCtx,
  keys: IdentityKeys,
  goalId: Id<'goals'>,
) {
  const existing = await findGoalStats(ctx, keys.ownerKey, goalId)
  if (existing) return existing
  const id = await ctx.db.insert('goalEconomyStats', {
    ...keys,
    goalId,
    honeyEarned: 0,
    honeyFatigueRemoved: 0,
    honeyAbandonmentRemoved: 0,
    honeyResurrectionRefunded: 0,
    fatigueRemainderMs: 0,
    taskProgressCount: 0,
    backfilledProgressCount: 0,
    updatedAt: Date.now(),
  })
  const stats = await ctx.db.get('goalEconomyStats', id)
  if (!stats) throw new Error('Failed to create Goal economy stats')
  return stats
}

async function activeFocusShield(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  now: number,
) {
  const rows = await ctx.db
    .query('boosterActivations')
    .withIndex('by_owner_key_and_kind_and_expires_at', (q) =>
      q
        .eq('ownerKey', ownerKey)
        .eq('kind', 'focus-shield')
        .gte('expiresAt', now),
    )
    .take(1)
  return rows[0] ?? null
}

async function focusShieldsOverlapping(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  from: number,
) {
  return await ctx.db
    .query('boosterActivations')
    .withIndex('by_owner_key_and_kind_and_expires_at', (q) =>
      q
        .eq('ownerKey', ownerKey)
        .eq('kind', 'focus-shield')
        .gt('expiresAt', from),
    )
    .collect()
}

async function geniusProgress(
  ctx: QueryCtx | MutationCtx,
  keys: IdentityKeys,
  goals: Doc<'goals'>[],
  now: number,
  currentEvent?: { goalId: Id<'goals'>; occurredAt: number },
) {
  let verifiedGoalCount = 0
  const threshold = now - GENIUS_WINDOW_MS
  for (const goal of goals) {
    const stats = await findGoalStats(ctx, keys.ownerKey, goal._id)
    const lastProgress =
      currentEvent?.goalId === goal._id
        ? Math.max(stats?.lastVerifiedProgressAt ?? 0, currentEvent.occurredAt)
        : (stats?.lastVerifiedProgressAt ?? 0)
    if (lastProgress >= threshold && lastProgress <= now) verifiedGoalCount += 1
  }
  return {
    isActive:
      goals.length === MAX_ACTIVE_GOALS &&
      verifiedGoalCount === MAX_ACTIVE_GOALS,
    verifiedGoalCount,
    requiredGoalCount: MAX_ACTIVE_GOALS,
  }
}

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

async function ensureWeeklyRoster(
  ctx: MutationCtx,
  keys: IdentityKeys,
  goals: Doc<'goals'>[],
  now: number,
) {
  const rows = await ctx.db
    .query('weeklyProgressRosters')
    .withIndex('by_owner_key_and_started_at', (q) =>
      q.eq('ownerKey', keys.ownerKey),
    )
    .order('desc')
    .take(1)
  const current = rows[0]
  if (current && current.endsAt >= now) return current
  const rosterId = await ctx.db.insert('weeklyProgressRosters', {
    ...keys,
    startedAt: now,
    endsAt: now + GENIUS_WINDOW_MS,
    goalIds: goals.map((goal) => goal._id),
    satisfiedGoalIds: [],
    anonymousRequiredCount: 0,
    anonymousSatisfiedCount: 0,
  })
  const roster = await ctx.db.get('weeklyProgressRosters', rosterId)
  if (!roster) throw new Error('Failed to create weekly progress roster')
  return roster
}

async function applyWeeklyProgress(
  ctx: MutationCtx,
  keys: IdentityKeys,
  hive: Doc<'hives'>,
  goals: Doc<'goals'>[],
  goalId: Id<'goals'>,
  now: number,
) {
  const roster = await ensureWeeklyRoster(ctx, keys, goals, now)
  const belongs = roster.goalIds.some((id) => id === goalId)
  const satisfied =
    belongs && !roster.satisfiedGoalIds.some((id) => id === goalId)
      ? [...roster.satisfiedGoalIds, goalId]
      : roster.satisfiedGoalIds
  const anonymousRequired = roster.anonymousRequiredCount ?? 0
  const anonymousSatisfied = roster.anonymousSatisfiedCount ?? 0
  const requiredCount = roster.goalIds.length + anonymousRequired
  const satisfiedCount = satisfied.length + anonymousSatisfied
  const shouldAward =
    !roster.completedAt &&
    requiredCount > 0 &&
    satisfiedCount === requiredCount &&
    (hive.lastRoyalJellyEarnedAt === undefined ||
      now - hive.lastRoyalJellyEarnedAt >= GENIUS_WINDOW_MS)
  if (satisfied !== roster.satisfiedGoalIds || shouldAward) {
    await ctx.db.patch('weeklyProgressRosters', roster._id, {
      satisfiedGoalIds: satisfied,
      completedAt: shouldAward ? now : roster.completedAt,
      royalJellyAwarded: shouldAward
        ? ROYAL_JELLY_WEEKLY_AWARD
        : roster.royalJellyAwarded,
    })
  }
  if (!shouldAward) return 0
  const balance = (hive.royalJellyBalance ?? 0) + ROYAL_JELLY_WEEKLY_AWARD
  await ctx.db.patch('hives', hive._id, {
    royalJellyBalance: balance,
    lastRoyalJellyEarnedAt: now,
  })
  await ctx.db.insert('royalJellyLedgerEntries', {
    ...keys,
    receiptKey: `weekly-progress:${roster._id}`,
    kind: 'weekly-progress',
    delta: ROYAL_JELLY_WEEKLY_AWARD,
    balanceAfter: balance,
    occurredAt: now,
  })
  return ROYAL_JELLY_WEEKLY_AWARD
}

export type TaskCompletionResult = {
  status: 'completed' | 'already_completed'
  taskId: Id<'tasks'>
  honeyAwarded: number
  scoreAwarded: number
  honeyBalance: number
  honeycombScore: number
}

/** Server-authoritative once-ever Task completion shared by every app surface. */
export async function completeTaskWithEconomy(
  ctx: MutationCtx,
  keys: IdentityKeys,
  args: {
    requestId: string
    task: Doc<'tasks'>
    projectId?: Id<'projects'>
    now?: number
  },
): Promise<TaskCompletionResult> {
  const now = args.now ?? Date.now()
  const goal = await ctx.db.get('goals', args.task.goalId)
  if (!goal || goal.userId !== keys.userId || goal.status !== 'active') {
    throw new ConvexError({
      code: 'ACTIVE_GOAL_REQUIRED',
      message: 'Verified progress requires an Active Goal',
    })
  }
  const priorByRequest = await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_request_id', (q) =>
      q.eq('ownerKey', keys.ownerKey).eq('requestId', args.requestId),
    )
    .unique()
  if (priorByRequest && priorByRequest.taskId !== args.task._id) {
    throw new ConvexError({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Request id was already used for another Task',
    })
  }
  const priorByTask = await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_task_id', (q) =>
      q.eq('ownerKey', keys.ownerKey).eq('taskId', args.task._id),
    )
    .unique()
  if (priorByRequest || priorByTask) {
    if (args.task.status !== 'done') {
      await ctx.db.patch('tasks', args.task._id, {
        status: 'done',
        completedAt: now,
      })
    }
    const hive = await findHive(ctx, keys.ownerKey)
    return {
      status: 'already_completed',
      taskId: args.task._id,
      honeyAwarded: 0,
      scoreAwarded: 0,
      honeyBalance: hive?.honeyBalance ?? 0,
      honeycombScore: hive?.honeycombScore ?? 0,
    }
  }

  await settleFatigueForOwner(ctx, keys, now)
  let hive = await ensureHive(ctx, keys)
  const goals = await activeEconomyGoals(ctx, keys)
  const rank = goals.findIndex((goal) => goal._id === args.task.goalId) + 1
  const stats = await ensureGoalStats(ctx, keys, args.task.goalId)
  const shield = await activeFocusShield(ctx, keys.ownerKey, now)
  const genius = await geniusProgress(ctx, keys, goals, now, {
    goalId: args.task.goalId,
    occurredAt: now,
  })
  const newlyActivatedGenius =
    genius.isActive && hive.geniusActivatedAt === undefined
  let rewardedTaskTimestamps = (hive.rewardedTaskTimestamps ?? []).filter(
    (timestamp) => timestamp >= now - TASK_REWARD_WINDOW_MS && timestamp <= now,
  )
  if (hive.rewardedTaskTimestamps === undefined) {
    rewardedTaskTimestamps = []
    const priorEvents = ctx.db
      .query('verifiedProgressEvents')
      .withIndex('by_owner_key_and_occurred_at', (q) =>
        q
          .eq('ownerKey', keys.ownerKey)
          .gte('occurredAt', now - TASK_REWARD_WINDOW_MS),
      )
      .order('desc')
    for await (const event of priorEvents) {
      if (event.honeyDelta > 0 || event.scoreDelta > 0) {
        rewardedTaskTimestamps.push(event.occurredAt)
        if (rewardedTaskTimestamps.length >= TASK_REWARD_CAP) break
      }
    }
  }
  const withinCap = rewardedTaskTimestamps.length < TASK_REWARD_CAP
  const exhausted =
    rank >= 4 &&
    !genius.isActive &&
    shield?.goalId !== args.task.goalId &&
    hive.honeyBalance === 0
  const honeyAwarded = withinCap && !exhausted ? TASK_HONEY_AWARD : 0
  const scoreAwarded = withinCap ? TASK_SCORE_AWARD : 0
  const honeyBalance = Math.max(0, hive.honeyBalance + honeyAwarded)
  const honeycombScore = Math.max(0, hive.honeycombScore + scoreAwarded)
  if (withinCap) rewardedTaskTimestamps.push(now)

  await ctx.db.patch('tasks', args.task._id, {
    status: 'done',
    completedAt: now,
  })
  const progressEventId = await ctx.db.insert('verifiedProgressEvents', {
    ...keys,
    requestId: args.requestId,
    goalId: args.task.goalId,
    projectId: args.projectId ?? args.task.projectId,
    taskId: args.task._id,
    kind: 'task-completed',
    honeyDelta: honeyAwarded,
    scoreDelta: scoreAwarded,
    occurredAt: now,
    rewardEligible: withinCap && !exhausted,
    rewardReason: !withinCap
      ? 'rolling-cap'
      : exhausted
        ? 'exhausted'
        : 'awarded',
    geniusActivated: newlyActivatedGenius,
    achievementBackfilledAt: now,
  })
  await ctx.db.patch('goalEconomyStats', stats._id, {
    honeyEarned: stats.honeyEarned + honeyAwarded,
    taskProgressCount: stats.taskProgressCount + 1,
    lastVerifiedProgressAt: now,
    updatedAt: now,
  })
  await ctx.db.patch('hives', hive._id, {
    honeyBalance,
    honeycombScore,
    geniusActivatedAt: newlyActivatedGenius ? now : hive.geniusActivatedAt,
    rewardedTaskTimestamps,
  })
  if (honeyAwarded > 0) {
    await ctx.db.insert('honeyLedgerEntries', {
      ...keys,
      goalId: args.task.goalId,
      progressEventId,
      delta: honeyAwarded,
      balanceAfter: honeyBalance,
      occurredAt: now,
    })
  }
  hive = (await ctx.db.get('hives', hive._id)) ?? hive
  await applyWeeklyProgress(ctx, keys, hive, goals, args.task.goalId, now)
  await reconcileAchievementsForOwner(ctx, keys, now, args.task.goalId)

  return {
    status: 'completed',
    taskId: args.task._id,
    honeyAwarded,
    scoreAwarded,
    honeyBalance,
    honeycombScore,
  }
}

export async function economySummary(
  ctx: QueryCtx,
  keys: IdentityKeys,
  now = Date.now(),
) {
  const [hive, goals, shield, rosterRows, unlocks] = await Promise.all([
    findHive(ctx, keys.ownerKey),
    activeEconomyGoals(ctx, keys),
    activeFocusShield(ctx, keys.ownerKey, now),
    ctx.db
      .query('weeklyProgressRosters')
      .withIndex('by_owner_key_and_started_at', (q) =>
        q.eq('ownerKey', keys.ownerKey),
      )
      .order('desc')
      .take(1),
    ctx.db
      .query('achievementUnlocks')
      .withIndex('by_owner_key_and_unlocked_at', (q) =>
        q.eq('ownerKey', keys.ownerKey),
      )
      .order('desc')
      .take(100),
  ])
  const genius = await geniusProgress(ctx, keys, goals, now)
  const shieldedRank = shield
    ? goals.findIndex((goal) => goal._id === shield.goalId) + 1
    : 0
  const shieldedRate =
    shieldedRank > 0 ? fatigueDailyRateForRank(shieldedRank) : 0
  const dailyHoneyDrain = genius.isActive
    ? 0
    : totalDailyFatigue(goals.length) - shieldedRate
  const shieldGoal = shield ? await ctx.db.get('goals', shield.goalId) : null
  const roster = rosterRows[0]
  return {
    royalJellyBalance: hive?.royalJellyBalance ?? 0,
    brainFatigue: {
      isActive: dailyHoneyDrain > 0,
      dailyHoneyDrain,
      rank: goals.length,
      affectedGoalCount: genius.isActive
        ? 0
        : goals.filter((_, index) => fatigueDailyRateForRank(index + 1) > 0)
            .length - (shieldedRate > 0 ? 1 : 0),
    },
    geniusState: genius,
    activeFocusShield:
      shield && shieldGoal
        ? {
            goalId: shield.goalId,
            goalTitle: shieldGoal.title,
            expiresAt: shield.expiresAt,
          }
        : null,
    weeklyProgress: roster
      ? {
          startedAt: roster.startedAt,
          endsAt: roster.endsAt,
          completedGoals:
            roster.satisfiedGoalIds.length +
            (roster.anonymousSatisfiedCount ?? 0),
          requiredGoals:
            roster.goalIds.length + (roster.anonymousRequiredCount ?? 0),
          completed: roster.completedAt !== undefined,
        }
      : null,
    achievements: unlocks.map((unlock) => achievementPresentation(unlock)),
  }
}

export const getSummary = query({
  args: {},
  returns: economySummaryValidator,
  handler: async (ctx) =>
    economySummary(ctx, await requireEconomyIdentity(ctx)),
})

export const settleNow = mutation({
  args: {},
  returns: v.object({ honeyRemoved: v.number(), honeyBalance: v.number() }),
  handler: async (ctx) =>
    settleFatigueForOwner(ctx, await requireEconomyIdentity(ctx)),
})

export const spendHoney = mutation({
  args: { requestId: v.string(), cosmeticId: v.string(), amount: v.number() },
  returns: v.object({ honeyBalance: v.number(), spent: v.number() }),
  handler: async (ctx, args) => {
    const keys = await requireEconomyIdentity(ctx)
    const requestId = requiredRequestId(args.requestId)
    const cosmeticId = args.cosmeticId.trim()
    if (!Number.isSafeInteger(args.amount) || args.amount <= 0 || !cosmeticId) {
      throw new ConvexError({
        code: 'INVALID_SPEND',
        message: 'Invalid cosmetic Honey spend',
      })
    }
    const fingerprint = `${cosmeticId}:${args.amount}`
    const prior = await priorEconomyCommand(
      ctx,
      keys,
      requestId,
      'cosmetic-spend',
      fingerprint,
    )
    if (prior) {
      return { honeyBalance: prior.honeyBalance, spent: -prior.honeyDelta }
    }
    const receiptKey = `cosmetic:${requestId}`
    await settleFatigueForOwner(ctx, keys)
    const hive = await ensureHive(ctx, keys)
    if (hive.honeyBalance < args.amount) {
      throw new ConvexError({
        code: 'INSUFFICIENT_HONEY',
        message: 'Not enough Honey',
      })
    }
    const balance = hive.honeyBalance - args.amount
    await ctx.db.patch('hives', hive._id, { honeyBalance: balance })
    await ctx.db.insert('honeyEconomyEntries', {
      ...keys,
      receiptKey,
      kind: 'cosmetic-spend',
      delta: -args.amount,
      balanceAfter: balance,
      occurredAt: Date.now(),
    })
    await ctx.db.insert('economyCommandReceipts', {
      ...keys,
      requestId,
      kind: 'cosmetic-spend',
      fingerprint,
      honeyDelta: -args.amount,
      honeyBalance: balance,
      royalJellyBalance: hive.royalJellyBalance ?? 0,
      occurredAt: Date.now(),
    })
    return { honeyBalance: balance, spent: args.amount }
  },
})

export const activateFocusShield = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({
    goalId: v.id('goals'),
    expiresAt: v.number(),
    royalJellyBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const keys = await requireEconomyIdentity(ctx)
    const requestId = requiredRequestId(args.requestId)
    const fingerprint = `${args.goalId}`
    const prior = await priorEconomyCommand(
      ctx,
      keys,
      requestId,
      'focus-shield',
      fingerprint,
    )
    if (prior?.expiresAt !== undefined) {
      return {
        goalId: args.goalId,
        expiresAt: prior.expiresAt,
        royalJellyBalance: prior.royalJellyBalance,
      }
    }
    const goal = await ctx.db.get('goals', args.goalId)
    if (!goal || goal.userId !== keys.userId || goal.status !== 'active') {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Active Goal not found',
      })
    }
    await requireGoalFocusOwner(ctx, keys.ownerKey, goal._id)
    const now = Date.now()
    await settleFatigueForOwner(ctx, keys, now)
    const existing = await activeFocusShield(ctx, keys.ownerKey, now)
    if (existing) {
      throw new ConvexError({
        code: 'BOOSTER_ACTIVE',
        message: 'A Focus Shield is already active',
      })
    }
    const hive = await ensureHive(ctx, keys)
    const royalJelly = hive.royalJellyBalance ?? 0
    if (royalJelly < FOCUS_SHIELD_COST) {
      throw new ConvexError({
        code: 'INSUFFICIENT_ROYAL_JELLY',
        message: 'Not enough Royal Jelly',
      })
    }
    const balance = royalJelly - FOCUS_SHIELD_COST
    const expiresAt = now + FOCUS_SHIELD_DURATION_MS
    await ctx.db.patch('hives', hive._id, { royalJellyBalance: balance })
    const activationId = await ctx.db.insert('boosterActivations', {
      ...keys,
      goalId: goal._id,
      kind: 'focus-shield',
      activatedAt: now,
      expiresAt,
    })
    await ctx.db.insert('royalJellyLedgerEntries', {
      ...keys,
      receiptKey: `focus-shield:${activationId}`,
      kind: 'focus-shield',
      delta: -FOCUS_SHIELD_COST,
      balanceAfter: balance,
      occurredAt: now,
    })
    await ctx.db.insert('economyCommandReceipts', {
      ...keys,
      requestId,
      kind: 'focus-shield',
      fingerprint,
      goalId: goal._id,
      honeyDelta: 0,
      honeyBalance: hive.honeyBalance,
      royalJellyBalance: balance,
      expiresAt,
      occurredAt: now,
    })
    return { goalId: goal._id, expiresAt, royalJellyBalance: balance }
  },
})

export const abandonGoal = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({ honeyRemoved: v.number(), honeyBalance: v.number() }),
  handler: async (ctx, args) => {
    const keys = await requireEconomyIdentity(ctx)
    const requestId = requiredRequestId(args.requestId)
    const fingerprint = `${args.goalId}`
    const prior = await priorEconomyCommand(
      ctx,
      keys,
      requestId,
      'abandonment',
      fingerprint,
    )
    if (prior) {
      return {
        honeyRemoved: Math.max(0, -prior.honeyDelta),
        honeyBalance: prior.honeyBalance,
      }
    }
    const goal = await ctx.db.get('goals', args.goalId)
    if (!goal || goal.userId !== keys.userId || goal.status !== 'active') {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Active Goal not found',
      })
    }
    await requireGoalFocusOwner(ctx, keys.ownerKey, goal._id)
    const now = Date.now()
    await settleFatigueForOwner(ctx, keys, now)
    const hive = await ensureHive(ctx, keys)
    const stats = await ensureGoalStats(ctx, keys, goal._id)
    const contribution = Math.max(
      0,
      stats.honeyEarned - stats.honeyFatigueRemoved,
    )
    const removed = Math.min(hive.honeyBalance, contribution)
    const balance = hive.honeyBalance - removed
    await ctx.db.patch('hives', hive._id, {
      honeyBalance: balance,
      fatigueSettledAt: now,
    })
    await ctx.db.patch('goals', goal._id, {
      status: 'abandoned',
      abandonedAt: now,
      lifecycleUpdatedAt: now,
    })
    const bee = await ctx.db
      .query('golieBees')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', keys.ownerKey).eq('goalId', goal._id),
      )
      .unique()
    if (bee) await ctx.db.patch('golieBees', bee._id, { status: 'ghosty' })
    await ctx.db.patch('goalEconomyStats', stats._id, {
      honeyAbandonmentRemoved: stats.honeyAbandonmentRemoved + removed,
      lastAbandonmentRemoved: removed,
      resurrectionRefundClaimed: false,
      updatedAt: now,
    })
    await ctx.db.insert('honeyEconomyEntries', {
      ...keys,
      receiptKey: `abandonment:${goal._id}:${now}`,
      goalId: goal._id,
      kind: 'abandonment',
      delta: -removed,
      balanceAfter: balance,
      occurredAt: now,
    })
    await ctx.db.insert('economyCommandReceipts', {
      ...keys,
      requestId,
      kind: 'abandonment',
      fingerprint,
      goalId: goal._id,
      honeyDelta: -removed,
      honeyBalance: balance,
      royalJellyBalance: hive.royalJellyBalance ?? 0,
      occurredAt: now,
    })
    return { honeyRemoved: removed, honeyBalance: balance }
  },
})

export const resurrectGoal = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({
    honeyRefunded: v.number(),
    honeyBalance: v.number(),
    royalJellyBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const keys = await requireEconomyIdentity(ctx)
    const requestId = requiredRequestId(args.requestId)
    const fingerprint = `${args.goalId}`
    const prior = await priorEconomyCommand(
      ctx,
      keys,
      requestId,
      'resurrection',
      fingerprint,
    )
    if (prior) {
      return {
        honeyRefunded: Math.max(0, prior.honeyDelta),
        honeyBalance: prior.honeyBalance,
        royalJellyBalance: prior.royalJellyBalance,
      }
    }
    const goal = await ctx.db.get('goals', args.goalId)
    if (!goal || goal.userId !== keys.userId || goal.status !== 'abandoned') {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Abandoned Goal not found',
      })
    }
    await requireGoalFocusOwner(ctx, keys.ownerKey, goal._id)
    const active = await activeEconomyGoals(ctx, keys)
    if (active.length >= MAX_ACTIVE_GOALS) {
      throw new ConvexError({
        code: 'ACTIVE_GOAL_LIMIT',
        message: `A Hive can have at most ${MAX_ACTIVE_GOALS} Active Goals`,
      })
    }
    const now = Date.now()
    await settleFatigueForOwner(ctx, keys, now)
    const hive = await ensureHive(ctx, keys)
    const royalJelly = hive.royalJellyBalance ?? 0
    if (royalJelly < RESURRECTION_COST) {
      throw new ConvexError({
        code: 'INSUFFICIENT_ROYAL_JELLY',
        message: 'Not enough Royal Jelly',
      })
    }
    const stats = await ensureGoalStats(ctx, keys, goal._id)
    const refund = stats.resurrectionRefundClaimed
      ? 0
      : Math.floor(
          (stats.lastAbandonmentRemoved ?? stats.honeyAbandonmentRemoved) / 2,
        )
    const honeyBalance = hive.honeyBalance + refund
    const royalJellyBalance = royalJelly - RESURRECTION_COST
    await ctx.db.patch('hives', hive._id, {
      honeyBalance,
      royalJellyBalance,
      fatigueSettledAt: now,
    })
    await ctx.db.patch('goals', goal._id, {
      status: 'active',
      activatedAt: now,
      resurrectedAt: now,
      lifecycleUpdatedAt: now,
    })
    const bee = await ctx.db
      .query('golieBees')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', keys.ownerKey).eq('goalId', goal._id),
      )
      .unique()
    if (!bee) throw new Error('Goal GolieBee not found')
    await ctx.db.patch('golieBees', bee._id, { status: 'active' })
    await ctx.db.patch('goalEconomyStats', stats._id, {
      honeyResurrectionRefunded: stats.honeyResurrectionRefunded + refund,
      resurrectionRefundClaimed: true,
      fatigueRemainderMs: 0,
      updatedAt: now,
    })
    await ctx.db.insert('royalJellyLedgerEntries', {
      ...keys,
      receiptKey: `resurrection:${goal._id}:${now}`,
      kind: 'resurrection',
      delta: -RESURRECTION_COST,
      balanceAfter: royalJellyBalance,
      occurredAt: now,
    })
    await ctx.db.insert('honeyEconomyEntries', {
      ...keys,
      receiptKey: `resurrection-refund:${goal._id}:${now}`,
      goalId: goal._id,
      kind: 'resurrection-refund',
      delta: refund,
      balanceAfter: honeyBalance,
      occurredAt: now,
    })
    await ctx.db.insert('economyCommandReceipts', {
      ...keys,
      requestId,
      kind: 'resurrection',
      fingerprint,
      goalId: goal._id,
      honeyDelta: refund,
      honeyBalance,
      royalJellyBalance,
      occurredAt: now,
    })
    return { honeyRefunded: refund, honeyBalance, royalJellyBalance }
  },
})

export const completeGoal = mutation({
  args: {
    requestId: v.string(),
    goalId: v.id('goals'),
    confirmed: v.boolean(),
  },
  returns: v.object({ completed: v.boolean() }),
  handler: async (ctx, args) => {
    const keys = await requireEconomyIdentity(ctx)
    const requestId = requiredRequestId(args.requestId)
    if (!args.confirmed) return { completed: false }
    const fingerprint = `${args.goalId}:confirmed`
    const prior = await priorEconomyCommand(
      ctx,
      keys,
      requestId,
      'goal-completion',
      fingerprint,
    )
    if (prior) return { completed: prior.completed ?? true }
    const goal = await ctx.db.get('goals', args.goalId)
    if (!goal || goal.userId !== keys.userId || goal.status !== 'active') {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Active Goal not found',
      })
    }
    await requireGoalFocusOwner(ctx, keys.ownerKey, goal._id)
    const now = Date.now()
    const settled = await settleFatigueForOwner(ctx, keys, now)
    await ctx.db.patch('goals', goal._id, {
      status: 'completed',
      completedAt: now,
      lifecycleUpdatedAt: now,
    })
    const bee = await ctx.db
      .query('golieBees')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', keys.ownerKey).eq('goalId', goal._id),
      )
      .unique()
    if (bee)
      await ctx.db.patch('golieBees', bee._id, { status: 'hall-of-fame' })
    await reconcileAchievementsForOwner(ctx, keys, now)
    const hive = await ensureHive(ctx, keys)
    await ctx.db.insert('economyCommandReceipts', {
      ...keys,
      requestId,
      kind: 'goal-completion',
      fingerprint,
      goalId: goal._id,
      honeyDelta: 0,
      honeyBalance: settled.honeyBalance,
      royalJellyBalance: hive.royalJellyBalance ?? 0,
      completed: true,
      occurredAt: now,
    })
    return { completed: true }
  },
})

function achievementPresentation(unlock: Doc<'achievementUnlocks'>) {
  const match = unlock.achievementKey.match(/:(\d+)$/)
  const rank = match ? Number(match[1]) : undefined
  const title = unlock.achievementKey.includes(':tasks:')
    ? `GolieBee Task ${rank}`
    : unlock.achievementKey.startsWith('hive:completed-goals:')
      ? `Completed Goals ${rank}`
      : 'Genius State'
  return {
    id: unlock.achievementKey,
    title,
    ...(rank === undefined ? {} : { rank }),
    kind: unlock.scope === 'goal' ? ('goliebee' as const) : ('hive' as const),
  }
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

async function ensureAchievementBackfillScheduled(
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

async function reconcileAchievementsForOwner(
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

export const reconcileAchievements = mutation({
  args: {},
  returns: v.object({ unlocked: v.number(), scoreAwarded: v.number() }),
  handler: async (ctx) => {
    const keys = await requireEconomyIdentity(ctx)
    return await reconcileAchievementsForOwner(ctx, keys)
  },
})

export const continueAchievementBackfill = internalMutation({
  args: {
    ownerKey: v.string(),
    userId: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ processed: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
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
  },
})

/** Daily-sweep seam. A scheduler can call batches without exposing owner keys. */
export const settleFatigueBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    now: v.optional(v.number()),
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
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
  },
})
