import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  assertNever,
  crawlRequestFor,
  crawlScopeFor,
  sameCrawlRequest,
  sanitizeCrawlResult,
} from './bookmarkCrawlDomain'
import {
  finishOutcomeValidator,
  prepareResultValidator,
  type CachedScrape,
  type CrawlRequest,
  type FinishOutcome,
  type PrepareResult,
} from './bookmarkCrawlValidators'
import {
  buildSearchText,
  MAX_CONTENT_BYTES,
  MAX_SUMMARY_BYTES,
  MAX_TITLE_BYTES,
  normalizeLabels,
  truncateContent,
} from './scraperShared'

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000
const RUN_LEASE_MS = 10 * 60 * 1_000
const WAITER_BATCH_SIZE = 50
const CLEANUP_BATCH_SIZE = 100
const WATCHDOG_BATCH_SIZE = 50
const STALLED_BOOKMARK_MS = 15 * 60 * 1_000

type CrawlIdentity =
  | {
      cacheKey: string
      kind: 'website'
      ownerKey: string
      request: Extract<CrawlRequest, { kind: 'website' }>
    }
  | {
      cacheKey: string
      kind: 'public'
      request: Exclude<CrawlRequest, { kind: 'website' }>
    }

type ReadyOutcome = Extract<FinishOutcome, { state: 'ready' }>
type FailedOutcome = Extract<FinishOutcome, { state: 'failed' }>
type RunRetirementReason =
  'lease-expired' | 'bookmark-revoked' | 'owner-deleted' | 'state-invalidated'

async function sha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function identityFor(bookmark: Doc<'bookmarks'>): Promise<CrawlIdentity> {
  const request = crawlRequestFor(bookmark)
  const scope = crawlScopeFor(request, bookmark.ownerKey)
  const cacheKey = await sha256(JSON.stringify({ scope, request }))
  switch (request.kind) {
    case 'website':
      return {
        cacheKey,
        kind: 'website',
        ownerKey: bookmark.ownerKey,
        request,
      }
    case 'tweet':
    case 'youtube':
      return { cacheKey, kind: 'public', request }
    default:
      return assertNever(request)
  }
}

function cacheMatchesIdentity(
  cache: Doc<'bookmarkCrawlCache'>,
  identity: CrawlIdentity,
) {
  if (cache.kind === 'website') {
    return (
      identity.kind === 'website' &&
      cache.ownerKey === identity.ownerKey &&
      sameCrawlRequest(cache.request, identity.request)
    )
  }
  return (
    identity.kind === 'public' &&
    sameCrawlRequest(cache.request, identity.request)
  )
}

async function scheduleRecovery(
  ctx: MutationCtx,
  runId: Id<'bookmarkCrawlRuns'>,
  deadlineAt: number,
) {
  await ctx.scheduler.runAt(deadlineAt, internal.bookmarkCrawl.recoverRun, {
    runId,
  })
}

async function scheduleWaiterDrain(
  ctx: MutationCtx,
  cacheKey: string,
  excludedOwnerKey?: string,
) {
  await ctx.scheduler.runAfter(0, internal.bookmarkCrawl.resumeWaiters, {
    cacheKey,
    excludedOwnerKey,
  })
}

async function scheduleWaiterPromotion(
  ctx: MutationCtx,
  cacheKey: string,
  excludedOwnerKey?: string,
) {
  await ctx.scheduler.runAfter(0, internal.bookmarkCrawl.promoteWaiter, {
    cacheKey,
    excludedOwnerKey,
  })
}

