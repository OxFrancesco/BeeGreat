import type { FunctionReturnType } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

describe('Mind bookmarks', () => {
  test('adds idempotently by normalized URL and scopes every operation', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('user_mind_owner'))
    const other = t.withIdentity(identity('user_mind_other'))

    const first = await owner.mutation(api.bookmarks.add, {
      url: 'https://example.com/guide?utm_source=bee',
      note: 'Read this',
    })
    const duplicate = await owner.mutation(api.bookmarks.add, {
      url: 'https://EXAMPLE.com/guide',
    })

    expect(duplicate._id).toBe(first._id)
    expect(first).toMatchObject({
      status: 'pending',
      kind: 'website',
      note: 'Read this',
      retryCount: 0,
    })
    expect(
      await other.query(api.bookmarks.get, { bookmarkId: first._id }),
    ).toBeNull()
    await expect(
      other.mutation(api.bookmarks.update, {
        bookmarkId: first._id,
        title: 'Stolen',
      }),
    ).rejects.toThrow('Bookmark not found')
  })

  test('updates search fields, aggregates labels, deletes, and enforces retry state', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('user_mind_editor'))
    const added = await owner.mutation(api.bookmarks.add, {
      url: 'https://example.com/convex',
    })
    const updated = await owner.mutation(api.bookmarks.update, {
      bookmarkId: added._id,
      title: 'Convex patterns',
      labels: ['Convex', 'TypeScript', 'convex'],
      note: 'Useful indexing notes',
    })
    expect(updated.labels).toEqual(['convex', 'typescript'])
    expect(updated.searchText).toContain('Convex patterns')
    expect(await owner.query(api.bookmarks.labels, {})).toEqual([
      { label: 'convex', count: 1 },
      { label: 'typescript', count: 1 },
    ])
    await expect(
      owner.mutation(api.bookmarks.retry, { bookmarkId: added._id }),
    ).rejects.toThrow('Only failed bookmarks')

    await owner.mutation(api.bookmarks.remove, { bookmarkId: added._id })
    expect(
      await owner.query(api.bookmarks.get, { bookmarkId: added._id }),
    ).toBeNull()
  })
})

test('atomic label changes compose and reject another owner', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(identity('label_owner'))
  const other = t.withIdentity(identity('label_other'))
  const bookmark = await owner.mutation(api.bookmarks.add, { url: 'https://example.com/labels' })
  await owner.mutation(api.bookmarks.update, { bookmarkId: bookmark._id, labels: ['a', 'b', 'c'] })
  await owner.mutation(api.bookmarks.changeLabel, { bookmarkId: bookmark._id, label: 'a', operation: 'remove' })
  const result = await owner.mutation(api.bookmarks.changeLabel, { bookmarkId: bookmark._id, label: 'b', operation: 'remove' })
  expect(result.labels).toEqual(['c'])
  await expect(other.mutation(api.bookmarks.changeLabel, { bookmarkId: bookmark._id, label: 'c', operation: 'remove' })).rejects.toThrow('Bookmark not found')
})

test('label search can continue beyond the first page without crossing owners', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(identity('search_owner'))
  const other = t.withIdentity(identity('search_other'))
  for (let i = 0; i < 30; i++) {
    const bookmark = await owner.mutation(api.bookmarks.add, { url: `https://example.com/search/${i}` })
    await owner.mutation(api.bookmarks.update, { bookmarkId: bookmark._id, title: 'Needle', labels: i === 29 ? ['chosen'] : [] })
  }
  const foreign = await other.mutation(api.bookmarks.add, { url: 'https://example.com/foreign' })
  await other.mutation(api.bookmarks.update, { bookmarkId: foreign._id, title: 'Needle', labels: ['chosen'] })
  let cursor: string | null = null
  const found: string[] = []
  let pages = 0
  do {
    const page: FunctionReturnType<typeof api.bookmarks.searchPage> = await owner.query(api.bookmarks.searchPage, { query: 'Needle', label: 'chosen', paginationOpts: { numItems: 24, cursor } })
    found.push(...page.page.map((item) => item._id))
    pages++
    if (page.isDone) break
    cursor = page.continueCursor
  } while (pages < 5)
  expect(pages).toBe(2)
  expect(found).toHaveLength(1)
  expect(found).not.toContain(foreign._id)
})
