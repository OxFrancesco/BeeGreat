import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { isClerkUserId } from '../revenueCatWebhook'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const subscriptionStatus = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<{ userId?: unknown }>(request)
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
})