async function drainWaiters(
  ctx: MutationCtx,
  cacheKey: string,
  excludedOwnerKey?: string,
) {
  const waiters = await ctx.db
    .query('bookmarkCrawlRuns')
    .withIndex('by_cache_key_and_status', (q) =>
      q.eq('cacheKey', cacheKey).eq('status', 'waiting'),
    )
    .take(WAITER_BATCH_SIZE)

  for (const waiter of waiters) {
    const bookmark = await ctx.db.get('bookmarks', waiter.bookmarkId)
    if (
      waiter.ownerKey !== excludedOwnerKey &&
      bookmark?.status === 'processing' &&
      bookmark.ownerKey === waiter.ownerKey
    ) {
      await ctx.db.patch('bookmarks', bookmark._id, {
        status: 'pending',
        updatedAt: Date.now(),
      })
      await ctx.scheduler.runAfter(0, internal.scraper.process, {
        bookmarkId: bookmark._id,
      })
    }
    await ctx.db.delete('bookmarkCrawlRuns', waiter._id)
  }

  if (waiters.length === WAITER_BATCH_SIZE) {
    await scheduleWaiterDrain(ctx, cacheKey, excludedOwnerKey)
  }
}

async function promoteOneWaiter(
  ctx: MutationCtx,
  cacheKey: string,
  excludedOwnerKey?: string,
) {
  const waiters = await ctx.db
    .query('bookmarkCrawlRuns')
    .withIndex('by_cache_key_and_status', (q) =>
      q.eq('cacheKey', cacheKey).eq('status', 'waiting'),
    )
    .take(WAITER_BATCH_SIZE)

  for (const waiter of waiters) {
    const bookmark = await ctx.db.get('bookmarks', waiter.bookmarkId)
    await ctx.db.delete('bookmarkCrawlRuns', waiter._id)
    if (
      waiter.ownerKey === excludedOwnerKey ||
      bookmark?.status !== 'processing' ||
      bookmark.ownerKey !== waiter.ownerKey
    ) {
      continue
    }
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'pending',
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.scraper.process, {
      bookmarkId: bookmark._id,
    })
    return
  }

  if (waiters.length === WAITER_BATCH_SIZE) {
    await scheduleWaiterPromotion(ctx, cacheKey, excludedOwnerKey)
  }
}

async function releaseOwnedLease(
  ctx: MutationCtx,
  run: Doc<'bookmarkCrawlRuns'>,
) {
  if (run.status !== 'active' || run.mode !== 'acquired') return false
  const cache = await ctx.db
    .query('bookmarkCrawlCache')
    .withIndex('by_cache_key', (q) => q.eq('cacheKey', run.cacheKey))
    .unique()
  if (cache?.status !== 'processing' || cache.leaseRunId !== run._id) {
    return false
  }
  await ctx.db.delete('bookmarkCrawlCache', cache._id)
  return true
}

async function retireRun(
  ctx: MutationCtx,
  run: Doc<'bookmarkCrawlRuns'>,
  reason: RunRetirementReason,
) {
  if (run.status === 'waiting') {
    const bookmark = await ctx.db.get('bookmarks', run.bookmarkId)
    if (
      reason === 'lease-expired' &&
      bookmark?.status === 'processing' &&
      bookmark.ownerKey === run.ownerKey
    ) {
      await ctx.db.patch('bookmarks', bookmark._id, {
        status: 'pending',
        updatedAt: Date.now(),
      })
      await ctx.scheduler.runAfter(0, internal.scraper.process, {
        bookmarkId: bookmark._id,
      })
    }
    await ctx.db.delete('bookmarkCrawlRuns', run._id)
    return
  }

  const released = await releaseOwnedLease(ctx, run)
  const bookmark = await ctx.db.get('bookmarks', run.bookmarkId)
  if (
    reason === 'lease-expired' &&
    bookmark?.status === 'processing' &&
    bookmark.ownerKey === run.ownerKey
  ) {
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'failed',
      errorCode: 'processing-interrupted',
      errorMessage:
        'Bookmark processing did not finish before its lease expired',
      updatedAt: Date.now(),
    })
  }
  await ctx.db.delete('bookmarkCrawlRuns', run._id)
  if (released) {
    await scheduleWaiterPromotion(
      ctx,
      run.cacheKey,
      reason === 'owner-deleted' ? run.ownerKey : undefined,
    )
  }
}

async function ownerAllowsCrawl(ctx: Pick<QueryCtx, 'db'>, ownerKey: string) {
  const deletionJob = await ctx.db
    .query('accountDeletionJobs')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .unique()
  return !deletionJob || deletionJob.status === 'awaiting_identity_deletion'
}

