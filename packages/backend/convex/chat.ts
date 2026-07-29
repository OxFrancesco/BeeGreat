import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

const MAX_MESSAGES_PER_SYNC = 200
const MAX_MESSAGE_JSON_BYTES = 512_000
const LEGACY_MESSAGE_LIMIT = 100
const MAX_MESSAGES_PER_PAGE = 100

const threadValidator = v.object({
  id: v.number(),
  createdAt: v.number(),
  title: v.optional(v.string()),
})

const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal('user'), v.literal('assistant')),
  contentJson: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

type JsonObject = Record<string, unknown>

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withoutKeys(value: JsonObject, keys: ReadonlySet<string>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.has(key)),
  )
}

/** True when `next` retains every value already present in `previous`. */
function isJsonExtension(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true
  if (Array.isArray(previous)) {
    return (
      Array.isArray(next) &&
      next.length >= previous.length &&
      previous.every((value, index) => isJsonExtension(value, next[index]))
    )
  }
  if (!isJsonObject(previous) || !isJsonObject(next)) return false
  return Object.entries(previous).every(
    ([key, value]) =>
      Object.prototype.hasOwnProperty.call(next, key) &&
      isJsonExtension(value, next[key]),
  )
}

const TEXT_PROGRESS_KEYS = new Set(['text', 'state'])
const TOOL_PROGRESS_KEYS = new Set(['state'])

function isAssistantPartProgression(previous: unknown, next: unknown): boolean {
  if (!isJsonObject(previous) || !isJsonObject(next)) return false
  if (previous.type !== next.type || typeof previous.type !== 'string') return false

  if (previous.type === 'text' || previous.type === 'reasoning') {
    if (
      typeof previous.text !== 'string' ||
      typeof next.text !== 'string' ||
      (previous.state !== 'streaming' && previous.state !== 'done') ||
      (next.state !== 'streaming' && next.state !== 'done')
    ) {
      return false
    }
    const contentProgresses =
      previous.state === 'done'
        ? next.state === 'done' && next.text === previous.text
        : next.text.startsWith(previous.text)
    return (
      contentProgresses &&
      isJsonExtension(
        withoutKeys(previous, TEXT_PROGRESS_KEYS),
        withoutKeys(next, TEXT_PROGRESS_KEYS),
      )
    )
  }

  if (previous.type === 'dynamic-tool') {
    const previousState = previous.state
    const nextState = next.state
    const sameState = previousState === nextState
    const reachesTerminalState =
      previousState === 'input-available' &&
      (nextState === 'output-available' || nextState === 'output-error')
    return (
      (sameState || reachesTerminalState) &&
      isJsonExtension(
        withoutKeys(previous, TOOL_PROGRESS_KEYS),
        withoutKeys(next, TOOL_PROGRESS_KEYS),
      )
    )
  }

  // File parts are immutable, but a later canonical snapshot may add optional
  // metadata such as a durable URL or byte size.
  return isJsonExtension(previous, next)
}

function parseAssistantEnvelope(
  contentJson: string,
  messageId: string,
): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(contentJson)
    if (
      !isJsonObject(value) ||
      value.id !== messageId ||
      value.role !== 'assistant' ||
      !Array.isArray(value.parts)
    ) {
      return undefined
    }
    return value
  } catch {
    return undefined
  }
}

/**
 * Flue assistant envelopes advance append-only: text grows, streaming parts
 * become done, tool calls acquire outcomes, and metadata may be added. Comparing
 * that structure gives every client/reconnect the same server-enforced order,
 * without relying on process-local counters or wall-clock arrival order.
 */
function isAssistantEnvelopeProgression(
  previousJson: string,
  nextJson: string,
  messageId: string,
): boolean {
  const previous = parseAssistantEnvelope(previousJson, messageId)
  const next = parseAssistantEnvelope(nextJson, messageId)
  if (!previous || !next) return false

  const previousParts = previous.parts as unknown[]
  const nextParts = next.parts as unknown[]
  if (
    nextParts.length < previousParts.length ||
    !previousParts.every((part, index) =>
      isAssistantPartProgression(part, nextParts[index]),
    )
  ) {
    return false
  }

  return isJsonExtension(
    withoutKeys(previous, new Set(['parts'])),
    withoutKeys(next, new Set(['parts'])),
  )
}

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Authentication required' })
  }
  return {
    ownerKey: identity.tokenIdentifier,
    userId: identity.subject,
  }
}

export type ChatIdentity = Awaited<ReturnType<typeof requireIdentity>>

async function findThread(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  threadId: number,
) {
  return await ctx.db
    .query('chatThreads')
    .withIndex('by_owner_key_and_thread_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('threadId', threadId),
    )
    .unique()
}

async function requireThread(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  threadId: number,
) {
  if (threadId === 0) return
  if (!(await findThread(ctx, ownerKey, threadId))) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Conversation not found' })
  }
}

export const listThreads = query({
  args: {},
  returns: v.array(threadValidator),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    const rows = await ctx.db
      .query('chatThreads')
      .withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))
      .order('asc')
      .collect()
    if (rows.length === 0) return [{ id: 0, createdAt: 0 }]
    return rows.map((row) => ({
      id: row.threadId,
      createdAt: row.createdAt,
      ...(row.title ? { title: row.title } : {}),
    }))
  },
})

export const getActiveThread = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return await activeThreadForIdentity(ctx, await requireIdentity(ctx))
  },
})

