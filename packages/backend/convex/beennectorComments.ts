import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { encryptedSecretValidator } from './beennectorValidators'
import { requireUserId } from './helpers'
import { reviewLink } from './reviewLinks'

const providerValidator = v.union(v.literal('github'), v.literal('linear'))
function sameSecret(left: Doc<'beennectorCredentials'>['encryptedAccess'], right: NonNullable<Doc<'beennectorCredentials'>['encryptedAccess']>) {
  return left?.iv === right.iv && left.ciphertext === right.ciphertext && left.tag === right.tag && left.version === right.version
}
function sameConnection(row: Doc<'beennectorCommentActions'>, connection: Doc<'beennectorCredentials'> | null) {
  return connection?.status === 'connected' && connection._id === row.connectionId && connection.userId === row.userId && connection.provider === row.provider && connection.externalAccountId === row.externalAccountId
}

export const createPending = internalMutation({
  args: { userId: v.string(), provider: providerValidator, targetId: v.string(), targetLabel: v.string(), targetUrl: v.string(), body: v.string(), expectedEncryptedAccess: encryptedSecretValidator },
  handler: async (ctx, args) => {
    const body = args.body.trim()
    if (!body || body.length > 20_000 || args.targetId.length > 256 || args.targetLabel.length > 1_000 || args.targetUrl.length > 2_000) throw new Error('The comment proposal is invalid or too large.')
    const target = new URL(args.targetUrl)
    if (target.protocol !== 'https:' || target.hostname !== (args.provider === 'github' ? 'github.com' : 'linear.app')) throw new Error('The comment destination is invalid.')
    const connection = await ctx.db.query('beennectorCredentials').withIndex('by_user_and_provider', q => q.eq('userId', args.userId).eq('provider', args.provider)).unique()
    if (connection?.status !== 'connected' || !sameSecret(connection.encryptedAccess, args.expectedEncryptedAccess)) throw new Error('The connected account changed. Prepare the comment again.')
    const id = await ctx.db.insert('beennectorCommentActions', { userId: args.userId, provider: args.provider, targetId: args.targetId, targetLabel: args.targetLabel, targetUrl: target.toString(), body, connectionId: connection._id, externalAccountId: connection.externalAccountId, accountName: connection.externalAccountName ?? connection.workspaceName ?? args.provider, state: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 30 * 60_000 })
    return { state: 'pending' as const, reviewUrl: reviewLink('comment', id) }
  },
})

export const status = query({
  args: { actionId: v.id('beennectorCommentActions') },
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const row = await ctx.db.get(actionId)
    if (!row || row.userId !== userId) return null
    const connection = await ctx.db.get(row.connectionId)
    const state = row.state === 'pending' && (row.expiresAt <= Date.now() || !sameConnection(row, connection)) ? 'unavailable' : row.state
    return { actionId, provider: row.provider, targetId: row.targetId, targetLabel: row.targetLabel, targetUrl: row.targetUrl, body: row.body, externalAccountId: row.externalAccountId, accountName: row.accountName, state, resultUrl: row.resultUrl ?? null, error: row.error ?? null }
  },
})

export const confirm = mutation({
  args: { actionId: v.id('beennectorCommentActions'), expectedProvider: providerValidator, expectedTargetId: v.string(), expectedBody: v.string(), expectedAccountId: v.string(), expectedTargetUrl: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const row = await ctx.db.get(args.actionId)
    if (!row || row.userId !== userId) throw new Error('This comment is unavailable.')
    if (row.provider !== args.expectedProvider || row.targetId !== args.expectedTargetId || row.body !== args.expectedBody || row.externalAccountId !== args.expectedAccountId || row.targetUrl !== args.expectedTargetUrl) throw new Error('The comment changed. Review it again.')
    if (row.state !== 'pending') return null
    if (row.expiresAt <= Date.now()) throw new Error('This comment approval expired. Prepare a new comment.')
    if (!sameConnection(row, await ctx.db.get(row.connectionId))) throw new Error('The connected account changed. Prepare the comment again.')
    await ctx.db.patch(row._id, { state: 'confirmed', confirmedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.beennectorOperations.executeApprovedComment, { actionId: row._id })
    return null
  },
})

export const cancel = mutation({
  args: { actionId: v.id('beennectorCommentActions') },
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const row = await ctx.db.get(actionId)
    if (!row || row.userId !== userId) throw new Error('This comment is unavailable.')
    if (row.state === 'pending' || row.state === 'confirmed') await ctx.db.patch(row._id, { state: 'cancelled' })
    return null
  },
})

export const claim = internalMutation({
  args: { actionId: v.id('beennectorCommentActions') },
  handler: async (ctx, { actionId }) => {
    const row = await ctx.db.get(actionId)
    if (row?.state !== 'confirmed') return null
    if (row.expiresAt <= Date.now() || !sameConnection(row, await ctx.db.get(row.connectionId))) {
      await ctx.db.patch(row._id, { state: 'failed', error: 'The approval expired or the connected account changed. No comment was posted.' })
      return null
    }
    await ctx.db.patch(row._id, { state: 'executing', executionStartedAt: Date.now() })
    return row
  },
})

export const authorizeSubmission = internalMutation({
  args: { actionId: v.id('beennectorCommentActions'), expectedEncryptedAccess: encryptedSecretValidator },
  handler: async (ctx, { actionId, expectedEncryptedAccess }) => {
    const row = await ctx.db.get(actionId)
    if (row?.state !== 'executing' || row.submissionStartedAt !== undefined) throw new Error('This comment cannot be submitted again.')
    const connection = await ctx.db.get(row.connectionId)
    if (!sameConnection(row, connection) || !sameSecret(connection?.encryptedAccess, expectedEncryptedAccess)) throw new Error('The connected account changed before posting.')
    await ctx.db.patch(row._id, { submissionStartedAt: Date.now() })
    return null
  },
})

export const finish = internalMutation({
  args: { actionId: v.id('beennectorCommentActions'), resultUrl: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { actionId, resultUrl, error }) => {
    const row = await ctx.db.get(actionId)
    if (!row || !['executing', 'unknown'].includes(row.state)) return null
    await ctx.db.patch(row._id, { state: resultUrl ? 'posted' : row.submissionStartedAt !== undefined ? 'unknown' : 'failed', resultUrl, error: resultUrl ? undefined : error ?? 'The comment outcome could not be confirmed. Check the destination before requesting another comment.' })
    return null
  },
})

export const watchdog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('beennectorCommentActions').withIndex('by_state_and_execution', q => q.eq('state', 'executing').lt('executionStartedAt', Date.now() - 5 * 60_000)).take(100)
    for (const row of rows) await ctx.db.patch(row._id, { state: 'unknown', error: 'The comment outcome could not be confirmed. Check the destination before requesting another comment.' })
    return null
  },
})
