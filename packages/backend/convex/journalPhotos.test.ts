import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const moment = { localDate: '2026-09-08', timeZone: 'UTC', occurredAt: Date.parse('2026-09-08T12:00:00Z') }
const ownerIdentity = { subject: 'user_photoowner', tokenIdentifier: 'issuer|user_photoowner' }
const attackerIdentity = { subject: 'user_photoattacker', tokenIdentifier: 'issuer|user_photoattacker' }

test('only the authenticated owner can upload bytes into an entry and remove the resulting file', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(ownerIdentity)
  const attacker = t.withIdentity(attackerIdentity)
  const entry = await owner.mutation(api.journalEntries.createDraft, moment)
  const path = `/journal/photo?entryId=${entry.id}&fileName=test.png`
  const request = { method: 'POST', headers: { 'content-type': 'image/png' }, body: new Uint8Array([137, 80, 78, 71]) }
  expect((await t.fetch(path, request)).status).toBe(401)
  expect((await attacker.fetch(path, request)).status).toBe(403)
  const uploaded = await owner.fetch(path, request)
  expect(uploaded.status).toBe(200)
  const photos = await owner.query(api.journalEntries.listPhotos, { entryId: entry.id })
  expect(photos).toHaveLength(1)
  const attachment = await t.run(ctx => ctx.db.get(photos[0]!.id))
  expect(attachment?.uploadVerified).toBe(true)
  await expect(attacker.mutation(api.journalEntries.removePhoto, { attachmentId: photos[0]!.id })).rejects.toThrow(/not found/)
  await owner.mutation(api.journalEntries.removePhoto, { attachmentId: photos[0]!.id })
  expect(await t.run(ctx => ctx.storage.get(attachment!.storageId))).toBeNull()
})

test('legacy unverified attachments cannot delete a foreign storage object', async () => {
  const t = convexTest(schema, modules)
  const attacker = t.withIdentity(attackerIdentity)
  const entry = await attacker.mutation(api.journalEntries.createDraft, moment)
  const { attachmentId, victimStorageId } = await t.run(async ctx => {
    const victimStorageId = await ctx.storage.store(new Blob(['victim-file']))
    const attachmentId = await ctx.db.insert('journalAttachments', { ownerKey: attackerIdentity.tokenIdentifier, userId: attackerIdentity.subject, entryId: entry.id, kind: 'photo', mimeType: 'image/png', storageId: victimStorageId, createdAt: Date.now() })
    return { attachmentId, victimStorageId }
  })
  await attacker.mutation(api.journalEntries.removePhoto, { attachmentId })
  expect(await t.run(async ctx => (await ctx.storage.get(victimStorageId)) !== null)).toBe(true)
  const reviews = await t.run(ctx => ctx.db.query('journalStorageReviews').collect())
  expect(reviews).toHaveLength(1)
  expect(reviews[0]?.storageId).toBe(victimStorageId)
  expect(reviews[0]?.ownerKey).toBe(attackerIdentity.tokenIdentifier)
  const response = await attacker.fetch(`/journal/photo?entryId=${entry.id}&storageId=${victimStorageId}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: 'new-owned-bytes' })
  expect(response.status).toBe(200)
  await attacker.mutation(api.journalEntries.remove, { entryId: entry.id })
  expect(await t.run(async ctx => (await ctx.storage.get(victimStorageId)) !== null)).toBe(true)
})

test('an oversized upload is rejected without storing a file', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(ownerIdentity)
  const entry = await owner.mutation(api.journalEntries.createDraft, moment)
  const response = await owner.fetch(`/journal/photo?entryId=${entry.id}`, { method: 'POST', headers: { 'content-type': 'image/png', 'content-length': '1' }, body: new Uint8Array(10 * 1024 * 1024 + 1) })
  expect(response.status).toBe(413)
  expect(await t.run(ctx => ctx.db.system.query('_storage').collect())).toEqual([])
})
