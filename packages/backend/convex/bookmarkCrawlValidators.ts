import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import {
  bookmarkMetaValidator,
  bookmarkValidator,
  transcriptSourceValidator,
} from './bookmarkValidators'

export const websiteCrawlRequestValidator = v.object({
  kind: v.literal('website'),
  recipe: v.literal('website-v1'),
  url: v.string(),
})

export const tweetCrawlRequestValidator = v.object({
  kind: v.literal('tweet'),
  recipe: v.literal('tweet-v1'),
  tweetId: v.string(),
})

export const youtubeCrawlRequestValidator = v.object({
  kind: v.literal('youtube'),
  recipe: v.literal('youtube-v1'),
  videoId: v.string(),
})

export const publicCrawlRequestValidator = v.union(
  tweetCrawlRequestValidator,
  youtubeCrawlRequestValidator,
)

export const crawlRequestValidator = v.union(
  websiteCrawlRequestValidator,
  tweetCrawlRequestValidator,
  youtubeCrawlRequestValidator,
)

export type CrawlRequest = Infer<typeof crawlRequestValidator>

export const cachedScrapeValidator = v.object({
  title: v.optional(v.string()),
  content: v.string(),
  meta: v.optional(bookmarkMetaValidator),
  transcriptSource: v.optional(transcriptSourceValidator),
})

export type CachedScrape = Infer<typeof cachedScrapeValidator>

const cacheTimesValidator = {
  cacheKey: v.string(),
  expiresAt: v.number(),
  updatedAt: v.number(),
}

export const bookmarkCrawlCacheValidator = v.union(
  v.object({
    ...cacheTimesValidator,
    status: v.literal('processing'),
    kind: v.literal('website'),
    ownerKey: v.string(),
    request: websiteCrawlRequestValidator,
    leaseRunId: v.id('bookmarkCrawlRuns'),
  }),
  v.object({
    ...cacheTimesValidator,
    status: v.literal('ready'),
    kind: v.literal('website'),
    ownerKey: v.string(),
    request: websiteCrawlRequestValidator,
    scraped: cachedScrapeValidator,
    scrapedAt: v.number(),
  }),
  v.object({
    ...cacheTimesValidator,
    status: v.literal('processing'),
    kind: v.literal('public'),
    request: publicCrawlRequestValidator,
    leaseRunId: v.id('bookmarkCrawlRuns'),
  }),
  v.object({
    ...cacheTimesValidator,
    status: v.literal('ready'),
    kind: v.literal('public'),
    request: publicCrawlRequestValidator,
    scraped: cachedScrapeValidator,
    scrapedAt: v.number(),
  }),
)

const runIdentityValidator = {
  bookmarkId: v.id('bookmarks'),
  ownerKey: v.string(),
  cacheKey: v.string(),
  deadlineAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}

export const bookmarkCrawlRunValidator = v.union(
  v.object({
    ...runIdentityValidator,
    status: v.literal('active'),
    mode: v.literal('acquired'),
  }),
  v.object({
    ...runIdentityValidator,
    status: v.literal('active'),
    mode: v.literal('hit'),
  }),
  v.object({
    ...runIdentityValidator,
    status: v.literal('waiting'),
    mode: v.literal('deferred'),
  }),
)

export const bookmarkSummaryValidator = v.object({
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  labels: v.array(v.string()),
})

export type BookmarkSummary = Infer<typeof bookmarkSummaryValidator>

export const finishOutcomeValidator = v.union(
  v.object({
    state: v.literal('ready'),
    scraped: cachedScrapeValidator,
    summary: bookmarkSummaryValidator,
    summaryError: v.optional(
      v.object({
        code: v.literal('summary-failed'),
        message: v.string(),
      }),
    ),
  }),
  v.object({
    state: v.literal('failed'),
    errorCode: v.string(),
    errorMessage: v.string(),
  }),
)

export type FinishOutcome = Infer<typeof finishOutcomeValidator>

export const prepareResultValidator = v.union(
  v.object({ state: v.literal('noop') }),
  v.object({ state: v.literal('deferred') }),
  v.object({
    state: v.literal('hit'),
    runId: v.id('bookmarkCrawlRuns'),
    bookmark: bookmarkValidator,
    scraped: cachedScrapeValidator,
  }),
  v.object({
    state: v.literal('acquired'),
    runId: v.id('bookmarkCrawlRuns'),
    bookmark: bookmarkValidator,
    request: crawlRequestValidator,
  }),
)

export type PrepareResult = Infer<typeof prepareResultValidator>
