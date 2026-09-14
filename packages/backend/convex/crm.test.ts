import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const input = { name: 'Alex Rivera', context: 'Design friend', email: 'alex@example.com', phone: '', note: 'Ask about the exhibition', followUpOn: '2026-09-20', lastContactedOn: null }
const page = { paginationOpts: { numItems: 10, cursor: null }, view: 'all' as const }

test('CRM persists edits, clears dates, archives and restores across app and agent', async () => {
  const t = convexTest(schema, modules)
  const user = t.withIdentity({ subject: 'user_crm', tokenIdentifier: 'issuer|user_crm' })
  await t.run(ctx => ctx.db.insert('hives', { userId: 'user_crm', ownerKey: 'issuer|user_crm', honeyBalance: 0, honeycombScore: 0 }))
  const contactId = await user.mutation(api.crm.save, input)
  expect((await user.query(api.crm.list, { ...page, view: 'followups' })).page).toHaveLength(1)
  expect(await t.query(internal.agentCrm.list, { userId: 'user_crm', view: 'all', search: 'Alex' })).toMatchObject([{ _id: contactId, note: input.note }])
  await t.mutation(internal.agentCrm.save, { ...input, contactId, userId: 'user_crm', note: 'Exhibition on Friday', followUpOn: null })
  expect(await user.query(api.crm.get, { contactId })).toMatchObject({ note: 'Exhibition on Friday', followUpOn: null })
  expect((await user.query(api.crm.list, { ...page, view: 'followups' })).page).toHaveLength(0)
  await user.mutation(api.crm.archive, { contactId, archived: true })
  expect((await user.query(api.crm.list, page)).page).toHaveLength(0)
  expect((await user.query(api.crm.list, { ...page, view: 'archived' })).page).toHaveLength(1)
  await t.mutation(internal.agentCrm.archive, { userId: 'user_crm', contactId, archived: false })
  expect((await user.query(api.crm.list, page)).page).toHaveLength(1)
})

test('CRM rejects anonymous and cross-owner access, invalid names and calendar dates', async () => {
  const t = convexTest(schema, modules)
  const user = t.withIdentity({ subject: 'user_crm', tokenIdentifier: 'issuer|user_crm' })
  const stranger = t.withIdentity({ subject: 'other', tokenIdentifier: 'issuer|other' })
  const contactId = await user.mutation(api.crm.save, input)
  await expect(t.query(api.crm.list, page)).rejects.toThrow('Sign in')
  expect(await stranger.query(api.crm.get, { contactId })).toBeNull()
  expect(await user.query(api.crm.get, { contactId: 'malformed' })).toBeNull()
  expect((await stranger.query(api.crm.list, page)).page).toHaveLength(0)
  await expect(stranger.mutation(api.crm.save, { ...input, contactId })).rejects.toThrow('Contact not found')
  await expect(stranger.mutation(api.crm.archive, { contactId, archived: true })).rejects.toThrow('Contact not found')
  await t.run(ctx => ctx.db.insert('hives', { userId: 'other', ownerKey: 'issuer|other', honeyBalance: 0, honeycombScore: 0 }))
  await expect(t.mutation(internal.agentCrm.save, { ...input, contactId, userId: 'other' })).rejects.toThrow('Contact not found')
  await expect(user.mutation(api.crm.save, { ...input, name: '  ' })).rejects.toThrow('Enter a name')
  await expect(user.mutation(api.crm.save, { ...input, followUpOn: '2026-02-30' })).rejects.toThrow('valid date')
})
