'use node'

import * as Predicate from 'effect/Predicate'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, type ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { resolveBeennectorCredential } from './beennectorAuthActions'
import { beennectorProviderValidator } from './beennectorValidators'
import { jsonRecord, type JsonValue } from './jsonValue'

const GITHUB_API_URL = 'https://api.github.com'
const LINEAR_API_URL = 'https://api.linear.app/graphql'
const NOTION_API_URL = 'https://api.notion.com/v1'
const NOTION_VERSION = '2026-03-11'

type Operation = 'list' | 'search' | 'get'

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
  throw new Error('Unsupported GitHub read operation.')
}

async function linearGraphql(
  token: string,
  query: string,
  variables: Record<string, string | number>,
) {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
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
  throw new Error('Unsupported Linear read operation.')
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
    if (args.operation === 'comment') return prepareCommentForAgent(ctx, args)
    const provider = args.provider
    const credential = await resolveBeennectorCredential(
      ctx,
      args.userId,
      provider,
    )
    const token = credential.accessToken
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
          expectedEncryptedAccess: credential.encryptedAccess,
        })
        throw new Error(
          `${provider} must be connected again from Profile → Beennectors.`,
        )
      }
      throw error
    }
  },
})


function providerUrl(value: unknown, provider: 'github' | 'linear') {
  if (typeof value !== 'string') throw new Error('The provider did not return the comment destination.')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== (provider === 'github' ? 'github.com' : 'linear.app')) throw new Error('The provider returned an invalid comment destination.')
  return url.toString()
}

export async function prepareCommentForAgent(ctx: ActionCtx, args: { userId: string; provider: string; ref?: string; body?: string }) {
  if (args.provider !== 'github' && args.provider !== 'linear') throw new Error('This provider is read-only.')
  const provider = args.provider
  const body = args.body?.trim()
  if (!body || body.length > 20_000) throw new Error('A comment body of at most 20,000 characters is required.')
  const credential = await resolveBeennectorCredential(ctx, args.userId, provider)
  let result: BeennectorOperationResult
  try {
    result = provider === 'github'
      ? await githubRequest(credential.accessToken, 'get', args)
      : await linearRequest(credential.accessToken, 'get', args)
  } catch (error) {
    if (error instanceof BeennectorApiError && error.status === 401) await ctx.runMutation(internal.beennectors.markNeedsReauth, { userId: args.userId, provider, expectedEncryptedAccess: credential.encryptedAccess })
    throw error
  }
  const issue = jsonRecord(jsonRecord(result)?.issue)
  const targetId = issue?.[provider === 'github' ? 'node_id' : 'id']
  const title = issue?.title
  if (typeof targetId !== 'string' || !targetId || typeof title !== 'string') throw new Error('The provider did not resolve this comment destination.')
  const targetUrl = providerUrl(issue?.[provider === 'github' ? 'html_url' : 'url'], provider)
  return await ctx.runMutation(internal.beennectorComments.createPending, { userId: args.userId, provider, targetId, targetLabel: title, targetUrl, body, expectedEncryptedAccess: credential.encryptedAccess })
}

export async function executeApprovedCommentForId(ctx: ActionCtx, actionId: Id<'beennectorCommentActions'>) {
  const row = await ctx.runMutation(internal.beennectorComments.claim, { actionId })
  if (!row) return null
  let resultUrl: string
  let credential: Awaited<ReturnType<typeof resolveBeennectorCredential>> | undefined
  try {
    credential = await resolveBeennectorCredential(ctx, row.userId, row.provider)
    await ctx.runMutation(internal.beennectorComments.authorizeSubmission, { actionId, expectedEncryptedAccess: credential.encryptedAccess })
    if (row.provider === 'github') {
      const result = jsonRecord(await responseJson(await fetch(`${GITHUB_API_URL}/graphql`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/json', 'user-agent': 'BeeGreat-Beennector' },
        body: JSON.stringify({ query: 'mutation BeeApprovedComment($subjectId: ID!, $body: String!) { addComment(input: {subjectId: $subjectId, body: $body}) { commentEdge { node { url } } } }', variables: { subjectId: row.targetId, body: row.body } }),
      }), 'GitHub'))
      if (Array.isArray(result?.errors) && result.errors.length) throw new Error('GitHub did not acknowledge the comment.')
      resultUrl = providerUrl(jsonRecord(jsonRecord(jsonRecord(jsonRecord(result?.data)?.addComment)?.commentEdge)?.node)?.url, 'github')
    } else {
      const result = jsonRecord(await linearGraphql(credential.accessToken,
        'mutation BeeApprovedComment($issueId: String!, $body: String!) { commentCreate(input: {issueId: $issueId, body: $body}) { success comment { id url } } }',
        { issueId: row.targetId, body: row.body }))
      const created = jsonRecord(result?.commentCreate)
      if (created?.success !== true) throw new Error('Linear did not acknowledge the comment.')
      resultUrl = providerUrl(jsonRecord(created.comment)?.url, 'linear')
    }
  } catch (error) {
    if (credential && error instanceof BeennectorApiError && error.status === 401) {
      await ctx.runMutation(internal.beennectors.markNeedsReauth, { userId: row.userId, provider: row.provider, expectedEncryptedAccess: credential.encryptedAccess })
    }
    await ctx.runMutation(internal.beennectorComments.finish, { actionId })
    return null
  }
  // A lost database acknowledgement must never repeat the provider write.
  await ctx.runMutation(internal.beennectorComments.finish, { actionId, resultUrl })
  return null
}

export const executeApprovedComment = internalAction({
  args: { actionId: v.id('beennectorCommentActions') },
  handler: (ctx, { actionId }) => executeApprovedCommentForId(ctx, actionId),
})
