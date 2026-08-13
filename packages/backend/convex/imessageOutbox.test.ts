import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const userId = 'user_imessage_outbox'
const ownerKey = `https://issuer.example.test|${userId}`
const address = '+393331234567'

async function terminalIMessageAction() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const connectionId = await ctx.db.insert('imessageConnections', {
      userId,
      address,
      addressKind: 'phone',
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
      summary: 'Claim the selected pool fees',
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
        summary: 'Claim the selected pool fees',
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
