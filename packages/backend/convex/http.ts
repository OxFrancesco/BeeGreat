import { httpRouter } from 'convex/server'
import { verifyWebhook } from '@clerk/backend/webhooks'
import {
  isSugarAction,
  isSugarTxAction,
  type SugarAction,
} from '@beegreat/sugar/contracts'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { env, httpAction } from './_generated/server'
import { isClerkUserId, parseRevenueCatWebhook } from './revenueCatWebhook'

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
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET?.trim()
    if (!signingSecret) {
      return jsonResponse({ error: 'Clerk webhook is not configured' }, 503, {
        'retry-after': '60',
      })
    }
    let event: Awaited<ReturnType<typeof verifyWebhook>>
    try {
      event = await verifyWebhook(request, { signingSecret })
    } catch {
      return jsonResponse({ error: 'Invalid Clerk webhook signature' }, 401)
    }
    if (event.type !== 'user.deleted') return jsonResponse({ ok: true }, 200)
    const userId = event.data.id
    if (typeof userId !== 'string' || !isClerkUserId(userId)) {
      return jsonResponse({ error: 'Invalid Clerk user deletion event' }, 400)
    }
    await ctx.runMutation(internal.accountDeletion.activateFromClerkWebhook, {
      userId,
    })
    return jsonResponse({ ok: true }, 200)
  }),
})

http.route({
  path: '/webhooks/revenuecat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.REVENUECAT_WEBHOOK_SECRET?.trim()
    const configuredAppId = env.REVENUECAT_APP_ID?.trim()
    if (!configuredSecret || !configuredAppId) {
      return jsonResponse(
        { error: 'RevenueCat webhook is not configured' },
        503,
        {
          'retry-after': '60',
        },
      )
    }
    const suppliedSecret = request.headers
      .get('authorization')
      ?.match(/^Bearer ([^\s]+)$/i)?.[1]
    if (!suppliedSecret || !secretsMatch(configuredSecret, suppliedSecret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      return jsonResponse({ error: 'RevenueCat webhook is too large' }, 413)
    }
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 64 * 1024) {
      return jsonResponse({ error: 'RevenueCat webhook is too large' }, 413)
    }
    let body: unknown
    try {
      body = JSON.parse(rawBody || 'null') as unknown
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }
    const parsed = parseRevenueCatWebhook(body)
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400)
    if (parsed.event.apiVersion !== '1.0') {
      return jsonResponse({ error: 'Unsupported RevenueCat API version' }, 400)
    }
    if (parsed.event.appId !== configuredAppId) {
      // A project-wide integration may deliver events for another app. Ack it
      // so RevenueCat does not retry an event that can never belong to BeeGreat.
      return jsonResponse({ ok: true, status: 'ignored_app' }, 200)
    }

    const event = parsed.event
    const result = await ctx.runMutation(
      internal.subscriptions.applyRevenueCatEvent,
      {
        eventId: event.eventId,
        type: event.type,
        ...(event.appUserId ? { appUserId: event.appUserId } : {}),
        ...(event.environment ? { environment: event.environment } : {}),
        ...(event.productId ? { productId: event.productId } : {}),
        entitlementIds: event.entitlementIds,
        ...(event.purchasedAtMs !== undefined
          ? { purchasedAtMs: event.purchasedAtMs }
          : {}),
        ...(event.expirationAtMs !== undefined
          ? { expirationAtMs: event.expirationAtMs }
          : {}),
        ...(event.gracePeriodExpirationAtMs !== undefined
          ? {
              gracePeriodExpirationAtMs: event.gracePeriodExpirationAtMs,
            }
          : {}),
        ...(event.cancelReason ? { cancelReason: event.cancelReason } : {}),
        eventTimestampMs: event.eventTimestampMs,
        receivedAt: Date.now(),
        transferredFrom: event.transferredFrom,
        transferredTo: event.transferredTo,
      },
    )
    return jsonResponse({ ok: true, status: result.status }, 200)
  }),
})

