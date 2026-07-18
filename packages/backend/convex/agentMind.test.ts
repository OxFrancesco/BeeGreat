import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

test('agent Mind CRUD is scoped through the user Hive', async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    await ctx.db.insert('hives', {
      ownerKey: 'issuer|user_agent_mind',
      userId: 'user_agent_mind',
      honeyBalance: 0,
      honeycombScore: 0,
    })
    await ctx.db.insert('hives', {
      ownerKey: 'issuer|user_agent_other',
      userId: 'user_agent_other',
      honeyBalance: 0,
      honeycombScore: 0,
    })
  })

  const saved = await t.mutation(internal.agentMind.saveBookmark, {
    userId: 'user_agent_mind',
    url: 'youtu.be/mind-video',
    note: 'Watch later',
  })
  expect(saved).toMatchObject({
    kind: 'youtube',
    status: 'pending',
    url: 'https://youtu.be/mind-video',
  })
  expect(
    await t.query(internal.agentMind.listBookmarks, {
      userId: 'user_agent_mind',
    }),
  ).toHaveLength(1)
  expect(
    await t.query(internal.agentMind.getBookmark, {
      userId: 'user_agent_other',
      bookmarkId: saved.id,
    }),
  ).toBeNull()

  await expect(
    t.mutation(internal.agentMind.updateBookmark, {
      userId: 'user_agent_other',
      bookmarkId: saved.id,
      title: 'Not theirs',
    }),
  ).rejects.toThrow('Bookmark not found')

  const updated = await t.mutation(internal.agentMind.updateBookmark, {
    userId: 'user_agent_mind',
    bookmarkId: saved.id,
    title: 'Mind video',
    labels: ['Research', 'Video'],
    note: '',
  })
  expect(updated).toMatchObject({
    id: saved.id,
    title: 'Mind video',
    labels: ['research', 'video'],
  })
  expect(updated.note).toBeUndefined()

  await expect(
    t.mutation(internal.agentMind.deleteBookmark, {
      userId: 'user_agent_other',
      bookmarkId: saved.id,
    }),
  ).rejects.toThrow('Bookmark not found')

  expect(
    await t.mutation(internal.agentMind.deleteBookmark, {
      userId: 'user_agent_mind',
      bookmarkId: saved.id,
    }),
  ).toEqual({ id: saved.id, deleted: true })
  expect(
    await t.query(internal.agentMind.listBookmarks, {
      userId: 'user_agent_mind',
    }),
  ).toEqual([])
})
