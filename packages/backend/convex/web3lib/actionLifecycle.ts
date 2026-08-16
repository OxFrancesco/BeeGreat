// Confirmation-gate lifecycle for Web3 actions that move funds: create,
// confirm, cancel, expiry, and generic executor settlement. Plain TypeScript
// helpers only — the Convex function definitions live in web3Actions.ts.

import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { requirePowerup, isPowerupEnabled } from '../powerups'
import { yoloEnabledForUser } from '../web3Prefs'
import { authorizeAgentJobWeb3Action } from '../agentJobGrants'

/** Pending actions die after 10 minutes so stale confirm cards are inert. */
export const ACTION_TTL_MS = 10 * 60 * 1000
/** Keeps the private continuation small enough for a single settled signal. */
export const MAX_WEB3_CONTINUATION_LENGTH = 1_000

const THREAD_SUFFIX = /^[1-9]\d{0,15}$/

export function publicView(action: Doc<'web3Actions'>) {
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
export function withExpiry(action: Doc<'web3Actions'>, now: number) {
  if (action.status === 'pending' && action.expiresAt <= now) {
    return { ...action, status: 'expired' as const }
  }
  return action
}

function belongsToUserConversation(userId: string, conversationId: string) {
  if (conversationId === userId) return true
  const prefix = `${userId}~`
  return (
    conversationId.startsWith(prefix) &&
    THREAD_SUFFIX.test(conversationId.slice(prefix.length))
  )
}

/**
 * Validate and normalize the private routing context captured by every
 * prepared action. Both the broker HTTP boundary and the durable create seam
 * call this so an action can never be routed across users.
 */
export function web3ActionContext(
  userId: string,
  conversationId?: string,
  continuation?: string,
) {
  if (
    conversationId !== undefined &&
    !belongsToUserConversation(userId, conversationId)
  ) {
    throw new Error(
      'The originating conversation does not belong to this user.',
    )
  }
  const cleanContinuation = continuation?.trim()
  if (cleanContinuation && !conversationId) {
    throw new Error('A continuation requires its originating conversation.')
  }
  if (
    cleanContinuation &&
    cleanContinuation.length > MAX_WEB3_CONTINUATION_LENGTH
  ) {
    throw new Error('The Web3 continuation is too long.')
  }
  return {
    ...(conversationId ? { conversationId } : {}),
    ...(cleanContinuation ? { continuation: cleanContinuation } : {}),
  }
}

/**
 * Agent/internal: create an action awaiting client confirmation. When the
 * signed-in user pre-authorized YOLO mode, a smart-wallet action is confirmed
 * immediately and its executor is scheduled. EOA actions always stay pending
 * for the app's connected-wallet flow.
 */
export async function createWeb3Action(
  ctx: MutationCtx,
  {
    userId,
    jobRunId,
    jobSugarAction,
    jobPoolAddress,
    conversationId,
    continuation,
    summary,
    payload,
  }: {
    userId: string
    jobRunId?: Id<'agentJobRuns'>
    jobSugarAction?: string
    jobPoolAddress?: string
    conversationId?: string
    continuation?: string
    summary: string
    payload: Doc<'web3Actions'>['payload']
  },
) {
  const actionContext = web3ActionContext(userId, conversationId, continuation)
  const now = Date.now()
  const actionExpiresAt = now + ACTION_TTL_MS
  if (jobRunId) {
    if (payload.kind !== 'execute_plan' || !jobSugarAction) {
      throw new Error(
        'Scheduled wallet grants support only scoped Aerodrome smart-wallet actions',
      )
    }
    await authorizeAgentJobWeb3Action(ctx, {
      userId,
      jobRunId,
      sugarAction: jobSugarAction,
      poolAddress: jobPoolAddress,
    })
  }
  const autoConfirm = jobRunId
    ? true
    : payload.kind !== 'execute_eoa_plan' &&
      (await yoloEnabledForUser(ctx, userId)) &&
      (await isPowerupEnabled(ctx, userId, 'web3'))
  const id = await ctx.db.insert('web3Actions', {
    userId,
    ...(jobRunId ? { jobRunId } : {}),
    ...actionContext,
    summary,
    payload,
    status: autoConfirm ? 'confirmed' : 'pending',
    createdAt: now,
    expiresAt: actionExpiresAt,
    ...(autoConfirm
      ? {
          confirmedAt: now,
          executionStartedAt: now,
          autoConfirmed: true,
        }
      : {}),
  })
  if (autoConfirm) {
    await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
      actionId: id,
    })
  } else {
    await ctx.scheduler.runAt(
      actionExpiresAt,
      internal.web3Actions.expirePending,
      {
        actionId: id,
      },
    )
  }
  return { id, expiresAt: actionExpiresAt, autoConfirmed: autoConfirm }
}

/** Materializes expiry so channel outboxes and subscriptions see a transition. */
export async function expirePendingWeb3Action(
  ctx: MutationCtx,
  actionId: Id<'web3Actions'>,
) {
  const action = await ctx.db.get(actionId)
  if (!action || action.status !== 'pending' || action.expiresAt > Date.now()) {
    return null
  }
  await ctx.db.patch(actionId, { status: 'expired', settledAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
    actionId,
  })
  return null
}

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
    await ctx.db.patch(actionId, { status: 'expired', settledAt: now })
    await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
      actionId,
    })
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
  await ctx.db.patch(actionId, {
    status: 'confirmed',
    confirmedAt: now,
    executionStartedAt: now,
  })
  await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
    actionId,
  })
  return null
}

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

/** Executor bookkeeping: record the outcome of a confirmed action. */
export async function recordWeb3ActionResult(
  ctx: MutationCtx,
  {
    actionId,
    result,
    error,
  }: {
    actionId: Id<'web3Actions'>
    result?: Doc<'web3Actions'>['result']
    error?: string
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  )
    return null
  await ctx.db.patch(actionId, {
    status: error === undefined ? 'executed' : 'failed',
    result,
    error,
    settledAt: Date.now(),
  })
  await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
    actionId,
  })
  return null
}
