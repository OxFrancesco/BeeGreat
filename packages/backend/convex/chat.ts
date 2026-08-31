import * as Predicate from 'effect/Predicate'
import { paginationOptsValidator, type WithoutSystemFields } from 'convex/server'
import { ConvexError, v, type Infer } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { jsonRecord, type JsonRecord, type JsonValue } from './jsonValue'

const MAX_MESSAGES_PER_SYNC = 200
const MAX_MESSAGE_JSON_BYTES = 512_000
const LEGACY_MESSAGE_LIMIT = 100
const MAX_MESSAGES_PER_PAGE = 100

const threadValidator = v.object({
  id: v.number(),
  createdAt: v.number(),
  source: v.optional(v.literal('imessage')),
  title: v.optional(v.string()),
  archivedAt: v.optional(v.number()),
})

const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal('user'), v.literal('assistant')),
  contentJson: v.string(),
  hidden: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const chatMessageSyncValidator = v.object({
  id: v.string(),
  role: v.union(v.literal('user'), v.literal('assistant')),
  contentJson: v.string(),
  createdAt: v.number(),
})

type ChatThreadSummary = Infer<typeof threadValidator>
type ChatMessageView = Infer<typeof messageValidator>

function withoutKeys(value: JsonRecord, keys: ReadonlySet<string>): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.has(key)),
  )
}

/** True when `next` retains every value already present in `previous`. */
function isJsonExtension(
  previous: JsonValue | undefined,
  next: JsonValue | undefined,
): boolean {
  if (Object.is(previous, next)) return true
  if (Array.isArray(previous)) {
    return (
      Array.isArray(next) &&
      next.length >= previous.length &&
      previous.every((value, index) => isJsonExtension(value, next[index]))
    )
  }
  const previousRecord = jsonRecord(previous)
  const nextRecord = jsonRecord(next)
  if (!previousRecord || !nextRecord) return false
  return Object.entries(previousRecord).every(
    ([key, value]) =>
      Object.prototype.hasOwnProperty.call(nextRecord, key) &&
      isJsonExtension(value, nextRecord[key]),
  )
}

const TEXT_PROGRESS_KEYS = new Set(['text', 'state'])
const TOOL_PROGRESS_KEYS = new Set(['state'])

function isAssistantPartProgression(
  previous: JsonValue,
  next: JsonValue | undefined,
): boolean {
  const previousPart = jsonRecord(previous)
  const nextPart = jsonRecord(next)
  if (!previousPart || !nextPart) return false
  if (
    previousPart.type !== nextPart.type ||
    !Predicate.isString(previousPart.type)
  )
    return false

  if (previousPart.type === 'text' || previousPart.type === 'reasoning') {
    if (
      !Predicate.isString(previousPart.text) ||
      !Predicate.isString(nextPart.text) ||
      (previousPart.state !== 'streaming' && previousPart.state !== 'done') ||
      (nextPart.state !== 'streaming' && nextPart.state !== 'done')
    ) {
      return false
    }
    const contentProgresses =
      previousPart.state === 'done'
        ? nextPart.state === 'done' && nextPart.text === previousPart.text
        : nextPart.text.startsWith(previousPart.text)
    return (
      contentProgresses &&
      isJsonExtension(
        withoutKeys(previousPart, TEXT_PROGRESS_KEYS),
        withoutKeys(nextPart, TEXT_PROGRESS_KEYS),
      )
    )
  }

  if (previousPart.type === 'dynamic-tool') {
    const previousState = previousPart.state
    const nextState = nextPart.state
    const sameState = previousState === nextState
    const reachesTerminalState =
      previousState === 'input-available' &&
      (nextState === 'output-available' || nextState === 'output-error')
    return (
      (sameState || reachesTerminalState) &&
      isJsonExtension(
        withoutKeys(previousPart, TOOL_PROGRESS_KEYS),
        withoutKeys(nextPart, TOOL_PROGRESS_KEYS),
      )
    )
  }

  // File parts are immutable, but a later canonical snapshot may add optional
  // metadata such as a durable URL or byte size.
  return isJsonExtension(previous, next)
}

type AssistantEnvelope = {
  envelope: JsonRecord
  parts: JsonValue[]
}

function parseAssistantEnvelope(
  contentJson: string,
  messageId: string,
): AssistantEnvelope | undefined {
  try {
    const value = jsonRecord(JSON.parse(contentJson))
    if (!value || value.id !== messageId || value.role !== 'assistant') {
      return undefined
    }
    const parts = value.parts
    if (!Array.isArray(parts)) return undefined
    return { envelope: value, parts }
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

  const previousParts = previous.parts
  const nextParts = next.parts
  if (
    nextParts.length < previousParts.length ||
    !previousParts.every((part, index) =>
      isAssistantPartProgression(part, nextParts[index]),
    )
  ) {
    return false
  }

  return isJsonExtension(
    withoutKeys(previous.envelope, new Set(['parts'])),
    withoutKeys(next.envelope, new Set(['parts'])),
  )
}

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    })
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
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Conversation not found',
    })
  }
}

