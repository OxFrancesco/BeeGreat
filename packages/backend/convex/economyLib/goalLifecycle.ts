// Goal lifecycle economy: abandonment (with its Honey clawback), Royal
// Jelly-funded resurrection (with the partial refund), and confirmed Goal
// completion. Plain TypeScript helpers only — the Convex function definitions
// live in economy.ts.

import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { RESURRECTION_COST } from '../economyPolicy'
import { MAX_ACTIVE_GOALS } from '../focusConstants'
import { requireGoalFocusOwner } from '../focusDeletion'
import {
  activeEconomyGoals,
  ensureGoalStats,
  ensureHive,
  priorEconomyCommand,
  requireEconomyIdentity,
  requiredRequestId,
} from './core'
import { settleFatigueForOwner } from './fatigue'
import { reconcileAchievementsForOwner } from './achievements'

export async function abandonGoalCommand(
  ctx: MutationCtx,
  args: { requestId: string; goalId: Id<'goals'> },
) {
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
}

export async function resurrectGoalCommand(
  ctx: MutationCtx,
  args: { requestId: string; goalId: Id<'goals'> },
) {
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
}

export async function completeGoalCommand(
  ctx: MutationCtx,
  args: { requestId: string; goalId: Id<'goals'>; confirmed: boolean },
) {
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
}