async function repairWaitingRun(
  ctx: MutationCtx,
  run: Extract<Doc<'bookmarkCrawlRuns'>, { status: 'waiting' }>,
) {
  const cache = await ctx.db
    .query('bookmarkCrawlCache')
    .withIndex('by_cache_key', (q) => q.eq('cacheKey', run.cacheKey))
    .unique()
  if (cache?.status === 'ready') {
    await scheduleWaiterDrain(ctx, run.cacheKey)
    return
  }
  if (cache?.status === 'processing') {
    if (cache.expiresAt > Date.now()) {
      await ctx.db.patch('bookmarkCrawlRuns', run._id, {
        deadlineAt: cache.expiresAt,
        updatedAt: Date.now(),
      })
      return
    }
    const leader = await ctx.db.get('bookmarkCrawlRuns', cache.leaseRunId)
    if (leader) {
      await retireRun(ctx, leader, 'lease-expired')
    } else {
      await ctx.db.delete('bookmarkCrawlCache', cache._id)
      await scheduleWaiterPromotion(ctx, run.cacheKey)
    }
    return
  }
  await scheduleWaiterPromotion(ctx, run.cacheKey)
}

function processingCache(
  identity: CrawlIdentity,
  runId: Id<'bookmarkCrawlRuns'>,
  now: number,
) {
  const common = {
    cacheKey: identity.cacheKey,
    status: 'processing' as const,
    request: identity.request,
    leaseRunId: runId,
    expiresAt: now + RUN_LEASE_MS,
    updatedAt: now,
  }
  return identity.kind === 'website'
    ? {
        ...common,
        kind: 'website' as const,
        ownerKey: identity.ownerKey,
        request: identity.request,
      }
    : {
        ...common,
        kind: 'public' as const,
        request: identity.request,
      }
}

function readyCache(
  cache: Doc<'bookmarkCrawlCache'>,
  scraped: CachedScrape,
  now: number,
) {
  const common = {
    cacheKey: cache.cacheKey,
    status: 'ready' as const,
    request: cache.request,
    scraped,
    scrapedAt: now,
    expiresAt: now + CACHE_TTL_MS,
    updatedAt: now,
  }
  return cache.kind === 'website'
    ? {
        ...common,
        kind: 'website' as const,
        ownerKey: cache.ownerKey,
        request: cache.request,
      }
    : {
        ...common,
        kind: 'public' as const,
        request: cache.request,
      }
}

async function markReady(
  ctx: MutationCtx,
  bookmark: Doc<'bookmarks'>,
  outcome: ReadyOutcome,
  scraped: CachedScrape,
) {
  const title =
    bookmark.title ??
    (outcome.summary.title
      ? truncateContent(outcome.summary.title.trim(), MAX_TITLE_BYTES) ||
        undefined
      : undefined) ??
    scraped.title
  const labels =
    bookmark.labels.length > 0
      ? bookmark.labels
      : normalizeLabels(outcome.summary.labels)
  const summary = outcome.summary.summary
    ? truncateContent(outcome.summary.summary.trim(), MAX_SUMMARY_BYTES) ||
      undefined
    : undefined
  await ctx.db.patch('bookmarks', bookmark._id, {
    status: 'ready',
    title,
    summary,
    labels,
    content: truncateContent(scraped.content, MAX_CONTENT_BYTES),
    meta: scraped.meta,
    transcriptSource: scraped.transcriptSource,
    errorCode: outcome.summaryError?.code,
    errorMessage: outcome.summaryError
      ? truncateContent(outcome.summaryError.message, 2_000)
      : undefined,
    searchText: buildSearchText({
      title,
      labels,
      summary,
      content: truncateContent(scraped.content, MAX_CONTENT_BYTES),
    }),
    updatedAt: Date.now(),
  })
}

