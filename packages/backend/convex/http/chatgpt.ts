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

type BrokerResult =
  | { status: 'ok'; accessToken: string; expiresAt: number }
  | { status: 'missing' | 'reauth' }
  | { status: 'busy' | 'unavailable'; retryAfterMs: number }

const ChatgptTokenRequest = Schema.Struct({ userId: AgentUserId })

export const chatgptToken = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError

  const raw = await readJsonBody<JsonValue>(request)
  if (raw === null) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const body = decodeRequestBody(ChatgptTokenRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
  }
  const userId = body.userId

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
