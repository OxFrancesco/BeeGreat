import type { JsonValue } from '@flue/runtime'
import { defineTool } from '@flue/runtime'
import * as v from 'valibot'

export type MindServiceOptions = {
  convexSiteUrl?: string
  brokerSecret?: string
}

function siteUrl(convexUrl: string, configured?: string) {
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(convexUrl)
  if (!url.hostname.endsWith('.convex.cloud')) {
    throw new Error('CONVEX_SITE_URL is required for non-Convex-cloud URLs.')
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

export async function callMindService<T extends JsonValue = JsonValue>(
  userId: string,
  convexUrl: string,
  options: MindServiceOptions,
  operation: 'search' | 'list' | 'get' | 'save',
  input: Record<string, unknown> = {},
): Promise<T> {
  const secret = options.brokerSecret?.trim()
  if (!secret) {
    throw new Error('Bee Mind access is not configured on this deployment.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(
      `${siteUrl(convexUrl, options.convexSiteUrl)}/internal/mind`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId, operation, ...input }),
        signal: controller.signal,
      },
    )
    const body = (await response.json().catch(() => null)) as
      | { error?: unknown }
      | T
      | null
    if (!response.ok) {
      const message =
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : `Mind service failed (HTTP ${response.status})`
      throw new Error(message)
    }
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}

const bookmarkKind = v.optional(v.picklist(['website', 'tweet', 'youtube']))

export function createMindTools(
  userId: string,
  convexUrl: string,
  options: MindServiceOptions,
) {
  return [
    defineTool({
      name: 'search_mind',
      description:
        "Search the user's Mind across saved website text, tweets, video transcripts, summaries, and labels. Use before answering what the user saved about a topic.",
      input: v.object({
        query: v.pipe(v.string(), v.description('Topic or keywords to search')),
        kind: bookmarkKind,
      }),
      async run({ input }) {
        return await callMindService(
          userId,
          convexUrl,
          options,
          'search',
          input,
        )
      },
    }),
    defineTool({
      name: 'list_bookmarks',
      description:
        "List the user's newest Mind bookmarks, optionally filtered by source kind or exact label.",
      input: v.object({
        kind: bookmarkKind,
        label: v.optional(v.string()),
        limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
      }),
      async run({ input }) {
        return await callMindService(
          userId,
          convexUrl,
          options,
          'list',
          input,
        )
      },
    }),
    defineTool({
      name: 'get_bookmark',
      description:
        'Read the full content or transcript of one Mind bookmark after finding its id.',
      input: v.object({
        bookmarkId: v.pipe(
          v.string(),
          v.description('Bookmark id from search_mind or list_bookmarks'),
        ),
      }),
      async run({ input }) {
        return await callMindService(
          userId,
          convexUrl,
          options,
          'get',
          input,
        )
      },
    }),
    defineTool({
      name: 'save_bookmark',
      description:
        'Save a website, X/Twitter post, or YouTube URL to the user’s Mind. Use when the user explicitly asks to save a link they shared.',
      input: v.object({
        url: v.pipe(v.string(), v.description('The complete http or https URL')),
        note: v.optional(
          v.pipe(v.string(), v.description("The user's own note, if supplied")),
        ),
      }),
      async run({ input }) {
        return await callMindService(
          userId,
          convexUrl,
          options,
          'save',
          input,
        )
      },
    }),
  ]
}
