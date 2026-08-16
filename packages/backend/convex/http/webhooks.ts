import { verifyWebhook } from '@clerk/backend/webhooks'
import { internal } from '../_generated/api'
import { env, httpAction } from '../_generated/server'
import { isClerkUserId, parseRevenueCatWebhook } from '../revenueCatWebhook'
import {
  bearerSecret,
  jsonResponse,
  parseLimitedJsonBody,
  requireJsonContentType,
  secretsMatch,
} from './middleware'

export const clerkWebhook = httpAction(async (ctx, request) => {
  const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET?.trim()
  if (!signingSecret) {
    return jsonResponse({ error: 'Clerk webhook is not configured' }, 503, {
      'retry-after': '60',
    })
  }
  let event: Awaited<ReturnType<typeof verifyWebhook>>
  try {
    event = await verifyWebhook(request, { signingSecret })
  } catch {
    return jsonResponse({ error: 'Invalid Clerk webhook signature' }, 401)
  }
  if (event.type !== 'user.deleted') return jsonResponse({ ok: true }, 200)
  const userId = event.data.id
  if (typeof userId !== 'string' || !isClerkUserId(userId)) {
    return jsonResponse({ error: 'Invalid Clerk user deletion event' }, 400)
  }
  await ctx.runMutation(internal.accountDeletion.activateFromClerkWebhook, {
    userId,
  })
  return jsonResponse({ ok: true }, 200)
})

export const revenueCatWebhook = httpAction(async (ctx, request) => {
  const configuredSecret = env.REVENUECAT_WEBHOOK_SECRET?.trim()
  const configuredAppId = env.REVENUECAT_APP_ID?.trim()
  if (!configuredSecret || !configuredAppId) {
    return jsonResponse(
      { error: 'RevenueCat webhook is not configured' },
      503,
      {
        'retry-after': '60',
      },
    )
  }
  const suppliedSecret = bearerSecret(request)
  if (!suppliedSecret || !secretsMatch(configuredSecret, suppliedSecret)) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const parsedBody = await parseLimitedJsonBody(request, {
    maxBytes: 64 * 1024,
    tooLargeError: 'RevenueCat webhook is too large',
    checkContentLength: true,
    invalidJsonError: 'Invalid JSON',
  })
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.body
  const parsed = parseRevenueCatWebhook(body)
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400)
  if (parsed.event.apiVersion !== '1.0') {
    return jsonResponse({ error: 'Unsupported RevenueCat API version' }, 400)
  }
  if (parsed.event.appId !== configuredAppId) {
    // A project-wide integration may deliver events for another app. Ack it
    // so RevenueCat does not retry an event that can never belong to BeeGreat.
    return jsonResponse({ ok: true, status: 'ignored_app' }, 200)
  }

  const event = parsed.event
  const result = await ctx.runMutation(
    internal.subscriptions.applyRevenueCatEvent,
    {
      eventId: event.eventId,
      type: event.type,
      ...(event.appUserId ? { appUserId: event.appUserId } : {}),
      ...(event.environment ? { environment: event.environment } : {}),
      ...(event.productId ? { productId: event.productId } : {}),
      entitlementIds: event.entitlementIds,
      ...(event.purchasedAtMs !== undefined
        ? { purchasedAtMs: event.purchasedAtMs }
        : {}),
      ...(event.expirationAtMs !== undefined
        ? { expirationAtMs: event.expirationAtMs }
        : {}),
      ...(event.gracePeriodExpirationAtMs !== undefined
        ? {
            gracePeriodExpirationAtMs: event.gracePeriodExpirationAtMs,
          }
        : {}),
      ...(event.cancelReason ? { cancelReason: event.cancelReason } : {}),
      eventTimestampMs: event.eventTimestampMs,
      receivedAt: Date.now(),
      transferredFrom: event.transferredFrom,
      transferredTo: event.transferredTo,
    },
  )
  return jsonResponse({ ok: true, status: result.status }, 200)
})
