'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, action, internalAction, type ActionCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { encryptBeennectorSecret, decryptBeennectorSecret, hashBeennectorValue, randomBeennectorValue } from './beennectorCrypto'
import { integer, object, parseCollections, parseItem, parseItems, request, safeUrl, type RaindropCollection, type RaindropItem } from './raindropApi'
import { raindropCollection, raindropItem } from './raindropValidators'

const REDIRECT = 'beegreat://raindrop'
const aad = (ownerKey: string, kind: string) => `raindrop:${ownerKey}:${kind}`

function oauthConfig() {
  const clientId = env.RAINDROP_CLIENT_ID
  const clientSecret = env.RAINDROP_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Raindrop sign-in is not configured. Use a personal test token or ask the app administrator to configure Raindrop.')
  return { client_id: clientId, client_secret: clientSecret }
}
async function user(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Sign in to connect Raindrop')
  return identity
}
async function exchange(body: Record<string, string>) {
  const response = await fetch('https://raindrop.io/oauth/access_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...oauthConfig(), ...body }), signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error('Raindrop sign-in expired. Connect again.')
  const result = object(await response.json())
  if (typeof result.access_token !== 'string' || typeof result.refresh_token !== 'string' || typeof result.expires_in !== 'number' || result.expires_in <= 0) throw new Error('Invalid Raindrop token response')
  return { access: result.access_token, refresh: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 }
}
async function saveConnection(ctx: ActionCtx, sessionId: Id<'raindropSessions'>, ownerKey: string, tokens: { access: string; refresh?: string; expiresAt?: number }) {
  const account = object((await request(tokens.access, 'user')).user)
  integer(account._id)
  await ctx.runMutation(internal.raindrop.storeConnection, {
    sessionId, accountName: typeof account.fullName === 'string' ? account.fullName : 'Raindrop',
    encryptedAccess: encryptBeennectorSecret(tokens.access, aad(ownerKey, 'access')),
    ...(tokens.refresh ? { encryptedRefresh: encryptBeennectorSecret(tokens.refresh, aad(ownerKey, 'refresh')) } : {}),
    ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
  })
}
export const beginAuthorization = action({
  args: {}, returns: v.object({ authorizationUrl: v.string() }), handler: async ctx => {
    const identity = await user(ctx)
    const config = oauthConfig()
    const state = randomBeennectorValue()
    await ctx.runMutation(internal.raindrop.createSession, { ownerKey: identity.tokenIdentifier, userId: identity.subject, stateHash: hashBeennectorValue(state) })
    const url = new URL('https://raindrop.io/oauth/authorize')
    url.search = new URLSearchParams({ client_id: config.client_id, redirect_uri: REDIRECT, response_type: 'code', state }).toString()
    return { authorizationUrl: url.href }
  },
})
export const completeAuthorization = action({
  args: { code: v.string(), state: v.string() }, returns: v.null(), handler: async (ctx, args) => {
    const identity = await user(ctx)
    const session = await ctx.runMutation(internal.raindrop.claimSession, { ownerKey: identity.tokenIdentifier, stateHash: hashBeennectorValue(args.state) })
    const tokens = await exchange({ grant_type: 'authorization_code', code: args.code, redirect_uri: REDIRECT })
    await saveConnection(ctx, session._id, identity.tokenIdentifier, tokens)
    return null
  },
})
export const connectToken = action({
  args: { token: v.string() }, returns: v.null(), handler: async (ctx, args) => {
    const identity = await user(ctx)
    const token = args.token.trim()
    if (!token || token.length > 4096 || /\s/.test(token)) throw new Error('Enter a valid Raindrop test token')
    const stateHash = hashBeennectorValue(randomBeennectorValue())
    const sessionId = await ctx.runMutation(internal.raindrop.createSession, { ownerKey: identity.tokenIdentifier, userId: identity.subject, stateHash })
    await ctx.runMutation(internal.raindrop.claimSession, { ownerKey: identity.tokenIdentifier, stateHash })
    await saveConnection(ctx, sessionId, identity.tokenIdentifier, { access: token })
    return null
  },
})
async function tokenFor(ctx: ActionCtx, row: Doc<'raindropConnections'>): Promise<string> {
  const claim = randomBeennectorValue()
  const result: string = await ctx.runMutation(internal.raindrop.claimRefresh, { connectionId: row._id, claim })
  if (result === 'reauth') {
    if (row.refreshClaim) await ctx.runMutation(internal.raindrop.failRefresh, { connectionId: row._id, claim: row.refreshClaim })
    throw new Error('Reconnect Raindrop to continue')
  }
  if (result === 'ready') {
    const latest: Doc<'raindropConnections'> | null = await ctx.runQuery(internal.raindrop.getConnection, { connectionId: row._id })
    if (!latest) throw new Error('Raindrop disconnected')
    return decryptBeennectorSecret(latest.encryptedAccess, aad(row.ownerKey, 'access'))
  }
  try {
    if (!row.encryptedRefresh) throw new Error('Reconnect Raindrop')
    const tokens = await exchange({ grant_type: 'refresh_token', refresh_token: decryptBeennectorSecret(row.encryptedRefresh, aad(row.ownerKey, 'refresh')) })
    await ctx.runMutation(internal.raindrop.finishRefresh, { connectionId: row._id, claim,
      encryptedAccess: encryptBeennectorSecret(tokens.access, aad(row.ownerKey, 'access')),
      encryptedRefresh: encryptBeennectorSecret(tokens.refresh, aad(row.ownerKey, 'refresh')), expiresAt: tokens.expiresAt })
    return tokens.access
  } catch (error) {
    await ctx.runMutation(internal.raindrop.failRefresh, { connectionId: row._id, claim })
    throw error
  }
}
async function authenticated(ctx: ActionCtx) {
  const identity = await user(ctx)
  const row: Doc<'raindropConnections'> | null = await ctx.runQuery(internal.raindrop.credential, { ownerKey: identity.tokenIdentifier })
  if (!row || row.state !== 'connected') throw new Error('Connect Raindrop first')
  return { row, token: await tokenFor(ctx, row) }
}
export const collections = action({
  args: {}, returns: v.array(raindropCollection), handler: async (ctx): Promise<RaindropCollection[]> => {
    const { token } = await authenticated(ctx)
    const roots = parseCollections(await request(token, 'collections'))
    const children = parseCollections(await request(token, 'collections/childrens'))
    return [{ id: 0, title: 'All bookmarks', parentId: null }, { id: -1, title: 'Unsorted', parentId: null }, ...roots, ...children, { id: -99, title: 'Trash', parentId: null }]
  },
})
export const bookmarks = action({
  args: { collectionId: v.number(), search: v.string(), page: v.number() },
  returns: v.object({ items: v.array(raindropItem), hasMore: v.boolean() }),
  handler: async (ctx, args): Promise<{ items: RaindropItem[]; hasMore: boolean }> => {
    integer(args.collectionId); integer(args.page)
    if (args.page < 0 || args.search.length > 1000) throw new Error('Invalid search')
    const { token } = await authenticated(ctx)
    const query = new URLSearchParams({ search: args.search, page: String(args.page), perpage: '50', sort: '-created' })
    const items = parseItems(await request(token, `raindrops/${args.collectionId}?${query}`))
    return { items, hasMore: items.length === 50 }
  },
})
export const save = action({
  args: { id: v.optional(v.number()), url: v.string(), title: v.string(), note: v.string(), tags: v.array(v.string()), collectionId: v.number(), important: v.boolean() },
  returns: raindropItem, handler: async (ctx, args): Promise<RaindropItem> => {
    const collectionId = integer(args.collectionId)
    if (collectionId !== -1 && collectionId <= 0) throw new Error('Choose a collection')
    if (args.title.length > 1000 || args.note.length > 10000 || args.tags.length > 100 || args.tags.some(tag => tag.length > 100)) throw new Error('Bookmark details are too long')
    const { row, token } = await authenticated(ctx)
    const path = args.id === undefined ? 'raindrop' : `raindrop/${integer(args.id)}`
    const item = parseItem((await request(token, path, args.id === undefined ? 'POST' : 'PUT', {
      link: safeUrl(args.url), title: args.title, note: args.note, tags: args.tags, collection: { $id: collectionId }, important: args.important,
    })).item)
    await ctx.scheduler.runAfter(0, internal.raindropActions.startSync, { connectionId: row._id })
    return item
  },
})
export const trash = action({
  args: { id: v.number() }, returns: v.null(), handler: async (ctx, args) => {
    const { token } = await authenticated(ctx)
    const id = integer(args.id)
    const item = parseItem((await request(token, `raindrop/${id}`)).item)
    if (item.collectionId === -99) throw new Error('This bookmark is already in Trash')
    await request(token, `raindrop/${id}`, 'DELETE')
    return null
  },
})
export const sync = action({
  args: {}, returns: v.null(), handler: async ctx => {
    const { row } = await authenticated(ctx)
    await ctx.scheduler.runAfter(0, internal.raindropActions.startSync, { connectionId: row._id })
    return null
  },
})
export const startSync = internalAction({
  args: { connectionId: v.id('raindropConnections') }, returns: v.null(), handler: async (ctx, args) => {
    const run = randomBeennectorValue()
    const started: boolean = await ctx.runMutation(internal.raindrop.beginSync, { ...args, run })
    if (started) await ctx.scheduler.runAfter(0, internal.raindropActions.pullPage, { ...args, run, page: 0 })
    return null
  },
})
export const pullPage = internalAction({
  args: { connectionId: v.id('raindropConnections'), run: v.string(), page: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row: Doc<'raindropConnections'> | null = await ctx.runQuery(internal.raindrop.getConnection, { connectionId: args.connectionId })
    if (!row || row.syncRun !== args.run) return null
    try {
      const token = await tokenFor(ctx, row)
      const items = parseItems(await request(token, `raindrops/0?perpage=50&page=${args.page}&sort=created`))
      const more: boolean = await ctx.runMutation(internal.raindrop.syncPage, { connectionId: row._id, run: args.run, items, done: items.length < 50 })
      if (more && items.length === 50) await ctx.scheduler.runAfter(1000, internal.raindropActions.pullPage, { ...args, page: args.page + 1 })
    } catch {
      await ctx.runMutation(internal.raindrop.syncFailed, { connectionId: row._id, run: args.run })
    }
    return null
  },
})
