import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  decodeRequestBody,
  jsonResponse,
  parseLimitedJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

const FalMediaRequest = Schema.Struct({
  operation: Schema.Literals([
    'generate_image',
    'edit_image',
    'generate_video',
    'edit_video',
  ]),
  prompt: Schema.String,
  sourceUrl: Schema.optional(Schema.String),
})

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
  const body = decodeRequestBody(FalMediaRequest, parsedBody.body)
  if (!body) {
    return jsonResponse({ error: 'Invalid Imagine request' }, 400)
  }
  try {
    const result = await ctx.runAction(internal.falMedia.execute, {
      operation: body.operation,
      prompt: body.prompt,
      sourceUrl: body.sourceUrl,
    })
    return jsonResponse(result, 200)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Imagine request failed'
    return jsonResponse({ error: message }, 400)
  }
})
