import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

async function insertRawWebsite(
  t: ReturnType<typeof convexTest>,
  input: {
    ownerKey: string
    status: 'pending' | 'processing'
    url: string
    updatedAt: number
  },
) {
  return t.run((ctx) =>
    ctx.db.insert('bookmarks', {
      ownerKey: input.ownerKey,
      userId: input.ownerKey,
      url: input.url,
      normalizedUrl: input.url,
      kind: 'website',
      status: input.status,
      labels: [],
      searchText: '',
      retryCount: 0,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    }),
  )
}

const readyOutcome = {
  state: 'ready' as const,
  scraped: {
    title: 'Shared source',
    content: '# Crawled once',
    meta: { siteName: 'Example' },
  },
  summary: {
    title: 'Shared source summary',
    summary: 'A useful cached source.',
    labels: ['cache'],
  },
}

afterEach(() => {
  vi.useRealTimers()
})

describe('bookmark crawl coordination', () => {
  test('uses the exact website request and never shares it across owners', async () => {
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('private_cache_first'))
    const secondOwner = t.withIdentity(identity('private_cache_second'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://example.com/private?utm_source=first&edition=one#section',
    })
    const second = await secondOwner.mutation(api.bookmarks.add, {
      url: 'https://example.com/private?utm_source=second&edition=one#other',
    })

    expect(first.normalizedUrl).toBe(second.normalizedUrl)

    const firstPlan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: first._id,
    })
    const secondPlan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: second._id,
    })

    expect(firstPlan).toMatchObject({
      state: 'acquired',
      request: {
        kind: 'website',
        recipe: 'website-v1',
        url: 'https://example.com/private?utm_source=first&edition=one#section',
      },
    })
    expect(secondPlan).toMatchObject({
      state: 'acquired',
      request: {
        kind: 'website',
        recipe: 'website-v1',
        url: 'https://example.com/private?utm_source=second&edition=one#other',
      },
    })

    const cache = await t.run((ctx) =>
      ctx.db.query('bookmarkCrawlCache').collect(),
    )
    expect(cache).toHaveLength(2)
    expect(
      new Set(
        cache
          .filter((entry) => entry.kind === 'website')
          .map((entry) => entry.ownerKey),
      ),
    ).toEqual(new Set([first.ownerKey, second.ownerKey]))
  })

  test('coalesces public tweet crawls and wakes waiters without polling', async () => {
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('public_cache_first'))
    const secondOwner = t.withIdentity(identity('public_cache_second'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://x.com/bee/status/123456789?utm_source=first',
    })
    const second = await secondOwner.mutation(api.bookmarks.add, {
      url: 'https://twitter.com/other/status/123456789?ref_src=second',
    })

    const firstPlan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: first._id,
    })
    expect(firstPlan).toMatchObject({
      state: 'acquired',
      request: {
        kind: 'tweet',
        recipe: 'tweet-v1',
        tweetId: '123456789',
      },
    })
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, {
        bookmarkId: second._id,
      }),
    ).resolves.toEqual({ state: 'deferred' })
    const waitingRun = await t.run((ctx) =>
      ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', second._id))
        .unique(),
    )
    if (!waitingRun) throw new Error('Expected waiting run')

    if (firstPlan.state !== 'acquired') throw new Error('Expected crawl lease')
    await expect(
      t.mutation(internal.bookmarkCrawl.finish, {
        runId: firstPlan.runId,
        outcome: readyOutcome,
      }),
    ).resolves.toBe('committed')
    await t.mutation(internal.bookmarkCrawl.resumeWaiters, {
      cacheKey: waitingRun.cacheKey,
    })

    const waitingBookmark = await t.run((ctx) =>
      ctx.db.get('bookmarks', second._id),
    )
    expect(waitingBookmark?.status).toBe('pending')
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('bookmarkCrawlRuns')
          .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', second._id))
          .unique(),
      ),
    ).toBeNull()

    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, {
        bookmarkId: second._id,
      }),
    ).resolves.toMatchObject({
      state: 'hit',
      scraped: readyOutcome.scraped,
    })
  })

  test('revokes an in-flight private crawl when its bookmark is deleted', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('deleted_cache_owner'))
    const bookmark = await owner.mutation(api.bookmarks.add, {
      url: 'https://example.com/private-delete?secret=owner-only',
    })
    const plan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: bookmark._id,
    })
    if (plan.state !== 'acquired') throw new Error('Expected crawl lease')

    await owner.mutation(api.bookmarks.remove, { bookmarkId: bookmark._id })

    await expect(
      t.mutation(internal.bookmarkCrawl.finish, {
        runId: plan.runId,
        outcome: readyOutcome,
      }),
    ).resolves.toBe('stale')
    expect(
      await t.run((ctx) => ctx.db.query('bookmarkCrawlCache').collect()),
    ).toEqual([])
    expect(
      await t.run((ctx) => ctx.db.query('bookmarkCrawlRuns').collect()),
    ).toEqual([])
  })

  test('settles failures atomically and promotes exactly one waiter', async () => {
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('failed_cache_first'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://youtu.be/shared-video-id',
    })
    const waiters = await Promise.all(
      ['second', 'third', 'fourth'].map((suffix) =>
        t
          .withIdentity(identity(`failed_cache_${suffix}`))
          .mutation(api.bookmarks.add, {
            url: 'https://www.youtube.com/watch?v=shared-video-id&feature=share',
          }),
      ),
    )
    const firstPlan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: first._id,
    })
    if (firstPlan.state !== 'acquired') throw new Error('Expected crawl lease')
    for (const waiter of waiters) {
      await t.mutation(internal.bookmarkCrawl.prepare, {
        bookmarkId: waiter._id,
      })
    }
    const waitingRun = await t.run((ctx) =>
      ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_bookmark_id', (q) =>
          q.eq('bookmarkId', waiters[0]!._id),
        )
        .unique(),
    )
    if (!waitingRun) throw new Error('Expected waiting run')

    await expect(
      t.mutation(internal.bookmarkCrawl.finish, {
        runId: firstPlan.runId,
        outcome: {
          state: 'failed',
          errorCode: 'transcript-unavailable',
          errorMessage: 'No transcript was available',
        },
      }),
    ).resolves.toBe('committed')
    await t.mutation(internal.bookmarkCrawl.promoteWaiter, {
      cacheKey: waitingRun.cacheKey,
    })

    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', first._id)),
    ).toMatchObject({
      status: 'failed',
      errorCode: 'transcript-unavailable',
    })
    const waiterDocuments = await Promise.all(
      waiters.map((waiter) =>
        t.run((ctx) => ctx.db.get('bookmarks', waiter._id)),
      ),
    )
    expect(waiterDocuments.map((bookmark) => bookmark?.status).sort()).toEqual([
      'pending',
      'processing',
      'processing',
    ])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('bookmarkCrawlRuns')
          .withIndex('by_cache_key_and_status', (q) =>
            q.eq('cacheKey', waitingRun.cacheKey).eq('status', 'waiting'),
          )
          .collect(),
      ),
    ).toHaveLength(2)
    const promoted = waiterDocuments.find(
      (bookmark) => bookmark?.status === 'pending',
    )
    if (!promoted) throw new Error('Expected one promoted waiter')
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, {
        bookmarkId: promoted._id,
      }),
    ).resolves.toMatchObject({ state: 'acquired' })
  })

  test('lease recovery rejects late writes and unblocks waiters', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'))
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('recovery_first'))
    const secondOwner = t.withIdentity(identity('recovery_second'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://x.com/bee/status/987654321',
    })
    const second = await secondOwner.mutation(api.bookmarks.add, {
      url: 'https://twitter.com/bee/status/987654321',
    })
    const firstPlan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: first._id,
    })
    if (firstPlan.state !== 'acquired') throw new Error('Expected crawl lease')
    await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: second._id,
    })
    const waitingRun = await t.run((ctx) =>
      ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', second._id))
        .unique(),
    )
    if (!waitingRun) throw new Error('Expected waiting run')

    vi.setSystemTime(new Date('2026-07-20T12:11:00.000Z'))
    await t.mutation(internal.bookmarkCrawl.recoverRun, {
      runId: firstPlan.runId,
    })
    await t.mutation(internal.bookmarkCrawl.promoteWaiter, {
      cacheKey: waitingRun.cacheKey,
    })

    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', first._id)),
    ).toMatchObject({
      status: 'failed',
      errorCode: 'processing-interrupted',
    })
    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', second._id)),
    ).toMatchObject({
      status: 'pending',
    })
    await expect(
      t.mutation(internal.bookmarkCrawl.finish, {
        runId: firstPlan.runId,
        outcome: readyOutcome,
      }),
    ).resolves.toBe('stale')
  })

  test('watchdog requeues orphaned bookmarks without duplicating live work', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T14:00:00.000Z').getTime()
    vi.setSystemTime(now)
    const staleAt = now - 20 * 60 * 1_000
    const t = convexTest(schema, modules)
    const pendingId = await insertRawWebsite(t, {
      ownerKey: 'watchdog-pending',
      status: 'pending',
      url: 'https://example.com/watchdog-pending',
      updatedAt: staleAt,
    })
    const processingId = await insertRawWebsite(t, {
      ownerKey: 'watchdog-processing',
      status: 'processing',
      url: 'https://example.com/watchdog-processing',
      updatedAt: staleAt,
    })
    const liveId = await insertRawWebsite(t, {
      ownerKey: 'watchdog-live',
      status: 'pending',
      url: 'https://example.com/watchdog-live',
      updatedAt: staleAt,
    })
    await t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId: liveId })
    await t.run((ctx) =>
      ctx.db.patch('bookmarks', liveId, { updatedAt: staleAt }),
    )

    await t.mutation(internal.bookmarkCrawl.watchdog, {})

    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', pendingId)),
    ).toMatchObject({
      status: 'pending',
      updatedAt: now,
    })
    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', processingId)),
    ).toMatchObject({
      status: 'pending',
      updatedAt: now,
    })
    expect(await t.run((ctx) => ctx.db.get('bookmarks', liveId))).toMatchObject(
      {
        status: 'processing',
        updatedAt: staleAt,
      },
    )
    const scheduledScrapeCount = async () =>
      t.run(
        async (ctx) =>
          (await ctx.db.system.query('_scheduled_functions').collect()).filter(
            (scheduled) =>
              scheduled.name === 'scraper:process' &&
              scheduled.state.kind === 'pending',
          ).length,
      )
    expect(await scheduledScrapeCount()).toBe(2)

    await t.mutation(internal.bookmarkCrawl.watchdog, {})
    expect(await scheduledScrapeCount()).toBe(2)
  })

  test('keeps the full crawl budget in cache but bounds bookmark storage', async () => {
    const t = convexTest(schema, modules)
    const firstOwner = t.withIdentity(identity('large_cache_first'))
    const secondOwner = t.withIdentity(identity('large_cache_second'))
    const first = await firstOwner.mutation(api.bookmarks.add, {
      url: 'https://x.com/bee/status/77889900',
    })
    const second = await secondOwner.mutation(api.bookmarks.add, {
      url: 'https://twitter.com/bee/status/77889900',
    })
    const plan = await t.mutation(internal.bookmarkCrawl.prepare, {
      bookmarkId: first._id,
    })
    if (plan.state !== 'acquired') throw new Error('Expected crawl lease')
    const content = 'x'.repeat(80 * 1024)
    await t.mutation(internal.bookmarkCrawl.finish, {
      runId: plan.runId,
      outcome: {
        state: 'ready',
        scraped: { content },
        summary: { labels: [] },
      },
    })

    expect(
      (await t.run((ctx) => ctx.db.get('bookmarks', first._id)))?.content,
    ).toHaveLength(64 * 1024)
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, {
        bookmarkId: second._id,
      }),
    ).resolves.toMatchObject({
      state: 'hit',
      scraped: { content },
    })
  })

  test('schema rejects public ownership and partial lifecycle states', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('cache_schema_owner'))
    const bookmark = await owner.mutation(api.bookmarks.add, {
      url: 'https://x.com/bee/status/44556677',
    })
    const runId = await t.run((ctx) => {
      const now = Date.now()
      return ctx.db.insert('bookmarkCrawlRuns', {
        status: 'active',
        mode: 'acquired',
        bookmarkId: bookmark._id,
        ownerKey: bookmark.ownerKey,
        cacheKey: 'invalid-shape-test',
        deadlineAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      })
    })
    const common = {
      cacheKey: 'invalid-shape-test',
      status: 'processing' as const,
      kind: 'public' as const,
      request: {
        kind: 'tweet' as const,
        recipe: 'tweet-v1' as const,
        tweetId: '44556677',
      },
      leaseRunId: runId,
      expiresAt: Date.now() + 60_000,
      updatedAt: Date.now(),
    }

    // SAFETY: this document deliberately violates the bookmarkCrawlCache
    // schema (a `public` entry must not carry `ownerKey`); `never` bypasses
    // the compile-time document type so the runtime schema rejection under
    // test can be exercised.
    await expect(
      t.run((ctx) =>
        ctx.db.insert('bookmarkCrawlCache', {
          ...common,
          ownerKey: bookmark.ownerKey,
        } as never),
      ),
    ).rejects.toThrow()
    // SAFETY: this document deliberately violates the bookmarkCrawlCache
    // schema (a `processing` entry must not already have `scraped` content);
    // `never` bypasses the compile-time document type so the runtime schema
    // rejection under test can be exercised.
    await expect(
      t.run((ctx) =>
        ctx.db.insert('bookmarkCrawlCache', {
          ...common,
          scraped: { content: 'Impossible while processing' },
        } as never),
      ),
    ).rejects.toThrow()
  })
})
