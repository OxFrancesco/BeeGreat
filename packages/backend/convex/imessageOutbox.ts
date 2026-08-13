import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

const LEASE_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000
const terminalStatusValidator = v.union(
  v.literal('executed'),
  v.literal('failed'),
  v.literal('refunded'),
  v.literal('expired'),
)

function threadIdFromConversation(userId: string, conversationId?: string) {
  const prefix = `${userId}~`
  if (!conversationId?.startsWith(prefix)) return null
  const value = Number(conversationId.slice(prefix.length))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

/** Enqueue one terminal update only when the action originated in iMessage. */
export const enqueueAction = internalMutation({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      (action.status !== 'executed' &&
        action.status !== 'failed' &&
        action.status !== 'refunded' &&
        action.status !== 'expired')
    )
      return null
    const actionStatus = action.status as
      'executed' | 'failed' | 'refunded' | 'expired'
    const threadId = threadIdFromConversation(
      action.userId,
      action.conversationId,
    )
    if (threadId === null) return null
    const thread = await ctx.db
      .query('chatThreads')
      .withIndex('by_user_id_and_thread_id', (q) =>
        q.eq('userId', action.userId).eq('threadId', threadId),
      )
      .unique()
    if (!thread || thread.source !== 'imessage') return null
    const existing = await ctx.db
      .query('imessageDeliveries')
      .withIndex('by_action_and_status', (q) =>
        q.eq('actionId', actionId).eq('actionStatus', actionStatus),
      )
      .unique()
    if (existing) return null
    const explorerLink =
      action.socketProgress?.destinationExplorerLink ??
      [...(action.result ?? [])].reverse().find((item) => item.explorerLink)
        ?.explorerLink ??
      undefined
    const now = Date.now()
    await ctx.db.insert('imessageDeliveries', {
      userId: action.userId,
      threadId,
      ...(thread.imessageConnectionId
        ? { imessageConnectionId: thread.imessageConnectionId }
        : {}),
      actionId,
      actionStatus,
      kind: action.payload.kind,
      summary: action.summary,
      ...(action.socketProgress?.detail
        ? { detail: action.socketProgress.detail }
        : {}),
      ...(action.error ? { error: action.error } : {}),
      ...(explorerLink ? { explorerLink } : {}),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    })
    return null
  },
})

const claimedValidator = v.object({
  deliveryId: v.id('imessageDeliveries'),
  leaseId: v.string(),
  address: v.string(),
  action: v.object({
    summary: v.string(),
    kind: v.union(
      v.literal('send_tokens'),
      v.literal('execute_plan'),
      v.literal('execute_eoa_plan'),
      v.literal('socket_swap'),
    ),
    status: terminalStatusValidator,
    detail: v.optional(v.string()),
    error: v.optional(v.string()),
    explorerLink: v.optional(v.string()),
  }),
})

/** Lease the oldest due message. Expired leases become eligible again. */
export const claimNext = internalMutation({
  args: { leaseId: v.string() },
  returns: v.union(v.null(), claimedValidator),
  handler: async (ctx, { leaseId }) => {
    if (!leaseId.trim()) throw new Error('Delivery lease id is empty.')
    const now = Date.now()
    const expired = await ctx.db
      .query('imessageDeliveries')
      .withIndex('by_status_and_lease_expiry', (q) =>
        q.eq('status', 'leased').lte('leaseExpiresAt', now),
      )
      .first()
    if (expired) {
      await ctx.db.patch(expired._id, {
        status: 'pending',
        nextAttemptAt: now,
        leaseId: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      })
    }
    const delivery = await ctx.db
      .query('imessageDeliveries')
      .withIndex('by_status_and_next_attempt', (q) =>
        q.eq('status', 'pending').lte('nextAttemptAt', now),
      )
      .first()
    if (!delivery) return null

    let connection = delivery.imessageConnectionId
      ? await ctx.db.get(delivery.imessageConnectionId)
      : null
    if (!connection || connection.userId !== delivery.userId) {
      const connections = await ctx.db
        .query('imessageConnections')
        .withIndex('by_user', (q) => q.eq('userId', delivery.userId))
        .take(20)
      connection = connections.reduce(
        (latest, item) =>
          !latest || item.updatedAt > latest.updatedAt ? item : latest,
        null as (typeof connections)[number] | null,
      )
    }
    if (!connection) {
      const attempts = delivery.attempts + 1
      await ctx.db.patch(delivery._id, {
        attempts,
        nextAttemptAt:
          now + Math.min(MAX_BACKOFF_MS, 2 ** Math.min(attempts, 8) * 1_000),
        updatedAt: now,
      })
      return null
    }
    await ctx.db.patch(delivery._id, {
      status: 'leased',
      leaseId,
      leaseExpiresAt: now + LEASE_MS,
      updatedAt: now,
    })
    return {
      deliveryId: delivery._id,
      leaseId,
      address: connection.address,
      action: {
        summary: delivery.summary,
        kind: delivery.kind,
        status: delivery.actionStatus,
        ...(delivery.detail ? { detail: delivery.detail } : {}),
        ...(delivery.error ? { error: delivery.error } : {}),
        ...(delivery.explorerLink
          ? { explorerLink: delivery.explorerLink }
          : {}),
      },
    }
  },
})

export const complete = internalMutation({
  args: { deliveryId: v.id('imessageDeliveries'), leaseId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (
      !delivery ||
      delivery.status !== 'leased' ||
      delivery.leaseId !== args.leaseId
    )
      return null
    const now = Date.now()
    await ctx.db.patch(delivery._id, {
      status: 'delivered',
      attempts: delivery.attempts + 1,
      deliveredAt: now,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    return null
  },
})

export const retry = internalMutation({
  args: { deliveryId: v.id('imessageDeliveries'), leaseId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (
      !delivery ||
      delivery.status !== 'leased' ||
      delivery.leaseId !== args.leaseId
    )
      return null
    const attempts = delivery.attempts + 1
    const now = Date.now()
    await ctx.db.patch(delivery._id, {
      status: 'pending',
      attempts,
      nextAttemptAt:
        now + Math.min(MAX_BACKOFF_MS, 2 ** Math.min(attempts, 8) * 1_000),
      leaseId: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    return null
  },
})