http.route({
  path: '/internal/subscription/status',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }
    const body = (await request.json().catch(() => null)) as {
      userId?: unknown
    } | null
    if (
      !body ||
      typeof body.userId !== 'string' ||
      !isClerkUserId(body.userId)
    ) {
      return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
    }
    const result = await ctx.runAction(
      internal.subscriptionReconciliation.statusForAgent,
      {
        userId: body.userId,
      },
    )
    if (result.status === 'unavailable') {
      return jsonResponse(
        {
          error: 'Subscription verification unavailable',
          reason: result.reason,
        },
        503,
        { 'retry-after': '5' },
      )
    }
    return jsonResponse(result.subscription, 200)
  }),
})

http.route({
  path: '/internal/focus',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
      const channelOwnerKey =
        typeof body.ownerKey === 'string' &&
        body.ownerKey.endsWith(`|${body.userId}`)
          ? body.ownerKey
          : undefined
      if (body.operation.startsWith('channel_') && !channelOwnerKey) {
        return jsonResponse({ error: 'Invalid channel identity' }, 400)
      }
      if (body.operation === 'channel_context') {
        if (body.source !== 'imessage') {
          return jsonResponse({ error: 'Invalid channel source' }, 400)
        }
        result = await ctx.runMutation(internal.channelActions.getContext, {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          source: body.source,
        })
      } else if (body.operation === 'channel_create_thread') {
        if (body.source !== 'imessage') {
          return jsonResponse({ error: 'Invalid channel source' }, 400)
        }
        result = await ctx.runMutation(internal.channelActions.createThread, {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          source: body.source,
        })
      } else if (body.operation === 'channel_title_thread') {
        if (
          typeof body.threadId !== 'number' ||
          typeof body.title !== 'string'
        ) {
          return jsonResponse({ error: 'Invalid conversation title' }, 400)
        }
        result = await ctx.runMutation(internal.channelActions.titleThread, {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          threadId: body.threadId,
          title: body.title,
        })
      } else if (body.operation === 'channel_confirm_first_focus') {
        if (
          typeof body.requestId !== 'string' ||
          typeof body.goalTitle !== 'string' ||
          typeof body.projectTitle !== 'string' ||
          typeof body.taskTitle !== 'string' ||
          (body.highlightExpiresAt !== undefined &&
            typeof body.highlightExpiresAt !== 'number')
        ) {
          return jsonResponse(
            { error: 'Invalid first-focus confirmation' },
            400,
          )
        }
        result = await ctx.runMutation(
          internal.channelActions.confirmFirstFocus,
          {
            userId: body.userId,
            ownerKey: channelOwnerKey!,
            requestId: body.requestId,
            goalTitle: body.goalTitle,
            projectTitle: body.projectTitle,
            taskTitle: body.taskTitle,
            highlightExpiresAt: body.highlightExpiresAt as number | undefined,
          },
        )
      } else if (body.operation === 'channel_cancel_first_focus') {
        if (
          typeof body.requestId !== 'string' ||
          typeof body.goalTitle !== 'string' ||
          typeof body.projectTitle !== 'string' ||
          typeof body.taskTitle !== 'string'
        ) {
          return jsonResponse(
            { error: 'Invalid first-focus cancellation' },
            400,
          )
        }
        result = await ctx.runMutation(
          internal.channelActions.cancelFirstFocus,
          {
            userId: body.userId,
            ownerKey: channelOwnerKey!,
            requestId: body.requestId,
            goalTitle: body.goalTitle,
            projectTitle: body.projectTitle,
            taskTitle: body.taskTitle,
          },
        )
      } else if (body.operation === 'channel_complete_highlight') {
        if (
          typeof body.requestId !== 'string' ||
          typeof body.taskId !== 'string'
        ) {
          return jsonResponse({ error: 'Invalid Highlight completion' }, 400)
        }
        result = await ctx.runMutation(
          internal.channelActions.completeHighlight,
          {
            userId: body.userId,
            ownerKey: channelOwnerKey!,
            requestId: body.requestId,
            taskId: body.taskId as Id<'tasks'>,
          },
        )
      } else if (body.operation === 'get_context') {
        result = await ctx.runQuery(internal.agentFocus.getContext, {
          userId: body.userId,
        })
      } else if (body.operation === 'get_goals') {
        result = await ctx.runQuery(internal.agentFocus.getGoals, {
          userId: body.userId,
        })
      } else if (body.operation === 'list_tasks') {
        if (body.goalId !== undefined && typeof body.goalId !== 'string') {
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
          (body.projectId !== undefined &&
            typeof body.projectId !== 'string') ||
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
  path: '/internal/mind',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
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
      return jsonResponse({ error: 'Invalid Mind request' }, 400)
    }
    const kind = body.kind
    if (
      kind !== undefined &&
      kind !== 'website' &&
      kind !== 'tweet' &&
      kind !== 'youtube'
    ) {
      return jsonResponse({ error: 'Invalid bookmark kind' }, 400)
    }

    try {
      let result: unknown
      if (body.operation === 'search') {
        if (typeof body.query !== 'string') {
          return jsonResponse({ error: 'Search query is required' }, 400)
        }
        result = await ctx.runQuery(internal.agentMind.searchBookmarks, {
          userId: body.userId,
          query: body.query,
          kind,
        })
      } else if (body.operation === 'list') {
        if (
          (body.label !== undefined && typeof body.label !== 'string') ||
          (body.limit !== undefined && typeof body.limit !== 'number')
        ) {
          return jsonResponse({ error: 'Invalid bookmark filters' }, 400)
        }
        result = await ctx.runQuery(internal.agentMind.listBookmarks, {
          userId: body.userId,
          kind,
          label: body.label as string | undefined,
          limit: body.limit as number | undefined,
        })
      } else if (body.operation === 'get') {
        if (typeof body.bookmarkId !== 'string') {
          return jsonResponse({ error: 'Bookmark id is required' }, 400)
        }
        result = await ctx.runQuery(internal.agentMind.getBookmark, {
          userId: body.userId,
          bookmarkId: body.bookmarkId as Id<'bookmarks'>,
        })
      } else if (body.operation === 'save') {
        if (
          typeof body.url !== 'string' ||
          (body.note !== undefined && typeof body.note !== 'string')
        ) {
          return jsonResponse(
            { error: 'A valid bookmark URL is required' },
            400,
          )
        }
        result = await ctx.runMutation(internal.agentMind.saveBookmark, {
          userId: body.userId,
          url: body.url,
          note: body.note as string | undefined,
        })
      } else if (body.operation === 'update') {
        if (
          typeof body.bookmarkId !== 'string' ||
          (body.title !== undefined && typeof body.title !== 'string') ||
          (body.note !== undefined && typeof body.note !== 'string') ||
          (body.labels !== undefined &&
            (!Array.isArray(body.labels) ||
              !body.labels.every((label) => typeof label === 'string'))) ||
          (body.title === undefined &&
            body.labels === undefined &&
            body.note === undefined)
        ) {
          return jsonResponse({ error: 'Invalid bookmark update' }, 400)
        }
        result = await ctx.runMutation(internal.agentMind.updateBookmark, {
          userId: body.userId,
          bookmarkId: body.bookmarkId as Id<'bookmarks'>,
          title: body.title as string | undefined,
          labels: body.labels as string[] | undefined,
          note: body.note as string | undefined,
        })
      } else if (body.operation === 'delete') {
        if (typeof body.bookmarkId !== 'string') {
          return jsonResponse({ error: 'Bookmark id is required' }, 400)
        }
        result = await ctx.runMutation(internal.agentMind.deleteBookmark, {
          userId: body.userId,
          bookmarkId: body.bookmarkId as Id<'bookmarks'>,
        })
      } else {
        return jsonResponse({ error: 'Unknown Mind operation' }, 400)
      }
      return jsonResponse(result, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Mind request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/chatgpt/token',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
        {
          'retry-after': String(retryAfterSeconds),
        },
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
    if (state) {
      const result = await ctx.runAction(
        internal.googleHealthAuthActions.completeAuthorization,
        {
          state,
          ...(code ? { code } : {}),
          ...(oauthError ? { errorCode: oauthError } : {}),
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
  path: '/beennectors/oauth/callback',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const state = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    const oauthError = url.searchParams.get('error')
    let connected = false
    let provider: 'github' | 'linear' | 'notion' | undefined
    if (state) {
      const result = await ctx.runAction(
        internal.beennectorAuthActions.completeAuthorization,
        {
          state,
          ...(code ? { code } : {}),
          ...(oauthError ? { errorCode: oauthError } : {}),
        },
      )
      connected = result.ok
      provider = result.provider
    }
    const appUrl = new URL(
      process.env.BEENNECTOR_APP_REDIRECT_URI?.trim() || 'beegreat://profile',
    )
    appUrl.searchParams.set('beennector', provider ?? 'unknown')
    appUrl.searchParams.set('status', connected ? 'connected' : 'failed')
    return Response.redirect(appUrl.toString(), 302)
  }),
})

http.route({
  path: '/internal/beennectors',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body || typeof body.operation !== 'string') {
      return jsonResponse({ error: 'Invalid Beennector request' }, 400)
    }
    const provider = body.provider
    if (
      provider !== undefined &&
      provider !== 'github' &&
      provider !== 'linear' &&
      provider !== 'notion'
    ) {
      return jsonResponse({ error: 'Invalid Beennector provider' }, 400)
    }
    try {
      if (body.operation === 'claim_delivery') {
        if (
          !provider ||
          typeof body.deliveryId !== 'string' ||
          (body.actorId !== undefined && typeof body.actorId !== 'string') ||
          (body.workspaceId !== undefined &&
            typeof body.workspaceId !== 'string')
        ) {
          return jsonResponse({ error: 'Invalid Beennector delivery' }, 400)
        }
        const result = await ctx.runMutation(
          internal.beennectors.claimDelivery,
          {
            provider,
            deliveryId: body.deliveryId,
            actorId: body.actorId as string | undefined,
            workspaceId: body.workspaceId as string | undefined,
          },
        )
        if (result.status === 'accepted') {
          const verification = await ctx.runAction(
            internal.subscriptionReconciliation.statusForAgent,
            { userId: result.userId },
          )
          if (
            verification.status === 'unavailable' ||
            !verification.subscription.active
          ) {
            // The signed provider delivery is intentionally consumed, but it
            // must not dispatch paid AI work without a current paid grant.
            return jsonResponse({ status: 'subscription_required' }, 200)
          }
        }
        return jsonResponse(result, 200)
      }
      if (
        typeof body.userId !== 'string' ||
        !/^user_[A-Za-z0-9]+$/.test(body.userId)
      ) {
        return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
      }
      if (body.operation === 'list_connections') {
        const result = await ctx.runQuery(
          internal.beennectors.listConnectedForAgent,
          {
            userId: body.userId,
          },
        )
        return jsonResponse(result, 200)
      }
      if (
        body.operation !== 'list' &&
        body.operation !== 'search' &&
        body.operation !== 'get' &&
        body.operation !== 'comment'
      ) {
        return jsonResponse({ error: 'Unknown Beennector operation' }, 400)
      }
      if (
        !provider ||
        (body.query !== undefined && typeof body.query !== 'string') ||
        (body.ref !== undefined && typeof body.ref !== 'string') ||
        (body.body !== undefined && typeof body.body !== 'string') ||
        (body.limit !== undefined && typeof body.limit !== 'number')
      ) {
        return jsonResponse({ error: 'Invalid Beennector operation' }, 400)
      }
      const result = await ctx.runAction(
        internal.beennectorOperations.execute,
        {
          userId: body.userId,
          provider,
          operation: body.operation,
          query: body.query as string | undefined,
          ref: body.ref as string | undefined,
          body: body.body as string | undefined,
          limit: body.limit as number | undefined,
        },
      )
      return jsonResponse(result, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Beennector request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/google-health/context',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
        {
          userId: body.userId,
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

http.route({
  path: '/internal/devin',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const operation = body?.operation
    if (
      typeof body?.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      (operation !== 'start' &&
        operation !== 'list' &&
        operation !== 'inspect' &&
        operation !== 'follow_up') ||
      (body.prompt !== undefined && typeof body.prompt !== 'string') ||
      (body.title !== undefined && typeof body.title !== 'string') ||
      (body.repos !== undefined &&
        (!Array.isArray(body.repos) ||
          body.repos.some((repo) => typeof repo !== 'string'))) ||
      (body.mode !== undefined &&
        body.mode !== 'normal' &&
        body.mode !== 'fast') ||
      (body.maxAcuLimit !== undefined &&
        typeof body.maxAcuLimit !== 'number') ||
      (body.sessionId !== undefined && typeof body.sessionId !== 'string') ||
      (body.message !== undefined && typeof body.message !== 'string') ||
      (body.limit !== undefined && typeof body.limit !== 'number')
    ) {
      return jsonResponse({ error: 'Invalid Devin request' }, 400)
    }
    try {
      const result: string = await ctx.runAction(internal.devin.execute, {
        userId: body.userId,
        operation,
        prompt: body.prompt as string | undefined,
        title: body.title as string | undefined,
        repos: body.repos as string[] | undefined,
        mode: body.mode as 'normal' | 'fast' | undefined,
        maxAcuLimit: body.maxAcuLimit as number | undefined,
        sessionId: body.sessionId as string | undefined,
        message: body.message as string | undefined,
        limit: body.limit as number | undefined,
      })
      return new Response(result, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Devin request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/fal-media',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return jsonResponse(
        { error: 'Content-Type must be application/json' },
        415,
      )
    }
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024) {
      return jsonResponse({ error: 'Imagine request is too large' }, 413)
    }
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 32 * 1024) {
      return jsonResponse({ error: 'Imagine request is too large' }, 413)
    }
    const body = (() => {
      try {
        return JSON.parse(rawBody || 'null') as Record<string, unknown> | null
      } catch {
        return null
      }
    })()
    const operation = body?.operation
    if (
      !body ||
      (operation !== 'generate_image' &&
        operation !== 'edit_image' &&
        operation !== 'generate_video' &&
        operation !== 'edit_video') ||
      typeof body.prompt !== 'string' ||
      (body.sourceUrl !== undefined && typeof body.sourceUrl !== 'string')
    ) {
      return jsonResponse({ error: 'Invalid Imagine request' }, 400)
    }
    try {
      const result = await ctx.runAction(internal.falMedia.execute, {
        operation,
        prompt: body.prompt,
        sourceUrl: body.sourceUrl as string | undefined,
      })
      return jsonResponse(result, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Imagine request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

http.route({
  path: '/internal/google-health/query',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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

http.route({
  path: '/internal/web3/sugar',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    const parameters = body?.parameters
    if (
      typeof body?.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      !isSugarAction(body.sugarAction) ||
      !parameters ||
      typeof parameters !== 'object' ||
      Array.isArray(parameters) ||
      Object.values(parameters).some(
        (value) =>
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean',
      )
    ) {
      return jsonResponse({ error: 'Invalid Sugar request' }, 400)
    }

    try {
      // The Node action runs the native TypeScript Sugar SDK directly. This
      // HTTP route remains the authenticated boundary used by the agent.
      const result: string = await ctx.runAction(internal.web3.runSugar, {
        userId: body.userId,
        sugarAction: body.sugarAction as SugarAction,
        parameters: parameters as Record<string, string | number | boolean>,
      })
      return new Response(result, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sugar request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

const WEB3_WALLET_OPS = [
  'create_wallet',
  'balances',
  'activity',
  'fund',
  'wallets',
  'prepare_send',
  'quote_socket_swap',
  'prepare_socket_swap',
  'prepare_execution',
  'action_status',
] as const
type Web3WalletOp = (typeof WEB3_WALLET_OPS)[number]

// Authenticated bridge for every wallet-side Web3 tool. The Convex functions
// behind it are internal on purpose: agent identity is the broker secret, and
// nothing here can move funds — fund movement requires the signed-in app to
// confirm a pending web3Actions row.
http.route({
  path: '/internal/web3/wallet',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
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
    const params = (body?.params ?? {}) as Record<string, unknown>
    if (
      typeof body?.userId !== 'string' ||
      !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
      typeof body.op !== 'string' ||
      !(WEB3_WALLET_OPS as readonly string[]).includes(body.op) ||
      typeof params !== 'object' ||
      params === null ||
      Array.isArray(params)
    ) {
      return jsonResponse({ error: 'Invalid Web3 request' }, 400)
    }

    const userId = body.userId
    const op = body.op as Web3WalletOp
    const str = (name: string) =>
      typeof params[name] === 'string' ? (params[name] as string) : ''
    try {
      switch (op) {
        case 'create_wallet':
          return jsonResponse(
            await ctx.runAction(internal.web3.getOrCreateWallet, { userId }),
            200,
          )
        case 'balances': {
          const chain = str('chain')
          if (chain && chain !== 'base' && chain !== 'arbitrum') {
            return jsonResponse({ error: 'Invalid balance chain' }, 400)
          }
          return jsonResponse(
            await ctx.runAction(internal.web3.getBalances, {
              userId,
              ...(chain ? { chain: chain as 'base' | 'arbitrum' } : {}),
            }),
            200,
          )
        }
        case 'activity': {
          const activity: string = await ctx.runAction(
            internal.web3.getActivity,
            { userId },
          )
          return new Response(activity, {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            },
          })
        }
        case 'fund':
          return jsonResponse(
            await ctx.runAction(internal.web3.fundWallet, {
              userId,
              amount: typeof params.amount === 'number' ? params.amount : 0,
            }),
            200,
          )
        case 'wallets':
          return jsonResponse(
            await ctx.runQuery(internal.wallets.getWalletsForAgent, { userId }),
            200,
          )
        case 'prepare_send':
          return jsonResponse(
            await ctx.runAction(internal.web3.prepareSendTokens, {
              userId,
              recipient: str('recipient'),
              token: str('token'),
              amount: str('amount'),
            }),
            200,
          )
        case 'quote_socket_swap':
        case 'prepare_socket_swap': {
          const originChain = str('originChain')
          const destinationChain = str('destinationChain')
          const inputToken = str('inputToken')
          const outputToken = str('outputToken')
          if (
            (originChain !== 'base' && originChain !== 'arbitrum') ||
            (destinationChain !== 'base' && destinationChain !== 'arbitrum') ||
            (inputToken !== 'eth' && inputToken !== 'usdc') ||
            (outputToken !== 'eth' && outputToken !== 'usdc')
          ) {
            return jsonResponse({ error: 'Invalid Socket swap request' }, 400)
          }
          const request = {
            userId,
            originChain: originChain as 'base' | 'arbitrum',
            destinationChain: destinationChain as 'base' | 'arbitrum',
            inputToken: inputToken as 'eth' | 'usdc',
            outputToken: outputToken as 'eth' | 'usdc',
            amount: str('amount'),
          }
          return jsonResponse(
            op === 'quote_socket_swap'
              ? await ctx.runAction(internal.web3.quoteSocketSwap, request)
              : await ctx.runAction(internal.web3.prepareSocketSwap, request),
            200,
          )
        }
        case 'prepare_execution': {
          const sugarAction = str('sugarAction')
          const sugarParameters = params.parameters
          if (
            !isSugarTxAction(sugarAction) ||
            !sugarParameters ||
            typeof sugarParameters !== 'object' ||
            Array.isArray(sugarParameters) ||
            Object.values(sugarParameters).some(
              (value) =>
                typeof value !== 'string' &&
                typeof value !== 'number' &&
                typeof value !== 'boolean',
            )
          ) {
            return jsonResponse(
              { error: 'Invalid Sugar execution request' },
              400,
            )
          }
          return jsonResponse(
            await ctx.runAction(internal.web3.prepareSugarExecution, {
              userId,
              sugarAction,
              parameters: sugarParameters as Record<
                string,
                string | number | boolean
              >,
            }),
            200,
          )
        }
        case 'action_status': {
          const status = await ctx.runQuery(internal.web3Actions.getForUser, {
            userId,
            actionId: str('actionId') as Id<'web3Actions'>,
          })
          return jsonResponse(
            status ?? { error: 'Unknown action for this user' },
            status ? 200 : 404,
          )
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Web3 request failed'
      return jsonResponse({ error: message }, 400)
    }
  }),
})

export default http
