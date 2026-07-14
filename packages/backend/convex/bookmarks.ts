import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  bookmarkKindValidator,
  bookmarkListItemValidator,
  bookmarkMetaValidator,
  bookmarkValidator,
  transcriptSourceValidator,
} from './bookmarkValidators'
import {
  BookmarkUrlError,
  buildSearchText,
  detectBookmarkKind,
  MAX_CONTENT_BYTES,
  normalizeBookmarkUrl,
  normalizeLabels,
  normalizeNote,
  truncateContent,
} from './scraperShared'

const MAX_LABEL_SCAN = 500
const MAX_URL_BYTES = 8 * 1024
const MAX_TITLE_BYTES = 4 * 1024
const MAX_SUMMARY_BYTES = 8 * 1024
const MAX_META_TEXT_BYTES = 2 * 1024

type AuthCtx = QueryCtx | MutationCtx

async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to use Mind',
    })
  }
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject }
}

function bookmarkNotFound(): never {
  throw new ConvexError({ code: 'NOT_FOUND', message: 'Bookmark not found' })
}

async function ownedBookmark(
  ctx: AuthCtx,
  ownerKey: string,
  bookmarkId: Id<'bookmarks'>,
) {
  const bookmark = await ctx.db.get('bookmarks', bookmarkId)
  if (!bookmark || bookmark.ownerKey !== ownerKey) bookmarkNotFound()
  return bookmark
}

export function bookmarkListItem(bookmark: Doc<'bookmarks'>) {
  return {
    _id: bookmark._id,
    _creationTime: bookmark._creationTime,
    url: bookmark.url,
    kind: bookmark.kind,
    status: bookmark.status,
    title: bookmark.title,
    summary: bookmark.summary,
    labels: bookmark.labels,
    note: bookmark.note,
    meta: bookmark.meta,
    transcriptSource: bookmark.transcriptSource,
    errorCode: bookmark.errorCode,
    errorMessage: bookmark.errorMessage,
    retryCount: bookmark.retryCount,
    createdAt: bookmark.createdAt,
    updatedAt: bookmark.updatedAt,
  }
}

export async function insertBookmarkForOwner(
  ctx: MutationCtx,
  input: { ownerKey: string; userId: string; url: string; note?: string },
) {
  if (new TextEncoder().encode(input.url).byteLength > MAX_URL_BYTES) {
    throw new ConvexError({
      code: 'INVALID_URL',
      message: 'Bookmark URL is too long',
    })
  }
  let normalizedUrl: string
  let detected: ReturnType<typeof detectBookmarkKind>
  try {
    normalizedUrl = normalizeBookmarkUrl(input.url)
    detected = detectBookmarkKind(input.url)
  } catch (error) {
    if (error instanceof BookmarkUrlError) {
      throw new ConvexError({ code: 'INVALID_URL', message: error.message })
    }
    throw error
  }

  const existing = await ctx.db
    .query('bookmarks')
    .withIndex('by_owner_key_and_normalized_url', (q) =>
      q.eq('ownerKey', input.ownerKey).eq('normalizedUrl', normalizedUrl),
    )
    .unique()
  if (existing) return existing

  const now = Date.now()
  const bookmarkId = await ctx.db.insert('bookmarks', {
    ownerKey: input.ownerKey,
    userId: input.userId,
    url: input.url.trim(),
    normalizedUrl,
    kind: detected.kind,
    status: 'pending',
    labels: [],
    note: normalizeNote(input.note),
    searchText: '',
    meta:
      detected.kind === 'tweet'
        ? { tweetId: detected.tweetId }
        : detected.kind === 'youtube'
          ? { videoId: detected.videoId }
          : undefined,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.scheduler.runAfter(0, internal.scraper.process, { bookmarkId })
  const bookmark = await ctx.db.get('bookmarks', bookmarkId)
  if (!bookmark) bookmarkNotFound()
  return bookmark
}

export const list = query({
  args: {
    kind: v.optional(bookmarkKindValidator),
    label: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(bookmarkListItemValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const result = args.kind
      ? await ctx.db
          .query('bookmarks')
          .withIndex('by_owner_key_and_kind_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey).eq('kind', args.kind!),
          )
          .order('desc')
          .paginate(args.paginationOpts)
      : await ctx.db
          .query('bookmarks')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .order('desc')
          .paginate(args.paginationOpts)
    const label = args.label?.trim().toLowerCase()
    return {
      ...result,
      page: result.page
        .filter((bookmark) => !label || bookmark.labels.includes(label))
        .map(bookmarkListItem),
    }
  },
})

export const search = query({
  args: { query: v.string(), kind: v.optional(bookmarkKindValidator) },
  returns: v.array(bookmarkListItemValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const searchQuery = args.query.trim().slice(0, 500)
    if (!searchQuery) return []
    const results = await ctx.db
      .query('bookmarks')
      .withSearchIndex('search_text', (q) => {
        const scoped = q.search('searchText', searchQuery).eq('ownerKey', ownerKey)
        return args.kind ? scoped.eq('kind', args.kind) : scoped
      })
      .take(24)
    return results.map(bookmarkListItem)
  },
})

export const get = query({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.union(v.null(), bookmarkValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    return bookmark?.ownerKey === ownerKey ? bookmark : null
  },
})

export const labels = query({
  args: {},
  returns: v.array(v.object({ label: v.string(), count: v.number() })),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    const bookmarks = await ctx.db
      .query('bookmarks')
      .withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))
      .order('desc')
      .take(MAX_LABEL_SCAN)
    const counts = new Map<string, number>()
    for (const bookmark of bookmarks) {
      for (const label of bookmark.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  },
})

export const add = mutation({
  args: { url: v.string(), note: v.optional(v.string()) },
  returns: bookmarkValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return await insertBookmarkForOwner(ctx, { ...identity, ...args })
  },
})

export const update = mutation({
  args: {
    bookmarkId: v.id('bookmarks'),
    title: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
  },
  returns: bookmarkValidator,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const bookmark = await ownedBookmark(ctx, ownerKey, args.bookmarkId)
    const title =
      args.title === undefined
        ? bookmark.title
        : truncateContent(args.title.trim(), MAX_TITLE_BYTES) || undefined
    const labels =
      args.labels === undefined ? bookmark.labels : normalizeLabels(args.labels)
    const note =
      args.note === undefined ? bookmark.note : normalizeNote(args.note)
    await ctx.db.patch('bookmarks', bookmark._id, {
      title,
      labels,
      note,
      searchText: buildSearchText({
        title,
        labels,
        summary: bookmark.summary,
        content: bookmark.content,
      }),
      updatedAt: Date.now(),
    })
    const updated = await ctx.db.get('bookmarks', bookmark._id)
    if (!updated) bookmarkNotFound()
    return updated
  },
})

