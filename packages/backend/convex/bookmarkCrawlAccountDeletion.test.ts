import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'
import { modules } from './test.setup'

const ACTIVATION_TOKEN = 'crawl-cache-deletion-capability-00000001'

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

async function insertBookmark(
  t: ReturnType<typeof convexTest>,
  input: {
    ownerKey: string
    userId: string
    url: string
    normalizedUrl: string
    kind: 'website' | 'tweet'
    meta?: { tweetId: string }
  },
) {
  return t.run((ctx) => {
    const now = Date.now()
    return ctx.db.insert('bookmarks', {
      ...input,
      status: 'pending',
      labels: [],
      searchText: '',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  }) as Promise<Id<'bookmarks'>>
}

async function cacheReady(
  t: ReturnType<typeof convexTest>,
  bookmarkId: Id<'bookmarks'>,
) {
  const plan = await t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId })
  if (plan.state !== 'acquired') throw new Error('Expected crawl lease')
  await t.mutation(internal.bookmarkCrawl.finish, {
    runId: plan.runId,
    outcome: {
      state: 'ready',
      scraped: { content: `Source ${bookmarkId}` },
      summary: { labels: [] },
    },
  })
}

async function finishDeletion(t: ReturnType<typeof convexTest>) {
  await (
    t.finishAllScheduledFunctions as unknown as (
      advanceTimers: () => void,
      maxIterations: number,
    ) => Promise<void>
  )(vi.runAllTimers, 1_000)
}

test('account erasure purges private crawl data and preserves public sources', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-20T09:00:00.000Z'))
  try {
    const t = convexTest(schema, modules)
    const subject = 'crawl_deletion_owner'
    const ownerKey = `https://issuer.example.test|${subject}`
    const otherSubject = 'crawl_deletion_other'
    const otherOwnerKey = `https://issuer.example.test|${otherSubject}`
    const owner = t.withIdentity(identity(subject))

    const privateBookmarkId = await insertBookmark(t, {
      ownerKey,
      userId: subject,
      url: 'https://example.com/private?token=owner',
      normalizedUrl: 'https://example.com/private?token=owner',
      kind: 'website',
    })
    const publicBookmarkId = await insertBookmark(t, {
      ownerKey,
      userId: subject,
      url: 'https://x.com/bee/status/11223344',
      normalizedUrl: 'https://x.com/i/status/11223344',
      kind: 'tweet',
      meta: { tweetId: '11223344' },
    })
    const otherBookmarkId = await insertBookmark(t, {
      ownerKey: otherOwnerKey,
      userId: otherSubject,
      url: 'https://example.com/other-private',
      normalizedUrl: 'https://example.com/other-private',
      kind: 'website',
    })

    await cacheReady(t, privateBookmarkId)
    await cacheReady(t, publicBookmarkId)
    await cacheReady(t, otherBookmarkId)

    const prepared = await owner.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    })
    await t.mutation(api.accountDeletion.activate, {
      jobId: prepared.jobId,
      activationToken: ACTIVATION_TOKEN,
    })
    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      bookmarks: await ctx.db.query('bookmarks').collect(),
      cache: await ctx.db.query('bookmarkCrawlCache').collect(),
      runs: await ctx.db.query('bookmarkCrawlRuns').collect(),
    }))
    expect(remaining.bookmarks.map((bookmark) => bookmark.ownerKey)).toEqual([
      otherOwnerKey,
    ])
    expect(remaining.runs).toEqual([])
    expect(remaining.cache).toHaveLength(2)
    expect(
      remaining.cache.some(
        (entry) => entry.kind === 'website' && entry.ownerKey === ownerKey,
      ),
    ).toBe(false)
    expect(
      remaining.cache.some(
        (entry) => entry.kind === 'website' && entry.ownerKey === otherOwnerKey,
      ),
    ).toBe(true)
    const publicEntry = remaining.cache.find((entry) => entry.kind === 'public')
    expect(publicEntry).toBeDefined()
    expect(publicEntry).not.toHaveProperty('ownerKey')
  } finally {
    vi.useRealTimers()
  }
})

