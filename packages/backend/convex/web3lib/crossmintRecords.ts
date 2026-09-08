import { scheduleWeb3Reconciliation } from '../web3Reconciliation'
// Durable Crossmint execution bookkeeping for confirmed smart-wallet plans:
// each prepared operation id is persisted before approval so a crashed
// executor can be reconciled instead of double-spending. Plain TypeScript
// helpers only — the Convex function definitions live in web3Actions.ts.

import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

/** Persist the Crossmint operation id before approving it. */
export async function recordCrossmintPreparedStep(
  ctx: MutationCtx,
  {
    actionId,
    role,
    transactionId,
  }: {
    actionId: Id<'web3Actions'>
    role: 'approval' | 'action'
    transactionId: string
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.payload.kind !== 'execute_plan' ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  )
    throw new Error('This action cannot accept a prepared transaction.')
  if (!transactionId.trim())
    throw new Error('Crossmint transaction id is empty.')
  const execution = action.crossmintExecution ?? []
  const existing = execution.find(
    (step) => step.transactionId === transactionId,
  )
  if (existing) {
    if (existing.status !== 'prepared') throw new Error('This transaction is already settled.')
    return null
  }
  if (execution.some((step) => step.status === 'prepared')) {
    throw new Error(
      'A Crossmint transaction is already pending for this action.',
    )
  }
  await ctx.db.patch(actionId, {
    status: 'in_progress',
    executionStartedAt: action.executionStartedAt ?? Date.now(),
    submittedAt: action.submittedAt ?? Date.now(),
    crossmintExecution: [
      ...execution,
      { role, transactionId, status: 'prepared' as const },
    ],
  })
  await scheduleWeb3Reconciliation(ctx, actionId, 70_000)
  return null
}

/** Settle one durable Crossmint step and continue only after an approval. */
export async function recordCrossmintSuccessStep(
  ctx: MutationCtx,
  {
    actionId,
    transactionId,
    hash,
    explorerLink,
  }: {
    actionId: Id<'web3Actions'>
    transactionId: string
    hash: string
    explorerLink: string
  },
) {
  const action = await ctx.db.get(actionId)
  if (!action || action.payload.kind !== 'execute_plan' || (action.status !== 'confirmed' && action.status !== 'in_progress')) return null
  const execution = action.crossmintExecution ?? []
  const index = execution.findIndex(
    (step) => step.transactionId === transactionId,
  )
  if (index < 0) return null
  if (execution[index].status === 'success') return null
  const settled = execution.map((step, stepIndex) =>
    stepIndex === index
      ? { ...step, status: 'success' as const, hash, explorerLink }
      : step,
  )
  const result = [
    ...(action.result ?? []),
    { hash, explorerLink: explorerLink || null },
  ]
  const finalAction = execution[index].role === 'action'
  const patch: Partial<Doc<'web3Actions'>> = {
    crossmintExecution: settled,
    error: undefined, recoveryDetail: undefined, settlementFailureSource: undefined, reconcileAt: undefined, reconcileLeaseUntil: undefined, settledAt: undefined,
    result,
    status: finalAction ? 'executed' : 'confirmed',
  }
  if (!finalAction && action.recoveryObservationOnly) {
    patch.status = 'failed'
    patch.settlementFailureSource = 'pre_submission'
    patch.error = 'An earlier approval succeeded. Recovery did not submit the remaining action. Review the saved receipts before preparing another action.'
    patch.settledAt = Date.now()
  }
  if (finalAction) patch.settledAt = Date.now()
  await ctx.db.patch(actionId, patch)
  if (finalAction) {
    await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
      actionId,
    })
  } else if (!action.recoveryObservationOnly) {
    await ctx.scheduler.runAfter(0, internal.web3.executeConfirmedAction, {
      actionId,
    })
  }
  return null
}

/** Close a durable Crossmint step only after Crossmint reports failure. */
export async function recordCrossmintFailureStep(
  ctx: MutationCtx,
  {
    actionId,
    transactionId,
    error,
  }: {
    actionId: Id<'web3Actions'>
    transactionId?: string
    error: string
  },
) {
  const action = await ctx.db.get(actionId)
  if (
    !action ||
    action.payload.kind !== 'execute_plan' ||
    (action.status !== 'confirmed' && action.status !== 'in_progress')
  )
    return null
  if (!transactionId && action.crossmintExecution?.length) {
    await scheduleWeb3Reconciliation(ctx, actionId)
    return null
  }
  if (transactionId && !action.crossmintExecution?.some((step) => step.transactionId === transactionId && step.status === 'prepared')) return null
  const execution = (action.crossmintExecution ?? []).map((step) =>
    transactionId && step.transactionId === transactionId
      ? { ...step, status: 'failed' as const }
      : step,
  )
  await ctx.db.patch(actionId, {
    crossmintExecution: execution,
    status: 'failed',
    settlementFailureSource: transactionId ? 'provider' : 'pre_submission',
    reconcileAt: undefined, reconcileLeaseUntil: undefined,
    error,
    settledAt: Date.now(),
  })
  await ctx.scheduler.runAfter(0, internal.web3Notify.notifyActionSettled, {
    actionId,
  })
  return null
}
