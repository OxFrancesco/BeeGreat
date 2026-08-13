import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  channelThreadForIdentity,
  chatMessageSyncValidator,
  createChannelThreadForIdentity,
  createDetachedThreadForIdentity,
  titleThreadForIdentity,
  syncMessagesForIdentity,
} from './chat'
import {
  completeHighlightedTask,
  confirmFirstFocusPlan,
  type IdentityKeys,
} from './firstFocus'
import { cancelWeb3Action, confirmWeb3Action } from './web3Actions'
import { connectionIdForBridgeAddress } from './imessage'

const identityArgs = {
  ownerKey: v.string(),
  userId: v.string(),
}

const channelSourceValidator = v.literal('imessage')

const highlightValidator = v.union(
  v.object({
    highlightId: v.id('highlights'),
    taskId: v.id('tasks'),
    title: v.string(),
    expiresAt: v.number(),
  }),
  v.null(),
)

const bundleValidator = v.object({
  goalId: v.id('goals'),
  projectId: v.id('projects'),
  taskId: v.id('tasks'),
  highlightId: v.id('highlights'),
  golieBeeId: v.id('golieBees'),
})

const channelConfirmResultValidator = v.object({
  status: v.union(v.literal('created'), v.literal('existing')),
  bundle: bundleValidator,
  highlightExpiresAt: v.number(),
})

const completeHighlightResultValidator = v.object({
  status: v.union(v.literal('completed'), v.literal('already_completed')),
  taskId: v.id('tasks'),
  honeyAwarded: v.number(),
  scoreAwarded: v.number(),
  honeyBalance: v.number(),
  honeycombScore: v.number(),
})

function channelIdentity(args: IdentityKeys): IdentityKeys {
  if (!args.ownerKey.endsWith(`|${args.userId}`)) {
    throw new ConvexError({
      code: 'INVALID_CHANNEL_IDENTITY',
      message: 'Channel identity does not match the mapped user',
    })
  }
  return { ownerKey: args.ownerKey, userId: args.userId }
}

async function currentHighlight(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  const highlight = await ctx.db
    .query('highlights')
    .withIndex('by_owner_key_and_status', (q) =>
      q.eq('ownerKey', ownerKey).eq('status', 'active'),
    )
    .first()
  if (!highlight || highlight.expiresAt <= Date.now()) return null
  const task = await ctx.db.get('tasks', highlight.taskId)
  if (!task || task.status !== 'todo') return null
  return {
    highlightId: highlight._id,
    taskId: task._id,
    title: task.title,
    expiresAt: highlight.expiresAt,
  }
}

function dateTimeParts(timestamp: number, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(timestamp)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

/** Resolves a local wall-clock time to an epoch without assuming a fixed UTC offset. */
function epochForLocalDateTime(
  target: ReturnType<typeof dateTimeParts>,
  timeZone: string,
) {
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  )
  let candidate = targetAsUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = dateTimeParts(candidate, timeZone)
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    const adjustment = targetAsUtc - actualAsUtc
    candidate += adjustment
    if (adjustment === 0) break
  }
  return candidate
}

function endOfLocalDay(timestamp: number, timeZone: string) {
  const local = dateTimeParts(timestamp, timeZone)
  const followingDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day + 1),
  )
  const nextMidnight = epochForLocalDateTime(
    {
      year: followingDate.getUTCFullYear(),
      month: followingDate.getUTCMonth() + 1,
      day: followingDate.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  )
  return nextMidnight - 1
}

async function userTimeZone(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  const preference = await ctx.db
    .query('userPreferences')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .unique()
  return preference?.timeZone ?? 'UTC'
}

export const getContext = internalMutation({
  args: {
    ...identityArgs,
    source: channelSourceValidator,
    sourceAddress: v.optional(v.string()),
  },
  returns: v.object({
    threadId: v.number(),
    activeHighlight: highlightValidator,
  }),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    const threadId = await channelThreadForIdentity(ctx, identity, args.source)
    const thread = await ctx.db
      .query('chatThreads')
      .withIndex('by_owner_key_and_thread_id', (q) =>
        q.eq('ownerKey', identity.ownerKey).eq('threadId', threadId),
      )
      .unique()
    if (thread && args.sourceAddress) {
      await ctx.db.patch(thread._id, {
        imessageConnectionId: await connectionIdForBridgeAddress(
          ctx,
          identity.userId,
          args.sourceAddress,
        ),
        updatedAt: Date.now(),
      })
    }
    return {
      threadId,
      activeHighlight: await currentHighlight(ctx, identity.ownerKey),
    }
  },
})

