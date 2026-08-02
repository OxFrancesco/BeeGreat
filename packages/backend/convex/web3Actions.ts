import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireUserId } from './helpers'
import { requirePowerup, isPowerupEnabled } from './powerups'
import { SOCKET_CHAINS, parseTokenAmount } from './socketSwap'
import { yoloEnabledForUser } from './web3Prefs'
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
// Bee renders a `confirm` component carrying the action id. Smart-wallet actions
// can be confirmed by a signed-in app or the mapped user's trusted iMessage
// adapter, then run in web3.ts with the Crossmint signer. EOA actions can only
// be claimed in a signed-in app and remain in the connected wallet for signing.
// The agent can read status but can never call either authorization route.
//
// YOLO mode (web3Prefs, settable only by the signed-in app) is the smart-wallet
// alternative to a per-action tap. EOA actions always bypass YOLO.
//
// When an action reaches a terminal state, `notifyActionSettled` pushes a
// `web3.action_settled` event to the agent worker so Bee can continue
// long-running multi-step plans (e.g. bridge, then open a pool position)
// without the user poking the chat.

/** Pending actions die after 10 minutes so stale confirm cards are inert. */
export const ACTION_TTL_MS = 10 * 60 * 1000

const EVM_HASH = /^0x[0-9a-fA-F]{64}$/
const EOA_CHAIN_EXPLORERS: Record<number, string> = {
  10: 'https://optimistic.etherscan.io/tx/',
  130: 'https://uniscan.xyz/tx/',
  252: 'https://fraxscan.com/tx/',
  1135: 'https://blockscout.lisk.com/tx/',
  1868: 'https://soneium.blockscout.com/tx/',
  5330: 'https://explorer.superseed.xyz/tx/',
  8453: 'https://basescan.org/tx/',
  34443: 'https://explorer.mode.network/tx/',
  42220: 'https://celoscan.io/tx/',
  57073: 'https://explorer.inkonchain.com/tx/',
}

function publicView(action: Doc<'web3Actions'>) {
  return {
    id: action._id,
    summary: action.summary,
    kind: action.payload.kind,
    status: action.status,
    expiresAt: action.expiresAt,
    autoConfirmed: action.autoConfirmed ?? false,
    eoaRequest:
      action.payload.kind === 'execute_eoa_plan'
        ? {
            walletAddress: action.payload.walletAddress,
            chainId: action.payload.chainId,
            stepCount: action.payload.transactions.length,
          }
        : null,
    // Task-based timing so callers (the app card and the agent's wait tool)
    // can budget how long this action is expected to run.
    timing:
      action.payload.kind === 'socket_swap'
        ? {
            estimatedTimeSeconds: action.payload.estimatedTimeSeconds,
            monitoringDeadlineAt: action.payload.monitoringDeadlineAt,
            statusIntervalSeconds: action.payload.statusIntervalSeconds,
          }
        : null,
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

/**
 * Agent/internal: create an action awaiting client confirmation. When the
 * signed-in user pre-authorized YOLO mode, a smart-wallet action is confirmed
 * immediately and its executor is scheduled. EOA actions always stay pending
 * for the app's connected-wallet flow.
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    summary: v.string(),
    payload: web3ActionPayloadValidator,
  },
  handler: async (ctx, { userId, summary, payload }) => {
    const now = Date.now()
    const actionExpiresAt = now + ACTION_TTL_MS
    const autoConfirm =
      payload.kind !== 'execute_eoa_plan' &&
      (await yoloEnabledForUser(ctx, userId)) &&
      (await isPowerupEnabled(ctx, userId, 'web3'))
    const id = await ctx.db.insert('web3Actions', {
      userId,
      summary,
      payload,
      status: autoConfirm ? 'confirmed' : 'pending',
      createdAt: now,
      expiresAt: actionExpiresAt,
      ...(autoConfirm ? { confirmedAt: now, autoConfirmed: true } : {}),
    })
    if (autoConfirm) {
      await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
        actionId: id,
      })
    }
    return { id, expiresAt: actionExpiresAt, autoConfirmed: autoConfirm }
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
 * App-facing: the manual path that authorizes moving funds (the other is the
 * user's standing YOLO opt-in applied in `create`). Requires the signed-in
 * owner, a live pending action, and the enabled power-up; then schedules the
 * internal executor exactly once.
 */
export async function confirmWeb3Action(
  ctx: MutationCtx,
  userId: string,
  actionId: Id<'web3Actions'>,
  expectedSummary?: string,
) {
  const action = await ctx.db.get(actionId)
  if (!action || action.userId !== userId) {
    throw new Error('This confirmation is no longer available.')
  }
  if (expectedSummary !== undefined && action.summary !== expectedSummary) {
    throw new Error(
      'This Web3 confirmation does not match the prepared action. Ask Bee to prepare it again.',
    )
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
  if (action.payload.kind === 'execute_eoa_plan') {
    throw new Error(
      'This action must be signed in BeeGreat with the linked wallet.',
    )
  }
  await ctx.db.patch(actionId, { status: 'confirmed', confirmedAt: now })
  await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
    actionId,
  })
  return null
}

export const confirm = mutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) =>
    await confirmWeb3Action(ctx, await requireUserId(ctx), actionId),
})

