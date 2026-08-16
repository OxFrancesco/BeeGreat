// Socket route refresh and cross-chain progress bookkeeping for confirmed
// swap actions: re-quoted route swaps, origin-chain settlement, and the
// destination status poller's state transitions. Plain TypeScript helpers
// only — the Convex function definitions live in web3Actions.ts.

import type { Infer } from 'convex/values'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { SOCKET_CHAINS, parseTokenAmount } from '../socketSwap'
import type {
  socketApprovalValidator,
  socketProgressValidator,
  web3TransactionValidator,
} from '../web3ActionValidators'

export type RefreshedSocketRoute = {
  quoteId: string
  outputAmount: string
  minimumOutputAmount: string
  provider: string
  estimatedTimeSeconds: number
  quoteExpiresAt: number
  monitoringDeadlineAt: number
  statusIntervalSeconds: number
  approval?: Infer<typeof socketApprovalValidator>
  transaction: Infer<typeof web3TransactionValidator>
}

/**
 * Executor-only: swap a freshly quoted Socket route into a confirmed action
 * whose original quote went stale. The argument shape cannot alter what the
 * user confirmed (chains, tokens, input amount), and a route that guarantees
 * less than the confirmed minimum output is rejected, so the executed swap
 * never pays less than the summary the user approved.
 */
export async function refreshConfirmedSocketRoute(
  ctx: MutationCtx,
  { actionId, route }: {
    actionId: Id<'web3Actions'>
    route: RefreshedSocketRoute
  },
) {
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
}

/** Persist Socket's single approval+route batch before Crossmint approval. */
export async function recordSocketPreparedStep(
  ctx: MutationCtx,
  {
    actionId,
    transactionId,
  }: { actionId: Id<'web3Actions'>; transactionId: string },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.payload.kind !== 'socket_swap' ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  )
    return null
  if (!transactionId.trim())
    throw new Error('Crossmint transaction id is empty.')
  const execution = action.crossmintExecution ?? []
  if (execution.some((step) => step.transactionId === transactionId))
    return null
  if (execution.some((step) => step.status === 'prepared')) {
    throw new Error('A Socket origin transaction is already pending.')
  }
  const now = Date.now()
  await ctx.db.patch(actionId, {
    status: 'in_progress',
    executionStartedAt: action.executionStartedAt ?? now,
    submittedAt: action.submittedAt ?? now,
    crossmintExecution: [
      ...execution,
      { role: 'action', transactionId, status: 'prepared' as const },
    ],
    socketProgress: {
      status: 'PENDING',
      detail: 'Submitting the approval and route atomically…',
      updatedAt: now,
    },
  })
  await ctx.scheduler.runAfter(
    70_000,
    internal.web3.reconcileSocketCrossmintAction,
    { actionId },
  )
  return null
}

/** Origin settlement starts Socket's independent destination status poller. */
export async function recordSocketOriginSuccessStep(
  ctx: MutationCtx,
  args: {
    actionId: Id<'web3Actions'>
    transactionId: string
    hash: string
    explorerLink: string
  },
) {
  const action = await ctx.db.get(args.actionId)
  if (!action || action.payload.kind !== 'socket_swap') return null
  const execution = action.crossmintExecution ?? []
  const index = execution.findIndex(
    (step) => step.transactionId === args.transactionId,
  )
  if (index < 0 || execution[index].status === 'success') return null
  const now = Date.now()
  await ctx.db.patch(args.actionId, {
    status: 'in_progress',
    crossmintExecution: execution.map((step, stepIndex) =>
      stepIndex === index
        ? {
            ...step,
            status: 'success' as const,
            hash: args.hash,
            explorerLink: args.explorerLink,
          }
        : step,
    ),
    result: [
      ...(action.result ?? []),
      { hash: args.hash, explorerLink: args.explorerLink || null },
    ],
    socketProgress: {
      status: 'PENDING',
      detail: `Moving funds to ${action.payload.destinationChain === 'base' ? 'Base' : 'Arbitrum'}…`,
      originTxHash: args.hash,
      updatedAt: now,
    },
  })
  await ctx.scheduler.runAfter(
    action.payload.statusIntervalSeconds * 1_000,
    internal.web3.pollSocketSwapStatus,
    { actionId: args.actionId },
  )
  return null
}

export async function recordSocketOriginFailureStep(
  ctx: MutationCtx,
  args: {
    actionId: Id<'web3Actions'>
    transactionId?: string
    error: string
  },
) {
  const action = await ctx.db.get(args.actionId)
  if (
    !action ||
    action.payload.kind !== 'socket_swap' ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  )
    return null
  await ctx.db.patch(args.actionId, {
    status: 'failed',
    settledAt: Date.now(),
    error: args.error,
    crossmintExecution: (action.crossmintExecution ?? []).map((step) =>
      !args.transactionId || step.transactionId === args.transactionId
        ? { ...step, status: 'failed' as const }
        : step,
    ),
  })
  await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
    actionId: args.actionId,
  })
  return null
}

/** Mark a Socket route as submitted while destination settlement continues. */
export async function recordSocketSubmittedStep(
  ctx: MutationCtx,
  {
    actionId,
    result,
    originTxHash,
  }: {
    actionId: Id<'web3Actions'>
    result: NonNullable<Doc<'web3Actions'>['result']>
    originTxHash?: string
  },
) {
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
    executionStartedAt: action.executionStartedAt ?? Date.now(),
    submittedAt: action.submittedAt ?? Date.now(),
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
}

/** Persist Socket's cross-chain status and close the action when it is final. */
export async function recordSocketProgressStep(
  ctx: MutationCtx,
  {
    actionId,
    progress,
    result,
  }: {
    actionId: Id<'web3Actions'>
    progress: Infer<typeof socketProgressValidator>
    result?: NonNullable<Doc<'web3Actions'>['result']>
  },
) {
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
    ...(status !== 'in_progress' ? { settledAt: Date.now() } : {}),
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
}

/** Keep a route live when Socket status is briefly unavailable. */
export async function recordSocketPollingDelayStep(
  ctx: MutationCtx,
  actionId: Id<'web3Actions'>,
) {
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
}
