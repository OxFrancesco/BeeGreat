import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

const DevinRequestBody = Schema.Struct({
  userId: Schema.String.pipe(Schema.check(Schema.isPattern(/^user_[A-Za-z0-9]+$/))),
  operation: Schema.Literals(['start', 'list', 'inspect', 'follow_up']),
  prompt: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  repos: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  mode: Schema.optional(Schema.Literals(['normal', 'fast'])),
  maxAcuLimit: Schema.optional(Schema.Number),
  sessionId: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

export const devinInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = Schema.decodeUnknownResult(DevinRequestBody)(
    await readJsonBody(request),
  )
  if (Result.isFailure(body)) {
    return jsonResponse({ error: 'Invalid Devin request' }, 400)
  }
  try {
    const result: string = await ctx.runAction(internal.devin.execute, body.success)
    return new Response(result, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Devin request failed'
    return jsonResponse({ error: message }, 400)
  }
})
