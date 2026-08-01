import { v } from 'convex/values'
import { internalQuery, mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireUserId } from './helpers'

// Power-ups are opt-in capability packs. Nothing here is loaded by default:
// a user flips a power-up on from their profile, the agent worker picks up the
// matching tool bundle (packages/agent/src/shared/powerups), and every backend
// function that belongs to a power-up re-checks the entitlement server-side.
//
// Adding a power-up:
//   1. Add it to POWERUP_CATALOG below.
//   2. Guard its Convex functions with `requirePowerup(ctx, userId, '<id>')`.
//   3. Register its tool bundle in the agent worker's power-up registry.

export const POWERUP_CATALOG = [
  {
    id: 'devin',
    name: 'Devin',
    tagline: 'Cloud coding, from the Hive',
    description:
      'Lets your Bee launch Devin cloud tasks, check live progress and pull requests, and send follow-up instructions.',
  },
  {
    id: 'web3',
    name: 'Web3',
    tagline: 'A wallet for your hive',
    description:
      'Gives your Bee a secure smart wallet and DeFi smarts: balances, transfers, Aerodrome pools, swaps, liquidity, and rewards. Anything that moves funds waits for your in-app confirmation, and you can link your own wallet for plans you sign yourself.',
  },
  {
    id: 'google-health',
    name: 'Google Health',
    tagline: 'Your health, understood',
    description:
      'Lets your Bee read your steps, sleep, workouts, and heart data to answer health questions. Read-only.',
  },
] as const

export type PowerupId = (typeof POWERUP_CATALOG)[number]['id']

const KNOWN_POWERUP_IDS = new Set<string>(POWERUP_CATALOG.map((powerup) => powerup.id))

async function getPowerupRow(ctx: QueryCtx, userId: string, powerupId: string) {
  return await ctx.db
    .query('powerups')
    .withIndex('by_user', (q) => q.eq('userId', userId).eq('powerupId', powerupId))
    .unique()
}

/** True when the user has the given power-up switched on. */
export async function isPowerupEnabled(ctx: QueryCtx, userId: string, powerupId: PowerupId) {
  const row = await getPowerupRow(ctx, userId, powerupId)
  return row?.enabled ?? false
}

/** Guard for power-up functions: throws unless the user enabled the power-up. */
export async function requirePowerup(ctx: QueryCtx, userId: string, powerupId: PowerupId) {
  if (!(await isPowerupEnabled(ctx, userId, powerupId))) {
    const name = POWERUP_CATALOG.find((powerup) => powerup.id === powerupId)?.name ?? powerupId
    throw new Error(
      `The ${name} power-up is not enabled. Turn it on from the profile screen first.`,
    )
  }
}

/** App-facing: the catalog with the signed-in user's toggle state. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const rows = await ctx.db
      .query('powerups')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const enabled = new Set(rows.filter((row) => row.enabled).map((row) => row.powerupId))
    return POWERUP_CATALOG.map((powerup) => ({ ...powerup, enabled: enabled.has(powerup.id) }))
  },
})

/** App-facing: flip a power-up on or off for the signed-in user. Idempotent. */
export const setEnabled = mutation({
  args: { powerupId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { powerupId, enabled }) => {
    const userId = await requireUserId(ctx)
    if (!KNOWN_POWERUP_IDS.has(powerupId)) {
      throw new Error(`Unknown power-up "${powerupId}"`)
    }
    const existing = await getPowerupRow(ctx, userId, powerupId)
    if (existing) {
      if (existing.enabled !== enabled) await ctx.db.patch(existing._id, { enabled })
    } else {
      await ctx.db.insert('powerups', { userId, powerupId, enabled })
    }
    return null
  },
})

// Agent-facing: the Flue worker passes its instance id as userId (see agent.ts)
// and uses this to decide which power-up tool bundles to load for the session.
export const getEnabledIds = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('powerups')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    return rows
      .filter((row) => row.enabled && KNOWN_POWERUP_IDS.has(row.powerupId))
      .map((row) => row.powerupId)
  },
})

// Internal: lets actions (which have no db access) enforce the entitlement.
export const checkEnabled = internalQuery({
  args: { userId: v.string(), powerupId: v.string() },
  handler: async (ctx, { userId, powerupId }) => {
    const row = await getPowerupRow(ctx, userId, powerupId)
    return row?.enabled ?? false
  },
})
