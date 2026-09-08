import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { env, internalAction, internalMutation } from './_generated/server'

export const claim = internalMutation({
  args: { id: v.id('beennectorDeliveries'), leaseId: v.string() },
  handler: async (ctx, { id, leaseId }) => {
    const row = await ctx.db.get(id)
    if (!row?.message || !['queued', 'processing'].includes(row.state ?? '') || row.expiresAt <= Date.now() || (row.nextAttemptAt ?? 0) > Date.now() || (row.leaseUntil ?? 0) > Date.now()) return null
    const connection = await ctx.db.query('beennectorCredentials').withIndex('by_user_and_provider', q => q.eq('userId', row.userId).eq('provider', row.provider)).unique()
    if (connection?.status !== 'connected' || connection.externalAccountId !== row.actorId) {
      await ctx.db.patch(id, { state: 'cancelled', leaseId: undefined, leaseUntil: undefined })
      return null
    }
    await ctx.db.patch(id, { state: 'processing', leaseId, leaseUntil: Date.now() + 120_000, attempts: (row.attempts ?? 0) + 1 })
    return row
  },
})

export const finish = internalMutation({
  args: { id: v.id('beennectorDeliveries'), leaseId: v.string(), submissionId: v.optional(v.string()) },
  handler: async (ctx, { id, leaseId, submissionId }) => {
    const row = await ctx.db.get(id)
    if (row?.state !== 'processing' || row.leaseId !== leaseId) return null
    if (submissionId) {
      await ctx.db.patch(id, { state: 'delivered', submissionId, leaseId: undefined, leaseUntil: undefined, nextAttemptAt: undefined })
    } else {
      const delay = Math.min(300_000, 5_000 * 2 ** Math.min(row.attempts ?? 0, 6))
      await ctx.db.patch(id, { state: 'queued', leaseId: undefined, leaseUntil: undefined, nextAttemptAt: Date.now() + delay })
      await ctx.scheduler.runAfter(delay, internal.beennectorDispatch.deliver, { id })
    }
    return null
  },
})

export async function deliverBeennectorForId(ctx: ActionCtx, id: Id<'beennectorDeliveries'>) {
    const leaseId = crypto.randomUUID()
    const row = await ctx.runMutation(internal.beennectorDispatch.claim, { id, leaseId })
    if (!row) return null
    let submissionId: string | undefined
    try {
      const subscription = await ctx.runAction(internal.subscriptionReconciliation.statusForAgent, { userId: row.userId })
      if (subscription.status === 'unavailable' || !subscription.subscription.active) throw new Error('Subscription unavailable')
      if (!env.AGENT_URL || !env.AGENT_CREDENTIAL_BROKER_SECRET) throw new Error('Agent dispatch is not configured')
      const response = await fetch(new URL('/internal/beennector-delivery', env.AGENT_URL), {
        method: 'POST', headers: { authorization: `Bearer ${env.AGENT_CREDENTIAL_BROKER_SECRET}`, 'content-type': 'application/json' },
        body: JSON.stringify({ userId: row.userId, provider: row.provider, deliveryKey: `beennector:${row._id}`, message: row.message }),
        signal: AbortSignal.timeout(20_000),
      })
      const body: unknown = await response.json()
      if (!response.ok || !body || typeof body !== 'object' || !('submissionId' in body) || typeof body.submissionId !== 'string' || !body.submissionId) throw new Error('Agent admission was not acknowledged')
      submissionId = body.submissionId
    } catch { /* Keep the exact payload and admission key for a later attempt. */ }
    await ctx.runMutation(internal.beennectorDispatch.finish, { id, leaseId, submissionId })
    return null
}

export const deliver = internalAction({
  args: { id: v.id('beennectorDeliveries') },
  handler: (ctx, { id }) => deliverBeennectorForId(ctx, id),
})

export const watchdog = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const state of ['queued', 'processing'] as const) {
      const rows = await ctx.db.query('beennectorDeliveries').withIndex('by_state_due', q => q.eq('state', state).lte('nextAttemptAt', Date.now())).take(100)
      for (const row of rows) {
        if (row.expiresAt <= Date.now()) { await ctx.db.patch(row._id, { state: 'cancelled' }); continue }
        if ((row.leaseUntil ?? 0) > Date.now()) continue
        await ctx.db.patch(row._id, { state: 'queued', leaseId: undefined, leaseUntil: undefined, nextAttemptAt: Date.now() + 1_000 })
        await ctx.scheduler.runAfter(1_000, internal.beennectorDispatch.deliver, { id: row._id })
      }
    }
    return null
  },
})
