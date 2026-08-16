import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { env, httpAction } from '../_generated/server'
import { LINK_SESSION_TTL_MS } from '../imessage'
import { isValidImessageAddress } from '../imessageAddress'
import { hashImessageToken } from '../imessageAuth'
import { isClerkUserId } from '../revenueCatWebhook'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

// Trusted iMessage-bridge identity service (proxied by the agent worker).
// `resolve` maps a sender to their user; `begin_link` mints a single-use
// magic link for unknown senders; `unlink`/`status`/`disconnect` complete
// the reverse states for the bridge and the CLI.
export const imessageInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<Record<string, unknown>>(request)
  const operation = body?.operation
  if (
    !body ||
    (operation !== 'resolve' &&
      operation !== 'begin_link' &&
      operation !== 'unlink' &&
      operation !== 'status' &&
      operation !== 'disconnect' &&
      operation !== 'claim_delivery' &&
      operation !== 'complete_delivery' &&
      operation !== 'retry_delivery')
  ) {
    return jsonResponse({ error: 'Invalid iMessage request' }, 400)
  }
  if (operation === 'claim_delivery') {
    if (typeof body.leaseId !== 'string' || !body.leaseId.trim()) {
      return jsonResponse({ error: 'Invalid delivery lease' }, 400)
    }
    return jsonResponse(
      await ctx.runMutation(internal.imessageOutbox.claimNext, {
        leaseId: body.leaseId,
      }),
      200,
    )
  }
  if (operation === 'complete_delivery' || operation === 'retry_delivery') {
    if (
      typeof body.deliveryId !== 'string' ||
      typeof body.leaseId !== 'string'
    ) {
      return jsonResponse({ error: 'Invalid delivery acknowledgement' }, 400)
    }
    await ctx.runMutation(
      operation === 'complete_delivery'
        ? internal.imessageOutbox.complete
        : internal.imessageOutbox.retry,
      {
        deliveryId: body.deliveryId as Id<'imessageDeliveries'>,
        leaseId: body.leaseId,
      },
    )
    return jsonResponse({ ok: true }, 200)
  }
  if (
    operation === 'resolve' ||
    operation === 'begin_link' ||
    operation === 'unlink'
  ) {
    if (
      typeof body.address !== 'string' ||
      !isValidImessageAddress(body.address)
    ) {
      return jsonResponse({ error: 'Invalid iMessage address' }, 400)
    }
    if (operation === 'resolve') {
      const connection = await ctx.runQuery(
        internal.imessage.resolveAddressForBridge,
        { address: body.address },
      )
      return jsonResponse({ userId: connection?.userId ?? null }, 200)
    }
    if (operation === 'unlink') {
      const result = await ctx.runMutation(
        internal.imessage.disconnectAddressForBridge,
        { address: body.address },
      )
      return jsonResponse(result, 200)
    }
    const webAppUrl = (
      env.WEB_APP_URL?.trim() || 'https://beegreat.app'
    ).replace(/\/$/, '')
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const token = Array.from(tokenBytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    const expiresAt = Date.now() + LINK_SESSION_TTL_MS
    try {
      await ctx.runMutation(internal.imessage.createLinkSession, {
        address: body.address,
        tokenHash: await hashImessageToken(token),
        expiresAt,
      })
    } catch (error) {
      const code =
        error instanceof ConvexError &&
        typeof error.data === 'object' &&
        error.data &&
        'code' in error.data
          ? (error.data as { code?: string }).code
          : undefined
      return jsonResponse(
        {
          error:
            code === 'RATE_LIMITED'
              ? 'Too many link attempts for this address. Try again later.'
              : 'This sender address cannot be linked.',
          code: code ?? 'INVALID_ADDRESS',
        },
        code === 'RATE_LIMITED' ? 429 : 400,
      )
    }
    return jsonResponse(
      {
        url: `${webAppUrl}/link/imessage?token=${token}`,
        expiresAt,
      },
      200,
    )
  }
  if (typeof body.userId !== 'string' || !isClerkUserId(body.userId)) {
    return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
  }
  if (operation === 'status') {
    const connections = await ctx.runQuery(
      internal.imessage.connectionsForAgent,
      { userId: body.userId },
    )
    return jsonResponse({ connections }, 200)
  }
  const result = await ctx.runMutation(internal.imessage.disconnectForAgent, {
    userId: body.userId,
    ...(typeof body.address === 'string' ? { address: body.address } : {}),
  })
  return jsonResponse(result, 200)
})
