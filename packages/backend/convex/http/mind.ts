import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const mind = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    typeof body.operation !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid Mind request' }, 400)
  }
  const kind = body.kind
  if (
    kind !== undefined &&
    kind !== 'website' &&
    kind !== 'tweet' &&
    kind !== 'youtube'
  ) {
    return jsonResponse({ error: 'Invalid bookmark kind' }, 400)
  }

  try {
    let result: unknown
    if (body.operation === 'search') {
      if (typeof body.query !== 'string') {
        return jsonResponse({ error: 'Search query is required' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.searchBookmarks, {
        userId: body.userId,
        query: body.query,
        kind,
      })
    } else if (body.operation === 'list') {
      if (
        (body.label !== undefined && typeof body.label !== 'string') ||
        (body.limit !== undefined && typeof body.limit !== 'number')
      ) {
        return jsonResponse({ error: 'Invalid bookmark filters' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.listBookmarks, {
        userId: body.userId,
        kind,
        label: body.label as string | undefined,
        limit: body.limit as number | undefined,
      })
    } else if (body.operation === 'get') {
      if (typeof body.bookmarkId !== 'string') {
        return jsonResponse({ error: 'Bookmark id is required' }, 400)
      }
      result = await ctx.runQuery(internal.agentMind.getBookmark, {
        userId: body.userId,
        bookmarkId: body.bookmarkId as Id<'bookmarks'>,
      })
    } else if (body.operation === 'save') {
      if (
        typeof body.url !== 'string' ||
        (body.note !== undefined && typeof body.note !== 'string')
      ) {
        return jsonResponse(
          { error: 'A valid bookmark URL is required' },
          400,
        )
      }
      result = await ctx.runMutation(internal.agentMind.saveBookmark, {
        userId: body.userId,
        url: body.url,
        note: body.note as string | undefined,
      })
    } else if (body.operation === 'update') {
      if (
        typeof body.bookmarkId !== 'string' ||
        (body.title !== undefined && typeof body.title !== 'string') ||
        (body.note !== undefined && typeof body.note !== 'string') ||
        (body.labels !== undefined &&
          (!Array.isArray(body.labels) ||
            !body.labels.every((label) => typeof label === 'string'))) ||
        (body.title === undefined &&
          body.labels === undefined &&
          body.note === undefined)
      ) {
        return jsonResponse({ error: 'Invalid bookmark update' }, 400)
      }
      result = await ctx.runMutation(internal.agentMind.updateBookmark, {
        userId: body.userId,
        bookmarkId: body.bookmarkId as Id<'bookmarks'>,
        title: body.title as string | undefined,
        labels: body.labels as string[] | undefined,
        note: body.note as string | undefined,
      })
    } else if (body.operation === 'delete') {
      if (typeof body.bookmarkId !== 'string') {
        return jsonResponse({ error: 'Bookmark id is required' }, 400)
      }
      result = await ctx.runMutation(internal.agentMind.deleteBookmark, {
        userId: body.userId,
        bookmarkId: body.bookmarkId as Id<'bookmarks'>,
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
