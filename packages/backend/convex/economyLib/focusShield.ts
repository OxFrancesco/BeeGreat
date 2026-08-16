// Focus Shield activation: an idempotent Royal Jelly spend that protects one
// Active Goal from Brain Fatigue for a fixed duration. Plain TypeScript
// helpers only — the Convex function definitions live in economy.ts.

import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  FOCUS_SHIELD_COST,
  FOCUS_SHIELD_DURATION_MS,
} from '../economyPolicy'
import { requireGoalFocusOwner } from '../focusDeletion'
import {
  activeFocusShield,
  ensureHive,
  priorEconomyCommand,
  requireEconomyIdentity,
  requiredRequestId,
} from './core'
import { settleFatigueForOwner } from './fatigue'

export async function activateFocusShieldCommand(
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
}
