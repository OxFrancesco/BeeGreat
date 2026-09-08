import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, type MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

function target(action: Doc<'web3Actions'>) {
  if (action.crossmintExecution?.some((step) => step.status === 'prepared')) {
    if (action.payload.kind === 'execute_plan') return internal.web3.reconcileCrossmintAction
    if (action.payload.kind === 'socket_swap') return internal.web3.reconcileSocketCrossmintAction
  }
  if (action.payload.kind === 'socket_swap' && action.socketProgress && action.submittedAt !== undefined) return internal.web3.pollSocketSwapStatus
  return undefined
}

export function reconciliationDelay(action: Doc<'web3Actions'>): number {
  return Date.now() - (action.submittedAt ?? action.createdAt) > 15 * 60_000 ? 5 * 60_000 : 15_000
}

export async function scheduleWeb3Reconciliation(ctx: MutationCtx, actionId: Id<'web3Actions'>, delay?: number) {
  const action = await ctx.db.get(actionId)
  if (!action || action.status !== 'in_progress') return null
  const handler = target(action)
  if (!handler) return null
  const wait = delay ?? reconciliationDelay(action)
  await ctx.db.patch(actionId, { reconcileAt: Date.now() + wait, reconcileLeaseUntil: undefined })
  await ctx.scheduler.runAfter(wait, handler, { actionId })
  return null
}

export const schedule = internalMutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => scheduleWeb3Reconciliation(ctx, actionId),
})

export const claim = internalMutation({
  args: { actionId: v.id('web3Actions') },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId)
    const now = Date.now()
    if (!action || action.status !== 'in_progress' || !target(action) || (action.reconcileAt ?? 0) > now || (action.reconcileLeaseUntil ?? 0) > now) return false
    await ctx.db.patch(actionId, { reconcileLeaseUntil: now + 120_000 })
    return true
  },
})

export const noteAwaitingApproval = internalMutation({
  args: { actionId: v.id('web3Actions'), transactionId: v.string() },
  handler: async (ctx, { actionId, transactionId }) => {
    const action = await ctx.db.get(actionId)
    if (action?.status === 'in_progress' && action.crossmintExecution?.some((step) => step.transactionId === transactionId && step.status === 'prepared')) {
      await ctx.db.patch(actionId, { recoveryDetail: 'The saved transaction is awaiting approval. It has not been replaced. Review this transaction with support before starting another action.' })
    }
    return null
  },
})

// A bounded sweep also recovers historical false failures. It only schedules
// observation of saved provider IDs, never a new transaction or approval.
export const watchdog = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('web3Actions').paginate({ cursor: cursor ?? null, numItems: 100 })
    for (const row of page.page) {
      let action = row
      if (action.status === 'failed' && action.settlementFailureSource === undefined) {
        const execution = action.crossmintExecution ?? []
        const unsettled = execution.some((step) => step.status !== 'success')
        const expiredDestination = action.payload.kind === 'socket_swap' && action.socketProgress?.status === 'EXPIRED' && action.submittedAt !== undefined
        if (unsettled || expiredDestination) {
          await ctx.db.patch(action._id, {
            status: 'in_progress', error: undefined, settledAt: undefined, recoveryObservationOnly: true,
            crossmintExecution: execution.map((step) => step.status === 'failed' ? { ...step, status: 'prepared' as const } : step),
            ...(expiredDestination ? { socketProgress: { ...action.socketProgress!, status: 'IN_PROGRESS' as const, detail: 'Checking the existing transfer after interrupted monitoring.', updatedAt: Date.now() } } : {}),
          })
          action = (await ctx.db.get(action._id))!
        }
      }
      if (action.status === 'in_progress' && (action.reconcileAt ?? 0) <= Date.now() && (action.reconcileLeaseUntil ?? 0) <= Date.now()) await scheduleWeb3Reconciliation(ctx, action._id, 0)
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.web3Reconciliation.watchdog, { cursor: page.continueCursor })
    return null
  },
})
