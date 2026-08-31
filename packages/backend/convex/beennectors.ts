import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { requireUserId } from './helpers'
import {
  beennectorConnectionValidator,
  beennectorCredentialClaimValidator,
  beennectorDeliveryClaimValidator,
  beennectorProviderValidator,
  encryptedSecretValidator,
  googleWorkspaceServiceValidator,
} from './beennectorValidators'

const REFRESH_LEASE_MS = 15_000
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

const CATALOG = {
  github: {
    name: 'GitHub',
    description: 'Issues, pull requests, repositories, and comments.',
  },
  linear: {
    name: 'Linear',
    description: 'Workspace issues, projects, and team conversations.',
  },
  notion: {
    name: 'Notion',
    description: 'Search and read the pages shared with Bee.',
  },
  google: {
    name: 'Google Workspace',
    description:
      'Choose Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts, Tasks, or Forms.',
  },
} as const

export const list = query({
  args: {},
  returns: v.array(beennectorConnectionValidator),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    return await Promise.all(
      (['github', 'linear', 'notion', 'google'] as const).map(async (provider) => {
        const [credential, sessions] = await Promise.all([
          ctx.db
            .query('beennectorCredentials')
            .withIndex('by_user_and_provider', (q) =>
              q.eq('userId', userId).eq('provider', provider),
            )
            .unique(),
          ctx.db
            .query('beennectorAuthSessions')
            .withIndex('by_user_and_provider', (q) =>
              q.eq('userId', userId).eq('provider', provider),
            )
            .order('desc')
            .take(1),
        ])
        const catalog = CATALOG[provider]
        const base = {
          provider,
          ...catalog,
          accountName: credential?.externalAccountName,
          workspaceName: credential?.workspaceName,
        }
        if (credential?.status === 'connected') {
          return {
            ...base,
            state: 'connected' as const,
          }
        }
        const session = sessions[0]
        if (session?.status === 'pending' && session.expiresAt > now) {
          return { ...base, state: 'pending' as const }
        }
        if (session?.status === 'failed') {
          return {
            ...base,
            state: 'failed' as const,
            message: `${catalog.name} could not be connected. Try again.`,
          }
        }
        if (credential?.status === 'needs_reauth') {
          return {
            ...base,
            state: 'needs_reauth' as const,
            message: `${catalog.name} needs to be connected again.`,
          }
        }
        return { ...base, state: 'disconnected' as const }
      }),
    )
  },
})
export const createSession = internalMutation({
  args: {
    userId: v.string(),
    provider: beennectorProviderValidator,
    stateHash: v.string(),
    encryptedCodeVerifier: v.optional(encryptedSecretValidator),
    expiresAt: v.number(),
    disclosureVersion: v.optional(v.string()),
    disclosureAcceptedAt: v.optional(v.number()),
    requestedGoogleServices: v.optional(
      v.array(googleWorkspaceServiceValidator),
    ),
  },
  returns: v.id('beennectorAuthSessions'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('beennectorAuthSessions')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .order('desc')
      .take(10)
    await Promise.all(
      existing
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('beennectorAuthSessions', session._id, {
            status: 'cancelled' as const,
            encryptedCodeVerifier: undefined,
            updatedAt: now,
          }),
        ),
    )
    return await ctx.db.insert('beennectorAuthSessions', {
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
      sessionId: v.id('beennectorAuthSessions'),
      userId: v.string(),
      provider: beennectorProviderValidator,
      status: v.string(),
      encryptedCodeVerifier: v.optional(encryptedSecretValidator),
      requestedGoogleServices: v.optional(
        v.array(googleWorkspaceServiceValidator),
      ),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('beennectorAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (!session) return null
    return {
      sessionId: session._id,
      userId: session.userId,
      provider: session.provider,
      status: session.status,
      encryptedCodeVerifier: session.encryptedCodeVerifier,
      requestedGoogleServices: session.requestedGoogleServices,
      expiresAt: session.expiresAt,
    }
  },
})

export const completeAuthorization = internalMutation({
  args: {
    sessionId: v.id('beennectorAuthSessions'),
    encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: v.optional(encryptedSecretValidator),
    expiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
    googleServices: v.optional(v.array(googleWorkspaceServiceValidator)),
    externalAccountId: v.string(),
    externalAccountName: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    botId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get('beennectorAuthSessions', args.sessionId)
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now()
    ) {
      return false
    }
    const now = Date.now()
    const existing = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', session.userId).eq('provider', session.provider),
      )
      .unique()
    const credential = {
      status: 'connected' as const,
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      scopes: args.scopes,
      googleServices: args.googleServices,
      externalAccountId: args.externalAccountId,
      externalAccountName: args.externalAccountName,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      botId: args.botId,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: now,
    }
    if (existing) {
      await ctx.db.patch('beennectorCredentials', existing._id, credential)
    } else {
      await ctx.db.insert('beennectorCredentials', {
        userId: session.userId,
        provider: session.provider,
        ...credential,
      })
    }
    await ctx.db.patch('beennectorAuthSessions', session._id, {
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
      .query('beennectorAuthSessions')
      .withIndex('by_state_hash', (q) => q.eq('stateHash', args.stateHash))
      .unique()
    if (session?.status === 'pending') {
      await ctx.db.patch('beennectorAuthSessions', session._id, {
        status: session.expiresAt <= Date.now() ? 'expired' : 'failed',
        encryptedCodeVerifier: undefined,
        errorCode: args.errorCode,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const getCredentialForDisconnect = internalQuery({
  args: { userId: v.string(), provider: beennectorProviderValidator },
  returns: v.union(
    v.null(),
    v.object({
      encryptedAccess: v.optional(encryptedSecretValidator),
      encryptedRefresh: v.optional(encryptedSecretValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .unique()
    if (!credential) return null
    return {
      encryptedAccess: credential.encryptedAccess,
      encryptedRefresh: credential.encryptedRefresh,
    }
  },
})

export const listConnectedForAgent = internalQuery({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      provider: beennectorProviderValidator,
      accountName: v.optional(v.string()),
      workspaceName: v.optional(v.string()),
      googleServices: v.optional(v.array(googleWorkspaceServiceValidator)),
    }),
  ),
  handler: async (ctx, args) => {
    const credentials = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) => q.eq('userId', args.userId))
      .collect()
    return credentials
      .filter((credential) => credential.status === 'connected')
      .map((credential) => ({
        provider: credential.provider,
        accountName: credential.externalAccountName,
        workspaceName: credential.workspaceName,
        googleServices: credential.googleServices,
      }))
  },
})

export const removeConnection = internalMutation({
  args: { userId: v.string(), provider: beennectorProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [credential, sessions] = await Promise.all([
      ctx.db
        .query('beennectorCredentials')
        .withIndex('by_user_and_provider', (q) =>
          q.eq('userId', args.userId).eq('provider', args.provider),
        )
        .unique(),
      ctx.db
        .query('beennectorAuthSessions')
        .withIndex('by_user_and_provider', (q) =>
          q.eq('userId', args.userId).eq('provider', args.provider),
        )
        .order('desc')
        .take(10),
    ])
    if (credential) await ctx.db.delete('beennectorCredentials', credential._id)
    await Promise.all(
      sessions
        .filter((session) => session.status === 'pending')
        .map((session) =>
          ctx.db.patch('beennectorAuthSessions', session._id, {
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
    provider: beennectorProviderValidator,
    now: v.number(),
    leaseId: v.string(),
    minValidityMs: v.number(),
  },
  returns: beennectorCredentialClaimValidator,
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .unique()
    if (!credential) return { status: 'missing' as const }
    if (credential.status === 'needs_reauth' || !credential.encryptedAccess) {
      return { status: 'reauth' as const }
    }
    if (
      credential.expiresAt === undefined ||
      credential.expiresAt > args.now + args.minValidityMs
    ) {
      return {
        status: 'ready' as const,
        encryptedAccess: credential.encryptedAccess,
      }
    }
    if (!credential.encryptedRefresh) return { status: 'reauth' as const }
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
    await ctx.db.patch('beennectorCredentials', credential._id, {
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
    provider: beennectorProviderValidator,
    leaseId: v.string(),
    encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: v.optional(encryptedSecretValidator),
    expiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .unique()
    if (!credential || credential.refreshLeaseId !== args.leaseId) return false
    await ctx.db.patch('beennectorCredentials', credential._id, {
      status: 'connected',
      encryptedAccess: args.encryptedAccess,
      encryptedRefresh: args.encryptedRefresh,
      expiresAt: args.expiresAt,
      scopes: args.scopes.length ? args.scopes : credential.scopes,
      refreshLeaseId: undefined,
      refreshLeaseExpiresAt: undefined,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const failRefresh = internalMutation({
  args: {
    userId: v.string(),
    provider: beennectorProviderValidator,
    leaseId: v.string(),
    permanent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .unique()
    if (credential?.refreshLeaseId === args.leaseId) {
      const patch: Partial<Doc<'beennectorCredentials'>> = {
        refreshLeaseId: undefined,
        refreshLeaseExpiresAt: undefined,
        updatedAt: Date.now(),
      }
      if (args.permanent) patch.status = 'needs_reauth'
      await ctx.db.patch('beennectorCredentials', credential._id, patch)
    }
    return null
  },
})

export const markNeedsReauth = internalMutation({
  args: { userId: v.string(), provider: beennectorProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const credential = await ctx.db
      .query('beennectorCredentials')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider),
      )
      .unique()
    if (credential) {
      await ctx.db.patch('beennectorCredentials', credential._id, {
        status: 'needs_reauth',
        refreshLeaseId: undefined,
        refreshLeaseExpiresAt: undefined,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const claimDelivery = internalMutation({
  args: {
    provider: beennectorProviderValidator,
    deliveryId: v.string(),
    actorId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
  },
  returns: beennectorDeliveryClaimValidator,
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query('beennectorDeliveries')
      .withIndex('by_provider_and_delivery', (q) =>
        q.eq('provider', args.provider).eq('deliveryId', args.deliveryId),
      )
      .unique()
    if (duplicate) return { status: 'duplicate' as const }

    let candidates = args.actorId
      ? await ctx.db
          .query('beennectorCredentials')
          .withIndex('by_provider_and_external_account', (q) =>
            q
              .eq('provider', args.provider)
              .eq('externalAccountId', args.actorId!),
          )
          .collect()
      : []
    candidates = candidates.filter(
      (credential) => credential.status === 'connected',
    )
    if (candidates.length === 0 && args.workspaceId) {
      candidates = (
        await ctx.db
          .query('beennectorCredentials')
          .withIndex('by_provider_and_workspace', (q) =>
            q.eq('provider', args.provider).eq('workspaceId', args.workspaceId),
          )
          .collect()
      ).filter((credential) => credential.status === 'connected')
    }
    if (candidates.length === 0) return { status: 'unmapped' as const }
    const userIds = [...new Set(candidates.map((candidate) => candidate.userId))]
    if (userIds.length !== 1) return { status: 'ambiguous' as const }
    const userId = userIds[0]!
    const now = Date.now()
    await ctx.db.insert('beennectorDeliveries', {
      provider: args.provider,
      deliveryId: args.deliveryId,
      userId,
      receivedAt: now,
      expiresAt: now + DELIVERY_RETENTION_MS,
    })
    return { status: 'accepted' as const, userId }
  },
})

export const deleteExpiredDeliveries = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('beennectorDeliveries')
      .withIndex('by_expires_at', (q) => q.lt('expiresAt', Date.now()))
      .take(500)
    await Promise.all(
      expired.map((delivery) =>
        ctx.db.delete('beennectorDeliveries', delivery._id),
      ),
    )
    if (expired.length === 500) {
      await ctx.scheduler.runAfter(
        0,
        internal.beennectors.deleteExpiredDeliveries,
        {},
      )
    }
    return null
  },
})
