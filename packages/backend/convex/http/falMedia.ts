import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  parseLimitedJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const falMediaInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const parsedBody = await parseLimitedJsonBody(request, {
    maxBytes: 32 * 1024,
    tooLargeError: 'Imagine request is too large',
    checkContentLength: true,
  })
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.body as Record<string, unknown> | null
  const operation = body?.operation
  if (
    !body ||
    (operation !== 'generate_image' &&
      operation !== 'edit_image' &&
      operation !== 'generate_video' &&
      operation !== 'edit_video') ||
    typeof body.prompt !== 'string' ||
    (body.sourceUrl !== undefined && typeof body.sourceUrl !== 'string')
  ) {
    return jsonResponse({ error: 'Invalid Imagine request' }, 400)
  }
  try {
    const result = await ctx.runAction(internal.falMedia.execute, {
      operation,
      prompt: body.prompt,
      sourceUrl: body.sourceUrl as string | undefined,
    })
    return jsonResponse(result, 200)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Imagine request failed'
    return jsonResponse({ error: message }, 400)
  }
})
