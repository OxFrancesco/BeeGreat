import { ConvexError, v } from 'convex/values'
import { internalMutation, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

export const paidOperation = v.union(
  v.literal('voice_transcribe'), v.literal('voice_speak'), v.literal('voice_realtime'),
  v.literal('firecrawl'), v.literal('media_image'), v.literal('media_video'),
  v.literal('devin'), v.literal('bookmark'),
)
export type PaidOperation = typeof paidOperation.type

// Units are requests except voice_speak (characters) and devin (reserved ACUs).
const LIMITS: Record<PaidOperation, { daily: number; global: number; concurrent: number; globalConcurrent: number; leaseMs: number; maxUnits: number }> = {
  voice_transcribe: { daily: 30, global: 1000, concurrent: 2, globalConcurrent: 4, leaseMs: 120_000, maxUnits: 1 },
  voice_speak: { daily: 20_000, global: 1_000_000, concurrent: 2, globalConcurrent: 40, leaseMs: 60_000, maxUnits: 2000 },
  voice_realtime: { daily: 12, global: 500, concurrent: 1, globalConcurrent: 30, leaseMs: 360_000, maxUnits: 1 },
  firecrawl: { daily: 100, global: 5000, concurrent: 3, globalConcurrent: 40, leaseMs: 600_000, maxUnits: 10 },
  media_image: { daily: 20, global: 500, concurrent: 2, globalConcurrent: 20, leaseMs: 900_000, maxUnits: 1 },
  media_video: { daily: 4, global: 100, concurrent: 1, globalConcurrent: 10, leaseMs: 900_000, maxUnits: 1 },
  devin: { daily: 10, global: 100, concurrent: 1, globalConcurrent: 5, leaseMs: 86_400_000, maxUnits: 5 },
  bookmark: { daily: 50, global: 2000, concurrent: 2, globalConcurrent: 40, leaseMs: 600_000, maxUnits: 1 },
}

export async function reservePaidUsage(ctx: MutationCtx, input: { userId: string; operation: PaidOperation; units: number; ticketHash?: string }) {
  if (!/^user_[A-Za-z0-9]+$/.test(input.userId)) throw new Error('Invalid paid service user')
  const limit = LIMITS[input.operation]
  if (!Number.isSafeInteger(input.units) || input.units < 1 || input.units > limit.maxUnits) throw new Error('Invalid paid usage amount')
  if (input.ticketHash !== undefined && (input.operation !== 'voice_realtime' || !/^[a-f0-9]{64}$/.test(input.ticketHash))) throw new Error('Invalid voice ticket')
  const now = Date.now()
  const day = Math.floor(now / 86_400_000)
  const [userLease, globalLease] = await Promise.all([
    ctx.db.query('paidUsageLeases').withIndex('by_user_operation_expiry', q => q.eq('userId', input.userId).eq('operation', input.operation).gt('expiresAt', now)).take(limit.concurrent),
    ctx.db.query('paidUsageLeases').withIndex('by_operation_expiry', q => q.eq('operation', input.operation).gt('expiresAt', now)).take(limit.globalConcurrent),
  ])
  if (userLease.length >= limit.concurrent || globalLease.length >= limit.globalConcurrent) throw new ConvexError({ code: 'USAGE_BUSY', message: 'This service is busy. Wait for the current request to finish.' })
  for (const [scope, max] of [[input.userId, limit.daily], ['global', limit.global]] as const) {
    const row = await ctx.db.query('paidUsage').withIndex('by_scope_operation_day', q => q.eq('scope', scope).eq('operation', input.operation).eq('day', day)).unique()
    if ((row?.units ?? 0) + input.units > max) throw new ConvexError({ code: 'USAGE_LIMIT', message: 'The daily limit for this service has been reached. Try again tomorrow.' })
    if (row) await ctx.db.patch(row._id, { units: row.units + input.units })
    else await ctx.db.insert('paidUsage', { scope, operation: input.operation, day, units: input.units })
  }
  const expiresAt = now + (input.ticketHash ? 60_000 : limit.leaseMs)
  const leaseId = await ctx.db.insert('paidUsageLeases', { userId: input.userId, operation: input.operation, expiresAt, ticketHash: input.ticketHash, ticketExpiresAt: input.ticketHash ? now + 60_000 : undefined })
  return { leaseId, expiresAt }
}

export const reserve = internalMutation({
  args: { userId: v.string(), operation: paidOperation, units: v.number(), ticketHash: v.optional(v.string()) },
  handler: reservePaidUsage,
})

export async function releasePaidUsage(ctx: MutationCtx, userId: string, leaseId: Id<'paidUsageLeases'>) {
  const lease = await ctx.db.get(leaseId)
  if (lease?.userId === userId) await ctx.db.delete(leaseId)
}

// Reservations never refund units. Failed/uncertain provider responses may have billed.
export const release = internalMutation({
  args: { userId: v.string(), leaseId: v.id('paidUsageLeases') },
  handler: async (ctx, args) => { await releasePaidUsage(ctx, args.userId, args.leaseId) },
})

export const claimVoiceTicket = internalMutation({
  args: { ticketHash: v.string() },
  handler: async (ctx, args) => {
    const lease = await ctx.db.query('paidUsageLeases').withIndex('by_ticket_hash', q => q.eq('ticketHash', args.ticketHash)).unique()
    if (!lease || lease.operation !== 'voice_realtime' || lease.claimedAt !== undefined || (lease.ticketExpiresAt ?? 0) <= Date.now() || lease.expiresAt <= Date.now()) return null
    const expiresAt = Date.now() + 300_000
    await ctx.db.patch(lease._id, { claimedAt: Date.now(), expiresAt })
    return { userId: lease.userId, leaseId: lease._id, expiresAt }
  },
})

export const sweep = internalMutation({
  args: {},
  handler: async ctx => {
    const leases = await ctx.db.query('paidUsageLeases').withIndex('by_expiry', q => q.lt('expiresAt', Date.now())).take(200)
    for (const row of leases) await ctx.db.delete(row._id)
    const usage = await ctx.db.query('paidUsage').withIndex('by_day', q => q.lt('day', Math.floor(Date.now() / 86_400_000) - 2)).take(200)
    for (const row of usage) await ctx.db.delete(row._id)
  },
})
