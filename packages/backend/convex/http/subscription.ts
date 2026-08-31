import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  ClerkUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from './middleware'

const SubscriptionStatusRequest = Schema.Struct({ userId: ClerkUserId })

export const subscriptionStatus = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(SubscriptionStatusRequest, raw)
  if (!body) {
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
})