export const createThread = internalMutation({
  args: {
    ...identityArgs,
    source: channelSourceValidator,
    sourceAddress: v.optional(v.string()),
  },
  returns: v.object({ threadId: v.number() }),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    const threadId = await createChannelThreadForIdentity(
      ctx,
      identity,
      args.source,
    )
    const thread = await ctx.db
      .query('chatThreads')
      .withIndex('by_owner_key_and_thread_id', (q) =>
        q.eq('ownerKey', identity.ownerKey).eq('threadId', threadId),
      )
      .unique()
    if (thread && args.sourceAddress) {
      await ctx.db.patch(thread._id, {
        imessageConnectionId: await connectionIdForBridgeAddress(
          ctx,
          identity.userId,
          args.sourceAddress,
        ),
      })
    }
    return { threadId }
  },
})

export const syncTranscript = internalMutation({
  args: {
    ...identityArgs,
    threadId: v.number(),
    messages: v.array(chatMessageSyncValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    await syncMessagesForIdentity(ctx, identity, args.threadId, args.messages)
    return null
  },
})

export const createCliThread = internalMutation({
  args: identityArgs,
  returns: v.object({ threadId: v.number() }),
  handler: async (ctx, args) => ({
    threadId: await createDetachedThreadForIdentity(ctx, channelIdentity(args)),
  }),
})

export const titleThread = internalMutation({
  args: {
    ...identityArgs,
    threadId: v.number(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    await titleThreadForIdentity(ctx, identity, args.threadId, args.title)
    return null
  },
})

export const confirmFirstFocus = internalMutation({
  args: {
    ...identityArgs,
    requestId: v.string(),
    goalTitle: v.string(),
    projectTitle: v.string(),
    taskTitle: v.string(),
    highlightExpiresAt: v.optional(v.number()),
  },
  returns: channelConfirmResultValidator,
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    const highlightExpiresAt =
      args.highlightExpiresAt && args.highlightExpiresAt > Date.now()
        ? args.highlightExpiresAt
        : endOfLocalDay(Date.now(), await userTimeZone(ctx, identity.ownerKey))
    const result = await confirmFirstFocusPlan(ctx, identity, {
      requestId: args.requestId,
      confirmed: true,
      goalTitle: args.goalTitle,
      projectTitle: args.projectTitle,
      taskTitle: args.taskTitle,
      highlightExpiresAt,
    })
    if (!result.bundle) {
      throw new Error('First-focus confirmation did not create a plan')
    }
    return {
      status: result.status,
      bundle: result.bundle,
      highlightExpiresAt,
    }
  },
})

export const cancelFirstFocus = internalMutation({
  args: {
    ...identityArgs,
    requestId: v.string(),
    goalTitle: v.string(),
    projectTitle: v.string(),
    taskTitle: v.string(),
  },
  returns: v.object({ status: v.literal('cancelled') }),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    await confirmFirstFocusPlan(ctx, identity, {
      requestId: args.requestId,
      confirmed: false,
      goalTitle: args.goalTitle,
      projectTitle: args.projectTitle,
      taskTitle: args.taskTitle,
      highlightExpiresAt: Date.now() + 1,
    })
    return { status: 'cancelled' as const }
  },
})

export const completeHighlight = internalMutation({
  args: {
    ...identityArgs,
    requestId: v.string(),
    taskId: v.id('tasks'),
  },
  returns: completeHighlightResultValidator,
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    return await completeHighlightedTask(ctx, identity, {
      requestId: args.requestId,
      taskId: args.taskId as Id<'tasks'>,
    })
  },
})

export const confirmWeb3 = internalMutation({
  args: {
    ...identityArgs,
    actionId: v.id('web3Actions'),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    return await confirmWeb3Action(
      ctx,
      identity.userId,
      args.actionId,
      args.summary,
    )
  },
})

export const cancelWeb3 = internalMutation({
  args: {
    ...identityArgs,
    actionId: v.id('web3Actions'),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = channelIdentity(args)
    return await cancelWeb3Action(
      ctx,
      identity.userId,
      args.actionId,
      args.summary,
    )
  },
})
