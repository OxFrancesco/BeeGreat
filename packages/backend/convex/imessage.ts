import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireUserId } from './helpers'
import {
  imessageAddressKind,
  isValidImessageAddress,
  maskImessageAddress,
  normalizeImessageAddress,
} from './imessageAddress'
import {
  imessageAddressKindValidator,
  imessageConnectionValidator,
} from './imessageValidators'

// A magic link is single-use and short-lived: the sender must open it before
// this window closes, so a stale link on a lost device stays worthless.
export const LINK_SESSION_TTL_MS = 15 * 60 * 1000
// One address gets at most this many links per hour, so an attacker who knows
// Bee's number cannot make Bee flood an arbitrary victim with links.
const MAX_SESSIONS_PER_HOUR = 5

async function revokedBefore(ctx: QueryCtx | MutationCtx, userId: string) {
  const row = await ctx.db.query('imessageRevocations').withIndex('by_user', q => q.eq('userId', userId)).unique()
  return row?.revokedBefore ?? -Infinity
}

export async function connectionIsActive(ctx: QueryCtx | MutationCtx, connection: Doc<'imessageConnections'>) {
  return connection.connectedAt > await revokedBefore(ctx, connection.userId)
}

export async function connectionsForUser(ctx: QueryCtx | MutationCtx, userId: string) {
  const cutoff = await revokedBefore(ctx, userId)
  return await ctx.db.query('imessageConnections')
    .withIndex('by_user_and_connected_at', q => q.eq('userId', userId).gt('connectedAt', cutoff)).collect()
}

/** Verifies and returns the linked sender row used to bind a channel thread. */
export async function connectionIdForBridgeAddress(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  address: string,
) {
  const connection = await ctx.db
    .query('imessageConnections')
    .withIndex('by_address', (q) =>
      q.eq('address', normalizeImessageAddress(address)),
    )
    .unique()
  if (!connection || connection.userId !== userId || !(await connectionIsActive(ctx, connection))) {
    throw new ConvexError({
      code: 'INVALID_CHANNEL_ADDRESS',
      message: 'This iMessage sender is not linked to the mapped user.',
    })
  }
  return connection._id
}

/** Linked iMessage addresses for the signed-in user's settings screens. */
export const connections = query({
  args: {},
  returns: v.array(imessageConnectionValidator),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const rows = await connectionsForUser(ctx, userId)
    return rows.map((row) => ({
      address: row.address,
      addressKind: row.addressKind,
      connectedAt: row.connectedAt,
    }))
  },
})

async function removeAddress(
  ctx: MutationCtx,
  address: string,
  userId?: string,
) {
  const normalized = normalizeImessageAddress(address)
  const connection = await ctx.db
    .query('imessageConnections')
    .withIndex('by_address', (q) => q.eq('address', normalized))
    .unique()
  if (!connection || (userId && connection.userId !== userId)) {
    return { disconnected: false }
  }
  await ctx.db.delete('imessageConnections', connection._id)
  return { disconnected: true }
}

/** Removes one linked address from the signed-in user's account. */
export const disconnect = mutation({
  args: { address: v.string() },
  returns: v.object({ disconnected: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    return await removeAddress(ctx, args.address, userId)
  },
})

/** The bridge maps an inbound sender to its BeeGreat user, if linked. */
export const resolveAddressForBridge = internalQuery({
  args: { address: v.string() },
  returns: v.union(v.null(), v.object({ userId: v.string() })),
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('imessageConnections')
      .withIndex('by_address', (q) =>
        q.eq('address', normalizeImessageAddress(args.address)),
      )
      .unique()
    return connection && await connectionIsActive(ctx, connection) ? { userId: connection.userId } : null
  },
})

export const createLinkSession = internalMutation({
  args: {
    address: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, args) => {
    const address = normalizeImessageAddress(args.address)
    if (!isValidImessageAddress(address)) {
      throw new ConvexError({
        code: 'INVALID_ADDRESS',
        message: 'This sender address cannot be linked.',
      })
    }
    const now = Date.now()
    const recent = await ctx.db
      .query('imessageLinkSessions')
      .withIndex('by_address', (q) => q.eq('address', address))
      .order('desc')
      .take(MAX_SESSIONS_PER_HOUR)
    if (
      recent.length === MAX_SESSIONS_PER_HOUR &&
      recent[recent.length - 1]._creationTime > now - 60 * 60 * 1000
    ) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: 'Too many link attempts for this address. Try again later.',
      })
    }
    await Promise.all(
      recent
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('imessageLinkSessions', session._id, {
            status: 'cancelled' as const,
            updatedAt: now,
          }),
        ),
    )
    await ctx.db.insert('imessageLinkSessions', {
      address,
      addressKind: imessageAddressKind(address),
      tokenHash: args.tokenHash,
      status: 'pending',
      expiresAt: args.expiresAt,
      updatedAt: now,
    })
    return { created: true }
  },
})

