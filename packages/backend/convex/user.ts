import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const profile = query({
  args: {},
  handler: async (ctx) => {
    return ctx.auth.getUserIdentity()
  },
})

export const syncTimeZone = mutation({
  args: { timeZone: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      })
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: args.timeZone }).format()
    } catch {
      throw new ConvexError({
        code: 'INVALID_TIME_ZONE',
        message: 'Use a valid IANA timezone',
      })
    }
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_owner_key', (q) =>
        q.eq('ownerKey', identity.tokenIdentifier),
      )
      .unique()
    const value = {
      userId: identity.subject,
      timeZone: args.timeZone,
      updatedAt: Date.now(),
    }
    if (existing) {
      await ctx.db.patch('userPreferences', existing._id, value)
    } else {
      await ctx.db.insert('userPreferences', {
        ownerKey: identity.tokenIdentifier,
        ...value,
      })
    }
    return null
  },
})
