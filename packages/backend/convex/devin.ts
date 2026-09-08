import { requireDevinOrganizationAccess } from './devinAccess'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import {
  createDevinClient,
  type DevinCreateSessionInput,
  type DevinSession,
} from './devinClient'

const sessionIdPattern = /^devin-[A-Za-z0-9_-]+$/
const MAX_POLL_ATTEMPTS = 240

function configuredClient() {
  const apiKey = env.DEVIN_API_KEY?.trim()
  const orgId = env.DEVIN_ORG_ID?.trim()
  if (!apiKey || !orgId) {
    throw new Error(
      'Devin is not configured. Set DEVIN_API_KEY and DEVIN_ORG_ID in Convex.',
    )
  }
  return createDevinClient({ apiKey, orgId })
}

async function requireDevin(ctx: ActionCtx, userId: string) {
  requireDevinOrganizationAccess(userId)
  const enabled = await ctx.runQuery(internal.powerups.checkEnabled, {
    userId,
    powerupId: 'devin',
  })
  if (!enabled) {
    throw new Error(
      'The Devin power-up is not enabled. Turn it on from the profile screen first.',
    )
  }
}

async function requireOwnedSession(
  ctx: ActionCtx,
  userId: string,
  sessionId: string,
) {
  if (!sessionIdPattern.test(sessionId)) throw new Error('Invalid Devin session id.')
  const session: Doc<'devinSessions'> | null = await ctx.runQuery(
    internal.devinData.getOwned,
    { userId, sessionId },
  )
  if (!session) throw new Error('Devin session not found for this user.')
  return session
}

async function cacheSession(ctx: ActionCtx, userId: string, session: DevinSession) {
  await ctx.runMutation(internal.devinData.upsert, { userId, session })
  return session
}

function needsPolling(session: DevinSession) {
  if (
    session.status === 'exit' ||
    session.status === 'error' ||
    session.status === 'suspended'
  ) {
    return false
  }
  return (
    session.statusDetail !== 'finished' &&
    session.statusDetail !== 'waiting_for_user' &&
    session.statusDetail !== 'waiting_for_approval'
  )
}

async function schedulePoll(ctx: ActionCtx, userId: string, session: DevinSession, completedGeneration?: number) {
  await ctx.runMutation(internal.devinData.schedulePoll, { userId, sessionId: session.sessionId, active: needsPolling(session), completedGeneration })
}

function validateStart(input: {
  prompt?: string
  title?: string
  repos?: string[]
  mode?: 'normal' | 'fast'
  maxAcuLimit?: number
}) {
  const prompt = input.prompt?.trim()
  const title = input.title?.trim()
  if (!prompt || prompt.length > 20_000) throw new Error('Invalid Devin task prompt.')
  if (title && title.length > 200) throw new Error('Invalid Devin task title.')
  if (
    input.repos &&
    (input.repos.length > 10 ||
      input.repos.some((repo) => !repo.trim() || repo.length > 300))
  ) {
    throw new Error('Invalid Devin repository list.')
  }
  if (
    input.maxAcuLimit !== undefined &&
    (!Number.isInteger(input.maxAcuLimit) ||
      input.maxAcuLimit < 1 ||
      input.maxAcuLimit > 5)
  ) {
    throw new Error('Devin ACU limit must be an integer from 1 to 5.')
  }
  const start: DevinCreateSessionInput = { prompt }
  if (title) start.title = title
  if (input.repos) start.repos = input.repos.map((repo) => repo.trim())
  if (input.mode) start.mode = input.mode
  start.maxAcuLimit = input.maxAcuLimit ?? 5
  if (input.mode === 'fast') throw new Error('Shared Devin access supports normal mode only.')
  return start
}

