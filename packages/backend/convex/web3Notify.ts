import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction, internalQuery } from './_generated/server'
import type { Doc } from './_generated/dataModel'

// Wakes the Bee agent when a Web3 action settles. Cross-chain swaps can take
// many minutes to reach destination settlement; the scheduler-driven poller in
// web3.ts tracks them server-side, and this bridge pushes one
// `web3.action_settled` event to the agent worker at the terminal transition
// so Bee can continue a multi-step plan (e.g. bridge, then open a pool
// position) without the user poking the chat.
//
// Delivery is best-effort: the confirm card already shows live status in the
// app, so a missed wake-up degrades to today's behavior (the user nudges Bee).

const TERMINAL_STATUSES = new Set([
  'executed',
  'failed',
  'refunded',
  'expired',
])

/**
 * The Flue conversation the app is currently showing for this user: thread 0
 * keeps the original `userId` id and later threads append `~N` (mirrors
 * use-voice-agent.ts in the mobile app).
 */
export const activeConversation = internalQuery({
  args: { userId: v.string() },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('chatPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(10)
    const newest = rows.reduce(
      (best, row) => (best && best.updatedAt >= row.updatedAt ? best : row),
      undefined as Doc<'chatPreferences'> | undefined,
    )
    const threadId = newest?.activeThreadId ?? 0
    return threadId > 0 ? `${userId}~${threadId}` : userId
  },
})

/** Push a settled-action event to the agent worker's private route. */
export const notifyActionSettled = internalAction({
  args: { actionId: v.id('web3Actions') },
  returns: v.null(),
  handler: async (ctx, { actionId }) => {
    const baseUrl = env.AGENT_URL?.trim()
    const secret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
    if (!baseUrl || !secret) return null

    const action: Doc<'web3Actions'> | null = await ctx.runQuery(
      internal.web3Actions.get,
      { actionId },
    )
    if (!action || !TERMINAL_STATUSES.has(action.status)) return null

    const conversationId: string = await ctx.runQuery(
      internal.web3Notify.activeConversation,
      { userId: action.userId },
    )
    const explorerLink =
      action.socketProgress?.destinationExplorerLink ??
      [...(action.result ?? [])].reverse().find((item) => item.explorerLink)
        ?.explorerLink ??
      null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(new URL('/internal/web3-settled', baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          userId: action.userId,
          conversationId,
          actionId,
          kind: action.payload.kind,
          status: action.status,
          summary: action.summary,
          detail: action.socketProgress?.detail ?? null,
          error: action.error ?? null,
          explorerLink,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        console.warn('Web3 settled notification was rejected.', {
          actionId,
          status: response.status,
        })
      }
    } catch (error) {
      // Best-effort wake-up: the app card still shows the final status.
      console.warn('Web3 settled notification failed.', {
        actionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      clearTimeout(timeout)
    }
    return null
  },
})
