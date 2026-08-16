import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { jsonResponse, readJsonBody, requireBrokerSecret } from './middleware'

export const googleHealthOauthCallback = httpAction(async (ctx, request) => {
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
})

export const googleHealthContext = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const body = await readJsonBody<{ userId?: unknown }>(request)
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
})

export const googleHealthQuery = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const body = await readJsonBody<Record<string, unknown>>(request)
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
})
