import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { httpAction } from './_generated/server'

const http = httpRouter()

function secretsMatch(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index++) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }
  return difference === 0
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

type BrokerResult =
  | { status: 'ok'; accessToken: string; expiresAt: number }
  | { status: 'missing' | 'reauth' }
  | { status: 'busy' | 'unavailable'; retryAfterMs: number }

type FocusRecurrence = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  firstOccurrenceAt: number
}

function focusRecurrence(value: unknown): FocusRecurrence | undefined | null {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    (record.frequency !== 'daily' &&
      record.frequency !== 'weekly' &&
      record.frequency !== 'monthly' &&
      record.frequency !== 'yearly') ||
    typeof record.interval !== 'number' ||
    typeof record.firstOccurrenceAt !== 'number'
  ) {
    return null
  }
  return {
    frequency: record.frequency,
    interval: record.interval,
    firstOccurrenceAt: record.firstOccurrenceAt,
  }
}

http.route({
  path: '/internal/focus',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
    const suppliedSecret = request.headers
      .get('authorization')
      ?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (
      !configuredSecret ||
      !suppliedSecret ||
      !secretsMatch(configuredSecret, suppliedSecret)
    ) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (
      !body ||
      typeof body.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      typeof body.operation !== 'string'
    ) {
      return jsonResponse({ error: 'Invalid focus request' }, 400)
    }

    try {
      let result: unknown
      if (body.operation === 'get_context') {
        result = await ctx.runQuery(internal.agentFocus.getContext, {
          userId: body.userId,
        })
      } else if (body.operation === 'get_goals') {
        result = await ctx.runQuery(internal.agentFocus.getGoals, {
          userId: body.userId,
        })
      } else if (body.operation === 'list_tasks') {
        if (
          body.goalId !== undefined &&
          typeof body.goalId !== 'string'
        ) {
          return jsonResponse({ error: 'Invalid Goal id' }, 400)
        }
        if (
          body.status !== undefined &&
          body.status !== 'todo' &&
          body.status !== 'done'
        ) {
          return jsonResponse({ error: 'Invalid Task status' }, 400)
        }
        result = await ctx.runQuery(internal.agentFocus.listTasks, {
          userId: body.userId,
          goalId: body.goalId as Id<'goals'> | undefined,
          status: body.status as 'todo' | 'done' | undefined,
        })
      } else if (body.operation === 'create_goal') {
        if (
          typeof body.title !== 'string' ||
          (body.finalGoal !== undefined && typeof body.finalGoal !== 'string')
        ) {
          return jsonResponse({ error: 'Invalid Goal' }, 400)
        }
        result = await ctx.runMutation(internal.agentFocus.createGoal, {
          userId: body.userId,
          title: body.title,
          finalGoal: body.finalGoal as string | undefined,
        })
      } else if (body.operation === 'create_project') {
        const recurrence = focusRecurrence(body.recurrence)
        if (
          typeof body.goalId !== 'string' ||
          typeof body.title !== 'string' ||
          recurrence === null
        ) {
          return jsonResponse({ error: 'Invalid Project' }, 400)
        }
        result = await ctx.runMutation(internal.agentFocus.createProject, {
          userId: body.userId,
          goalId: body.goalId as Id<'goals'>,
          title: body.title,
          recurrence,
        })
      } else if (body.operation === 'create_task') {
        const recurrence = focusRecurrence(body.recurrence)
        if (
          typeof body.goalId !== 'string' ||
          typeof body.title !== 'string' ||
          (body.projectId !== undefined && typeof body.projectId !== 'string') ||
          (body.dueDate !== undefined && typeof body.dueDate !== 'number') ||
          recurrence === null
        ) {
          return jsonResponse({ error: 'Invalid Task' }, 400)
        }
        result = await ctx.runMutation(internal.agentFocus.createTask, {
          userId: body.userId,
          goalId: body.goalId as Id<'goals'>,
          projectId: body.projectId as Id<'projects'> | undefined,
          title: body.title,
          dueDate: body.dueDate as number | undefined,
          recurrence,
        })
      } else {
        return jsonResponse({ error: 'Unknown focus operation' }, 400)
      }
      return jsonResponse(result, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Focus request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/chatgpt/token',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
    const authorization = request.headers.get('authorization')
    const suppliedSecret = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (
      !configuredSecret ||
      !suppliedSecret ||
      !secretsMatch(configuredSecret, suppliedSecret)
    ) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }

    let userId: string | undefined
    try {
      const body = (await request.json()) as { userId?: unknown }
      if (typeof body.userId === 'string') userId = body.userId
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
    if (!userId || !/^user_[A-Za-z0-9]+$/.test(userId)) {
      return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
    }

    try {
      const result: BrokerResult = await ctx.runAction(
        internal.chatgptAuthActions.resolveForAgent,
        { userId },
      )
      if (result.status === 'ok') {
        return jsonResponse(
          { accessToken: result.accessToken, expiresAt: result.expiresAt },
          200,
        )
      }
      if (result.status === 'missing') {
        return jsonResponse({ error: 'ChatGPT is not connected' }, 404)
      }
      if (result.status === 'reauth') {
        return jsonResponse({ error: 'ChatGPT must be connected again' }, 401)
      }
      if (result.status !== 'busy' && result.status !== 'unavailable') {
        return jsonResponse({ error: 'Unexpected credential state' }, 500)
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(result.retryAfterMs / 1000),
      )
      return jsonResponse(
        { error: 'ChatGPT credentials are temporarily unavailable' },
        503,
        { 'retry-after': String(retryAfterSeconds) },
      )
    } catch {
      return jsonResponse({ error: 'Credential broker failed' }, 500)
    }
  }),
})

