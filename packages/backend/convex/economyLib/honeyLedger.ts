// Honey ledger operations: idempotent cosmetic Honey spends recorded against
// the Hive balance. Plain TypeScript helpers only — the Convex function
// definitions live in economy.ts.

import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import {
  ensureHive,
  priorEconomyCommand,
  requireEconomyIdentity,
  requiredRequestId,
} from './core'
import { settleFatigueForOwner } from './fatigue'

export async function spendHoneyCommand(
  ctx: MutationCtx,
  args: { requestId: string; cosmeticId: string; amount: number },
) {
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
}
