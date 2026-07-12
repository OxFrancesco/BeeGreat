import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import {
  chatgptAuthSessionStatusValidator,
  chatgptAuthStatusValidator,
  credentialResolutionValidator,
  encryptedSecretValidator,
} from './chatgptAuthValidators'
import { requireUserId } from './helpers'

const DEVICE_FLOW_TTL_MS = 15 * 60 * 1000
const REFRESH_LEASE_MS = 30_000

function messageForSessionError(errorCode?: string) {
  switch (errorCode) {
    case 'device_auth_disabled':
      return 'ChatGPT device authorization is unavailable. Try again later.'
    case 'configuration_error':
      return 'ChatGPT connection is not configured on this deployment.'
    case 'expired':
      return 'The ChatGPT code expired. Start a new connection.'
    default:
      return 'ChatGPT connection failed. Try again.'
  }
}

export const status = query({
  args: {},
  returns: chatgptAuthStatusValidator,
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const [credential, preference] = await Promise.all([
      ctx.db
        .query('chatgptCredentials')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('chatgptGatePreferences')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
    ])
    const skipped = preference ? true : undefined

    if (credential?.status === 'connected') {
      return { state: 'connected' as const, skipped }
    }
    if (credential?.status === 'needs_reauth') {
      return {
        state: 'needs_reauth' as const,
        skipped,
        message: 'Your ChatGPT session expired. Connect it again.',
      }
    }

    const session = await ctx.db
      .query('chatgptAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .first()

    if (!session) return { state: 'disconnected' as const, skipped }
    if (session.status === 'starting') {
      return {
        state: 'starting' as const,
        skipped,
        sessionId: session._id,
        expiresAt: session.expiresAt,
      }
    }
    if (session.status === 'pending') {
      return {
        state: 'pending' as const,
        skipped,
        sessionId: session._id,
        userCode: session.userCode,
        verificationUri: session.verificationUri,
        expiresAt: session.expiresAt,
      }
    }
    if (session.status === 'failed' || session.status === 'expired') {
      return {
        state: 'failed' as const,
        skipped,
        sessionId: session._id,
        message: messageForSessionError(session.errorCode),
      }
    }
    return { state: 'disconnected' as const, skipped }
  },
})

// Skipping is durable and cross-device: the user keeps using BeeGreat on the
// default OpenRouter model and can still connect ChatGPT later from settings.
export const skip = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const existing = await ctx.db
      .query('chatgptGatePreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch('chatgptGatePreferences', existing._id, {
        skippedAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('chatgptGatePreferences', {
        userId,
        skippedAt: now,
        updatedAt: now,
      })
    }
    return null
  },
})

export const start = mutation({
  args: {},
  returns: v.id('chatgptAuthSessions'),
  handler: async (ctx): Promise<Id<'chatgptAuthSessions'>> => {
    const userId = await requireUserId(ctx)
    const credential = await ctx.db
      .query('chatgptCredentials')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (credential?.status === 'connected') {
      throw new ConvexError({
        code: 'ALREADY_CONNECTED',
        message: 'ChatGPT is already connected.',
      })
    }

    const now = Date.now()
    const latest = await ctx.db
      .query('chatgptAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .first()
    if (
      latest &&
      (latest.status === 'starting' || latest.status === 'pending') &&
      latest.expiresAt > now
    ) {
      return latest._id
    }
    if (latest && (latest.status === 'starting' || latest.status === 'pending')) {
      await ctx.db.patch('chatgptAuthSessions', latest._id, {
        status: 'expired',
        errorCode: 'expired',
        encryptedDeviceAuthId: undefined,
        updatedAt: now,
      })
    }

    const sessionId = await ctx.db.insert('chatgptAuthSessions', {
      userId,
      status: 'starting',
      expiresAt: now + DEVICE_FLOW_TTL_MS,
      attemptCount: 0,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      0,
      internal.chatgptAuthActions.beginDeviceAuthorization,
      { sessionId },
    )
    return sessionId
  },
})

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const [credential, sessions] = await Promise.all([
      ctx.db
        .query('chatgptCredentials')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('chatgptAuthSessions')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ])
    if (credential) {
      await ctx.db.delete('chatgptCredentials', credential._id)
    }
    const now = Date.now()
    await Promise.all(
      sessions
        .filter((session) => session.status === 'starting' || session.status === 'pending')
        .map((session) =>
          ctx.db.patch('chatgptAuthSessions', session._id, {
            status: 'cancelled',
            encryptedDeviceAuthId: undefined,
            userCode: undefined,
            updatedAt: now,
          }),
        ),
    )
    return null
  },
})

const pollingSessionValidator = v.union(
  v.null(),
  v.object({
    userId: v.string(),
    status: chatgptAuthSessionStatusValidator,
    encryptedDeviceAuthId: v.optional(encryptedSecretValidator),
    userCode: v.optional(v.string()),
    intervalMs: v.optional(v.number()),
    expiresAt: v.number(),
    attemptCount: v.number(),
  }),
)

export const getSessionForPolling = internalQuery({
  args: { sessionId: v.id('chatgptAuthSessions') },
  returns: pollingSessionValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db.get('chatgptAuthSessions', args.sessionId)
    if (!session) return null
    return {
      userId: session.userId,
      status: session.status,
      encryptedDeviceAuthId: session.encryptedDeviceAuthId,
      userCode: session.userCode,
      intervalMs: session.intervalMs,
      expiresAt: session.expiresAt,
      attemptCount: session.attemptCount,
    }
  },
})

