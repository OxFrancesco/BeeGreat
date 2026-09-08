import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import { deliverBeennectorForId } from './beennectorDispatch'
import schema from './schema'
import { modules } from './test.setup'

const message = { kind: 'signal' as const, type: 'github.issue', body: 'Original event', attributes: { url: 'https://github.com/example/repo/issues/1' } }
async function seed(t: ReturnType<typeof convexTest>) {
  const connectionId = await t.run(ctx => ctx.db.insert('beennectorCredentials', { userId: 'user_delivery', provider: 'github', status: 'connected', scopes: [], externalAccountId: 'actor', updatedAt: Date.now() }))
  await t.mutation(internal.beennectors.claimDelivery, { provider: 'github', actorId: 'actor', deliveryId: 'event-1', message })
  const row = await t.run(ctx => ctx.db.query('beennectorDeliveries').first())
  return { id: row!._id, connectionId }
}
function context(t: ReturnType<typeof convexTest>, available = true) {
  return { runMutation: t.mutation, runAction: async () => available ? { status: 'available', subscription: { active: true } } : { status: 'unavailable' } } as unknown as ActionCtx
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08T20:00:00Z'))
  vi.stubEnv('AGENT_URL', 'https://agent.example.test'); vi.stubEnv('AGENT_CREDENTIAL_BROKER_SECRET', 'test-broker')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

test('an acknowledged provider event saves the immutable payload before dispatch', async () => {
  const t = convexTest(schema, modules); const { id } = await seed(t)
  expect(await t.mutation(internal.beennectors.claimDelivery, { provider: 'github', actorId: 'actor', deliveryId: 'event-1', message: { ...message, body: 'Changed duplicate' } })).toEqual({ status: 'duplicate' })
  expect(await t.run(ctx => ctx.db.get('beennectorDeliveries', id))).toMatchObject({ state: 'queued', message, attempts: 0 })
})

test('lost admission response retries the same payload and key then saves the admission receipt', async () => {
  const t = convexTest(schema, modules); const { id } = await seed(t)
  const admissions = new Map<string, string>(); const requests: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body); requests.push(body)
    admissions.set(body.deliveryKey, 'submission-one')
    if (requests.length === 1) throw new Error('response lost after admission')
    return Response.json({ submissionId: admissions.get(body.deliveryKey) })
  }))
  await deliverBeennectorForId(context(t), id)
  expect((await t.run(ctx => ctx.db.get('beennectorDeliveries', id)))?.state).toBe('queued')
  vi.setSystemTime(Date.now() + 10_001)
  await deliverBeennectorForId(context(t), id)
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]); expect(admissions.size).toBe(1)
  expect(await t.run(ctx => ctx.db.get('beennectorDeliveries', id))).toMatchObject({ state: 'delivered', submissionId: 'submission-one', attempts: 2 })
  await deliverBeennectorForId(context(t), id); expect(requests).toHaveLength(2)
})

test('subscription outages retain delivery and disconnect cancels it before admission', async () => {
  const t = convexTest(schema, modules); const { id, connectionId } = await seed(t)
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await deliverBeennectorForId(context(t, false), id)
  expect((await t.run(ctx => ctx.db.get('beennectorDeliveries', id)))?.state).toBe('queued'); expect(fetcher).not.toHaveBeenCalled()
  await t.run(ctx => ctx.db.delete(connectionId)); vi.setSystemTime(Date.now() + 10_001)
  await deliverBeennectorForId(context(t), id)
  expect((await t.run(ctx => ctx.db.get('beennectorDeliveries', id)))?.state).toBe('cancelled'); expect(fetcher).not.toHaveBeenCalled()
})

test('watchdog recovers an expired lease and rejects stale completion', async () => {
  const t = convexTest(schema, modules); const { id } = await seed(t)
  expect(await t.mutation(internal.beennectorDispatch.claim, { id, leaseId: 'old' })).not.toBeNull()
  expect(await t.mutation(internal.beennectorDispatch.claim, { id, leaseId: 'overlap' })).toBeNull()
  vi.setSystemTime(Date.now() + 120_001)
  await t.mutation(internal.beennectorDispatch.watchdog, {})
  vi.setSystemTime(Date.now() + 1_001)
  expect(await t.mutation(internal.beennectorDispatch.claim, { id, leaseId: 'new' })).not.toBeNull()
  await t.mutation(internal.beennectorDispatch.finish, { id, leaseId: 'old', submissionId: 'stale' })
  expect((await t.run(ctx => ctx.db.get('beennectorDeliveries', id)))?.state).toBe('processing')
  await t.mutation(internal.beennectorDispatch.finish, { id, leaseId: 'new', submissionId: 'accepted' })
  expect(await t.run(ctx => ctx.db.get('beennectorDeliveries', id))).toMatchObject({ state: 'delivered', submissionId: 'accepted' })
})