export const execute = internalAction({
  args: {
    userId: v.string(),
    operation: v.union(
      v.literal('start'),
      v.literal('list'),
      v.literal('inspect'),
      v.literal('follow_up'),
    ),
    prompt: v.optional(v.string()),
    title: v.optional(v.string()),
    repos: v.optional(v.array(v.string())),
    mode: v.optional(v.union(v.literal('normal'), v.literal('fast'))),
    maxAcuLimit: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    message: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, input) => {
    await requireDevin(ctx, input.userId)
    const client = configuredClient()

    if (input.operation === 'start') {
      const request = validateStart(input)
      const reservation = await ctx.runMutation(internal.paidUsage.reserve, { userId: input.userId, operation: 'devin', units: request.maxAcuLimit! })
      const session = await client.createSession(request)
      await cacheSession(ctx, input.userId, session)
      await ctx.runMutation(internal.devinData.attachUsage, { userId: input.userId, sessionId: session.sessionId, leaseId: reservation.leaseId, safetyAcuLimit: request.maxAcuLimit! })
      await schedulePoll(ctx, input.userId, session)
      return JSON.stringify({ session })
    }

    if (input.operation === 'list') {
      const limit = Math.min(Math.max(Math.trunc(input.limit ?? 5), 1), 10)
      const cached: Doc<'devinSessions'>[] = await ctx.runQuery(
        internal.devinData.listOwned,
        { userId: input.userId, limit },
      )
      const sessions = await Promise.all(
        cached.map(async (entry) => {
          try {
            const session = await client.getSession(entry.sessionId)
            await cacheSession(ctx, input.userId, session)
            return session
          } catch {
            const staleSession: DevinSession & { stale: true } = {
              sessionId: entry.sessionId,
              url: entry.url,
              status: entry.status,
              pullRequests: entry.pullRequests,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
              stale: true,
            }
            if (entry.title) staleSession.title = entry.title
            if (entry.statusDetail) staleSession.statusDetail = entry.statusDetail
            return staleSession
          }
        }),
      )
      return JSON.stringify({ sessions })
    }

    if (!input.sessionId) throw new Error('A Devin session id is required.')
    const owned = await requireOwnedSession(ctx, input.userId, input.sessionId)

    if (input.operation === 'inspect') {
      const [session, messages] = await Promise.all([
        client.getSession(input.sessionId),
        client.listMessages(input.sessionId),
      ])
      await cacheSession(ctx, input.userId, session)
      await schedulePoll(ctx, input.userId, session)
      return JSON.stringify({ session, recentMessages: messages })
    }

    const message = input.message?.trim()
    if (!message || message.length > 10_000) {
      throw new Error('A valid Devin follow-up message is required.')
    }
    if (!owned.safetyAcuLimit || owned.safetyAcuLimit > 5) throw new Error('This legacy session has no verified spending cap. Start a new capped task to continue.')
    await ctx.runMutation(internal.devinData.admitFollowUp, { userId: input.userId, sessionId: input.sessionId })
    const session = await client.sendMessage(input.sessionId, message)
    await cacheSession(ctx, input.userId, session)
    await schedulePoll(ctx, input.userId, session)
    const messages = await client.listMessages(input.sessionId)
    return JSON.stringify({ session, recentMessages: messages })
  },
})

/** Bounded background refresh for live Devin cards while a session is active. */
export const poll = internalAction({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    attempt: v.number(),
    generation: v.optional(v.number()),
  },
  handler: async (ctx, { userId, sessionId, attempt, generation }) => {
    if (generation === undefined || attempt > MAX_POLL_ATTEMPTS || !sessionIdPattern.test(sessionId)) return null
    if (!(await ctx.runMutation(internal.devinData.claimPoll, { userId, sessionId, generation }))) return null
    const enabled = await ctx.runQuery(internal.powerups.checkEnabled, {
      userId,
      powerupId: 'devin',
    })
    if (!enabled) { await ctx.runMutation(internal.devinData.schedulePoll, { userId, sessionId, active: false, completedGeneration: generation }); return null }
    const owned: Doc<'devinSessions'> | null = await ctx.runQuery(
      internal.devinData.getOwned,
      { userId, sessionId },
    )
    if (!owned) return null

    try {
      const session = await configuredClient().getSession(sessionId)
      await cacheSession(ctx, userId, session)
      await schedulePoll(ctx, userId, session, generation)
    } catch {
      // A transient Devin/network failure should not erase the last good card.
      // Retry at the normal bounded cadence; the user can always refresh later.
      await ctx.runMutation(internal.devinData.schedulePoll, { userId, sessionId, active: true, completedGeneration: generation })
    }
    return null
  },
})
