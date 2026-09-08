import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const identity = { subject: 'user_offlinedrafts', tokenIdentifier: 'issuer|user_offlinedrafts' }
const draft = { sourceUserId: identity.subject, localDate: '2026-09-01', timeZone: 'Pacific/Kiritimati', body: 'Unsynced reflection', draftUpdatedAt: Date.parse('2026-09-08T23:00:00Z') }

test('offline import preserves the old local date and is atomic and idempotent across retries and deletion', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(identity)
  await Promise.all([owner.mutation(api.journalEntries.importOfflineDraft, draft), owner.mutation(api.journalEntries.importOfflineDraft, draft)])
  const entries = await owner.query(api.journalEntries.listDay, { localDate: draft.localDate })
  expect(entries).toHaveLength(1)
  expect(entries[0]?.body).toBe(draft.body)
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: draft.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(entries[0]!.occurredAt)
  expect(localDate).toBe(draft.localDate)
  await owner.mutation(api.journalEntries.remove, { entryId: entries[0]!.id })
  await owner.mutation(api.journalEntries.importOfflineDraft, draft)
  expect(await owner.query(api.journalEntries.listDay, { localDate: draft.localDate })).toEqual([])
  await owner.mutation(api.journalEntries.importOfflineDraft, { ...draft, body: 'A later edit' })
  expect(await owner.query(api.journalEntries.listDay, { localDate: draft.localDate })).toHaveLength(1)
})

test('a queued import cannot transfer an old account draft to the next signed-in account', async () => {
  const t = convexTest(schema, modules)
  const other = t.withIdentity({ subject: 'user_otherdrafts', tokenIdentifier: 'issuer|user_otherdrafts' })
  await expect(other.mutation(api.journalEntries.importOfflineDraft, draft)).rejects.toThrow(/owns these offline drafts/)
  expect(await t.run(ctx => ctx.db.query('journalEntries').collect())).toEqual([])
})
