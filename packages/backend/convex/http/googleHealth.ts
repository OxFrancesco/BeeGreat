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
  type JsonValue,
} from './middleware'

export const googleHealthOauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  let connected = false
  if (state) {
    const args: FunctionArgs<
      typeof internal.googleHealthAuthActions.completeAuthorization
    > = { state }
    if (code) args.code = code
    if (oauthError) args.errorCode = oauthError
    const result = await ctx.runAction(
      internal.googleHealthAuthActions.completeAuthorization,
      args,
    )
    connected = result.ok
  }
  const appUrl = new URL(
    process.env.GOOGLE_HEALTH_APP_REDIRECT_URI?.trim() ||
      'beegreat://profile',
  )
  appUrl.searchParams.set('googleHealth', connected ? 'connected' : 'failed')
  return Response.redirect(appUrl.toString(), 302)
})

const GoogleHealthContextRequest = Schema.Struct({ userId: AgentUserId })

export const googleHealthContext = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(GoogleHealthContextRequest, raw)
  if (!body) {
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
})

const GoogleHealthQuery = Schema.Struct({
  userId: AgentUserId,
  dataType: Schema.String,
  operation: Schema.Literals(['list', 'daily-rollup', 'reconcile']),
  from: Schema.String,
  to: Schema.String,
  timeZone: Schema.String,
  limit: Schema.optional(Schema.Number),
})

export const googleHealthQuery = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(GoogleHealthQuery, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Google Health query' }, 400)
  }
  try {
    const result: string = await ctx.runAction(
      internal.googleHealth.queryData,
      {
        userId: body.userId,
        dataType: body.dataType,
        operation: body.operation,
        from: body.from,
        to: body.to,
        timeZone: body.timeZone,
        limit: body.limit,
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
})