export async function activeThreadForIdentity(
  ctx: QueryCtx | MutationCtx,
  identity: ChatIdentity,
) {
  const preferences = await ctx.db
    .query('chatPreferences')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
    .unique()
  return preferences?.activeThreadId ?? 0
}

export async function createThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
) {
  const newest = await ctx.db
    .query('chatThreads')
    .withIndex('by_owner_key_and_created_at', (q) =>
      q.eq('ownerKey', identity.ownerKey),
    )
    .order('desc')
    .first()
  const now = Date.now()
  const threadId = Math.max(now, (newest?.threadId ?? 0) + 1)
  await ctx.db.insert('chatThreads', {
    ...identity,
    threadId,
    createdAt: now,
    updatedAt: now,
  })
  const preferences = await ctx.db
    .query('chatPreferences')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
    .unique()
  if (preferences) {
    await ctx.db.patch('chatPreferences', preferences._id, {
      activeThreadId: threadId,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert('chatPreferences', {
      ...identity,
      activeThreadId: threadId,
      updatedAt: now,
    })
  }
  return threadId
}

export const createThread = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return await createThreadForIdentity(ctx, await requireIdentity(ctx))
  },
})

export const setActiveThread = mutation({
  args: { threadId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await requireThread(ctx, identity.ownerKey, args.threadId)
    const now = Date.now()
    const preferences = await ctx.db
      .query('chatPreferences')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
      .unique()
    if (preferences) {
      await ctx.db.patch('chatPreferences', preferences._id, {
        activeThreadId: args.threadId,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('chatPreferences', {
        ...identity,
        activeThreadId: args.threadId,
        updatedAt: now,
      })
    }
    return null
  },
})

export async function titleThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  threadId: number,
  requestedTitle: string,
) {
  const title = requestedTitle.trim().slice(0, 64)
  if (!title) return
  const existing = await findThread(ctx, identity.ownerKey, threadId)
  if (existing) {
    if (!existing.title) {
      await ctx.db.patch('chatThreads', existing._id, {
        title,
        updatedAt: Date.now(),
      })
    }
  } else if (threadId === 0) {
    const now = Date.now()
    await ctx.db.insert('chatThreads', {
      ...identity,
      threadId: 0,
      title,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Conversation not found',
    })
  }
}

export const setThreadTitle = mutation({
  args: { threadId: v.number(), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await titleThreadForIdentity(
      ctx,
      await requireIdentity(ctx),
      args.threadId,
      args.title,
    )
    return null
  },
})

export const listMessages = query({
  args: { threadId: v.number() },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    await requireThread(ctx, ownerKey, args.threadId)
    const rows = await ctx.db
      .query('chatMessages')
      .withIndex('by_owner_key_and_thread_id_and_created_at', (q) =>
        q.eq('ownerKey', ownerKey).eq('threadId', args.threadId),
      )
      .order('desc')
      .take(LEGACY_MESSAGE_LIMIT)
    return rows.reverse().map((row) => ({
      id: row.messageId,
      role: row.role,
      contentJson: row.contentJson,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  },
})

export const listMessagesPage = query({
  args: {
    threadId: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(messageValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    await requireThread(ctx, ownerKey, args.threadId)
    const result = await ctx.db
      .query('chatMessages')
      .withIndex('by_owner_key_and_thread_id_and_created_at', (q) =>
        q.eq('ownerKey', ownerKey).eq('threadId', args.threadId),
      )
      .order('desc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, MAX_MESSAGES_PER_PAGE),
      })
    return {
      page: result.page.map((row) => ({
        id: row.messageId,
        role: row.role,
        contentJson: row.contentJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    }
  },
})

export const syncMessages = mutation({
  args: {
    threadId: v.number(),
    messages: v.array(
      v.object({
        id: v.string(),
        role: v.union(v.literal('user'), v.literal('assistant')),
        contentJson: v.string(),
        createdAt: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await requireThread(ctx, identity.ownerKey, args.threadId)
    if (args.messages.length > MAX_MESSAGES_PER_SYNC) {
      throw new ConvexError({ code: 'TOO_LARGE', message: 'Too many messages to sync' })
    }
    const now = Date.now()
    for (const message of args.messages) {
      if (!message.id || new TextEncoder().encode(message.contentJson).length > MAX_MESSAGE_JSON_BYTES) {
        throw new ConvexError({ code: 'TOO_LARGE', message: 'Message is too large to sync' })
      }
      const existing = await ctx.db
        .query('chatMessages')
        .withIndex('by_owner_key_and_thread_id_and_message_id', (q) =>
          q
            .eq('ownerKey', identity.ownerKey)
            .eq('threadId', args.threadId)
            .eq('messageId', message.id),
        )
        .unique()
      if (existing) {
        if (existing.contentJson !== message.contentJson) {
          if (
            existing.role !== message.role ||
            (existing.role === 'assistant' &&
              !isAssistantEnvelopeProgression(
                existing.contentJson,
                message.contentJson,
                message.id,
              ))
          ) {
            continue
          }
          await ctx.db.patch('chatMessages', existing._id, {
            contentJson: message.contentJson,
            updatedAt: now,
          })
        }
      } else {
        await ctx.db.insert('chatMessages', {
          ...identity,
          threadId: args.threadId,
          messageId: message.id,
          role: message.role,
          contentJson: message.contentJson,
          createdAt: message.createdAt,
          updatedAt: now,
        })
      }
    }
    return null
  },
})
