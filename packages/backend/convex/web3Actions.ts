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

const payloadValidator = v.union(
  v.object({
    kind: v.literal('send_tokens'),
    recipient: v.string(),
    token: v.string(),
    amount: v.string(),
  }),
  v.object({
    kind: v.literal('execute_plan'),
    chainId: v.number(),
    transactions: v.array(
      v.object({ to: v.string(), data: v.string(), value: v.string() }),
    ),
  }),
)

function publicView(action: Doc<'web3Actions'>) {
  return {
    id: action._id,
    summary: action.summary,
    kind: action.payload.kind,
    status: action.status,
    expiresAt: action.expiresAt,
    result: action.result ?? null,
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
    payload: payloadValidator,
  },
  handler: async (ctx, { userId, summary, payload }) => {
    const now = Date.now()
    const id = await ctx.db.insert('web3Actions', {
      userId,
      summary,
      payload,
      status: 'pending',
      createdAt: now,
      expiresAt: now + ACTION_TTL_MS,
    })
    return { id, expiresAt: now + ACTION_TTL_MS }
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

/** Executor bookkeeping: record the outcome of a confirmed action. */
export const recordResult = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    result: v.optional(
      v.array(
        v.object({
          hash: v.union(v.string(), v.null()),
          explorerLink: v.union(v.string(), v.null()),
        }),
      ),
    ),
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

export type Web3ActionId = Id<'web3Actions'>