export const remove = mutation({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const bookmark = await ownedBookmark(ctx, ownerKey, args.bookmarkId)
    await ctx.db.delete('bookmarks', bookmark._id)
    return null
  },
})

export const retry = mutation({
  args: { bookmarkId: v.id('bookmarks') },
  returns: bookmarkValidator,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const bookmark = await ownedBookmark(ctx, ownerKey, args.bookmarkId)
    if (bookmark.status !== 'failed') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: 'Only failed bookmarks can be retried',
      })
    }
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'pending',
      errorCode: undefined,
      errorMessage: undefined,
      retryCount: bookmark.retryCount + 1,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.scraper.process, {
      bookmarkId: bookmark._id,
    })
    const updated = await ctx.db.get('bookmarks', bookmark._id)
    if (!updated) bookmarkNotFound()
    return updated
  },
})

export const getForProcessing = internalQuery({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.union(v.null(), bookmarkValidator),
  handler: async (ctx, args) => {
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    return bookmark?.status === 'pending' ? bookmark : null
  },
})

export const markProcessing = internalMutation({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    if (!bookmark || bookmark.status !== 'pending') return false
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'processing',
      updatedAt: Date.now(),
    })
    return true
  },
})

export const saveScrape = internalMutation({
  args: {
    bookmarkId: v.id('bookmarks'),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    labels: v.array(v.string()),
    content: v.optional(v.string()),
    meta: v.optional(bookmarkMetaValidator),
    transcriptSource: v.optional(transcriptSourceValidator),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    if (!bookmark) return null
    const title =
      bookmark.title ??
      (args.title
        ? truncateContent(args.title.trim(), MAX_TITLE_BYTES) || undefined
        : undefined)
    const labels = bookmark.labels.length > 0 ? bookmark.labels : normalizeLabels(args.labels)
    const content = args.content
      ? truncateContent(args.content, MAX_CONTENT_BYTES)
      : undefined
    const summary = args.summary
      ? truncateContent(args.summary.trim(), MAX_SUMMARY_BYTES) || undefined
      : undefined
    const meta = args.meta
      ? {
          siteName: args.meta.siteName
            ? truncateContent(args.meta.siteName, MAX_META_TEXT_BYTES)
            : undefined,
          author: args.meta.author
            ? truncateContent(args.meta.author, MAX_META_TEXT_BYTES)
            : undefined,
          handle: args.meta.handle
            ? truncateContent(args.meta.handle, MAX_META_TEXT_BYTES)
            : undefined,
          imageUrl: args.meta.imageUrl
            ? truncateContent(args.meta.imageUrl, MAX_URL_BYTES)
            : undefined,
          faviconUrl: args.meta.faviconUrl
            ? truncateContent(args.meta.faviconUrl, MAX_URL_BYTES)
            : undefined,
          publishedAt: args.meta.publishedAt,
          tweetId: args.meta.tweetId,
          videoId: args.meta.videoId,
          durationSeconds: args.meta.durationSeconds,
        }
      : undefined
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'ready',
      title,
      summary,
      labels,
      content,
      meta,
      transcriptSource: args.transcriptSource,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      searchText: buildSearchText({ title, labels, summary, content }),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const markFailed = internalMutation({
  args: {
    bookmarkId: v.id('bookmarks'),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    if (!bookmark) return null
    await ctx.db.patch('bookmarks', bookmark._id, {
      status: 'failed',
      errorCode: args.errorCode,
      errorMessage: truncateContent(args.errorMessage, 2_000),
      updatedAt: Date.now(),
    })
    return null
  },
})
