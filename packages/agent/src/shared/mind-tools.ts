import type { JsonValue } from '@flue/runtime'
import { defineTool } from '@flue/runtime'
import * as v from 'valibot'

import { trustedCast } from './trusted-cast'

const serviceErrorSchema = v.object({ error: v.string() })

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
  operation: 'search' | 'list' | 'get' | 'save' | 'update' | 'delete',
  input: Record<string, JsonValue | undefined> = {},
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
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const message = v.is(serviceErrorSchema, body)
        ? body.error
        : `Mind service failed (HTTP ${response.status})`
      throw new Error(message)
    }
    return trustedCast<T>(body)
  } finally {
    clearTimeout(timeout)
  }
}

const bookmarkKind = v.optional(v.picklist(['website', 'tweet', 'youtube']))
const bookmarkId = v.pipe(
  v.string(),
  v.description('Bookmark id from search_mind or list_bookmarks'),
)

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
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'search', data),
        }
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
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'list', data),
        }
      },
    }),
    defineTool({
      name: 'get_bookmark',
      description:
        'Read the full content or transcript of one Mind bookmark after finding its id.',
      input: v.object({
        bookmarkId,
      }),
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'get', data),
        }
      },
    }),
    defineTool({
      name: 'save_bookmark',
      description:
        'Save a website, X/Twitter post, or YouTube URL to the user’s Mind. A bare domain such as instagram.com is valid and becomes HTTPS. Use when the user explicitly asks to save a link they shared.',
      input: v.object({
        url: v.pipe(
          v.string(),
          v.description('A domain, domain/path, or complete http or https URL'),
        ),
        note: v.optional(
          v.pipe(v.string(), v.description("The user's own note, if supplied")),
        ),
      }),
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'save', data),
        }
      },
    }),
    defineTool({
      name: 'update_bookmark',
      description:
        "Edit a Mind bookmark's title, labels, or personal note. Find the exact bookmark first. Omit fields that should stay unchanged; an empty title or note clears it, and labels replaces the full label list.",
      input: v.object({
        bookmarkId,
        title: v.optional(v.string()),
        labels: v.optional(v.pipe(v.array(v.string()), v.maxLength(12))),
        note: v.optional(v.string()),
      }),
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'update', data),
        }
      },
    }),
    defineTool({
      name: 'delete_bookmark',
      description:
        'Permanently delete one exact Mind bookmark. Find it first and use only after the user explicitly confirms they want that bookmark deleted.',
      input: v.object({ bookmarkId }),
      async run({ data }) {
        return {
          output: await callMindService(userId, convexUrl, options, 'delete', data),
        }
      },
    }),
  ]
}
