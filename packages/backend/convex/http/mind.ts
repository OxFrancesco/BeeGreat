import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  AgentUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from './middleware'

const MindRequest = Schema.Struct({
  userId: AgentUserId,
  operation: Schema.String,
})

const BookmarkKindField = Schema.Struct({
  kind: Schema.optional(Schema.Literals(['website', 'tweet', 'youtube'])),
})

const BookmarkSearch = Schema.Struct({ query: Schema.String })

const BookmarkFilters = Schema.Struct({
  label: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

const BookmarkLookup = Schema.Struct({ bookmarkId: Schema.String })

const BookmarkSave = Schema.Struct({
  url: Schema.String,
  note: Schema.optional(Schema.String),
})

const BookmarkUpdate = Schema.Struct({
  bookmarkId: Schema.String,
  title: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String),
  labels: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
})

export const mind = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(MindRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Mind request' }, 400)
  }
  const kindField = decodeRequestBody(BookmarkKindField, raw)
  if (!kindField) {
    return jsonResponse({ error: 'Invalid bookmark kind' }, 400)
  }
  const kind = kindField.kind

  try {
    let result: unknown
    if (body.operation === 'search') {
      const search = decodeRequestBody(BookmarkSearch, raw)
      if (!search) {
        return jsonResponse({ error: 'Search query is required' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.searchBookmarks, {
        userId: body.userId,
        query: search.query,
        kind,
      })
    } else if (body.operation === 'list') {
      const filters = decodeRequestBody(BookmarkFilters, raw)
      if (!filters) {
        return jsonResponse({ error: 'Invalid bookmark filters' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.listBookmarks, {
        userId: body.userId,
        kind,
        label: filters.label,
        limit: filters.limit,
      })
    } else if (body.operation === 'get') {
      const lookup = decodeRequestBody(BookmarkLookup, raw)
      if (!lookup) {
        return jsonResponse({ error: 'Bookmark id is required' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.getBookmark, {
        userId: body.userId,
        bookmarkId: requestDocumentId<'bookmarks'>(lookup.bookmarkId),
      })
    } else if (body.operation === 'save') {
      const save = decodeRequestBody(BookmarkSave, raw)
      if (!save) {
        return jsonResponse(
          { error: 'A valid bookmark URL is required' },
          400,
        )
      }
      result = await ctx.runMutation(internal.agentMind.saveBookmark, {
        userId: body.userId,
        url: save.url,
        note: save.note,
      })
    } else if (body.operation === 'update') {
      const update = decodeRequestBody(BookmarkUpdate, raw)
      if (
        !update ||
        (update.title === undefined &&
          update.labels === undefined &&
          update.note === undefined)
      ) {
        return jsonResponse({ error: 'Invalid bookmark update' }, 400)
      }
      result = await ctx.runMutation(internal.agentMind.updateBookmark, {
        userId: body.userId,
        bookmarkId: requestDocumentId<'bookmarks'>(update.bookmarkId),
        title: update.title,
        labels: update.labels,
        note: update.note,
      })
    } else if (body.operation === 'delete') {
      const removal = decodeRequestBody(BookmarkLookup, raw)
      if (!removal) {
        return jsonResponse({ error: 'Bookmark id is required' }, 400)
      }
      result = await ctx.runMutation(internal.agentMind.deleteBookmark, {
        userId: body.userId,
        bookmarkId: requestDocumentId<'bookmarks'>(removal.bookmarkId),
      })
    } else {
      return jsonResponse({ error: 'Unknown Mind operation' }, 400)
    }
    return jsonResponse(result, 200)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Mind request failed'
    return jsonResponse({ error: message }, 400)
  }
})