http.route({
  path: '/google-health/oauth/callback',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const state = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    const oauthError = url.searchParams.get('error')
    let connected = false
    if (state && code && !oauthError) {
      const result = await ctx.runAction(
        internal.googleHealthAuthActions.completeAuthorization,
        {
          state,
          code,
        },
      )
      connected = result.ok
    }
    const appUrl = new URL(
      process.env.GOOGLE_HEALTH_APP_REDIRECT_URI?.trim() ||
        'beegreat://profile',
    )
    appUrl.searchParams.set('googleHealth', connected ? 'connected' : 'failed')
    return Response.redirect(appUrl.toString(), 302)
  }),
})

http.route({
  path: '/internal/google-health/context',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
    const suppliedSecret = request.headers
      .get('authorization')
      ?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (
      !configuredSecret ||
      !suppliedSecret ||
      !secretsMatch(configuredSecret, suppliedSecret)
    ) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const body = (await request.json().catch(() => null)) as {
      userId?: unknown
    } | null
    if (
      typeof body?.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId)
    ) {
      return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
    }
    try {
      const result: string = await ctx.runAction(
        internal.googleHealth.getContext,
        { userId: body.userId },
      )
      return new Response(result, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google Health request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/google-health/query',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = process.env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
    const suppliedSecret = request.headers
      .get('authorization')
      ?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (
      !configuredSecret ||
      !suppliedSecret ||
      !secretsMatch(configuredSecret, suppliedSecret)
    ) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const operation = body?.operation
    if (
      typeof body?.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      typeof body.dataType !== 'string' ||
      (operation !== 'list' &&
        operation !== 'daily-rollup' &&
        operation !== 'reconcile') ||
      typeof body.from !== 'string' ||
      typeof body.to !== 'string' ||
      typeof body.timeZone !== 'string' ||
      (body.limit !== undefined && typeof body.limit !== 'number')
    ) {
      return jsonResponse({ error: 'Invalid Google Health query' }, 400)
    }
    try {
      const result: string = await ctx.runAction(
        internal.googleHealth.queryData,
        {
          userId: body.userId,
          dataType: body.dataType,
          operation,
          from: body.from,
          to: body.to,
          timeZone: body.timeZone,
          ...(body.limit === undefined ? {} : { limit: body.limit }),
        },
      )
      return new Response(result, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google Health request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

export default http
