'use node'

import * as Predicate from 'effect/Predicate'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { resolveBeennectorAccessToken } from './beennectorAuthActions'
import { beennectorProviderValidator } from './beennectorValidators'
import { jsonRecord, type JsonValue } from './jsonValue'

const GITHUB_API_URL = 'https://api.github.com'
const LINEAR_API_URL = 'https://api.linear.app/graphql'
const NOTION_API_URL = 'https://api.notion.com/v1'
const NOTION_VERSION = '2026-03-11'

type Operation = 'list' | 'search' | 'get' | 'comment'

/** Provider payloads flow through untouched; wrapped reads pair two of them. */
type BeennectorOperationResult =
  | JsonValue
  | undefined
  | { issue: JsonValue; comments: JsonValue }
  | { page: JsonValue; blocks: JsonValue }

class BeennectorApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function boundedLimit(limit?: number) {
  return Math.max(1, Math.min(Math.floor(limit ?? 20), 50))
}

async function responseJson(
  response: Response,
  provider: string,
): Promise<JsonValue> {
  const body: JsonValue = await response.json().catch(() => null)
  if (!response.ok) {
    const record = jsonRecord(body)
    const message =
      record && Predicate.isString(record.message)
        ? record.message
        : `${provider} request failed (HTTP ${response.status})`
    throw new BeennectorApiError(message, response.status)
  }
  return body
}

function parseGitHubRef(ref?: string) {
  const match = /^([^/\s]+)\/([^#\s]+)#([1-9]\d*)$/.exec(ref ?? '')
  if (!match) throw new Error('Use a GitHub reference like owner/repository#123.')
  return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) }
}

async function githubRequest(
  token: string,
  operation: Operation,
  args: { query?: string; ref?: string; body?: string; limit?: number },
) {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2026-03-10',
    'user-agent': 'BeeGreat-Beennector',
  }
  const limit = boundedLimit(args.limit)
  if (operation === 'list' || operation === 'search') {
    const query =
      operation === 'search'
        ? args.query?.trim()
        : 'is:open involves:@me sort:updated-desc'
    if (!query) throw new Error('A GitHub search query is required.')
    const url = new URL(`${GITHUB_API_URL}/search/issues`)
    url.search = new URLSearchParams({ q: query, per_page: String(limit) }).toString()
    return await responseJson(await fetch(url, { headers }), 'GitHub')
  }
  const ref = parseGitHubRef(args.ref)
  const endpoint = `${GITHUB_API_URL}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`
  if (operation === 'get') {
    const [issue, comments] = await Promise.all([
      responseJson(await fetch(endpoint, { headers }), 'GitHub'),
      responseJson(
        await fetch(`${endpoint}/comments?per_page=30`, { headers }),
        'GitHub',
      ),
    ])
    return { issue, comments }
  }
  const body = args.body?.trim()
  if (!body) throw new Error('A GitHub comment body is required.')
  return await responseJson(
    await fetch(`${endpoint}/comments`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    }),
    'GitHub',
  )
}

async function linearGraphql(
  token: string,
  query: string,
  variables: Record<string, string | number>,
) {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = jsonRecord(await responseJson(response, 'Linear'))
  const errors = body?.errors
  if (Array.isArray(errors) && errors.length) {
    const firstMessage = jsonRecord(errors[0])?.message
    throw new BeennectorApiError(
      Predicate.isString(firstMessage)
        ? firstMessage
        : 'Linear GraphQL request failed',
      400,
    )
  }
  return body?.data
}

async function linearRequest(
  token: string,
  operation: Operation,
  args: { query?: string; ref?: string; body?: string; limit?: number },
) {
  const first = boundedLimit(args.limit)
  const issueFields = `id identifier title url priority dueDate updatedAt
    state { name type } team { name key } assignee { name email }`
  if (operation === 'list') {
    return await linearGraphql(
      token,
      `query BeennectorAssignedIssues($first: Int!) {
        viewer { assignedIssues(first: $first) { nodes { ${issueFields} } } }
      }`,
      { first },
    )
  }
  if (operation === 'search') {
    const query = args.query?.trim()
    if (!query) throw new Error('A Linear search query is required.')
    return await linearGraphql(
      token,
      `query BeennectorIssueSearch($query: String!, $first: Int!) {
        issueSearch(query: $query, first: $first) { nodes { ${issueFields} } }
      }`,
      { query, first },
    )
  }
  const id = args.ref?.trim()
  if (!id) throw new Error('A Linear issue id or identifier is required.')
  if (operation === 'get') {
    return await linearGraphql(
      token,
      `query BeennectorIssue($id: String!) {
        issue(id: $id) {
          ${issueFields} description
          comments(first: 30) { nodes { id body createdAt user { name } } }
        }
      }`,
      { id },
    )
  }
  const body = args.body?.trim()
  if (!body) throw new Error('A Linear comment body is required.')
  return await linearGraphql(
    token,
    `mutation BeennectorComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success comment { id url }
      }
    }`,
    { issueId: id, body },
  )
}

type NotionSearchBody = {
  query?: string
  filter: { property: 'object'; value: 'page' }
  sort: { direction: 'descending'; timestamp: 'last_edited_time' }
  page_size: number
}

function notionHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'notion-version': NOTION_VERSION,
  }
}

async function notionRequest(
  token: string,
  operation: Operation,
  args: { query?: string; ref?: string; limit?: number },
) {
  if (operation === 'comment') {
    throw new Error('The Notion Beennector is read-only.')
  }
  if (operation === 'list' || operation === 'search') {
    const searchBody: NotionSearchBody = {
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: boundedLimit(args.limit),
    }
    const query = args.query?.trim()
    if (operation === 'search' && query) searchBody.query = query
    const response = await fetch(`${NOTION_API_URL}/search`, {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify(searchBody),
    })
    return await responseJson(response, 'Notion')
  }
  const pageId = args.ref?.trim()
  if (!pageId) throw new Error('A Notion page id is required.')
  const headers = notionHeaders(token)
  const [page, blocks] = await Promise.all([
    responseJson(
      await fetch(`${NOTION_API_URL}/pages/${encodeURIComponent(pageId)}`, {
        headers,
      }),
      'Notion',
    ),
    responseJson(
      await fetch(
        `${NOTION_API_URL}/blocks/${encodeURIComponent(pageId)}/children?page_size=100`,
        { headers },
      ),
      'Notion',
    ),
  ])
  return { page, blocks }
}

export const execute = internalAction({
  args: {
    userId: v.string(),
    provider: beennectorProviderValidator,
    operation: v.union(
      v.literal('list'),
      v.literal('search'),
      v.literal('get'),
      v.literal('comment'),
    ),
    query: v.optional(v.string()),
    ref: v.optional(v.string()),
    body: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<BeennectorOperationResult> => {
    const provider = args.provider
    const token: string = await resolveBeennectorAccessToken(
      ctx,
      args.userId,
      provider,
    )
    try {
      if (provider === 'github') {
        return await githubRequest(token, args.operation, args)
      }
      if (provider === 'linear') {
        return await linearRequest(token, args.operation, args)
      }
      if (provider === 'google') {
        throw new Error(
          'Google Workspace operations run through the guarded gog specialist.',
        )
      }
      return await notionRequest(token, args.operation, args)
    } catch (error) {
      if (error instanceof BeennectorApiError && error.status === 401) {
        await ctx.runMutation(internal.beennectors.markNeedsReauth, {
          userId: args.userId,
          provider,
        })
        throw new Error(
          `${provider} must be connected again from Profile → Beennectors.`,
        )
      }
      throw error
    }
  },
})