async function markFailed(
  ctx: MutationCtx,
  bookmark: Doc<'bookmarks'>,
  outcome: FailedOutcome,
) {
  await ctx.db.patch('bookmarks', bookmark._id, {
    status: 'failed',
    errorCode: truncateContent(outcome.errorCode.trim(), 200) || 'unknown',
    errorMessage: truncateContent(outcome.errorMessage, 2_000),
    updatedAt: Date.now(),
  })
}

export const prepare = internalMutation({
  args: { bookmarkId: v.id('bookmarks') },
  returns: prepareResultValidator,
  handler: async (ctx, args): Promise<PrepareResult> => {
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    if (!bookmark || bookmark.status !== 'pending') return { state: 'noop' }

    if (!(await ownerAllowsCrawl(ctx, bookmark.ownerKey))) {
      return { state: 'noop' }
    }

    const existingRun = await ctx.db
      .query('bookmarkCrawlRuns')
      .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', bookmark._id))
      .unique()
    if (existingRun) return { state: 'noop' }

    let identity: CrawlIdentity
    try {
      identity = await identityFor(bookmark)
    } catch (error) {
      await markFailed(ctx, bookmark, {
        state: 'failed',
        errorCode: 'invalid-source',
        errorMessage:
          error instanceof Error ? error.message : 'Bookmark source is invalid',
      })
      return { state: 'noop' }
    }

    const now = Date.now()
    let cache = await ctx.db
      .query('bookmarkCrawlCache')
      .withIndex('by_cache_key', (q) => q.eq('cacheKey', identity.cacheKey))
      .unique()
    if (cache && !cacheMatchesIdentity(cache, identity)) {
      throw new Error('Bookmark crawl cache identity collision')
    }

    if (cache && cache.expiresAt <= now) {
      if (cache.status === 'processing') {
        const expiredRun = await ctx.db.get(
          'bookmarkCrawlRuns',
          cache.leaseRunId,
        )
        if (expiredRun) {
          await retireRun(ctx, expiredRun, 'lease-expired')
        } else {
          await ctx.db.delete('bookmarkCrawlCache', cache._id)
          await scheduleWaiterPromotion(ctx, cache.cacheKey)
        }
      } else {
        await ctx.db.delete('bookmarkCrawlCache', cache._id)
      }
      cache = null
    }

    if (cache?.status === 'ready') {
      const deadlineAt = now + RUN_LEASE_MS
      const runId = await ctx.db.insert('bookmarkCrawlRuns', {
        status: 'active',
        mode: 'hit',
        bookmarkId: bookmark._id,
        ownerKey: bookmark.ownerKey,
        cacheKey: identity.cacheKey,
        deadlineAt,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch('bookmarks', bookmark._id, {
        status: 'processing',
        errorCode: undefined,
        errorMessage: undefined,
        updatedAt: now,
      })
      await scheduleRecovery(ctx, runId, deadlineAt)
      return {
        state: 'hit',
        runId,
        bookmark: { ...bookmark, status: 'processing', updatedAt: now },
        scraped: cache.scraped,
      }
    }

    if (cache?.status === 'processing') {
      const deadlineAt = cache.expiresAt
      await ctx.db.insert('bookmarkCrawlRuns', {
        status: 'waiting',
        mode: 'deferred',
        bookmarkId: bookmark._id,
        ownerKey: bookmark.ownerKey,
        cacheKey: identity.cacheKey,
        deadlineAt,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch('bookmarks', bookmark._id, {
        status: 'processing',
        errorCode: undefined,
        errorMessage: undefined,
        updatedAt: now,
      })
      return { state: 'deferred' }
    }

    const deadlineAt = now + RUN_LEASE_MS
    const runId = await ctx.db.insert('bookmarkCrawlRuns', {
      status: 'active',
      mode: 'acquired',
      bookmarkId: bookmark._id,
      ownerKey: bookmark.ownerKey,
      cacheKey: identity.cacheKey,
      deadlineAt,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert(
      'bookmarkCrawlCache',
      processingCache(identity, runId, now),
    )
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'processing',
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: now,
    })
    await scheduleRecovery(ctx, runId, deadlineAt)
    return {
      state: 'acquired',
      runId,
      bookmark: { ...bookmark, status: 'processing', updatedAt: now },
      request: identity.request,
    }
  },
})

export const isRunCurrent = internalQuery({
  args: { runId: v.id('bookmarkCrawlRuns') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('bookmarkCrawlRuns', args.runId)
    if (!run || run.status !== 'active' || run.deadlineAt <= Date.now()) {
      return false
    }
    const bookmark = await ctx.db.get('bookmarks', run.bookmarkId)
    if (
      !bookmark ||
      bookmark.status !== 'processing' ||
      bookmark.ownerKey !== run.ownerKey
    ) {
      return false
    }
    return ownerAllowsCrawl(ctx, run.ownerKey)
  },
})

export const finish = internalMutation({
  args: {
    runId: v.id('bookmarkCrawlRuns'),
    outcome: finishOutcomeValidator,
  },
  returns: v.union(v.literal('committed'), v.literal('stale')),
  handler: async (ctx, args): Promise<'committed' | 'stale'> => {
    const run = await ctx.db.get('bookmarkCrawlRuns', args.runId)
    if (!run || run.status !== 'active') return 'stale'
    if (run.deadlineAt <= Date.now()) {
      await retireRun(ctx, run, 'lease-expired')
      return 'stale'
    }

    const bookmark = await ctx.db.get('bookmarks', run.bookmarkId)
    if (
      !bookmark ||
      bookmark.status !== 'processing' ||
      bookmark.ownerKey !== run.ownerKey
    ) {
      await retireRun(ctx, run, 'state-invalidated')
      return 'stale'
    }

    if (args.outcome.state === 'failed') {
      const released = await releaseOwnedLease(ctx, run)
      await markFailed(ctx, bookmark, args.outcome)
      await ctx.db.delete('bookmarkCrawlRuns', run._id)
      if (released) await scheduleWaiterPromotion(ctx, run.cacheKey)
      return 'committed'
    }

    const scraped = sanitizeCrawlResult(args.outcome.scraped)
    if (run.mode === 'acquired') {
      const cache = await ctx.db
        .query('bookmarkCrawlCache')
        .withIndex('by_cache_key', (q) => q.eq('cacheKey', run.cacheKey))
        .unique()
      if (cache?.status !== 'processing' || cache.leaseRunId !== run._id) {
        throw new Error('Bookmark crawl lease was lost before settlement')
      }
      await ctx.db.replace(
        'bookmarkCrawlCache',
        cache._id,
        readyCache(cache, scraped, Date.now()),
      )
    }
    await markReady(ctx, bookmark, args.outcome, scraped)
    await ctx.db.delete('bookmarkCrawlRuns', run._id)
    if (run.mode === 'acquired') {
      await scheduleWaiterDrain(ctx, run.cacheKey)
    }
    return 'committed'
  },
})

export const resumeWaiters = internalMutation({
  args: {
    cacheKey: v.string(),
    excludedOwnerKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await drainWaiters(ctx, args.cacheKey, args.excludedOwnerKey)
    return null
  },
})

export const promoteWaiter = internalMutation({
  args: {
    cacheKey: v.string(),
    excludedOwnerKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await promoteOneWaiter(ctx, args.cacheKey, args.excludedOwnerKey)
    return null
  },
})

export const recoverRun = internalMutation({
  args: { runId: v.id('bookmarkCrawlRuns') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('bookmarkCrawlRuns', args.runId)
    if (!run) return null
    if (run.status === 'waiting') {
      await repairWaitingRun(ctx, run)
      return null
    }
    if (run.deadlineAt > Date.now()) {
      await scheduleRecovery(ctx, run._id, run.deadlineAt)
      return null
    }
    await retireRun(ctx, run, 'lease-expired')
    return null
  },
})

export const sweepExpiredCache = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('bookmarkCrawlCache')
      .withIndex('by_expires_at', (q) => q.lt('expiresAt', Date.now()))
      .take(CLEANUP_BATCH_SIZE)
    for (const cache of expired) {
      if (cache.status === 'processing') {
        const run = await ctx.db.get('bookmarkCrawlRuns', cache.leaseRunId)
        if (run) {
          await retireRun(ctx, run, 'lease-expired')
          continue
        }
        await scheduleWaiterPromotion(ctx, cache.cacheKey)
      }
      const current = await ctx.db.get('bookmarkCrawlCache', cache._id)
      if (current) await ctx.db.delete('bookmarkCrawlCache', cache._id)
    }
    if (expired.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.bookmarkCrawl.sweepExpiredCache,
        {},
      )
    }
    return null
  },
})

