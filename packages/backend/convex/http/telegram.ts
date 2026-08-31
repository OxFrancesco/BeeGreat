import type { FunctionArgs } from 'convex/server'
import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { env, httpAction } from '../_generated/server'
import {
  ClerkUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from './middleware'

export const telegramOauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  let connected = false
  let client: 'mobile' | 'browser' | undefined
  if (state) {
    const args: FunctionArgs<
      typeof internal.telegramAuthActions.completeAuthorization
    > = { state }
    if (code) args.code = code
    if (oauthError) args.errorCode = oauthError
    const result = await ctx.runAction(
      internal.telegramAuthActions.completeAuthorization,
      args,
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

const TelegramRequest = Schema.Struct({
  userId: ClerkUserId,
  operation: Schema.Literals(['status', 'connect', 'disconnect', 'send']),
})

const TelegramMessage = Schema.Struct({ text: Schema.String })

const TelegramSilentField = Schema.Struct({ silent: Schema.Boolean })

type ConnectedTelegramStatus = {
  status: 'connected'
  displayName: string
  username?: string
}

export const telegramInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(TelegramRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Telegram request' }, 400)
  }
  if (body.operation === 'status') {
    const connection = await ctx.runQuery(
      internal.telegram.getConnectionForAgent,
      { userId: body.userId },
    )
    if (connection.status === 'connected') {
      const payload: ConnectedTelegramStatus = {
        status: connection.status,
        displayName: connection.displayName,
      }
      if (connection.username) payload.username = connection.username
      return jsonResponse(payload, 200)
    }
    return jsonResponse(connection, 200)
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
  const message = decodeRequestBody(TelegramMessage, raw)
  if (
    !message ||
    !message.text.trim() ||
    [...message.text.trim()].length > 4096
  ) {
    return jsonResponse({ error: 'Invalid Telegram message' }, 400)
  }
  try {
    const args: FunctionArgs<
      typeof internal.telegramAuthActions.sendForAgent
    > = {
      userId: body.userId,
      text: message.text,
    }
    const silentField = decodeRequestBody(TelegramSilentField, raw)
    if (silentField) args.silent = silentField.silent
    const result = await ctx.runAction(
      internal.telegramAuthActions.sendForAgent,
      args,
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
