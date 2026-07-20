import type { Doc } from './_generated/dataModel'
import type { CachedScrape, CrawlRequest } from './bookmarkCrawlValidators'
import {
  detectBookmarkKind,
  MAX_CRAWL_CONTENT_BYTES,
  MAX_META_TEXT_BYTES,
  MAX_TITLE_BYTES,
  MAX_URL_BYTES,
  truncateContent,
} from './scraperShared'

export type CrawlScope =
  { kind: 'owner'; ownerKey: string } | { kind: 'public' }

export function assertNever(value: never): never {
  throw new Error(`Unexpected crawl variant: ${JSON.stringify(value)}`)
}

function boundedOptional(value: string | undefined, maxBytes: number) {
  if (!value) return undefined
  return truncateContent(value.trim(), maxBytes) || undefined
}

export function sanitizeCrawlResult(scraped: CachedScrape): CachedScrape {
  const meta = scraped.meta
    ? {
        siteName: boundedOptional(scraped.meta.siteName, MAX_META_TEXT_BYTES),
        author: boundedOptional(scraped.meta.author, MAX_META_TEXT_BYTES),
        handle: boundedOptional(scraped.meta.handle, MAX_META_TEXT_BYTES),
        imageUrl: boundedOptional(scraped.meta.imageUrl, MAX_URL_BYTES),
        faviconUrl: boundedOptional(scraped.meta.faviconUrl, MAX_URL_BYTES),
        publishedAt: scraped.meta.publishedAt,
        tweetId: boundedOptional(scraped.meta.tweetId, MAX_META_TEXT_BYTES),
        videoId: boundedOptional(scraped.meta.videoId, MAX_META_TEXT_BYTES),
        durationSeconds: scraped.meta.durationSeconds,
      }
    : undefined
  return {
    title: boundedOptional(scraped.title, MAX_TITLE_BYTES),
    content: truncateContent(scraped.content, MAX_CRAWL_CONTENT_BYTES),
    meta,
    transcriptSource: scraped.transcriptSource,
  }
}

export function crawlRequestFor(bookmark: Doc<'bookmarks'>): CrawlRequest {
  switch (bookmark.kind) {
    case 'website':
      return { kind: 'website', recipe: 'website-v1', url: bookmark.url }
    case 'tweet': {
      const detected = detectBookmarkKind(bookmark.url)
      const tweetId =
        bookmark.meta?.tweetId ??
        (detected.kind === 'tweet' ? detected.tweetId : undefined)
      if (!tweetId) throw new Error('Tweet bookmark is missing its source id')
      return { kind: 'tweet', recipe: 'tweet-v1', tweetId }
    }
    case 'youtube': {
      const detected = detectBookmarkKind(bookmark.url)
      const videoId =
        bookmark.meta?.videoId ??
        (detected.kind === 'youtube' ? detected.videoId : undefined)
      if (!videoId) throw new Error('YouTube bookmark is missing its source id')
      return { kind: 'youtube', recipe: 'youtube-v1', videoId }
    }
    default:
      return assertNever(bookmark.kind)
  }
}

export function crawlScopeFor(
  request: CrawlRequest,
  ownerKey: string,
): CrawlScope {
  switch (request.kind) {
    case 'website':
      return { kind: 'owner' as const, ownerKey }
    case 'tweet':
    case 'youtube':
      return { kind: 'public' as const }
    default:
      return assertNever(request)
  }
}

export function sameCrawlRequest(left: CrawlRequest, right: CrawlRequest) {
  return JSON.stringify(left) === JSON.stringify(right)
}
