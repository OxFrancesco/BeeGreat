import { v, type Infer } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server'
import { requireUserId } from './helpers'
import {
  encryptedSecretValidator,
  telegramConnectionStatusValidator,
} from './telegramValidators'

type TelegramConnectionStatus = Infer<typeof telegramConnectionStatusValidator>

export const status = query({
  args: {},
  returns: telegramConnectionStatusValidator,
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const connection = await ctx.db
      .query('telegramConnections')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (connection?.status === 'connected') {
      const connected: TelegramConnectionStatus = {
        state: 'connected',
        displayName: connection.displayName,
      }
      if (connection.username) connected.username = connection.username
      if (connection.photoUrl) connected.photoUrl = connection.photoUrl
      return connected
    }
    const sessions = await ctx.db
      .query('telegramAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(1)
    const session = sessions[0]
    if (session?.status === 'pending' && session.expiresAt > Date.now()) {
      return { state: 'pending' as const }
    }
    if (connection?.status === 'needs_reauth') {
      const needsReauth: TelegramConnectionStatus = {
        state: 'needs_reauth',
        displayName: connection.displayName,
        message: 'Reconnect Telegram so Bee can message you again.',
      }
      if (connection.username) needsReauth.username = connection.username
      return needsReauth
    }
    if (session?.status === 'failed') {
      return {
        state: 'failed' as const,
        message: 'Telegram could not be connected. Try again.',
      }
    }
    return { state: 'disconnected' as const }
  },
})

export const createSession = internalMutation({
  args: {
    userId: v.string(),
    client: v.union(v.literal('mobile'), v.literal('browser')),
    stateHash: v.string(),
    encryptedCodeVerifier: encryptedSecretValidator,
    encryptedNonce: encryptedSecretValidator,
    expiresAt: v.number(),
  },
  returns: v.id('telegramAuthSessions'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('telegramAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(10)
    await Promise.all(
      existing
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('telegramAuthSessions', session._id, {
            status: 'cancelled' as const,
            encryptedCodeVerifier: undefined,
            encryptedNonce: undefined,
            updatedAt: now,
          }),
        ),
    )
    return await ctx.db.insert('telegramAuthSessions', {
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
      sessionId: v.id('telegramAuthSessions'),
      userId: v.string(),
      client: v.union(v.literal('mobile'), v.literal('browser')),
      status: v.string(),
      encryptedCodeVerifier: v.optional(encryptedSecretValidator),
      encryptedNonce: v.optional(encryptedSecretValidator),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('telegramAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (!session) return null
    return {
      sessionId: session._id,
      userId: session.userId,
      client: session.client,
      status: session.status,
      encryptedCodeVerifier: session.encryptedCodeVerifier,
      encryptedNonce: session.encryptedNonce,
      expiresAt: session.expiresAt,
    }
  },
})

export const completeAuthorization = internalMutation({
  args: {
    sessionId: v.id('telegramAuthSessions'),
    telegramUserId: v.string(),
    displayName: v.string(),
    username: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('telegramAuthSessions', args.sessionId)
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now()
    ) {
      return false
    }
    const now = Date.now()
    const existing = await ctx.db
      .query('telegramConnections')
      .withIndex('by_user', (q) => q.eq('userId', session.userId))
      .unique()
    const connection = {
      status: 'connected' as const,
      telegramUserId: args.telegramUserId,
      displayName: args.displayName,
      username: args.username,
      photoUrl: args.photoUrl,
      connectedAt: now,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch('telegramConnections', existing._id, connection)
    } else {
      await ctx.db.insert('telegramConnections', {
        userId: session.userId,
        ...connection,
      })
    }
    await ctx.db.patch('telegramAuthSessions', session._id, {
      status: 'connected',
      encryptedCodeVerifier: undefined,
      encryptedNonce: undefined,
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
      .query('telegramAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (session?.status === 'pending') {
      await ctx.db.patch('telegramAuthSessions', session._id, {
        status: session.expiresAt <= Date.now() ? 'expired' : 'failed',
        encryptedCodeVerifier: undefined,
        encryptedNonce: undefined,
        errorCode: args.errorCode,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

async function disconnectUser(ctx: MutationCtx, userId: string) {
  const [connection, sessions] = await Promise.all([
    ctx.db
      .query('telegramConnections')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
    ctx.db
      .query('telegramAuthSessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(10),
  ])
  if (connection) await ctx.db.delete('telegramConnections', connection._id)
  await Promise.all(
    sessions
      .filter((session) => session.status === 'pending')
      .map((session) =>
        ctx.db.patch('telegramAuthSessions', session._id, {
          status: 'cancelled' as const,
          encryptedCodeVerifier: undefined,
          encryptedNonce: undefined,
          updatedAt: Date.now(),
        }),
      ),
  )
  return null
}

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return await disconnectUser(ctx, userId)
  },
})

export const disconnectForAgent = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => await disconnectUser(ctx, args.userId),
})

type ConnectedTelegramAgentView = {
  status: 'connected'
  telegramUserId: string
  displayName: string
  username?: string
}

export const getConnectionForAgent = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.object({ status: v.literal('missing') }),
    v.object({ status: v.literal('pending') }),
    v.object({ status: v.literal('failed'), message: v.string() }),
    v.object({ status: v.literal('needs_reauth') }),
    v.object({
      status: v.literal('connected'),
      telegramUserId: v.string(),
      displayName: v.string(),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('telegramConnections')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (!connection) {
      const session = (
        await ctx.db
          .query('telegramAuthSessions')
          .withIndex('by_user', (q) => q.eq('userId', args.userId))
          .order('desc')
          .take(1)
      )[0]
      if (session?.status === 'pending' && session.expiresAt > Date.now()) {
        return { status: 'pending' as const }
      }
      if (session?.status === 'failed') {
        return {
          status: 'failed' as const,
          message: 'Telegram could not be connected. Try again.',
        }
      }
      return { status: 'missing' as const }
    }
    if (connection.status === 'needs_reauth') {
      return { status: 'needs_reauth' as const }
    }
    const connected: ConnectedTelegramAgentView = {
      status: 'connected',
      telegramUserId: connection.telegramUserId,
      displayName: connection.displayName,
    }
    if (connection.username) connected.username = connection.username
    return connected
  },
})

export const markNeedsReauth = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('telegramConnections')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique()
    if (connection) {
      await ctx.db.patch('telegramConnections', connection._id, {
        status: 'needs_reauth',
        updatedAt: Date.now(),
      })
    }
    return null
  },
})