export const watchdog = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const [active, waiting] = await Promise.all([
      ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_status_and_deadline_at', (q) =>
          q.eq('status', 'active').lte('deadlineAt', now),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_status_and_deadline_at', (q) =>
          q.eq('status', 'waiting').lte('deadlineAt', now),
        )
        .take(WATCHDOG_BATCH_SIZE),
    ])
    for (const run of active) await retireRun(ctx, run, 'lease-expired')
    const repairedCacheKeys = new Set<string>()
    for (const run of waiting) {
      if (run.status !== 'waiting') continue
      if (repairedCacheKeys.has(run.cacheKey)) continue
      repairedCacheKeys.add(run.cacheKey)
      await repairWaitingRun(ctx, run)
    }

    const staleBefore = now - STALLED_BOOKMARK_MS
    const [pending, processing] = await Promise.all([
      ctx.db
        .query('bookmarks')
        .withIndex('by_status_and_updated_at', (q) =>
          q.eq('status', 'pending').lte('updatedAt', staleBefore),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('bookmarks')
        .withIndex('by_status_and_updated_at', (q) =>
          q.eq('status', 'processing').lte('updatedAt', staleBefore),
        )
        .take(WATCHDOG_BATCH_SIZE),
    ])
    for (const bookmark of pending) {
      const run = await ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', bookmark._id))
        .unique()
      if (run) continue
      await ctx.db.patch('bookmarks', bookmark._id, { updatedAt: now })
      await ctx.scheduler.runAfter(0, internal.scraper.process, {
        bookmarkId: bookmark._id,
      })
    }
    for (const bookmark of processing) {
      const run = await ctx.db
        .query('bookmarkCrawlRuns')
        .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', bookmark._id))
        .unique()
      if (run) continue
      await ctx.db.patch('bookmarks', bookmark._id, {
        status: 'pending',
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.scraper.process, {
        bookmarkId: bookmark._id,
      })
    }
    return null
  },
})

