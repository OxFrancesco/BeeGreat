import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'
import { parseItem, request, safeUrl } from './raindropApi'

const identity = { subject: 'raindrop-owner', tokenIdentifier: 'https://issuer.test|raindrop-owner' }
const secret = { version: 1 as const, iv: 'fixture', ciphertext: 'fixture', tag: 'fixture' }
const item = { id: 100, url: 'https://example.com/raindrop', title: 'Saved research', excerpt: '', note: 'Read later', tags: ['research'], collectionId: -1, important: false, cover: '', updatedAt: '2026-09-14T10:00:00Z' }

afterEach(() => { vi.unstubAllGlobals() })

describe('Raindrop authentication and Mind sync', () => {
  test('rejects signed-out access and scopes credentials by issuer', async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.raindrop.status, {})).rejects.toThrow('Sign in')
    await t.run(ctx => ctx.db.insert('raindropConnections', { ownerKey: identity.tokenIdentifier, userId: identity.subject, accountName: 'Owner', state: 'connected', encryptedAccess: secret }))
    const other = t.withIdentity({ ...identity, tokenIdentifier: 'https://other.test|raindrop-owner' })
    expect((await other.query(api.raindrop.status, {})).state).toBe('disconnected')
    await other.mutation(api.raindrop.disconnect, {})
    expect((await t.withIdentity(identity).query(api.raindrop.status, {})).state).toBe('connected')
  })

  test('binds one-use OAuth state to the owner and invalidates completion on disconnect', async () => {
    const t = convexTest(schema, modules)
    const sessionId = await t.mutation(internal.raindrop.createSession, { ownerKey: identity.tokenIdentifier, userId: identity.subject, stateHash: 'state' })
    await expect(t.mutation(internal.raindrop.claimSession, { ownerKey: 'other', stateHash: 'state' })).rejects.toThrow('expired')
    await t.mutation(internal.raindrop.claimSession, { ownerKey: identity.tokenIdentifier, stateHash: 'state' })
    await expect(t.mutation(internal.raindrop.claimSession, { ownerKey: identity.tokenIdentifier, stateHash: 'state' })).rejects.toThrow('expired')
    await t.withIdentity(identity).mutation(api.raindrop.disconnect, {})
    await expect(t.mutation(internal.raindrop.storeConnection, { sessionId, accountName: 'Owner', encryptedAccess: secret })).rejects.toThrow('cancelled')
  })

  test('imports idempotently, updates remote changes, and stops stale workers after disconnect', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity)
    const connectionId = await t.run(ctx => ctx.db.insert('raindropConnections', { ownerKey: identity.tokenIdentifier, userId: identity.subject, accountName: 'Owner', state: 'connected', encryptedAccess: secret }))
    await t.mutation(internal.raindrop.beginSync, { connectionId, run: 'first' })
    await t.mutation(internal.raindrop.syncPage, { connectionId, run: 'first', items: [item, item], done: true })
    let bookmarks = await t.run(ctx => ctx.db.query('bookmarks').collect())
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]).toMatchObject({ title: item.title, labels: item.tags, note: item.note })
    await t.mutation(internal.raindrop.beginSync, { connectionId, run: 'second' })
    await t.mutation(internal.raindrop.syncPage, { connectionId, run: 'second', items: [{ ...item, title: 'Updated research', updatedAt: 'later' }], done: true })
    bookmarks = await t.run(ctx => ctx.db.query('bookmarks').collect())
    expect(bookmarks[0]?.title).toBe('Updated research')
    await t.mutation(internal.raindrop.beginSync, { connectionId, run: 'third' })
    await owner.mutation(api.raindrop.disconnect, {})
    expect(await t.mutation(internal.raindrop.syncPage, { connectionId, run: 'third', items: [{ ...item, id: 101, url: 'https://example.com/new' }], done: true })).toBe(false)
    expect(await t.run(ctx => ctx.db.query('bookmarks').collect())).toHaveLength(1)
  })

  test('preserves existing Mind notes and does not re-create bookmarks deleted from Mind', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity)
    const bookmark = await owner.mutation(api.bookmarks.add, { url: item.url, note: 'My own note' })
    const connectionId = await t.run(ctx => ctx.db.insert('raindropConnections', { ownerKey: identity.tokenIdentifier, userId: identity.subject, accountName: 'Owner', state: 'connected', encryptedAccess: secret }))
    await t.mutation(internal.raindrop.beginSync, { connectionId, run: 'one' })
    await t.mutation(internal.raindrop.syncPage, { connectionId, run: 'one', items: [item], done: true })
    expect((await owner.query(api.bookmarks.get, { bookmarkId: bookmark._id }))?.note).toBe('My own note')
    await owner.mutation(api.bookmarks.remove, { bookmarkId: bookmark._id })
    await t.mutation(internal.raindrop.beginSync, { connectionId, run: 'two' })
    await t.mutation(internal.raindrop.syncPage, { connectionId, run: 'two', items: [{ ...item, updatedAt: 'later' }], done: true })
    expect(await t.run(ctx => ctx.db.query('bookmarks').collect())).toEqual([])
  })

  test('allows only one token refresh and rejects stale credential writes', async () => {
    const t = convexTest(schema, modules)
    const connectionId = await t.run(ctx => ctx.db.insert('raindropConnections', { ownerKey: identity.tokenIdentifier, userId: identity.subject, accountName: 'Owner', state: 'connected', encryptedAccess: secret, expiresAt: 1 }))
    expect(await t.mutation(internal.raindrop.claimRefresh, { connectionId, claim: 'first' })).toBe('claimed')
    await expect(t.mutation(internal.raindrop.claimRefresh, { connectionId, claim: 'second' })).rejects.toThrow('refreshing')
    await t.withIdentity(identity).mutation(api.raindrop.disconnect, {})
    await expect(t.mutation(internal.raindrop.finishRefresh, { connectionId, claim: 'first', encryptedAccess: secret, encryptedRefresh: secret, expiresAt: Date.now() + 100000 })).rejects.toThrow('changed')
  })
})

test('parses Raindrop data and rejects unsafe links and invalid ids', () => {
  const wire = { _id: 1, link: 'https://example.com', title: 'Example', collection: { $id: -1 }, tags: ['read'], lastUpdate: 'today' }
  expect(parseItem(wire)).toMatchObject({ id: 1, collectionId: -1, tags: ['read'], updatedAt: 'today' })
  expect(() => parseItem({ ...wire, _id: 1.5 })).toThrow()
  expect(() => safeUrl('javascript:alert(1)')).toThrow()
  expect(() => safeUrl('https://user:password@example.com')).toThrow()
})

test('uses bearer auth and reports rate limiting without leaking provider responses', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('private error details', { status: 429 }))
  vi.stubGlobal('fetch', fetch)
  await expect(request('test-only-token', 'raindrops/0')).rejects.toThrow('Try again in a minute')
  expect(fetch).toHaveBeenCalledWith('https://api.raindrop.io/rest/v1/raindrops/0', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-only-token' }) }))
})
