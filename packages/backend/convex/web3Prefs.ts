import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireUserId } from './helpers'
import { requirePowerup } from './powerups'

// Per-user Web3 preferences. YOLO mode lets the signed-in user pre-authorize
// automatic confirmation of prepared smart-wallet actions. Linked-wallet EOA
// actions always require the connected wallet. Only the app can flip YOLO
// (requireUserId): the agent has no path here, so the prompt-injection barrier
// of web3Actions stays intact — YOLO merely moves the user's consent from
// per-action taps to a standing opt-in.

/** Shared read for queries and the web3Actions.create auto-confirm check. */
export async function yoloEnabledForUser(
  ctx: QueryCtx,
  userId: string,
): Promise<boolean> {
  const row = await ctx.db
    .query('web3Prefs')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  return row?.yoloEnabled ?? false
}

/** App-facing: current YOLO setting for the wallet settings card. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return { yoloEnabled: await yoloEnabledForUser(ctx, userId) }
  },
})

/**
 * App-facing: the ONLY writer of YOLO mode. Requires the signed-in owner and
 * the enabled power-up, mirroring web3Actions.confirm — enabling YOLO is a
 * standing confirmation, so it demands the same authority as a per-action tap.
 */
export const setYolo = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await requireUserId(ctx)
    await requirePowerup(ctx, userId, 'web3')
    const existing = await ctx.db
      .query('web3Prefs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        yoloEnabled: enabled,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('web3Prefs', {
        userId,
        yoloEnabled: enabled,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})
