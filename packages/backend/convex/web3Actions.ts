import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireUserId } from './helpers'
import { requirePowerup } from './powerups'
import {
  socketApprovalValidator,
  socketProgressValidator,
  web3ActionPayloadValidator,
  web3ActionResultValidator,
  web3TransactionValidator,
} from './web3ActionValidators'
import {
  createWeb3Action,
  expirePendingWeb3Action,
  publicView,
  recordWeb3ActionResult,
  withExpiry,
} from './web3lib/actionLifecycle'
import {
  beginEoaExecutionForUser,
  recordEoaReceiptForUser,
  recordEoaSubmissionForUser,
  reportEoaFailureForUser,
} from './web3lib/eoaTracking'
import {
  recordCrossmintFailureStep,
  recordCrossmintPreparedStep,
  recordCrossmintSuccessStep,
} from './web3lib/crossmintRecords'
import {
  recordSocketOriginFailureStep,
  recordSocketOriginSuccessStep,
  recordSocketPollingDelayStep,
  recordSocketPreparedStep,
  recordSocketProgressStep,
  recordSocketSubmittedStep,
  refreshConfirmedSocketRoute,
} from './web3lib/socketRefresh'

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
//
// Handler bodies live in web3lib/ (actionLifecycle, eoaTracking,
// crossmintRecords, socketRefresh); this file keeps the thin Convex function
// definitions so the api.web3Actions.* / internal.web3Actions.* paths never move.

export {
  ACTION_TTL_MS,
  MAX_WEB3_CONTINUATION_LENGTH,
  cancelWeb3Action,
  confirmWeb3Action,
  web3ActionContext,
} from './web3lib/actionLifecycle'
import { cancelWeb3Action, confirmWeb3Action } from './web3lib/actionLifecycle'

/**
 * Agent/internal: create an action awaiting client confirmation. When the
 * signed-in user pre-authorized YOLO mode, a smart-wallet action is confirmed
 * immediately and its executor is scheduled. EOA actions always stay pending
 * for the app's connected-wallet flow.
 */
export const create = internalMutation({
  args: {
    userId: v.string(),
    jobRunId: v.optional(v.id('agentJobRuns')),
    jobSugarAction: v.optional(v.string()),
    jobPoolAddress: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    continuation: v.optional(v.string()),
    summary: v.string(),
    payload: web3ActionPayloadValidator,
  },
  returns: v.object({
    id: v.id('web3Actions'),
    expiresAt: v.number(),
    autoConfirmed: v.boolean(),
  }),
  handler: async (ctx, args) => await createWeb3Action(ctx, args),
})

/** Materializes expiry so channel outboxes and subscriptions see a transition. */
export const expirePending = internalMutation({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) =>
    await expirePendingWeb3Action(ctx, actionId),
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
    await requirePowerup(ctx, userId, 'web3')
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
 * user's standing YOLO opt-in applied in `create`). See
 * `confirmWeb3Action` in web3lib/actionLifecycle.ts.
 */
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
  handler: async (ctx, { actionId }) =>
    await beginEoaExecutionForUser(ctx, await requireUserId(ctx), actionId),
})

/** Record each WalletConnect hash as submitted, never as settled. */
export const recordEoaSubmission = mutation({
  args: {
    actionId: v.id('web3Actions'),
    index: v.number(),
    hash: v.string(),
    role: v.optional(v.union(v.literal('approval'), v.literal('action'))),
  },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) =>
    await recordEoaSubmissionForUser(ctx, await requireUserId(ctx), args),
})

/** Settle a linked-wallet step only after its successful on-chain receipt. */
export const recordEoaReceipt = mutation({
  args: {
    actionId: v.id('web3Actions'),
    index: v.number(),
    hash: v.string(),
  },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) =>
    await recordEoaReceiptForUser(ctx, await requireUserId(ctx), args),
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
  handler: async (ctx, args) =>
    await reportEoaFailureForUser(ctx, await requireUserId(ctx), args),
})

/** App-facing: decline a pending action from the confirm card. */
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
  handler: async (ctx, args) => await refreshConfirmedSocketRoute(ctx, args),
})

/** Executor bookkeeping: record the outcome of a confirmed action. */
export const recordResult = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    result: v.optional(web3ActionResultValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => await recordWeb3ActionResult(ctx, args),
})

/** Persist the Crossmint operation id before approving it. */
export const recordCrossmintPrepared = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    role: v.union(v.literal('approval'), v.literal('action')),
    transactionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => await recordCrossmintPreparedStep(ctx, args),
})

/** Settle one durable Crossmint step and continue only after an approval. */
export const recordCrossmintSuccess = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    transactionId: v.string(),
    hash: v.string(),
    explorerLink: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => await recordCrossmintSuccessStep(ctx, args),
})

/** Close a durable Crossmint step only after Crossmint reports failure. */
export const recordCrossmintFailure = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    transactionId: v.optional(v.string()),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => await recordCrossmintFailureStep(ctx, args),
})

/** Persist Socket's single approval+route batch before Crossmint approval. */
export const recordSocketPrepared = internalMutation({
  args: { actionId: v.id('web3Actions'), transactionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => await recordSocketPreparedStep(ctx, args),
})

/** Origin settlement starts Socket's independent destination status poller. */
export const recordSocketOriginSuccess = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    transactionId: v.string(),
    hash: v.string(),
    explorerLink: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    await recordSocketOriginSuccessStep(ctx, args),
})

export const recordSocketOriginFailure = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    transactionId: v.optional(v.string()),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    await recordSocketOriginFailureStep(ctx, args),
})

/** Mark a Socket route as submitted while destination settlement continues. */
export const recordSocketSubmitted = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    result: web3ActionResultValidator,
    originTxHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => await recordSocketSubmittedStep(ctx, args),
})

/** Persist Socket's cross-chain status and close the action when it is final. */
export const recordSocketProgress = internalMutation({
  args: {
    actionId: v.id('web3Actions'),
    progress: socketProgressValidator,
    result: v.optional(web3ActionResultValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => await recordSocketProgressStep(ctx, args),
})

/** Keep a route live when Socket status is briefly unavailable. */
export const recordSocketPollingDelay = internalMutation({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) =>
    await recordSocketPollingDelayStep(ctx, actionId),
})

export type Web3ActionId = Id<'web3Actions'>