/** Session lookup for the web link page; returns a masked address only. */
export const getLinkSessionByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      maskedAddress: v.string(),
      addressKind: imessageAddressKindValidator,
      status: v.string(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('imessageLinkSessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .unique()
    if (!session) return null
    return {
      maskedAddress: maskImessageAddress(session.address),
      addressKind: session.addressKind,
      status: session.status,
      expiresAt: session.expiresAt,
    }
  },
})

/**
 * Completes a magic link for the signed-in user. Presenting the raw token
 * proves control of the iMessage address (only that address received it), so
 * an address already linked elsewhere moves to this account.
 */
export const completeLinkSession = internalMutation({
  args: { tokenHash: v.string(), userId: v.string() },
  returns: v.object({
    status: v.union(
      v.literal('linked'),
      v.literal('invalid'),
      v.literal('expired'),
    ),
    maskedAddress: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('imessageLinkSessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .unique()
    if (!session || session.status !== 'pending') {
      return { status: 'invalid' as const }
    }
    const now = Date.now()
    if (session.expiresAt <= now) {
      await ctx.db.patch('imessageLinkSessions', session._id, {
        status: 'expired' as const,
        updatedAt: now,
      })
      return { status: 'expired' as const }
    }
    const existing = await ctx.db
      .query('imessageConnections')
      .withIndex('by_address', (q) => q.eq('address', session.address))
      .unique()
    const cutoff = await revokedBefore(ctx, args.userId)
    const connectedAt = Math.max(now, cutoff + 1)
    const activeConnections = await ctx.db.query('imessageConnections')
      .withIndex('by_user_and_connected_at', q => q.eq('userId', args.userId).gt('connectedAt', cutoff)).take(20)
    if ((existing?.userId !== args.userId || !(await connectionIsActive(ctx, existing))) && activeConnections.length >= 20) {
      throw new ConvexError({ code: 'CONNECTION_LIMIT', message: 'Disconnect an iMessage address before linking another. The limit is 20.' })
    }
    if (existing) {
      await ctx.db.patch('imessageConnections', existing._id, {
        userId: args.userId,
        connectedAt,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('imessageConnections', {
        userId: args.userId,
        address: session.address,
        addressKind: session.addressKind,
        connectedAt,
        updatedAt: now,
      })
    }
    await ctx.db.patch('imessageLinkSessions', session._id, {
      status: 'completed' as const,
      userId: args.userId,
      updatedAt: now,
    })
    return {
      status: 'linked' as const,
      maskedAddress: maskImessageAddress(session.address),
    }
  },
})

/** The bridge's `/unlink` command removes exactly the sending address. */
export const disconnectAddressForBridge = internalMutation({
  args: { address: v.string() },
  returns: v.object({ disconnected: v.boolean() }),
  handler: async (ctx, args) => await removeAddress(ctx, args.address),
})

/** Linked addresses for the CLI (`bee imessage status`). */
export const connectionsForAgent = internalQuery({
  args: { userId: v.string() },
  returns: v.array(imessageConnectionValidator),
  handler: async (ctx, args) => {
    const rows = await connectionsForUser(ctx, args.userId)
    return rows.map((row) => ({
      address: row.address,
      addressKind: row.addressKind,
      connectedAt: row.connectedAt,
    }))
  },
})

/** CLI disconnect: one address when given, otherwise every linked address. */
export const disconnectForAgent = internalMutation({
  args: { userId: v.string(), address: v.optional(v.string()) },
  returns: v.object({ disconnected: v.number(), all: v.optional(v.boolean()) }),
  handler: async (ctx, args) => {
    if (args.address) {
      const result = await removeAddress(ctx, args.address, args.userId)
      return { disconnected: result.disconnected ? 1 : 0 }
    }
    const cutoff = Date.now()
    const revocation = await ctx.db.query('imessageRevocations').withIndex('by_user', q => q.eq('userId', args.userId)).unique()
    const revokedAt = Math.max(cutoff, revocation?.revokedBefore ?? cutoff)
    if (revocation) await ctx.db.patch(revocation._id, { revokedBefore: revokedAt })
    else await ctx.db.insert('imessageRevocations', { userId: args.userId, revokedBefore: revokedAt })
    const removed = await removeRevokedConnections(ctx, args.userId, revokedAt)
    return { disconnected: removed, ...(removed === 100 ? { all: true } : {}) }
  },
})

async function removeRevokedConnections(ctx: MutationCtx, userId: string, cutoff: number) {
  const rows = await ctx.db.query('imessageConnections')
    .withIndex('by_user_and_connected_at', q => q.eq('userId', userId).lte('connectedAt', cutoff)).take(100)
  for (const row of rows) await ctx.db.delete(row._id)
  if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.imessage.cleanupRevoked, { userId, cutoff })
  return rows.length
}

export const cleanupRevoked = internalMutation({
  args: { userId: v.string(), cutoff: v.number() },
  handler: async (ctx, args) => { await removeRevokedConnections(ctx, args.userId, args.cutoff) },
})
