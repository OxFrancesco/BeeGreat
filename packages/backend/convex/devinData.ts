import { v } from 'convex/values'
import { internal } from './_generated/api'
import { releasePaidUsage, reservePaidUsage } from './paidUsage'
import { internalMutation, internalQuery, query } from './_generated/server'
import { requireUserId } from './helpers'

export const devinStatusValidator = v.union(
  v.literal('new'),
  v.literal('claimed'),
  v.literal('running'),
  v.literal('exit'),
  v.literal('error'),
  v.literal('suspended'),
  v.literal('resuming'),
)

export const devinPullRequestValidator = v.object({
  url: v.string(),
  state: v.optional(v.string()),
})

export const getOwned = internalQuery({
  args: { userId: v.string(), sessionId: v.string() },
  handler: async (ctx, { userId, sessionId }) => {
    const session = await ctx.db
      .query('devinSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', sessionId))
      .unique()
    return session?.userId === userId ? session : null
  },
})

/** App-facing live state for an agent-generated Devin card. */
export const get = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx)
    const session = await ctx.db
      .query('devinSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', sessionId))
      .unique()
    return session?.userId === userId ? session : null
  },
})

export const listOwned = internalQuery({
  args: { userId: v.string(), limit: v.number() },
  handler: async (ctx, { userId, limit }) =>
    await ctx.db
      .query('devinSessions')
      .withIndex('by_user_and_updated_at', (q) => q.eq('userId', userId))
      .order('desc')
      .take(Math.min(Math.max(Math.trunc(limit), 1), 10)),
})

export const upsert = internalMutation({
  args: {
    userId: v.string(),
    session: v.object({
      sessionId: v.string(),
      url: v.string(),
      title: v.optional(v.string()),
      status: devinStatusValidator,
      statusDetail: v.optional(v.string()),
      pullRequests: v.array(devinPullRequestValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
  handler: async (ctx, { userId, session }) => {
    const existing = await ctx.db
      .query('devinSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', session.sessionId))
      .unique()
    if (existing && existing.userId !== userId) {
      throw new Error('This Devin session belongs to another BeeGreat user.')
    }
    const value = { ...session, userId, lastSyncedAt: Date.now() }
    if (existing) {
      if (session.updatedAt < existing.updatedAt) return existing._id
      await ctx.db.patch(existing._id, value)
      return existing._id
    }
    return await ctx.db.insert('devinSessions', value)
  },
})

export const attachUsage = internalMutation({
  args: { userId: v.string(), sessionId: v.string(), leaseId: v.id('paidUsageLeases'), safetyAcuLimit: v.number() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query('devinSessions').withIndex('by_session_id', q => q.eq('sessionId', args.sessionId)).unique()
    if (!session || session.userId !== args.userId) throw new Error('Devin session not found')
    await ctx.db.patch(session._id, { usageLeaseId: args.leaseId, safetyAcuLimit: args.safetyAcuLimit })
  },
})

export const schedulePoll = internalMutation({
  args: { userId: v.string(), sessionId: v.string(), active: v.boolean(), completedGeneration: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const session = await ctx.db.query('devinSessions').withIndex('by_session_id', q => q.eq('sessionId', args.sessionId)).unique()
    if (!session || session.userId !== args.userId) return
    if (args.completedGeneration !== undefined && session.pollGeneration !== args.completedGeneration) return
    if (!args.active) {
      if (session.pollScheduledId) await ctx.scheduler.cancel(session.pollScheduledId)
      const stopped = session.status === 'exit' || session.status === 'error' || session.status === 'suspended'
      if (stopped && session.usageLeaseId) await releasePaidUsage(ctx, session.userId, session.usageLeaseId)
      await ctx.db.patch(session._id, { pollScheduledId: undefined, pollRunning: false, pollGeneration: (session.pollGeneration ?? 0) + 1, usageLeaseId: stopped ? undefined : session.usageLeaseId })
      return
    }
    if (args.completedGeneration === undefined && (session.pollScheduledId || (session.pollRunning && (session.pollLeaseExpiresAt ?? 0) > Date.now()))) return
    const attempt = args.completedGeneration === undefined ? 0 : session.pollAttempt ?? 0
    if (attempt >= 240) { await ctx.db.patch(session._id, { pollRunning: false }); return }
    const generation = (session.pollGeneration ?? 0) + 1
    const scheduledId = await ctx.scheduler.runAfter(30_000, internal.devin.poll, { userId: args.userId, sessionId: args.sessionId, generation, attempt: attempt + 1 })
    await ctx.db.patch(session._id, { pollGeneration: generation, pollAttempt: attempt + 1, pollScheduledId: scheduledId, pollRunning: false })
  },
})

export const claimPoll = internalMutation({
  args: { userId: v.string(), sessionId: v.string(), generation: v.number() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query('devinSessions').withIndex('by_session_id', q => q.eq('sessionId', args.sessionId)).unique()
    if (!session || session.userId !== args.userId || session.pollGeneration !== args.generation || session.pollRunning || !session.pollScheduledId) return false
    await ctx.db.patch(session._id, { pollScheduledId: undefined, pollRunning: true, pollLeaseExpiresAt: Date.now() + 120_000 })
    return true
  },
})

export const admitFollowUp = internalMutation({
  args: { userId: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query('devinSessions').withIndex('by_session_id', q => q.eq('sessionId', args.sessionId)).unique()
    if (!session || session.userId !== args.userId || !session.safetyAcuLimit || session.safetyAcuLimit > 5) throw new Error('This session has no verified spending cap')
    const lease = session.usageLeaseId ? await ctx.db.get(session.usageLeaseId) : null
    if (lease && lease.userId === args.userId && lease.expiresAt > Date.now()) return
    const reservation = await reservePaidUsage(ctx, { userId: args.userId, operation: 'devin', units: session.safetyAcuLimit })
    await ctx.db.patch(session._id, { usageLeaseId: reservation.leaseId })
  },
})
