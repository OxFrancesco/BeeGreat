import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireUserId } from './helpers'
import { requirePowerup } from './powerups'
import { SOCKET_CHAINS, parseTokenAmount } from './socketSwap'
import {
  socketApprovalValidator,
  socketProgressValidator,
  web3ActionPayloadValidator,
  web3ActionResultValidator,
  web3TransactionValidator,
} from './web3ActionValidators'

// Server-side confirmation gate for Web3 actions that move funds.
//
// Lifecycle: the agent *prepares* a pending action (internal.web3.prepare*),
// Bee renders a `confirm` component carrying the action id, and the signed-in
// app calls `confirm` — the only path to 'confirmed'. Confirming schedules the
// internal executor in web3.ts, which signs with the Crossmint server signer.
// The agent can read status but can never confirm or execute, so a prompt
// injection cannot spend from the wallet.

/** Pending actions die after 10 minutes so stale confirm cards are inert. */
export const ACTION_TTL_MS = 10 * 60 * 1000

function publicView(action: Doc<'web3Actions'>) {
  return {
    id: action._id,
    summary: action.summary,
    kind: action.payload.kind,
    status: action.status,
    expiresAt: action.expiresAt,
    result: action.result ?? null,
    socketProgress: action.socketProgress ?? null,
    error: action.error ?? null,
  }
}

/** Lazily reflect expiry: pending actions past their TTL read as expired. */
function withExpiry(action: Doc<'web3Actions'>, now: number) {
  if (action.status === 'pending' && action.expiresAt <= now) {
    return { ...action, status: 'expired' as const }
  }
  return action
}

/** Agent/internal: create a pending action awaiting in-app confirmation. */
export const create = internalMutation({
  args: {
    userId: v.string(),
    summary: v.string(),
    payload: web3ActionPayloadValidator,
  },
  handler: async (ctx, { userId, summary, payload }) => {
    const now = Date.now()
    const actionExpiresAt = now + ACTION_TTL_MS
    const id = await ctx.db.insert('web3Actions', {
      userId,
      summary,
      payload,
      status: 'pending',
      createdAt: now,
      expiresAt: actionExpiresAt,
    })
    return { id, expiresAt: actionExpiresAt }
  },
})

/** Internal: full row for the executor and the agent bridge. */
export const get = internalQuery({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId)
    return action ? withExpiry(action, Date.now()) : null
  },
})

/** Agent bridge: status of one action scoped to the requesting user. */
export const getForUser = internalQuery({
  args: { userId: v.string(), actionId: v.id('web3Actions') },
  handler: async (ctx, { userId, actionId }) => {
    const action = await ctx.db.get(actionId)
    if (!action || action.userId !== userId) return null
    return publicView(withExpiry(action, Date.now()))
  },
})

/** App-facing: the confirm card subscribes to live status by action id. */
export const status = query({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (!action || action.userId !== userId) return null
    return publicView(withExpiry(action, Date.now()))
  },
})

/**
 * App-facing: the ONLY path that authorizes moving funds. Requires the
 * signed-in owner, a live pending action, and the enabled power-up; then
 * schedules the internal executor exactly once.
 */
export const confirm = mutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (!action || action.userId !== userId) {
      throw new Error('This confirmation is no longer available.')
    }
    await requirePowerup(ctx, userId, 'web3')
    const now = Date.now()
    if (action.status === 'pending' && action.expiresAt <= now) {
      await ctx.db.patch(actionId, { status: 'expired' })
      throw new Error('This confirmation expired. Ask Bee to prepare it again.')
    }
    if (action.status !== 'pending') {
      throw new Error(`This action was already ${action.status}.`)
    }
    await ctx.db.patch(actionId, { status: 'confirmed', confirmedAt: now })
    await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
      actionId,
    })
    return null
  },
})

/** App-facing: decline a pending action from the confirm card. */
export const cancel = mutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (!action || action.userId !== userId) return null
    if (action.status === 'pending') {
      await ctx.db.patch(actionId, { status: 'cancelled' })
    }
    return null
  },
})

/**
 * Executor-only: swap a freshly quoted Socket route into a confirmed action
 * whose original quote went stale. The argument shape cannot alter what the
 * user confirmed (chains, tokens, input amount), and a route that guarantees
 * less than the confirmed minimum output is rejected, so the executed swap
 * never pays less than the summary the user approved.
 */
