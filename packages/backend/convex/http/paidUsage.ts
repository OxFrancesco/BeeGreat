import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { jsonResponse, parseLimitedJsonBody, requireBrokerSecret, requestDocumentId } from './middleware'
import type { PaidOperation } from '../paidUsage'

const operations = new Set<PaidOperation>(['voice_transcribe', 'voice_speak', 'voice_realtime', 'firecrawl', 'media_image', 'media_video', 'devin', 'bookmark'])
function isOperation(value: string): value is PaidOperation { return operations.has(value as PaidOperation) }

export const paidUsage = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const parsed = await parseLimitedJsonBody(request, { maxBytes: 4096, tooLargeError: 'Usage request is too large', checkContentLength: true })
  if (!parsed.ok) return parsed.response
  const body = parsed.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'Invalid usage request' }, 400)
  try {
    if (body.action === 'claim_voice' && typeof body.ticketHash === 'string' && /^[a-f0-9]{64}$/.test(body.ticketHash)) {
      const permit = await ctx.runMutation(internal.paidUsage.claimVoiceTicket, { ticketHash: body.ticketHash })
      return permit ? jsonResponse(permit, 200) : jsonResponse({ error: 'Voice ticket expired or already used' }, 401)
    }
    if (typeof body.userId !== 'string' || !/^user_[A-Za-z0-9]+$/.test(body.userId)) return jsonResponse({ error: 'Invalid usage user' }, 400)
    if (body.action === 'release' && typeof body.leaseId === 'string') {
      await ctx.runMutation(internal.paidUsage.release, { userId: body.userId, leaseId: requestDocumentId<'paidUsageLeases'>(body.leaseId) })
      return jsonResponse({ ok: true }, 200)
    }
    if (body.action !== 'reserve' || typeof body.operation !== 'string' || !isOperation(body.operation) || typeof body.units !== 'number' || (body.ticketHash !== undefined && typeof body.ticketHash !== 'string')) return jsonResponse({ error: 'Invalid usage reservation' }, 400)
    const result = await ctx.runMutation(internal.paidUsage.reserve, { userId: body.userId, operation: body.operation, units: body.units, ticketHash: body.ticketHash })
    return jsonResponse(result, 200)
  } catch {
    return jsonResponse({ error: 'This service has reached its usage or concurrency limit. Try again later.' }, 429)
  }
})
