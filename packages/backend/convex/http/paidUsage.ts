import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { jsonResponse, parseLimitedJsonBody, requireBrokerSecret, requestDocumentId } from './middleware'
import * as Schema from 'effect/Schema'
import * as Predicate from 'effect/Predicate'
import { jsonRecord } from '../jsonValue'

const isOperation = Schema.is(Schema.Literals(['voice_transcribe', 'voice_speak', 'voice_realtime', 'firecrawl', 'media_image', 'media_video', 'devin', 'bookmark']))

export const paidUsage = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const parsed = await parseLimitedJsonBody(request, { maxBytes: 4096, tooLargeError: 'Usage request is too large', checkContentLength: true })
  if (!parsed.ok) return parsed.response
  const body = jsonRecord(parsed.body)
  if (!body) return jsonResponse({ error: 'Invalid usage request' }, 400)
  try {
    if (body.action === 'claim_voice' && Predicate.isString(body.ticketHash) && /^[a-f0-9]{64}$/.test(body.ticketHash)) {
      const permit = await ctx.runMutation(internal.paidUsage.claimVoiceTicket, { ticketHash: body.ticketHash })
      return permit ? jsonResponse(permit, 200) : jsonResponse({ error: 'Voice ticket expired or already used' }, 401)
    }
    if (!Predicate.isString(body.userId) || !/^user_[A-Za-z0-9]+$/.test(body.userId)) return jsonResponse({ error: 'Invalid usage user' }, 400)
    if (body.action === 'release' && Predicate.isString(body.leaseId)) {
      await ctx.runMutation(internal.paidUsage.release, { userId: body.userId, leaseId: requestDocumentId<'paidUsageLeases'>(body.leaseId) })
      return jsonResponse({ ok: true }, 200)
    }
    if (body.action !== 'reserve' || !Predicate.isString(body.operation) || !isOperation(body.operation) || !Predicate.isNumber(body.units) || (body.ticketHash !== undefined && !Predicate.isString(body.ticketHash))) return jsonResponse({ error: 'Invalid usage reservation' }, 400)
    const result = await ctx.runMutation(internal.paidUsage.reserve, { userId: body.userId, operation: body.operation, units: body.units, ticketHash: body.ticketHash })
    return jsonResponse(result, 200)
  } catch {
    return jsonResponse({ error: 'This service has reached its usage or concurrency limit. Try again later.' }, 429)
  }
})