export const refreshSocketRoute = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    route: v.object({
      quoteId: v.string(),
      outputAmount: v.string(),
      minimumOutputAmount: v.string(),
      provider: v.string(),
      estimatedTimeSeconds: v.number(),
      quoteExpiresAt: v.number(),
      monitoringDeadlineAt: v.number(),
      statusIntervalSeconds: v.number(),
      approval: v.optional(socketApprovalValidator),
      transaction: web3TransactionValidator,
    }),
  },
  returns: v.null(),
  handler: async (ctx, { actionId, route }) => {
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.status !== 'confirmed' ||
      action.payload.kind !== 'socket_swap'
    ) {
      throw new Error('Only a confirmed Socket swap can refresh its route.')
    }
    const decimals =
      SOCKET_CHAINS[action.payload.destinationChain].tokens[
        action.payload.outputToken
      ].decimals
    const confirmedMinimum = BigInt(
      parseTokenAmount(action.payload.minimumOutputAmount, decimals),
    )
    const refreshedMinimum = BigInt(
      parseTokenAmount(route.minimumOutputAmount, decimals),
    )
    if (refreshedMinimum < confirmedMinimum) {
      throw new Error(
        'The refreshed route guarantees less than the amount you confirmed. Ask Bee to prepare the swap again.',
      )
    }
    const { approval: _staleApproval, ...confirmedTerms } = action.payload
    await ctx.db.patch(actionId, {
      payload: { ...confirmedTerms, ...route },
    })
    return null
  },
})

/** Executor bookkeeping: record the outcome of a confirmed action. */
export const recordResult = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    result: v.optional(web3ActionResultValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { actionId, result, error }) => {
    const action = await ctx.db.get(actionId)
    if (!action || action.status !== 'confirmed') return null
    await ctx.db.patch(actionId, {
      status: error === undefined ? 'executed' : 'failed',
      result,
      error,
    })
    return null
  },
})

/** Mark a Socket route as submitted while destination settlement continues. */
export const recordSocketSubmitted = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    result: web3ActionResultValidator,
    originTxHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { actionId, result, originTxHash }) => {
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.status !== 'confirmed' ||
      action.payload.kind !== 'socket_swap'
    ) {
      return null
    }
    await ctx.db.patch(actionId, {
      status: 'in_progress',
      result,
      socketProgress: {
        status: 'PENDING',
        detail: `Moving funds to ${action.payload.destinationChain === 'base' ? 'Base' : 'Arbitrum'}…`,
        ...(originTxHash ? { originTxHash } : {}),
        updatedAt: Date.now(),
      },
    })
    await ctx.scheduler.runAfter(
      action.payload.statusIntervalSeconds * 1_000,
      internal.web3.pollSocketSwapStatus,
      { actionId },
    )
    return null
  },
})

/** Persist Socket's cross-chain status and close the action when it is final. */
export const recordSocketProgress = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    progress: socketProgressValidator,
    result: v.optional(web3ActionResultValidator),
  },
  returns: v.null(),
  handler: async (ctx, { actionId, progress, result }) => {
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.status !== 'in_progress' ||
      action.payload.kind !== 'socket_swap'
    ) {
      return null
    }
    const status =
      progress.status === 'COMPLETED'
        ? ('executed' as const)
        : progress.status === 'REFUNDED'
          ? ('refunded' as const)
          : progress.status === 'FAILED' || progress.status === 'EXPIRED'
            ? ('failed' as const)
            : ('in_progress' as const)
    await ctx.db.patch(actionId, {
      status,
      socketProgress: progress,
      ...(result ? { result } : {}),
      ...(status === 'failed'
        ? {
            error:
              'The cross-chain route did not complete. No further transaction will be sent.',
          }
        : {}),
    })
    if (status === 'in_progress') {
      await ctx.scheduler.runAfter(
        action.payload.statusIntervalSeconds * 1_000,
        internal.web3.pollSocketSwapStatus,
        { actionId },
      )
    }
    return null
  },
})

/** Keep a route live when Socket status is briefly unavailable. */
export const recordSocketPollingDelay = internalMutation({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.status !== 'in_progress' ||
      action.payload.kind !== 'socket_swap'
    ) {
      return null
    }
    await ctx.db.patch(actionId, {
      socketProgress: {
        ...(action.socketProgress ?? {
          status: 'IN_PROGRESS' as const,
          detail: 'Moving funds…',
          updatedAt: Date.now(),
        }),
        detail: 'Transfer submitted. Checking destination settlement…',
        updatedAt: Date.now(),
      },
    })
    await ctx.scheduler.runAfter(
      action.payload.statusIntervalSeconds * 1_000,
      internal.web3.pollSocketSwapStatus,
      { actionId },
    )
    return null
  },
})

export type Web3ActionId = Id<'web3Actions'>
