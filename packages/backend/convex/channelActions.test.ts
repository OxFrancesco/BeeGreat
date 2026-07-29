import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { internal } from './_generated/api'
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
  test('uses the account-wide active conversation and creates a shared thread', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(internal.channelActions.getContext, owner),
    ).resolves.toMatchObject({ threadId: 0, activeHighlight: null })

    const thread = await t.mutation(
      internal.channelActions.createThread,
      owner,
    )
    expect(thread.threadId).toBe(Date.now())

    await expect(
      t.query(internal.channelActions.getContext, owner),
    ).resolves.toMatchObject({ threadId: Date.now() })
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

    const context = await t.query(
      internal.channelActions.getContext,
      owner,
    )
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
      t.query(internal.channelActions.getContext, owner),
    ).resolves.toMatchObject({ activeHighlight: null })
  })

  test('rejects an owner key that does not belong to the mapped Clerk user', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(internal.channelActions.getContext, {
        ownerKey: 'https://issuer.example.test|user_attacker',
        userId: owner.userId,
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
