import { internal } from '../_generated/api'
import { env, httpAction } from '../_generated/server'
import { isClerkUserId } from '../revenueCatWebhook'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const telegramOauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  let connected = false
  let client: 'mobile' | 'browser' | undefined
  if (state) {
    const result = await ctx.runAction(
      internal.telegramAuthActions.completeAuthorization,
      {
        state,
        ...(code ? { code } : {}),
        ...(oauthError ? { errorCode: oauthError } : {}),
      },
    )
    connected = result.ok
    client = result.client
  }
  if (client === 'mobile') {
    const appUrl = new URL(
      env.TELEGRAM_APP_REDIRECT_URI?.trim() || 'beegreat://profile',
    )
    appUrl.searchParams.set('telegram', connected ? 'connected' : 'failed')
    return Response.redirect(appUrl.toString(), 302)
  }
  return new Response(
    `<!doctype html><title>BeeGreat</title><main style="font:16px system-ui;max-width:36rem;margin:15vh auto;padding:2rem"><h1>${connected ? 'Telegram connected' : 'Telegram connection failed'}</h1><p>${connected ? 'You can close this tab and return to BeeGreat.' : 'Return to BeeGreat and try again.'}</p></main><script>if(window.opener)setTimeout(()=>window.close(),700)</script>`,
    {
      status: connected ? 200 : 400,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
})

export const telegramInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !isClerkUserId(body.userId) ||
    (body.operation !== 'status' &&
      body.operation !== 'connect' &&
      body.operation !== 'disconnect' &&
      body.operation !== 'send')
  ) {
    return jsonResponse({ error: 'Invalid Telegram request' }, 400)
  }
  if (body.operation === 'status') {
    const connection = await ctx.runQuery(
      internal.telegram.getConnectionForAgent,
      { userId: body.userId },
    )
    return jsonResponse(
      connection.status === 'connected'
        ? {
            status: connection.status,
            displayName: connection.displayName,
            ...(connection.username ? { username: connection.username } : {}),
          }
        : connection,
      200,
    )
  }
  if (body.operation === 'connect') {
    const result = await ctx.runAction(
      internal.telegramAuthActions.beginAuthorizationForAgent,
      { userId: body.userId, client: 'browser' },
    )
    return jsonResponse(result, 200)
  }
  if (body.operation === 'disconnect') {
    await ctx.runMutation(internal.telegram.disconnectForAgent, {
      userId: body.userId,
    })
    return jsonResponse({ disconnected: true }, 200)
  }
  if (
    typeof body.text !== 'string' ||
    !body.text.trim() ||
    [...body.text.trim()].length > 4096
  ) {
    return jsonResponse({ error: 'Invalid Telegram message' }, 400)
  }
  try {
    const result = await ctx.runAction(
      internal.telegramAuthActions.sendForAgent,
      {
        userId: body.userId,
        text: body.text,
        ...(typeof body.silent === 'boolean' ? { silent: body.silent } : {}),
      },
    )
    return jsonResponse(result, 200)
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Telegram message could not be sent',
      },
      409,
    )
  }
})
