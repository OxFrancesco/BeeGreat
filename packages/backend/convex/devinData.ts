import { v } from 'convex/values'
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
      await ctx.db.replace(existing._id, value)
      return existing._id
    }
    return await ctx.db.insert('devinSessions', value)
  },
})
