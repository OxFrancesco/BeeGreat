import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const owner = 'user_usageowner'

test('concurrent callers share one account limit and independent accounts remain usable', async () => {
  const t = convexTest(schema, modules)
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'firecrawl', units: 1 })))
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(2)
  await expect(t.mutation(internal.paidUsage.reserve, { userId: 'user_other', operation: 'firecrawl', units: 1 })).resolves.toHaveProperty('leaseId')
})

test('release is owner scoped and never refunds consumed daily units', async () => {
  const t = convexTest(schema, modules)
  const first = await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })
  await t.mutation(internal.paidUsage.release, { userId: 'user_other', leaseId: first.leaseId })
  await expect(t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })).rejects.toThrow(/busy/)
  await t.mutation(internal.paidUsage.release, { userId: owner, leaseId: first.leaseId })
  const second = await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })
  await t.mutation(internal.paidUsage.release, { userId: owner, leaseId: second.leaseId })
  await expect(t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 1 })).rejects.toThrow(/daily limit/)
  expect(await t.run(ctx => ctx.db.query('paidUsage').withIndex('by_scope', q => q.eq('scope', 'global')).collect())).toMatchObject([{ units: 10 }])
})

test('realtime tickets are one-use, short-lived and tied to their reserved account', async () => {
  const t = convexTest(schema, modules)
  const ticketHash = 'a'.repeat(64)
  await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'voice_realtime', units: 1, ticketHash })
  const claims = await Promise.all([t.mutation(internal.paidUsage.claimVoiceTicket, { ticketHash }), t.mutation(internal.paidUsage.claimVoiceTicket, { ticketHash })])
  expect(claims.filter(Boolean)).toHaveLength(1)
  expect(claims.find(Boolean)).toMatchObject({ userId: owner })
  const expiredHash = 'b'.repeat(64)
  const lease = await t.mutation(internal.paidUsage.reserve, { userId: 'user_other', operation: 'voice_realtime', units: 1, ticketHash: expiredHash })
  await t.run(ctx => ctx.db.patch(lease.leaseId, { ticketExpiresAt: Date.now() - 1 }))
  expect(await t.mutation(internal.paidUsage.claimVoiceTicket, { ticketHash: expiredHash })).toBeNull()
})

test('the powerup toggle cannot grant shared Devin authority', async () => {
  const t = convexTest(schema, modules)
  const client = t.withIdentity({ subject: owner, tokenIdentifier: `issuer|${owner}` })
  vi.stubEnv('DEVIN_ALLOWED_USER_IDS', '')
  await expect(client.mutation(api.powerups.setEnabled, { powerupId: 'devin', enabled: true })).rejects.toThrow(/administrator/)
  vi.stubEnv('DEVIN_ALLOWED_USER_IDS', owner)
  await client.mutation(api.powerups.setEnabled, { powerupId: 'devin', enabled: true })
  expect(await t.query(internal.powerups.getEnabledIds, { userId: owner })).toEqual(['devin'])
  vi.stubEnv('DEVIN_ALLOWED_USER_IDS', '')
  expect(await t.query(internal.powerups.getEnabledIds, { userId: owner })).toEqual([])
  await client.mutation(api.powerups.setEnabled, { powerupId: 'devin', enabled: false })
  vi.unstubAllEnvs()
})

test('inspection keeps one durable poll chain and stale generations cannot claim it', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(internal.devinData.upsert, { userId: owner, session: { sessionId: 'devin-test', url: 'https://devin.example/test', status: 'running', pullRequests: [], createdAt: Date.now(), updatedAt: Date.now() } })
  const input = { userId: owner, sessionId: 'devin-test', active: true }
  await Promise.all(Array.from({ length: 5 }, () => t.mutation(internal.devinData.schedulePoll, input)))
  const first = await t.query(internal.devinData.getOwned, { userId: owner, sessionId: 'devin-test' })
  expect(await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(1)
  expect(await t.mutation(internal.devinData.claimPoll, { userId: owner, sessionId: 'devin-test', generation: first!.pollGeneration! - 1 })).toBe(false)
  expect(await t.mutation(internal.devinData.claimPoll, { userId: owner, sessionId: 'devin-test', generation: first!.pollGeneration! })).toBe(true)
  await t.mutation(internal.devinData.schedulePoll, input)
  expect((await t.query(internal.devinData.getOwned, { userId: owner, sessionId: 'devin-test' }))?.pollGeneration).toBe(first?.pollGeneration)
})