export const listThreads = query({
  args: {},
  returns: v.array(threadValidator),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    const rows = await ctx.db
      .query('chatThreads')
      .withIndex('by_owner_key_and_created_at', (q) =>
        q.eq('ownerKey', ownerKey),
      )
      .order('asc')
      .collect()
    if (rows.length === 0) return [{ id: 0, createdAt: 0 }]
    return rows.map((row) => {
      const thread: ChatThreadSummary = {
        id: row.threadId,
        createdAt: row.createdAt,
      }
      if (row.source) thread.source = row.source
      if (row.title) thread.title = row.title
      if (row.archivedAt) thread.archivedAt = row.archivedAt
      return thread
    })
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

async function insertThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  source?: 'imessage',
) {
  const newest = await ctx.db
    .query('chatThreads')
    .withIndex('by_owner_key_and_thread_id', (q) =>
      q.eq('ownerKey', identity.ownerKey),
    )
    .order('desc')
    .first()
  const now = Date.now()
  const threadId = Math.max(now, (newest?.threadId ?? 0) + 1)
  const thread: WithoutSystemFields<Doc<'chatThreads'>> = {
    ...identity,
    threadId,
    createdAt: now,
    updatedAt: now,
  }
  if (source) thread.source = source
  await ctx.db.insert('chatThreads', thread)
  return threadId
}

/** Registers a conversation owned by another Bee client without selecting it in the apps. */
export async function createDetachedThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
) {
  return await insertThreadForIdentity(ctx, identity)
}

export async function createThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
) {
  const threadId = await insertThreadForIdentity(ctx, identity)
  const now = Date.now()
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

export async function channelThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  source: 'imessage',
) {
  const existing = await ctx.db
    .query('chatThreads')
    .withIndex('by_owner_key_and_source_and_created_at', (q) =>
      q.eq('ownerKey', identity.ownerKey).eq('source', source),
    )
    .order('desc')
    .first()
  return existing?.threadId ?? insertThreadForIdentity(ctx, identity, source)
}

export async function createChannelThreadForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  source: 'imessage',
) {
  return await insertThreadForIdentity(ctx, identity, source)
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

export const setThreadArchived = mutation({
  args: { threadId: v.number(), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existing = await findThread(ctx, identity.ownerKey, args.threadId)
    const now = Date.now()
    if (existing) {
      await ctx.db.patch('chatThreads', existing._id, {
        archivedAt: args.archived ? now : undefined,
        updatedAt: now,
      })
    } else if (args.threadId === 0) {
      // Thread 0 exists implicitly until its first write; materialize it so
      // the archive flag has a row to live on.
      const thread: WithoutSystemFields<Doc<'chatThreads'>> = {
        ...identity,
        threadId: 0,
        createdAt: now,
        updatedAt: now,
      }
      if (args.archived) thread.archivedAt = now
      await ctx.db.insert('chatThreads', thread)
    } else {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Conversation not found',
      })
    }
    return null
  },
})

const MAX_MESSAGES_PER_HIDE = 50

/**
 * Tombstones the retried turn. Flue's transcript is append-only, so a retry
 * hides the superseded user/assistant rows here instead of deleting them,
 * which also stops the live transcript sync from resurrecting them.
 */
export const hideMessages = mutation({
  args: { threadId: v.number(), messageIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await requireThread(ctx, identity.ownerKey, args.threadId)
    if (args.messageIds.length > MAX_MESSAGES_PER_HIDE) {
      throw new ConvexError({
        code: 'TOO_LARGE',
        message: 'Too many messages to hide',
      })
    }
    const now = Date.now()
    for (const messageId of args.messageIds) {
      const existing = await ctx.db
        .query('chatMessages')
        .withIndex('by_owner_key_and_thread_id_and_message_id', (q) =>
          q
            .eq('ownerKey', identity.ownerKey)
            .eq('threadId', args.threadId)
            .eq('messageId', messageId),
        )
        .unique()
      if (existing && !existing.hidden) {
        await ctx.db.patch('chatMessages', existing._id, {
          hidden: true,
          updatedAt: now,
        })
      }
    }
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
    return rows.reverse().map((row) => {
      const message: ChatMessageView = {
        id: row.messageId,
        role: row.role,
        contentJson: row.contentJson,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
      if (row.hidden) message.hidden = true
      return message
    })
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
      page: result.page.map((row) => {
        const message: ChatMessageView = {
          id: row.messageId,
          role: row.role,
          contentJson: row.contentJson,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
        if (row.hidden) message.hidden = true
        return message
      }),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    }
  },
})

export const syncMessages = mutation({
  args: {
    threadId: v.number(),
    messages: v.array(chatMessageSyncValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await syncMessagesForIdentity(ctx, identity, args.threadId, args.messages)
    return null
  },
})

export async function syncMessagesForIdentity(
  ctx: MutationCtx,
  identity: ChatIdentity,
  threadId: number,
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    contentJson: string
    createdAt: number
  }>,
) {
  await requireThread(ctx, identity.ownerKey, threadId)
  if (messages.length > MAX_MESSAGES_PER_SYNC) {
    throw new ConvexError({
      code: 'TOO_LARGE',
      message: 'Too many messages to sync',
    })
  }
  const now = Date.now()
  for (const message of messages) {
    if (
      !message.id ||
      new TextEncoder().encode(message.contentJson).length >
        MAX_MESSAGE_JSON_BYTES
    ) {
      throw new ConvexError({
        code: 'TOO_LARGE',
        message: 'Message is too large to sync',
      })
    }
    const existing = await ctx.db
      .query('chatMessages')
      .withIndex('by_owner_key_and_thread_id_and_message_id', (q) =>
        q
          .eq('ownerKey', identity.ownerKey)
          .eq('threadId', threadId)
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
        threadId,
        messageId: message.id,
        role: message.role,
        contentJson: message.contentJson,
        createdAt: message.createdAt,
        updatedAt: now,
      })
    }
  }
}
