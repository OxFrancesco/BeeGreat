import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from './_generated/server'

// DB surface for Web3 wallets (cache of Crossmint-created wallets).
// The Crossmint calls live in web3.ts (Node actions); this file stays in
// the default runtime so queries/mutations can be used by the app directly.

// Keep in sync with WEB3_CHAIN in web3.ts.
const DEFAULT_CHAIN = 'base-sepolia'

/** App-facing: the signed-in user's cached wallet, or null before creation. */
export const myWallet = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const wallet = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject).eq('chain', DEFAULT_CHAIN))
      .unique()
    return wallet ? { address: wallet.address, chain: wallet.chain } : null
  },
})

export const getCachedWallet = internalQuery({
  args: { userId: v.string(), chain: v.string() },
  handler: async (ctx, { userId, chain }) => {
    return await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', chain))
      .unique()
  },
})

export const cacheWallet = internalMutation({
  args: { userId: v.string(), chain: v.string(), address: v.string() },
  handler: async (ctx, { userId, chain, address }) => {
    const existing = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', chain))
      .unique()
    if (existing) {
      if (existing.address !== address) await ctx.db.patch(existing._id, { address })
    } else {
      await ctx.db.insert('wallets', { userId, chain, address })
    }
    return null
  },
})
