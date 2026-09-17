import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const userId = 'user_imessage_outbox'
const ownerKey = `https://issuer.example.test|${userId}`
const address = 'outbox-fixture@example.test'

afterEach(() => { vi.useRealTimers() })

async function terminalIMessageAction() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const connectionId = await ctx.db.insert('imessageConnections', {
      userId,
      address,
      addressKind: 'email',
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    })
    const threadId = 42
    await ctx.db.insert('chatThreads', {
      ownerKey,
      userId,
      threadId,
      source: 'imessage',
      imessageConnectionId: connectionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const actionId = await ctx.db.insert('web3Actions', {
      userId,
      conversationId: `${userId}~${threadId}`,
      summary: 'Non-financial delivery fixture',
      payload: {
        kind: 'execute_plan',
        chainId: 8453,
        transactions: [],
      },
      status: 'executed',
      createdAt: Date.now() - 1_000,
      expiresAt: Date.now() + 1_000,
      settledAt: Date.now(),
    })
    return { actionId }
  })
  return { t, ...ids }
}

describe('iMessage terminal delivery outbox', () => {
  test('enqueues once and leases the linked sender address', async () => {
    const { t, actionId } = await terminalIMessageAction()

    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    const claimed = await t.mutation(internal.imessageOutbox.claimNext, {
      leaseId: 'bridge-lease-1',
    })

    expect(claimed).toMatchObject({
      address,
      leaseId: 'bridge-lease-1',
      action: {
        summary: 'Non-financial delivery fixture',
        status: 'executed',
      },
    })
    await t.mutation(internal.imessageOutbox.complete, {
      deliveryId: claimed!.deliveryId,
      leaseId: claimed!.leaseId,
    })
    await expect(
      t.mutation(internal.imessageOutbox.claimNext, {
        leaseId: 'bridge-lease-2',
      }),
    ).resolves.toBeNull()
    const rows = await t.run(
      async (ctx) => await ctx.db.query('imessageDeliveries').collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'delivered', attempts: 1 })
  })

  test('does not enqueue terminal actions from non-iMessage threads', async () => {
    const { t, actionId } = await terminalIMessageAction()
    await t.run(async (ctx) => {
      const thread = await ctx.db
        .query('chatThreads')
        .withIndex('by_user_id_and_thread_id', (q) =>
          q.eq('userId', userId).eq('threadId', 42),
        )
        .unique()
      await ctx.db.patch(thread!._id, { source: undefined })
    })
    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    await expect(
      t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'none' }),
    ).resolves.toBeNull()
  })
})


describe('outbox recovery and competing bridges', () => {
  test('empty queue stays empty without creating lease records', async () => {
    const t = convexTest(schema, modules)
    expect(await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'empty' })).toBeNull()
    expect(await t.run(ctx => ctx.db.query('imessageDeliveries').collect())).toEqual([])
  })

  test('two competing bridges cannot both claim the same delivery', async () => {
    const { t, actionId } = await terminalIMessageAction()
    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    const results = await Promise.all(['a', 'b'].map(leaseId =>
      t.mutation(internal.imessageOutbox.claimNext, { leaseId }),
    ))
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  test('restart reclaims expired lease and rejects stale completion and retry', async () => {
    vi.useFakeTimers()
    const { t, actionId } = await terminalIMessageAction()
    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    const first = await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'crashed' })
    expect(first).not.toBeNull()
    expect(await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'early' })).toBeNull()
    vi.setSystemTime(Date.now() + 30_001)
    const recovered = await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'restarted' })
    expect(recovered?.deliveryId).toBe(first?.deliveryId)
    await t.mutation(internal.imessageOutbox.complete, { deliveryId: first!.deliveryId, leaseId: 'crashed' })
    await t.mutation(internal.imessageOutbox.retry, { deliveryId: first!.deliveryId, leaseId: 'crashed' })
    expect(await t.run(ctx => ctx.db.get(first!.deliveryId))).toMatchObject({ status: 'leased', leaseId: 'restarted' })
    await t.mutation(internal.imessageOutbox.complete, { deliveryId: recovered!.deliveryId, leaseId: 'restarted' })
    expect(await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'later' })).toBeNull()
  })

  test('failed delivery waits for retry deadline and retains ordering by due time', async () => {
    vi.useFakeTimers()
    const { t, actionId } = await terminalIMessageAction()
    await t.mutation(internal.imessageOutbox.enqueueAction, { actionId })
    const first = await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'first' })
    await t.mutation(internal.imessageOutbox.retry, { deliveryId: first!.deliveryId, leaseId: 'first' })
    expect(await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'too-early' })).toBeNull()
    const secondId = await t.run(async ctx => {
      const row = await ctx.db.get(first!.deliveryId)
      const { _id, _creationTime, ...rest } = row!
      return ctx.db.insert('imessageDeliveries', { ...rest, summary: 'Second fixture', nextAttemptAt: Date.now() })
    })
    const second = await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'second' })
    expect(second?.deliveryId).toBe(secondId)
    vi.setSystemTime(Date.now() + 2_000)
    const retried = await t.mutation(internal.imessageOutbox.claimNext, { leaseId: 'retry' })
    expect(retried?.deliveryId).toBe(first?.deliveryId)
    expect(await t.run(ctx => ctx.db.get(first!.deliveryId))).toMatchObject({ attempts: 1 })
  })
})
