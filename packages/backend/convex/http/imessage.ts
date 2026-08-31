import type { FunctionArgs } from 'convex/server'
import { ConvexError } from 'convex/values'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { env, httpAction } from '../_generated/server'
import { LINK_SESSION_TTL_MS } from '../imessage'
import { isValidImessageAddress } from '../imessageAddress'
import { hashImessageToken } from '../imessageAuth'
import {
  ClerkUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from './middleware'

const ImessageRequest = Schema.Struct({
  operation: Schema.Literals([
    'resolve',
    'begin_link',
    'unlink',
    'status',
    'disconnect',
    'claim_delivery',
    'complete_delivery',
    'retry_delivery',
  ]),
})

const DeliveryLease = Schema.Struct({ leaseId: Schema.String })

const DeliveryAcknowledgement = Schema.Struct({
  deliveryId: Schema.String,
  leaseId: Schema.String,
})

const AddressField = Schema.Struct({ address: Schema.String })

const UserIdField = Schema.Struct({ userId: ClerkUserId })

const LinkSessionError = Schema.Struct({
  code: Schema.optional(Schema.String),
})

// Trusted iMessage-bridge identity service (proxied by the agent worker).
// `resolve` maps a sender to their user; `begin_link` mints a single-use
// magic link for unknown senders; `unlink`/`status`/`disconnect` complete
// the reverse states for the bridge and the CLI.
export const imessageInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(ImessageRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid iMessage request' }, 400)
  }
  const operation = body.operation
  if (operation === 'claim_delivery') {
    const lease = decodeRequestBody(DeliveryLease, raw)
    if (!lease || !lease.leaseId.trim()) {
      return jsonResponse({ error: 'Invalid delivery lease' }, 400)
    }
    return jsonResponse(
      await ctx.runMutation(internal.imessageOutbox.claimNext, {
        leaseId: lease.leaseId,
      }),
      200,
    )
  }
  if (operation === 'complete_delivery' || operation === 'retry_delivery') {
    const acknowledgement = decodeRequestBody(DeliveryAcknowledgement, raw)
    if (!acknowledgement) {
      return jsonResponse({ error: 'Invalid delivery acknowledgement' }, 400)
    }
    await ctx.runMutation(
      operation === 'complete_delivery'
        ? internal.imessageOutbox.complete
        : internal.imessageOutbox.retry,
      {
        deliveryId: requestDocumentId<'imessageDeliveries'>(
          acknowledgement.deliveryId,
        ),
        leaseId: acknowledgement.leaseId,
      },
    )
    return jsonResponse({ ok: true }, 200)
  }
  if (
    operation === 'resolve' ||
    operation === 'begin_link' ||
    operation === 'unlink'
  ) {
    const addressField = decodeRequestBody(AddressField, raw)
    if (!addressField || !isValidImessageAddress(addressField.address)) {
      return jsonResponse({ error: 'Invalid iMessage address' }, 400)
    }
    const address = addressField.address
    if (operation === 'resolve') {
      const connection = await ctx.runQuery(
        internal.imessage.resolveAddressForBridge,
        { address },
      )
      return jsonResponse({ userId: connection?.userId ?? null }, 200)
    }
    if (operation === 'unlink') {
      const result = await ctx.runMutation(
        internal.imessage.disconnectAddressForBridge,
        { address },
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
        address,
        tokenHash: await hashImessageToken(token),
        expiresAt,
      })
    } catch (error) {
      const decodedError =
        error instanceof ConvexError
          ? Schema.decodeUnknownResult(LinkSessionError)(error.data)
          : null
      const code =
        decodedError !== null && Result.isSuccess(decodedError)
          ? decodedError.success.code
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
  const userIdField = decodeRequestBody(UserIdField, raw)
  if (!userIdField) {
    return jsonResponse({ error: 'Invalid Clerk user id' }, 400)
  }
  if (operation === 'status') {
    const connections = await ctx.runQuery(
      internal.imessage.connectionsForAgent,
      { userId: userIdField.userId },
    )
    return jsonResponse({ connections }, 200)
  }
  const disconnectArgs: FunctionArgs<
    typeof internal.imessage.disconnectForAgent
  > = { userId: userIdField.userId }
  const addressField = decodeRequestBody(AddressField, raw)
  if (addressField) disconnectArgs.address = addressField.address
  const result = await ctx.runMutation(
    internal.imessage.disconnectForAgent,
    disconnectArgs,
  )
  return jsonResponse(result, 200)
})