test('unused voice tickets free their slot after a minute and a claimed ticket retains it for five', async () => {
  const t = convexTest(schema, modules)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
  try {
    const abandoned = 'c'.repeat(64)
    await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'voice_realtime', units: 1, ticketHash: abandoned })
    clock.mockReturnValue(1_800_000_061_000)
    expect(await t.mutation(internal.paidUsage.claimVoiceTicket, { ticketHash: abandoned })).toBeNull()
    const active = 'd'.repeat(64)
    await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'voice_realtime', units: 1, ticketHash: active })
    const permit = await t.mutation(internal.paidUsage.claimVoiceTicket, { ticketHash: active })
    expect(permit?.expiresAt).toBe(Date.now() + 300_000)
    clock.mockReturnValue(1_800_000_122_000)
    await expect(t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'voice_realtime', units: 1, ticketHash: 'e'.repeat(64) })).rejects.toThrow(/busy/)
  } finally { clock.mockRestore() }
})

test('stopping Devin polling retains running work admission until observed terminal completion', async () => {
  const t = convexTest(schema, modules)
  const sessionId = 'running-disabled'
  const session = { sessionId, url: 'https://devin.example/test', status: 'running' as const, pullRequests: [], createdAt: Date.now(), updatedAt: Date.now() }
  const lease = await t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })
  await t.mutation(internal.devinData.upsert, { userId: owner, session })
  await t.mutation(internal.devinData.attachUsage, { userId: owner, sessionId, leaseId: lease.leaseId, safetyAcuLimit: 5 })
  await t.mutation(internal.devinData.schedulePoll, { userId: owner, sessionId, active: false })
  await expect(t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })).rejects.toThrow(/busy/)
  await t.mutation(internal.devinData.upsert, { userId: owner, session: { ...session, status: 'exit', updatedAt: Date.now() + 1 } })
  await t.mutation(internal.devinData.schedulePoll, { userId: owner, sessionId, active: false })
  await expect(t.mutation(internal.paidUsage.reserve, { userId: owner, operation: 'devin', units: 5 })).resolves.toHaveProperty('leaseId')
})

test('turning Web3 off revokes standing consent and consent can be revoked while it is disabled', async () => {
  const t = convexTest(schema, modules)
  const client = t.withIdentity({ subject: owner, tokenIdentifier: `issuer|${owner}` })
  await client.mutation(api.powerups.setEnabled, { powerupId: 'web3', enabled: true })
  await client.mutation(api.web3Prefs.setYolo, { enabled: true })
  await client.mutation(api.powerups.setEnabled, { powerupId: 'web3', enabled: false })
  expect(await client.query(api.web3Prefs.get, {})).toEqual({ yoloEnabled: false })
  await client.mutation(api.web3Prefs.setYolo, { enabled: false })
  await expect(client.mutation(api.web3Prefs.setYolo, { enabled: true })).rejects.toThrow(/not enabled/)
  await client.mutation(api.powerups.setEnabled, { powerupId: 'web3', enabled: true })
  expect(await client.query(api.web3Prefs.get, {})).toEqual({ yoloEnabled: false })
})

test('reactivating legacy disabled Web3 clears old consent before actions become available', async () => {
  const t = convexTest(schema, modules)
  const client = t.withIdentity({ subject: owner, tokenIdentifier: `issuer|${owner}` })
  await t.run(async ctx => {
    await ctx.db.insert('powerups', { userId: owner, powerupId: 'web3', enabled: false })
    await ctx.db.insert('web3Prefs', { userId: owner, yoloEnabled: true, updatedAt: Date.now() })
  })
  await client.mutation(api.powerups.setEnabled, { powerupId: 'web3', enabled: true })
  expect(await client.query(api.web3Prefs.get, {})).toEqual({ yoloEnabled: false })
  await client.mutation(api.web3Prefs.setYolo, { enabled: true })
  await client.mutation(api.powerups.setEnabled, { powerupId: 'web3', enabled: true })
  expect(await client.query(api.web3Prefs.get, {})).toEqual({ yoloEnabled: true })
})
