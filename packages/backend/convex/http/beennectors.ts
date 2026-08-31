import type { FunctionArgs } from 'convex/server'
import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  AgentUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from './middleware'

export const beennectorsOauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  let connected = false
  let provider: 'github' | 'linear' | 'notion' | 'google' | undefined
  if (state) {
    const args: FunctionArgs<
      typeof internal.beennectorAuthActions.completeAuthorization
    > = { state }
    if (code) args.code = code
    if (oauthError) args.errorCode = oauthError
    const result = await ctx.runAction(
      internal.beennectorAuthActions.completeAuthorization,
      args,
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

const BeennectorRequest = Schema.Struct({ operation: Schema.String })

const BeennectorProviderField = Schema.Struct({
  provider: Schema.optional(
    Schema.Literals(['github', 'linear', 'notion', 'google']),
  ),
})

const BeennectorDelivery = Schema.Struct({
  deliveryId: Schema.String,
  actorId: Schema.optional(Schema.String),
  workspaceId: Schema.optional(Schema.String),
})

const BeennectorUserField = Schema.Struct({ userId: AgentUserId })

const BeennectorOperationFilters = Schema.Struct({
  query: Schema.optional(Schema.String),
  ref: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

export const beennectorsInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(BeennectorRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Beennector request' }, 400)
  }
  const providerField = decodeRequestBody(BeennectorProviderField, raw)
  if (!providerField) {
    return jsonResponse({ error: 'Invalid Beennector provider' }, 400)
  }
  const provider = providerField.provider
  try {
    if (body.operation === 'claim_delivery') {
      const delivery = decodeRequestBody(BeennectorDelivery, raw)
      if (!provider || !delivery) {
        return jsonResponse({ error: 'Invalid Beennector delivery' }, 400)
      }
      const result = await ctx.runMutation(
        internal.beennectors.claimDelivery,
        {
          provider,
          deliveryId: delivery.deliveryId,
          actorId: delivery.actorId,
          workspaceId: delivery.workspaceId,
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
    const userField = decodeRequestBody(BeennectorUserField, raw)
    if (!userField) {
      return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
    }
    if (body.operation === 'list_connections') {
      const result = await ctx.runQuery(
        internal.beennectors.listConnectedForAgent,
        {
          userId: userField.userId,
        },
      )
      return jsonResponse(result, 200)
    }
    if (body.operation === 'google_access_token') {
      const result = await ctx.runAction(
        internal.beennectorAuthActions.googleAccessTokenForAgent,
        { userId: userField.userId },
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
    const filters = decodeRequestBody(BeennectorOperationFilters, raw)
    if (!provider || provider === 'google' || !filters) {
      return jsonResponse({ error: 'Invalid Beennector operation' }, 400)
    }
    const result = await ctx.runAction(
      internal.beennectorOperations.execute,
      {
        userId: userField.userId,
        provider,
        operation: body.operation,
        query: filters.query,
        ref: filters.ref,
        body: filters.body,
        limit: filters.limit,
      },
    )
    return jsonResponse(result, 200)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Beennector request failed'
    return jsonResponse({ error: message }, 400)
  }
})
