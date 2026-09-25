import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { internal } from './_generated/api'
import { env, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { encryptedSecretValidator } from './chatgptAuthValidators'
import { raindropItem } from './raindropValidators'
import { insertBookmarkForOwner, updateBookmarkForOwner } from './bookmarks'
import { normalizeBookmarkUrl } from './scraperShared'

async function identity(ctx: QueryCtx | MutationCtx) {
  const user = await ctx.auth.getUserIdentity()
  if (!user) throw new Error('Sign in to connect Raindrop')
  return user
}
async function connection(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  return ctx.db.query('raindropConnections').withIndex('by_ownerKey', q => q.eq('ownerKey', ownerKey)).unique()
}

export const status = query({
  args: {},
  handler: async ctx => {
    const user = await identity(ctx)
    const row = await connection(ctx, user.tokenIdentifier)
    const oauthAvailable = !!env.RAINDROP_CLIENT_ID && !!env.RAINDROP_CLIENT_SECRET
    return row ? {
      oauthAvailable, state: row.state, accountName: row.accountName, syncing: !!row.syncRun,
      lastSyncedAt: row.lastSyncedAt ?? null, message: row.message ?? null,
    } : { oauthAvailable, state: 'disconnected', accountName: null, syncing: false, lastSyncedAt: null, message: null }
  },
})
export const disconnect = mutation({
  args: {}, handler: async ctx => {
    const user = await identity(ctx)
    const row = await connection(ctx, user.tokenIdentifier)
    if (row) await ctx.db.delete('raindropConnections', row._id)
    const session = await ctx.db.query('raindropSessions').withIndex('by_ownerKey', q => q.eq('ownerKey', user.tokenIdentifier)).unique()
    if (session) await ctx.db.delete('raindropSessions', session._id)
    return null
  },
})
export const createSession = internalMutation({
  args: { ownerKey: v.string(), userId: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const old = await ctx.db.query('raindropSessions').withIndex('by_ownerKey', q => q.eq('ownerKey', args.ownerKey)).unique()
    if (old) await ctx.db.delete('raindropSessions', old._id)
    return ctx.db.insert('raindropSessions', { ...args, expiresAt: Date.now() + 600_000, claimed: false })
  },
})
export const claimSession = internalMutation({
  args: { ownerKey: v.string(), stateHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query('raindropSessions').withIndex('by_ownerKey', q => q.eq('ownerKey', args.ownerKey)).unique()
    if (!row || row.stateHash !== args.stateHash || row.claimed || row.expiresAt <= Date.now()) throw new Error('Raindrop sign-in expired. Connect again.')
    await ctx.db.patch('raindropSessions', row._id, { claimed: true })
    return row
  },
})
export const storeConnection = internalMutation({
  args: { sessionId: v.id('raindropSessions'), accountName: v.string(), encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: v.optional(encryptedSecretValidator), expiresAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('raindropSessions', args.sessionId)
    if (!session || !session.claimed || session.expiresAt <= Date.now()) throw new Error('Connection cancelled. Connect again.')
    const old = await connection(ctx, session.ownerKey)
    if (old) await ctx.db.delete('raindropConnections', old._id)
    const { sessionId, ...credential } = args
    const id = await ctx.db.insert('raindropConnections', {
      ...credential, ownerKey: session.ownerKey, userId: session.userId, state: 'connected',
    })
    await ctx.db.delete('raindropSessions', sessionId)
    await ctx.scheduler.runAfter(0, internal.raindropActions.startSync, { connectionId: id })
    return null
  },
})
export const credential = internalQuery({
  args: { ownerKey: v.string() }, handler: (ctx, args) => connection(ctx, args.ownerKey),
})
export const getConnection = internalQuery({
  args: { connectionId: v.id('raindropConnections') }, handler: (ctx, args) => ctx.db.get('raindropConnections', args.connectionId),
})
export const claimRefresh = internalMutation({
  args: { connectionId: v.id('raindropConnections'), claim: v.string() }, handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (!row || row.state !== 'connected') throw new Error('Reconnect Raindrop to continue')
    if (!row.expiresAt || row.expiresAt > Date.now() + 60_000) return 'ready'
    if (row.refreshClaim) {
      if ((row.refreshStartedAt ?? 0) < Date.now() - 60_000) return 'reauth'
      throw new Error('Raindrop is refreshing its connection. Try again shortly.')
    }
    await ctx.db.patch('raindropConnections', row._id, { refreshClaim: args.claim, refreshStartedAt: Date.now() })
    return 'claimed'
  },
})
export const finishRefresh = internalMutation({
  args: { connectionId: v.id('raindropConnections'), claim: v.string(), encryptedAccess: encryptedSecretValidator,
    encryptedRefresh: encryptedSecretValidator, expiresAt: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (!row || row.refreshClaim !== args.claim) throw new Error('Raindrop connection changed')
    const { connectionId, claim: _claim, ...tokens } = args
    await ctx.db.patch('raindropConnections', connectionId, { ...tokens, refreshClaim: undefined })
    return null
  },
})
export const failRefresh = internalMutation({
  args: { connectionId: v.id('raindropConnections'), claim: v.string() }, handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (row?.refreshClaim === args.claim) await ctx.db.patch('raindropConnections', row._id, { state: 'needs_reauth', message: 'Reconnect Raindrop to continue.', refreshClaim: undefined, syncRun: undefined })
    return null
  },
})
export const beginSync = internalMutation({
  args: { connectionId: v.id('raindropConnections'), run: v.string() }, handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (!row || row.state !== 'connected') return false
    if (row.syncRun && (row.syncTouchedAt ?? 0) > Date.now() - 600_000) {
      await ctx.db.patch('raindropConnections', row._id, { syncAgain: true })
      return false
    }
    await ctx.db.patch('raindropConnections', row._id, { syncRun: args.run, syncAgain: false, syncTouchedAt: Date.now(), message: undefined })
    return true
  },
})
export const syncPage = internalMutation({
  args: { connectionId: v.id('raindropConnections'), run: v.string(), items: v.array(raindropItem), done: v.boolean() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (!row || row.syncRun !== args.run || row.state !== 'connected') return false
    for (const item of args.items) {
      const mapping = await ctx.db.query('raindropImports').withIndex('by_ownerKey_and_raindropId', q => q.eq('ownerKey', row.ownerKey).eq('raindropId', item.id)).unique()
      const previous = mapping ? await ctx.db.get('bookmarks', mapping.bookmarkId) : null
      if (mapping && !previous) continue
      if (mapping && mapping.updatedAt >= item.updatedAt) continue
      const existing = previous ?? await ctx.db.query('bookmarks').withIndex('by_owner_key_and_normalized_url', q => q.eq('ownerKey', row.ownerKey).eq('normalizedUrl', normalizeBookmarkUrl(item.url))).unique()
      const bookmark = existing ?? await insertBookmarkForOwner(ctx, { ownerKey: row.ownerKey, userId: row.userId, url: item.url, note: item.note })
      const managed = mapping?.managed ?? !existing
      if (managed) await updateBookmarkForOwner(ctx, { ownerKey: row.ownerKey, bookmarkId: bookmark._id, title: item.title, labels: item.tags, note: item.note })
      if (mapping) await ctx.db.patch('raindropImports', mapping._id, { updatedAt: item.updatedAt })
      else await ctx.db.insert('raindropImports', { ownerKey: row.ownerKey, raindropId: item.id, bookmarkId: bookmark._id, updatedAt: item.updatedAt, managed })
    }
    if (args.done && row.syncAgain) await ctx.scheduler.runAfter(0, internal.raindropActions.startSync, { connectionId: row._id })
    const progress = { syncTouchedAt: Date.now() }
    await ctx.db.patch('raindropConnections', row._id, args.done ? { ...progress, syncRun: undefined, lastSyncedAt: Date.now(), message: undefined } : progress)
    return true
  },
})
export const syncFailed = internalMutation({
  args: { connectionId: v.id('raindropConnections'), run: v.string() }, handler: async (ctx, args) => {
    const row = await ctx.db.get('raindropConnections', args.connectionId)
    if (row?.syncRun === args.run) await ctx.db.patch('raindropConnections', row._id, { syncRun: undefined, message: 'Sync paused. Tap Sync to try again.' })
    return null
  },
})
export const scheduleSyncs = internalMutation({
  args: { paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
    const page = await ctx.db.query('raindropConnections').paginate(args.paginationOpts)
    for (const row of page.page) if (row.state === 'connected') await ctx.scheduler.runAfter(0, internal.raindropActions.startSync, { connectionId: row._id })
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.raindrop.scheduleSyncs, { paginationOpts: { numItems: 100, cursor: page.continueCursor } })
    return null
  },
})
