import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  bookmarkKindValidator,
  bookmarkValidator,
  compactBookmarkValidator,
} from './bookmarkValidators'
import { insertBookmarkForOwner } from './bookmarks'

const MAX_AGENT_RESULTS = 50

type ServiceCtx = QueryCtx | MutationCtx

async function serviceHive(ctx: ServiceCtx, userId: string) {
  const hive = await ctx.db
    .query('hives')
    .withIndex('by_user_id', (q) => q.eq('userId', userId))
    .unique()
  if (!hive) {
    throw new ConvexError({
      code: 'HIVE_SETUP_REQUIRED',
      message: 'Finish Hive setup before using Mind with Bee.',
    })
  }
  return hive
}

function compact(bookmark: {
  _id: Id<'bookmarks'>
  kind: 'website' | 'tweet' | 'youtube'
  status: 'pending' | 'processing' | 'ready' | 'failed'
  title?: string
  summary?: string
  labels: string[]
  url: string
  createdAt: number
}) {
  return {
    id: bookmark._id,
    kind: bookmark.kind,
    status: bookmark.status,
    title: bookmark.title,
    summary: bookmark.summary,
    labels: bookmark.labels,
    url: bookmark.url,
    createdAt: bookmark.createdAt,
  }
}

export const searchBookmarks = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    kind: v.optional(bookmarkKindValidator),
  },
  returns: v.array(compactBookmarkValidator),
  handler: async (ctx, args) => {
    const hive = await serviceHive(ctx, args.userId)
    const query = args.query.trim().slice(0, 500)
    if (!query) return []
    const bookmarks = await ctx.db
      .query('bookmarks')
      .withSearchIndex('search_text', (search) => {
        const scoped = search
          .search('searchText', query)
          .eq('ownerKey', hive.ownerKey)
        return args.kind ? scoped.eq('kind', args.kind) : scoped
      })
      .take(24)
    return bookmarks
      .filter((bookmark) => bookmark.userId === args.userId)
      .map(compact)
  },
})

export const listBookmarks = internalQuery({
  args: {
    userId: v.string(),
    kind: v.optional(bookmarkKindValidator),
    label: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(compactBookmarkValidator),
  handler: async (ctx, args) => {
    const hive = await serviceHive(ctx, args.userId)
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 24), MAX_AGENT_RESULTS))
    const label = args.label?.trim().toLowerCase()
    const bookmarks = args.kind
      ? await ctx.db
          .query('bookmarks')
          .withIndex('by_owner_key_and_kind_and_created_at', (q) =>
            q.eq('ownerKey', hive.ownerKey).eq('kind', args.kind!),
          )
          .order('desc')
          .take(label ? MAX_AGENT_RESULTS : limit)
      : await ctx.db
          .query('bookmarks')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', hive.ownerKey),
          )
          .order('desc')
          .take(label ? MAX_AGENT_RESULTS : limit)
    return bookmarks
      .filter(
        (bookmark) =>
          bookmark.userId === args.userId &&
          (!label || bookmark.labels.includes(label)),
      )
      .slice(0, limit)
      .map(compact)
  },
})

export const getBookmark = internalQuery({
  args: { userId: v.string(), bookmarkId: v.id('bookmarks') },
  returns: v.union(v.null(), bookmarkValidator),
  handler: async (ctx, args) => {
    const hive = await serviceHive(ctx, args.userId)
    const bookmark = await ctx.db.get('bookmarks', args.bookmarkId)
    if (
      !bookmark ||
      bookmark.ownerKey !== hive.ownerKey ||
      bookmark.userId !== args.userId
    ) {
      return null
    }
    return bookmark
  },
})

export const saveBookmark = internalMutation({
  args: { userId: v.string(), url: v.string(), note: v.optional(v.string()) },
  returns: compactBookmarkValidator,
  handler: async (ctx, args) => {
    const hive = await serviceHive(ctx, args.userId)
    return compact(
      await insertBookmarkForOwner(ctx, {
        ownerKey: hive.ownerKey,
        userId: args.userId,
        url: args.url,
        note: args.note,
      }),
    )
  },
})
