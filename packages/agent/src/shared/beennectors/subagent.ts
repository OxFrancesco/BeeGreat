import {
  defineSubagent,
  defineTool,
  useTool,
  type JsonValue,
  type SubagentDefinition,
} from '@flue/runtime'
import * as Sentry from '@sentry/cloudflare'
import * as v from 'valibot'
import {
  callBeennectorService,
  type BeennectorProvider,
  type BeennectorRuntime,
  type ConnectedBeennector,
} from './client.ts'

const PROVIDERS = ['github', 'linear', 'notion'] as const

const INSTRUCTIONS = `You are the Beennectors specialist inside BeeGreat, working for Bee
(the coordinator). You inspect the user's connected work systems. Your reply goes
back to Bee, not directly to the user, so be concise and include exact identifiers,
titles, states, URLs, assignees, due dates, and source provider.

- GitHub references use owner/repository#number. Linear references use an issue id
  or identifier such as ENG-123. Notion references use a page id.
- Start with list or search when the requested item is ambiguous.
- Search syntax is provider-native for GitHub and plain text for Linear/Notion.
- GitHub and Linear comments are write operations. Post only when Bee's delegated
  request says the user explicitly asked to send that exact message.
- Notion is read-only. Never claim to edit or comment on a page.
- Beennectors are account/workspace connections, never Power-ups or PowerBees.
- If authentication is missing or expired, tell Bee to reconnect the provider from
  Profile → Beennectors.`

export async function loadBeennectorSubagent(
  userId: string,
  convexUrl: string,
  runtime: BeennectorRuntime,
): Promise<SubagentDefinition[]> {
  let connected: ConnectedBeennector[]
  try {
    connected = await callBeennectorService<ConnectedBeennector[]>(
      convexUrl,
      runtime,
      { userId, operation: 'list_connections' },
    )
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: 'agent-worker',
        operation: 'beennectors.load',
        handled: 'true',
      },
    })
    return []
  }
  if (!connected.length) return []
  const connectedNames = connected
    .map(({ provider, accountName, workspaceName }) =>
      [provider, workspaceName ?? accountName].filter(Boolean).join(': '),
    )
    .join(', ')
  const request = (input: Record<string, unknown>) =>
    callBeennectorService<JsonValue>(convexUrl, runtime, { userId, ...input })

  const tools = [
    defineTool({
      name: 'list_beennector_items',
      description:
        'List recently relevant items. GitHub returns open items involving the user, Linear returns assigned issues, and Notion returns recently edited shared pages.',
      input: v.object({
        provider: v.picklist(PROVIDERS),
        limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
      }),
      async run({ data }) {
        return { output: await request({ operation: 'list', ...data }) }
      },
    }),
    defineTool({
      name: 'search_beennector',
      description:
        'Search a connected provider. GitHub accepts its issue-search syntax; Linear and Notion accept plain text.',
      input: v.object({
        provider: v.picklist(PROVIDERS),
        query: v.pipe(v.string(), v.minLength(1)),
        limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
      }),
      async run({ data }) {
        return { output: await request({ operation: 'search', ...data }) }
      },
    }),
    defineTool({
      name: 'get_beennector_item',
      description:
        'Read one GitHub issue/PR with comments, Linear issue with comments, or Notion page with its first 100 blocks.',
      input: v.object({
        provider: v.picklist(PROVIDERS),
        ref: v.pipe(v.string(), v.minLength(1)),
      }),
      async run({ data }) {
        return { output: await request({ operation: 'get', ...data }) }
      },
    }),
    defineTool({
      name: 'comment_on_beennector_item',
      description:
        'Post a GitHub issue/PR or Linear issue comment after an explicit user request. Notion is read-only.',
      input: v.object({
        provider: v.picklist(['github', 'linear'] as const),
        ref: v.pipe(v.string(), v.minLength(1)),
        body: v.pipe(v.string(), v.minLength(1)),
      }),
      async run({ data }) {
        return { output: await request({ operation: 'comment', ...data }) }
      },
    }),
  ]

  return [
    defineSubagent({
      name: 'beennectors',
      description: `Connected work systems (${connectedNames}): find and read GitHub issues/PRs, Linear issues, and Notion pages; post GitHub/Linear comments only on explicit request.`,
      agent: () => {
        for (const tool of tools) useTool(tool)
        return INSTRUCTIONS
      },
    }),
  ]
}

export type { BeennectorProvider }