export async function forgetBookmarkCrawlData(
  ctx: MutationCtx,
  bookmark: Doc<'bookmarks'>,
) {
  const run = await ctx.db
    .query('bookmarkCrawlRuns')
    .withIndex('by_bookmark_id', (q) => q.eq('bookmarkId', bookmark._id))
    .unique()
  if (run) await retireRun(ctx, run, 'bookmark-revoked')

  if (bookmark.kind !== 'website') return
  const identity = await identityFor(bookmark)
  const cache = await ctx.db
    .query('bookmarkCrawlCache')
    .withIndex('by_cache_key', (q) => q.eq('cacheKey', identity.cacheKey))
    .unique()
  if (cache?.kind === 'website' && cache.ownerKey === bookmark.ownerKey) {
    await ctx.db.delete('bookmarkCrawlCache', cache._id)
  }
}

export async function removeOwnerCrawlRunsBatch(
  ctx: MutationCtx,
  ownerKey: string,
  limit: number,
) {
  const runs = await ctx.db
    .query('bookmarkCrawlRuns')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .take(limit)
  for (const run of runs) await retireRun(ctx, run, 'owner-deleted')
  return runs.length
}

export async function removeOwnerWebsiteCacheBatch(
  ctx: MutationCtx,
  ownerKey: string,
  limit: number,
) {
  const entries = await ctx.db
    .query('bookmarkCrawlCache')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .take(limit)
  for (const entry of entries) {
    await ctx.db.delete('bookmarkCrawlCache', entry._id)
  }
  return entries.length
}

export { sanitizeCrawlResult }
