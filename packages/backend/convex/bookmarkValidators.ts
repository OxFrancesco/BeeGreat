import { v } from 'convex/values'

export const bookmarkKindValidator = v.union(
  v.literal('website'),
  v.literal('tweet'),
  v.literal('youtube'),
)

export const bookmarkStatusValidator = v.union(
  v.literal('pending'),
  v.literal('processing'),
  v.literal('ready'),
  v.literal('failed'),
)

export const bookmarkMetaValidator = v.object({
  siteName: v.optional(v.string()),
  author: v.optional(v.string()),
  handle: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  tweetId: v.optional(v.string()),
  videoId: v.optional(v.string()),
  durationSeconds: v.optional(v.number()),
})

export const transcriptSourceValidator = v.union(
  v.literal('captions'),
  v.literal('scribe'),
)

export const bookmarkValidator = v.object({
  _id: v.id('bookmarks'),
  _creationTime: v.number(),
  ownerKey: v.string(),
  userId: v.string(),
  url: v.string(),
  normalizedUrl: v.string(),
  kind: bookmarkKindValidator,
  status: bookmarkStatusValidator,
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  labels: v.array(v.string()),
  note: v.optional(v.string()),
  content: v.optional(v.string()),
  searchText: v.string(),
  meta: v.optional(bookmarkMetaValidator),
  transcriptSource: v.optional(transcriptSourceValidator),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const bookmarkListItemValidator = v.object({
  _id: v.id('bookmarks'),
  _creationTime: v.number(),
  url: v.string(),
  kind: bookmarkKindValidator,
  status: bookmarkStatusValidator,
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  labels: v.array(v.string()),
  note: v.optional(v.string()),
  meta: v.optional(bookmarkMetaValidator),
  transcriptSource: v.optional(transcriptSourceValidator),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const compactBookmarkValidator = v.object({
  id: v.id('bookmarks'),
  kind: bookmarkKindValidator,
  status: bookmarkStatusValidator,
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  labels: v.array(v.string()),
  url: v.string(),
  createdAt: v.number(),
})