export const markPendingAndSchedule = internalMutation({
  args: {
    sessionId: v.id('chatgptAuthSessions'),
    encryptedDeviceAuthId: encryptedSecretValidator,
    userCode: v.string(),
    verificationUri: v.string(),
    intervalMs: v.number(),
    expiresAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('chatgptAuthSessions', args.sessionId)
    if (!session || session.status !== 'starting') return false
    const intervalMs = Math.max(1_000, args.intervalMs)
    const now = Date.now()
    await ctx.db.patch('chatgptAuthSessions', args.sessionId, {
      status: 'pending',
      encryptedDeviceAuthId: args.encryptedDeviceAuthId,
      userCode: args.userCode,
      verificationUri: args.verificationUri,
      intervalMs,
      nextPollAt: now + intervalMs,
      expiresAt: Math.min(session.expiresAt, args.expiresAt),
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      intervalMs,
      internal.chatgptAuthActions.pollDeviceAuthorization,
      { sessionId: args.sessionId },
    )
    return true
  },
})

export const scheduleNextPoll = internalMutation({
  args: {
    sessionId: v.id('chatgptAuthSessions'),
    delayMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('chatgptAuthSessions', args.sessionId)
    const now = Date.now()
    if (!session || session.status !== 'pending') return false
    if (session.expiresAt <= now) {
      await ctx.db.patch('chatgptAuthSessions', args.sessionId, {
        status: 'expired',
        errorCode: 'expired',
        encryptedDeviceAuthId: undefined,
        updatedAt: now,
      })
      return false
    }
    const delayMs = Math.max(1_000, Math.min(args.delayMs, session.expiresAt - now))
    await ctx.db.patch('chatgptAuthSessions', args.sessionId, {
      intervalMs: delayMs,
      nextPollAt: now + delayMs,
      attemptCount: session.attemptCount + 1,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      delayMs,
      internal.chatgptAuthActions.pollDeviceAuthorization,
      { sessionId: args.sessionId },
    )
    return true
  },
})

export const markSessionFailure = internalMutation({
  args: {
    sessionId: v.id('chatgptAuthSessions'),
    status: v.union(v.literal('failed'), v.literal('expired')),
    errorCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('chatgptAuthSessions', args.sessionId)
    if (!session || session.status === 'cancelled' || session.status === 'connected') {
      return null
    }
    await ctx.db.patch('chatgptAuthSessions', args.sessionId, {
      status: args.status,
      errorCode: args.errorCode,
      encryptedDeviceAuthId: undefined,
      userCode: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const completeAuthorization = internalMutation({
  args: {
    sessionId: v.id('chatgptAuthSessions'),
    encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: encryptedSecretValidator,
    expiresAt: v.number(),
    accountIdHash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('chatgptAuthSessions', args.sessionId)
    if (!session || session.status !== 'pending') return false
    const now = Date.now()
    const credential = await ctx.db
      .query('chatgptCredentials')
      .withIndex('by_user', (q) => q.eq('userId', session.userId))
      .unique()
    const value = {
      status: 'connected' as const,
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      accountIdHash: args.accountIdHash,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      lastRefreshAt: now,
      updatedAt: now,
    }
    if (credential) {
      await ctx.db.patch('chatgptCredentials', credential._id, value)
    } else {
      await ctx.db.insert('chatgptCredentials', {
        userId: session.userId,
        ...value,
      })
    }
    await ctx.db.patch('chatgptAuthSessions', session._id, {
      status: 'connected',
      encryptedDeviceAuthId: undefined,
      userCode: undefined,
      updatedAt: now,
    })
    return true
  },
})

export const claimCredential = internalMutation({
  args: {
    userId: v.string(),
    now: v.number(),
    leaseId: v.string(),
    minValidityMs: v.number(),
  },
  returns: credentialResolutionValidator,
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('chatgptCredentials')
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
        retryAfterMs: Math.max(250, credential.refreshLeaseExpiresAt - args.now),
      }
    }
    await ctx.db.patch('chatgptCredentials', credential._id, {
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
    accountIdHash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('chatgptCredentials')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!credential || credential.refreshLeaseId !== args.leaseId) return false
    const now = Date.now()
    await ctx.db.patch('chatgptCredentials', credential._id, {
      status: 'connected',
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      accountIdHash: args.accountIdHash,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      lastRefreshAt: now,
      updatedAt: now,
    })
    return true
  },
})

export const failRefresh = internalMutation({
  args: {
    userId: v.string(),
    leaseId: v.string(),
    permanent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('chatgptCredentials')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!credential || credential.refreshLeaseId !== args.leaseId) return null
    const now = Date.now()
    await ctx.db.patch('chatgptCredentials', credential._id, {
      status: args.permanent ? 'needs_reauth' : credential.status,
      encryptedAccess: args.permanent ? undefined : credential.encryptedAccess,
      encryptedRefresh: args.permanent ? undefined : credential.encryptedRefresh,
      expiresAt: args.permanent ? undefined : credential.expiresAt,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: now,
    })
    return null
  },
})