/**
 * App-facing EOA confirmation. Claims the exact pending plan but deliberately
 * does not schedule the server signer; only the connected wallet can submit it.
 */
export const beginEoaExecution = mutation({
  args: { actionId: v.id('web3Actions') },
  returns: v.object({
    walletAddress: v.string(),
    chainId: v.number(),
    transactions: v.array(web3TransactionValidator),
  }),
  handler: async (ctx, { actionId }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (!action || action.userId !== userId) {
      throw new Error('This confirmation is no longer available.')
    }
    await requirePowerup(ctx, userId, 'web3')
    if (action.payload.kind !== 'execute_eoa_plan') {
      throw new Error('This action does not use your linked wallet.')
    }
    const now = Date.now()
    if (action.status === 'pending' && action.expiresAt <= now) {
      await ctx.db.patch(actionId, { status: 'expired' })
      throw new Error('This confirmation expired. Ask Bee to prepare it again.')
    }
    if (action.status !== 'pending') {
      throw new Error(`This action was already ${action.status}.`)
    }
    const linkedWallet = await ctx.db
      .query('wallets')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('chain', 'evm'))
      .unique()
    if (
      !linkedWallet ||
      linkedWallet.kind !== 'eoa' ||
      linkedWallet.address.toLowerCase() !==
        action.payload.walletAddress.toLowerCase()
    ) {
      throw new Error('Reconnect the wallet shown in this confirmation.')
    }
    await ctx.db.patch(actionId, { status: 'confirmed', confirmedAt: now })
    return {
      walletAddress: action.payload.walletAddress,
      chainId: action.payload.chainId,
      transactions: action.payload.transactions,
    }
  },
})

/** Record each WalletConnect submission in strict plan order. */
export const recordEoaSubmission = mutation({
  args: {
    actionId: v.id('web3Actions'),
    index: v.number(),
    hash: v.string(),
  },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, { actionId, index, hash }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.userId !== userId ||
      action.payload.kind !== 'execute_eoa_plan'
    ) {
      throw new Error('This wallet submission is no longer available.')
    }
    if (action.status !== 'confirmed' && action.status !== 'in_progress') {
      throw new Error(`This action was already ${action.status}.`)
    }
    if (
      !Number.isSafeInteger(index) ||
      index !== (action.result?.length ?? 0)
    ) {
      throw new Error('Wallet transactions must be submitted in plan order.')
    }
    if (!EVM_HASH.test(hash)) {
      throw new Error('The wallet returned an invalid transaction hash.')
    }
    const explorer = EOA_CHAIN_EXPLORERS[action.payload.chainId]
    if (!explorer) throw new Error('This EVM chain is not supported.')
    const result = [
      ...(action.result ?? []),
      { hash, explorerLink: `${explorer}${hash}` },
    ]
    const done = result.length === action.payload.transactions.length
    await ctx.db.patch(actionId, {
      result,
      status: done ? 'executed' : 'in_progress',
    })
    if (done) {
      await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
        actionId,
      })
    }
    return { done }
  },
})

/** Close a claimed EOA action with a server-owned, non-sensitive error. */
export const reportEoaFailure = mutation({
  args: {
    actionId: v.id('web3Actions'),
    reason: v.union(
      v.literal('user_rejected'),
      v.literal('account_changed'),
      v.literal('wallet_error'),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { actionId, reason }) => {
    const userId = await requireUserId(ctx)
    const action = await ctx.db.get(actionId)
    if (
      !action ||
      action.userId !== userId ||
      action.payload.kind !== 'execute_eoa_plan' ||
      (action.status !== 'confirmed' && action.status !== 'in_progress')
    ) {
      return null
    }
    const submitted = action.result?.length ?? 0
    const cancelled = reason === 'user_rejected' && submitted === 0
    const error =
      reason === 'account_changed'
        ? 'The connected wallet did not match the confirmed action.'
        : reason === 'user_rejected'
          ? submitted > 0
            ? 'The wallet declined a later step after an earlier transaction was submitted.'
            : 'The wallet declined the transaction.'
          : submitted > 0
            ? 'The wallet stopped before every step could be submitted.'
            : 'The wallet could not submit the transaction.'
    await ctx.db.patch(actionId, {
      status: cancelled ? 'cancelled' : 'failed',
      error,
    })
    if (!cancelled) {
      await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
        actionId,
      })
    }
    return null
  },
})

/** App-facing: decline a pending action from the confirm card. */
export async function cancelWeb3Action(
  ctx: MutationCtx,
  userId: string,
  actionId: Id<'web3Actions'>,
  expectedSummary?: string,
) {
  const action = await ctx.db.get(actionId)
  if (!action || action.userId !== userId) return null
  if (expectedSummary !== undefined && action.summary !== expectedSummary) {
    throw new Error(
      'This Web3 confirmation does not match the prepared action. Ask Bee to prepare it again.',
    )
  }
  if (action.status === 'pending') {
    await ctx.db.patch(actionId, { status: 'cancelled' })
  }
  return null
}

export const cancel = mutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) =>
    await cancelWeb3Action(ctx, await requireUserId(ctx), actionId),
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
    await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
      actionId,
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
    } else {
      // Terminal transition: wake the agent so it can continue the plan.
      await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
        actionId,
      })
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
