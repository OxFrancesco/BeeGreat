// Task-completion economy: once-ever verified progress, Honey/score awards
// under the rolling cap, weekly Royal Jelly progress, and the Genius-state
// activation hook. Plain TypeScript helpers only — the Convex function
// definitions live in economy.ts.

import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  GENIUS_WINDOW_MS,
  ROYAL_JELLY_WEEKLY_AWARD,
  TASK_HONEY_AWARD,
  TASK_REWARD_CAP,
  TASK_REWARD_WINDOW_MS,
  TASK_SCORE_AWARD,
} from '../economyPolicy'
import {
  activeEconomyGoals,
  activeFocusShield,
  ensureGoalStats,
  ensureHive,
  findHive,
  geniusProgress,
  type IdentityKeys,
} from './core'
import { settleFatigueForOwner } from './fatigue'
import { reconcileAchievementsForOwner } from './achievements'

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
