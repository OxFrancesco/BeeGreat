import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  bookmarkKindValidator,
  bookmarkListItemValidator,
  bookmarkValidator,
} from './bookmarkValidators'
import { forgetBookmarkCrawlData } from './bookmarkCrawl'
import {
  BookmarkUrlError,
  buildSearchText,
  completeBookmarkUrl,
  detectBookmarkKind,
  MAX_TITLE_BYTES,
  MAX_URL_BYTES,
  normalizeBookmarkUrl,
  normalizeLabels,
  normalizeNote,
  truncateContent,
} from './scraperShared'

const MAX_LABEL_SCAN = 500

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
  let completedUrl: string
  let normalizedUrl: string
  let detected: ReturnType<typeof detectBookmarkKind>
  try {
    completedUrl = completeBookmarkUrl(input.url)
    normalizedUrl = normalizeBookmarkUrl(completedUrl)
    detected = detectBookmarkKind(completedUrl)
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
    url: completedUrl,
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

export async function updateBookmarkForOwner(
  ctx: MutationCtx,
  input: {
    ownerKey: string
    bookmarkId: Id<'bookmarks'>
    title?: string
    labels?: string[]
    note?: string
  },
) {
  const bookmark = await ownedBookmark(ctx, input.ownerKey, input.bookmarkId)
  const title =
    input.title === undefined
      ? bookmark.title
      : truncateContent(input.title.trim(), MAX_TITLE_BYTES) || undefined
  const labels =
    input.labels === undefined ? bookmark.labels : normalizeLabels(input.labels)
  const note =
    input.note === undefined ? bookmark.note : normalizeNote(input.note)
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
}

export async function removeBookmarkForOwner(
  ctx: MutationCtx,
  input: { ownerKey: string; bookmarkId: Id<'bookmarks'> },
) {
  const bookmark = await ownedBookmark(ctx, input.ownerKey, input.bookmarkId)
  await forgetBookmarkCrawlData(ctx, bookmark)
  await ctx.db.delete('bookmarks', bookmark._id)
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
        const scoped = q
          .search('searchText', searchQuery)
          .eq('ownerKey', ownerKey)
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
      .withIndex('by_owner_key_and_created_at', (q) =>
        q.eq('ownerKey', ownerKey),
      )
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
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      )
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
    return await updateBookmarkForOwner(ctx, { ownerKey, ...args })
  },
})

export const remove = mutation({
  args: { bookmarkId: v.id('bookmarks') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    await removeBookmarkForOwner(ctx, { ownerKey, ...args })
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
