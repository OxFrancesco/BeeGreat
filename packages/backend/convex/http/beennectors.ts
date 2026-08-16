import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const beennectorsOauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  let connected = false
  let provider: 'github' | 'linear' | 'notion' | 'google' | undefined
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
})

export const beennectorsInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body || typeof body.operation !== 'string') {
    return jsonResponse({ error: 'Invalid Beennector request' }, 400)
  }
  const provider = body.provider
  if (
    provider !== undefined &&
    provider !== 'github' &&
    provider !== 'linear' &&
    provider !== 'notion' &&
    provider !== 'google'
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
    if (body.operation === 'google_access_token') {
      const result = await ctx.runAction(
        internal.beennectorAuthActions.googleAccessTokenForAgent,
        { userId: body.userId },
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
      provider === 'google' ||
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
})