test('account erasure cancels a waiting crawl without resurrecting work', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-20T10:00:00.000Z'))
  try {
    const t = convexTest(schema, modules)
    const leaderSubject = 'crawl_deletion_leader'
    const leaderOwnerKey = `https://issuer.example.test|${leaderSubject}`
    const deletingSubject = 'crawl_deletion_waiter'
    const deletingOwnerKey = `https://issuer.example.test|${deletingSubject}`
    const deletingOwner = t.withIdentity(identity(deletingSubject))
    const leaderId = await insertBookmark(t, {
      ownerKey: leaderOwnerKey,
      userId: leaderSubject,
      url: 'https://x.com/bee/status/55667788',
      normalizedUrl: 'https://x.com/i/status/55667788',
      kind: 'tweet',
      meta: { tweetId: '55667788' },
    })
    const waiterId = await insertBookmark(t, {
      ownerKey: deletingOwnerKey,
      userId: deletingSubject,
      url: 'https://twitter.com/other/status/55667788',
      normalizedUrl: 'https://x.com/i/status/55667788',
      kind: 'tweet',
      meta: { tweetId: '55667788' },
    })
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId: leaderId }),
    ).resolves.toMatchObject({ state: 'acquired' })
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId: waiterId }),
    ).resolves.toEqual({ state: 'deferred' })

    const prepared = await deletingOwner.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    })
    await t.mutation(api.accountDeletion.activate, {
      jobId: prepared.jobId,
      activationToken: ACTIVATION_TOKEN,
    })
    await t.run((ctx) =>
      ctx.db.patch('accountDeletionJobs', prepared.jobId, {
        status: 'purging',
        stageIndex: 23,
        updatedAt: Date.now(),
      }),
    )
    await t.mutation(internal.accountDeletion.process, {
      jobId: prepared.jobId,
    })

    expect(
      await t.run((ctx) =>
        ctx.db
          .query('bookmarkCrawlRuns')
          .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', waiterId))
          .unique(),
      ),
    ).toBeNull()
    expect(
      await t.run((ctx) => ctx.db.get('bookmarks', waiterId)),
    ).toMatchObject({
      status: 'processing',
    })
    const scheduledScrapes = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (scheduled) =>
          scheduled.name === 'scraper:process' &&
          scheduled.state.kind === 'pending',
      ),
    )
    expect(scheduledScrapes).toEqual([])

    await t.run((ctx) =>
      ctx.db.patch('bookmarks', waiterId, {
        status: 'pending',
        updatedAt: Date.now(),
      }),
    )
    await expect(
      t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId: waiterId }),
    ).resolves.toEqual({ state: 'noop' })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('bookmarkCrawlRuns')
          .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', waiterId))
          .unique(),
      ),
    ).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('active deletion revokes provider work before external I/O starts', async () => {
  const t = convexTest(schema, modules)
  const subject = 'crawl_deletion_provider_guard'
  const ownerKey = `https://issuer.example.test|${subject}`
  const owner = t.withIdentity(identity(subject))
  const bookmarkId = await insertBookmark(t, {
    ownerKey,
    userId: subject,
    url: 'https://example.com/private-provider-request?owner=secret',
    normalizedUrl: 'https://example.com/private-provider-request?owner=secret',
    kind: 'website',
  })
  const plan = await t.mutation(internal.bookmarkCrawl.prepare, { bookmarkId })
  if (plan.state !== 'acquired') throw new Error('Expected crawl lease')
  await expect(
    t.query(internal.bookmarkCrawl.isRunCurrent, { runId: plan.runId }),
  ).resolves.toBe(true)

  const prepared = await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken: ACTIVATION_TOKEN,
  })
  await t.mutation(api.accountDeletion.activate, {
    jobId: prepared.jobId,
    activationToken: ACTIVATION_TOKEN,
  })

  await expect(
    t.query(internal.bookmarkCrawl.isRunCurrent, { runId: plan.runId }),
  ).resolves.toBe(false)
})
