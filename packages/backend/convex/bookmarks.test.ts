import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
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
    expect(await other.query(api.bookmarks.get, { bookmarkId: first._id })).toBeNull()
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
    expect(await owner.query(api.bookmarks.get, { bookmarkId: added._id })).toBeNull()
  })

  test('shares one canonical crawl across owners for 24 hours', async () => {
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('user_cache_first'))
    const secondOwner = t.withIdentity(identity('user_cache_second'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://example.com/cached?utm_source=first',
    })
    const second = await secondOwner.mutation(api.bookmarks.add, {
      url: 'https://EXAMPLE.com/cached?utm_medium=second',
    })

    await t.mutation(internal.bookmarks.markProcessing, {
      bookmarkId: first._id,
    })
    await t.mutation(internal.bookmarks.markProcessing, {
      bookmarkId: second._id,
    })

    await expect(
      t.mutation(internal.bookmarks.claimCrawlCache, {
        bookmarkId: first._id,
      }),
    ).resolves.toEqual({ state: 'acquired' })
    await expect(
      t.mutation(internal.bookmarks.claimCrawlCache, {
        bookmarkId: second._id,
      }),
    ).resolves.toMatchObject({ state: 'wait' })

    await t.mutation(internal.bookmarks.saveCrawlCache, {
      bookmarkId: first._id,
      normalizedUrl: first.normalizedUrl,
      title: 'Shared crawl',
      content: '# Cached once',
      meta: { siteName: 'Example' },
    })
    const cached = await t.run(async (ctx) =>
      ctx.db
        .query('bookmarkCrawlCache')
        .withIndex('by_normalized_url', (q) =>
          q.eq('normalizedUrl', first.normalizedUrl),
        )
        .unique(),
    )
    expect(cached).not.toBeNull()
    expect(cached!.expiresAt - cached!.scrapedAt!).toBe(24 * 60 * 60 * 1_000)

    await expect(
      t.mutation(internal.bookmarks.claimCrawlCache, {
        bookmarkId: second._id,
      }),
    ).resolves.toEqual({
      state: 'hit',
      scraped: {
        title: 'Shared crawl',
        content: '# Cached once',
        meta: { siteName: 'Example' },
        transcriptSource: undefined,
      },
    })
  })
})
