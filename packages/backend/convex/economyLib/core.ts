// Core economy primitives shared by every economy subsystem: identity keys,
// idempotency receipts, Hive and Goal-stat records, focus-shield lookups, and
// Genius-state progress. This module exports plain TypeScript only — no
// Convex functions — so it never appears as an api path.

import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { GENIUS_WINDOW_MS } from '../economyPolicy'
import { MAX_ACTIVE_GOALS } from '../focusConstants'
import { canAccessGoalFocusLineage } from '../focusDeletion'

export type IdentityKeys = { ownerKey: string; userId: string }

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

export function requiredRequestId(value: string) {
  const requestId = value.trim()
  if (!requestId) {
    throw new ConvexError({
      code: 'INVALID_REQUEST',
      message: 'Request id cannot be empty',
    })
  }
  return requestId
}

export async function priorEconomyCommand(
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

export async function activeEconomyGoals(
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

export async function findGoalStats(
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

export async function ensureGoalStats(
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

export async function activeFocusShield(
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

export async function focusShieldsOverlapping(
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

export async function geniusProgress(
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
