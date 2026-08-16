import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

type BrokerResult =
  | { status: 'ok'; accessToken: string; expiresAt: number }
  | { status: 'missing' | 'reauth' }
  | { status: 'busy' | 'unavailable'; retryAfterMs: number }

export const chatgptToken = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError

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
})
