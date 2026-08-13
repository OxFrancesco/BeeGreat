import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const owner = {
  ownerKey: 'https://issuer.example.test|user_imessage',
  userId: 'user_imessage',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-10-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('trusted channel actions', () => {
  test('registers a CLI conversation without replacing the app active thread', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity({
      subject: owner.userId,
      tokenIdentifier: owner.ownerKey,
    })

    const thread = await t.mutation(
      internal.channelActions.createCliThread,
      owner,
    )

    expect(thread.threadId).toBe(Date.now())
    await expect(app.query(api.chat.listThreads, {})).resolves.toEqual([
      expect.objectContaining({ id: thread.threadId }),
    ])
    await expect(app.query(api.chat.getActiveThread, {})).resolves.toBe(0)
  })

  test('registers a durable iMessage conversation without replacing the app active thread', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity({
      subject: owner.userId,
      tokenIdentifier: owner.ownerKey,
    })

    const first = await t.mutation(internal.channelActions.getContext, {
      ...owner,
      source: 'imessage',
    })
    expect(first).toMatchObject({
      threadId: Date.now(),
      activeHighlight: null,
    })
    await expect(
      t.mutation(internal.channelActions.getContext, {
        ...owner,
        source: 'imessage',
      }),
    ).resolves.toMatchObject({ threadId: first.threadId })
    await expect(app.query(api.chat.listThreads, {})).resolves.toEqual([
      expect.objectContaining({
        id: first.threadId,
        source: 'imessage',
      }),
    ])
    await expect(app.query(api.chat.getActiveThread, {})).resolves.toBe(0)

    const thread = await t.mutation(internal.channelActions.createThread, {
      ...owner,
      source: 'imessage',
    })
    expect(thread.threadId).toBe(Date.now() + 1)

    await expect(
      t.mutation(internal.channelActions.getContext, {
        ...owner,
        source: 'imessage',
      }),
    ).resolves.toMatchObject({ threadId: thread.threadId })
    await expect(app.query(api.chat.getActiveThread, {})).resolves.toBe(0)
  })

  test('binds the linked sender and mirrors its transcript into Convex', async () => {
    const t = convexTest(schema, modules)
    const sourceAddress = '+393331234567'
    const connectionId = await t.run(
      async (ctx) =>
        await ctx.db.insert('imessageConnections', {
          userId: owner.userId,
          address: sourceAddress,
          addressKind: 'phone',
          connectedAt: Date.now(),
          updatedAt: Date.now(),
        }),
    )
    const context = await t.mutation(internal.channelActions.getContext, {
      ...owner,
      source: 'imessage',
      sourceAddress,
    })
    await t.mutation(internal.channelActions.syncTranscript, {
      ...owner,
      threadId: context.threadId,
      messages: [
        {
          id: 'message-1',
          role: 'user',
          contentJson: JSON.stringify({ id: 'message-1', role: 'user' }),
          createdAt: Date.now(),
        },
      ],
    })

    const stored = await t.run(async (ctx) => {
      const thread = await ctx.db
        .query('chatThreads')
        .withIndex('by_owner_key_and_thread_id', (q) =>
          q.eq('ownerKey', owner.ownerKey).eq('threadId', context.threadId),
        )
        .unique()
      const messages = await ctx.db.query('chatMessages').collect()
      return { thread, messages }
    })
    expect(stored.thread?.imessageConnectionId).toBe(connectionId)
    expect(stored.messages).toHaveLength(1)
    expect(stored.messages[0].messageId).toBe('message-1')
  })

  test('confirms first focus and completes its Highlight through the same transactions as the app', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('userPreferences', {
        ...owner,
        timeZone: 'Europe/Rome',
        updatedAt: Date.now(),
      })
    })

    const confirmed = await t.mutation(
      internal.channelActions.confirmFirstFocus,
      {
        ...owner,
        requestId: 'imessage-first-focus',
        goalTitle: 'Launch BeeGreat',
        projectTitle: 'Messaging',
        taskTitle: 'Finish iMessage parity',
      },
    )
    expect(confirmed.status).toBe('created')
    expect(confirmed.highlightExpiresAt).toBe(
      Date.parse('2026-10-01T21:59:59.999Z'),
    )

    const context = await t.mutation(internal.channelActions.getContext, {
      ...owner,
      source: 'imessage',
    })
    expect(context.activeHighlight).toMatchObject({
      title: 'Finish iMessage parity',
    })

    const completion = await t.mutation(
      internal.channelActions.completeHighlight,
      {
        ...owner,
        requestId: `complete-highlight:${context.activeHighlight!.highlightId}`,
        taskId: context.activeHighlight!.taskId,
      },
    )
    expect(completion).toMatchObject({
      status: 'completed',
      honeyAwarded: 5,
      scoreAwarded: 1,
    })

    await expect(
      t.mutation(internal.channelActions.getContext, {
        ...owner,
        source: 'imessage',
      }),
    ).resolves.toMatchObject({ activeHighlight: null })
  })

  test('confirms and cancels action-bound Web3 requests for the mapped iMessage user', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner.userId,
        powerupId: 'web3',
        enabled: true,
      })
    })
    const first = await t.mutation(internal.web3Actions.create, {
      userId: owner.userId,
      summary: 'Swap 10 USDC for ETH on Base',
      payload: {
        kind: 'execute_plan',
        chainId: 8453,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000aa',
            data: '0x1234',
            value: '0',
          },
        ],
      },
    })

    await t.mutation(internal.channelActions.confirmWeb3, {
      ...owner,
      actionId: first.id,
      summary: 'Swap 10 USDC for ETH on Base',
    })
    await expect(
      t.run(async (ctx) => (await ctx.db.get(first.id))?.status),
    ).resolves.toBe('confirmed')

    const second = await t.mutation(internal.web3Actions.create, {
      userId: owner.userId,
      summary: 'Create a USDC/WETH volatile pool',
      payload: {
        kind: 'execute_plan',
        chainId: 8453,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000bb',
            data: '0x5678',
            value: '0',
          },
        ],
      },
    })
    await t.mutation(internal.channelActions.cancelWeb3, {
      ...owner,
      actionId: second.id,
      summary: 'Create a USDC/WETH volatile pool',
    })
    await expect(
      t.run(async (ctx) => (await ctx.db.get(second.id))?.status),
    ).resolves.toBe('cancelled')
  })

  test("cannot confirm another user's Web3 action through iMessage", async () => {
    const t = convexTest(schema, modules)
    const actionId = await t.run(
      async (ctx) =>
        await ctx.db.insert('web3Actions', {
          userId: 'user_someone_else',
          summary: 'Send 1 ETH',
          payload: {
            kind: 'send_tokens',
            recipient: '0x00000000000000000000000000000000000000aa',
            token: 'eth',
            amount: '1',
          },
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        }),
    )

    await expect(
      t.mutation(internal.channelActions.confirmWeb3, {
        ...owner,
        actionId,
        summary: 'Send 1 ETH',
      }),
    ).rejects.toThrow('no longer available')
  })

  test('rejects action substitution when the rendered summary does not match Convex', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner.userId,
        powerupId: 'web3',
        enabled: true,
      })
    })
    const action = await t.mutation(internal.web3Actions.create, {
      userId: owner.userId,
      summary: 'Send 1 USDC to 0x…00aa',
      payload: {
        kind: 'send_tokens',
        recipient: '0x00000000000000000000000000000000000000aa',
        token: 'usdc',
        amount: '1',
      },
    })

    await expect(
      t.mutation(internal.channelActions.confirmWeb3, {
        ...owner,
        actionId: action.id,
        summary: 'Send 0.01 USDC to 0x…00aa',
      }),
    ).rejects.toThrow('does not match')
    await expect(
      t.run(async (ctx) => (await ctx.db.get(action.id))?.status),
    ).resolves.toBe('pending')
  })

  test('rejects an owner key that does not belong to the mapped Clerk user', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(internal.channelActions.getContext, {
        ownerKey: 'https://issuer.example.test|user_attacker',
        userId: owner.userId,
        source: 'imessage',
      }),
    ).rejects.toThrow('Channel identity does not match')
  })

  test('uses the user local day across a daylight-saving transition', async () => {
    vi.setSystemTime(Date.parse('2026-10-25T10:00:00Z'))
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('userPreferences', {
        ...owner,
        timeZone: 'Europe/Rome',
        updatedAt: Date.now(),
      })
    })

    const confirmed = await t.mutation(
      internal.channelActions.confirmFirstFocus,
      {
        ...owner,
        requestId: 'dst-first-focus',
        goalTitle: 'Keep local time correct',
        projectTitle: 'DST transition',
        taskTitle: 'Finish today',
      },
    )

    expect(confirmed.highlightExpiresAt).toBe(
      Date.parse('2026-10-25T22:59:59.999Z'),
    )
  })
})
