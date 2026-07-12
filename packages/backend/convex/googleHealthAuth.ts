import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { requireUserId } from './helpers'
import {
  encryptedSecretValidator,
  googleHealthConnectionStatusValidator,
  googleHealthCredentialClaimValidator,
} from './googleHealthValidators'

const REFRESH_LEASE_MS = 15_000

export const status = query({
  args: {},
  returns: googleHealthConnectionStatusValidator,
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const credential = await ctx.db
      .query('googleHealthCredentials')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (credential?.status === 'connected')
      return { state: 'connected' as const }
    if (credential?.status === 'needs_reauth') {
      return {
        state: 'needs_reauth' as const,
        message: 'Google Health needs to be connected again.',
      }
    }
    const sessions = await ctx.db
      .query('googleHealthAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(1)
    const session = sessions[0]
    if (session?.status === 'pending' && session.expiresAt > Date.now()) {
      return { state: 'pending' as const }
    }
    if (session?.status === 'failed') {
      return {
        state: 'failed' as const,
        message: 'Google Health could not be connected. Try again.',
      }
    }
    return { state: 'disconnected' as const }
  },
})

export const createSession = internalMutation({
  args: {
    userId: v.string(),
    stateHash: v.string(),
    encryptedCodeVerifier: encryptedSecretValidator,
    expiresAt: v.number(),
  },
  returns: v.id('googleHealthAuthSessions'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('googleHealthAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(10)
    await Promise.all(
      existing
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('googleHealthAuthSessions', session._id, {
            status: 'cancelled' as const,
            updatedAt: now,
          }),
        ),
    )
    return await ctx.db.insert('googleHealthAuthSessions', {
      ...args,
      status: 'pending',
      updatedAt: now,
    })
  },
})

export const getSessionByStateHash = internalQuery({
  args: { stateHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      sessionId: v.id('googleHealthAuthSessions'),
      userId: v.string(),
      status: v.string(),
      encryptedCodeVerifier: v.optional(encryptedSecretValidator),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('googleHealthAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (!session) return null
    return {
      sessionId: session._id,
      userId: session.userId,
      status: session.status,
      encryptedCodeVerifier: session.encryptedCodeVerifier,
      expiresAt: session.expiresAt,
    }
  },
})

export const completeAuthorization = internalMutation({
  args: {
    sessionId: v.id('googleHealthAuthSessions'),
    encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: encryptedSecretValidator,
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('googleHealthAuthSessions', args.sessionId)
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now()
    )
      return false
    const now = Date.now()
    const existing = await ctx.db
      .query('googleHealthCredentials')
      .withIndex('by_user', (q) => q.eq('userId', session.userId))
      .unique()
    const credential = {
      status: 'connected' as const,
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      scopes: args.scopes,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch('googleHealthCredentials', existing._id, credential)
    } else {
      await ctx.db.insert('googleHealthCredentials', {
        userId: session.userId,
        ...credential,
      })
    }
    await ctx.db.patch('googleHealthAuthSessions', session._id, {
      status: 'connected',
      encryptedCodeVerifier: undefined,
      updatedAt: now,
    })
    return true
  },
})

export const failSession = internalMutation({
  args: { stateHash: v.string(), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('googleHealthAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (session?.status === 'pending') {
      await ctx.db.patch('googleHealthAuthSessions', session._id, {
        status: session.expiresAt <= Date.now() ? 'expired' : 'failed',
        encryptedCodeVerifier: undefined,
        errorCode: args.errorCode,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const [credential, sessions] = await Promise.all([
      ctx.db
        .query('googleHealthCredentials')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('googleHealthAuthSessions')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('desc')
        .take(10),
    ])
    if (credential)
      await ctx.db.delete('googleHealthCredentials', credential._id)
    await Promise.all(
      sessions
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('googleHealthAuthSessions', session._id, {
            status: 'cancelled' as const,
            encryptedCodeVerifier: undefined,
            updatedAt: Date.now(),
          }),
        ),
    )
    return null
  },
})

export const claimCredential = internalMutation({
  args: {
    userId: v.string(),
    now: v.number(),
    leaseId: v.string(),
    minValidityMs: v.number(),
  },
  returns: googleHealthCredentialClaimValidator,
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('googleHealthCredentials')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!credential) return { status: 'missing' as const }
    if (
      credential.status === 'needs_reauth' ||
      !credential.encryptedAccess ||
      !credential.encryptedRefresh ||
      !credential.expiresAt
    ) {
      return { status: 'reauth' as const }
    }
    if (credential.expiresAt > args.now + args.minValidityMs) {
      return {
        status: 'ready' as const,
        encryptedAccess: credential.encryptedAccess,
        expiresAt: credential.expiresAt,
      }
    }
    if (
      credential.refreshLeaseId &&
      credential.refreshLeaseExpiresAt &&
      credential.refreshLeaseExpiresAt > args.now
    ) {
      return {
        status: 'busy' as const,
        retryAfterMs: credential.refreshLeaseExpiresAt - args.now,
      }
    }
    await ctx.db.patch('googleHealthCredentials', credential._id, {
      refreshLeaseId: args.leaseId,
      refreshLeaseExpiresAt: args.now + REFRESH_LEASE_MS,
      updatedAt: args.now,
    })
    return {
      status: 'refresh' as const,
      encryptedRefresh: credential.encryptedRefresh,
      leaseId: args.leaseId,
    }
  },
})

export const finishRefresh = internalMutation({
  args: {
    userId: v.string(),
    leaseId: v.string(),
    encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: encryptedSecretValidator,
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('googleHealthCredentials')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!credential || credential.refreshLeaseId !== args.leaseId) return false
    await ctx.db.patch('googleHealthCredentials', credential._id, {
      status: 'connected',
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      scopes: args.scopes.length > 0 ? args.scopes : credential.scopes,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const failRefresh = internalMutation({
  args: { userId: v.string(), leaseId: v.string(), permanent: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('googleHealthCredentials')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!credential || credential.refreshLeaseId !== args.leaseId) return null
    await ctx.db.patch('googleHealthCredentials', credential._id, {
      status: args.permanent ? 'needs_reauth' : credential.status,
      encryptedAccess: args.permanent ? undefined : credential.encryptedAccess,
      encryptedRefresh: args.permanent
        ? undefined
        : credential.encryptedRefresh,
      expiresAt: args.permanent ? undefined : credential.expiresAt,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})
