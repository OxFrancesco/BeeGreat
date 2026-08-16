import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  jsonResponse,
  readJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const devinInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const body = await readJsonBody<Record<string, unknown>>(request)
  const operation = body?.operation
  if (
    typeof body?.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    (operation !== 'start' &&
      operation !== 'list' &&
      operation !== 'inspect' &&
      operation !== 'follow_up') ||
    (body.prompt !== undefined && typeof body.prompt !== 'string') ||
    (body.title !== undefined && typeof body.title !== 'string') ||
    (body.repos !== undefined &&
      (!Array.isArray(body.repos) ||
        body.repos.some((repo) => typeof repo !== 'string'))) ||
    (body.mode !== undefined &&
      body.mode !== 'normal' &&
      body.mode !== 'fast') ||
    (body.maxAcuLimit !== undefined &&
      typeof body.maxAcuLimit !== 'number') ||
    (body.sessionId !== undefined && typeof body.sessionId !== 'string') ||
    (body.message !== undefined && typeof body.message !== 'string') ||
    (body.limit !== undefined && typeof body.limit !== 'number')
  ) {
    return jsonResponse({ error: 'Invalid Devin request' }, 400)
  }
  try {
    const result: string = await ctx.runAction(internal.devin.execute, {
      userId: body.userId,
      operation,
      prompt: body.prompt as string | undefined,
      title: body.title as string | undefined,
      repos: body.repos as string[] | undefined,
      mode: body.mode as 'normal' | 'fast' | undefined,
      maxAcuLimit: body.maxAcuLimit as number | undefined,
      sessionId: body.sessionId as string | undefined,
      message: body.message as string | undefined,
      limit: body.limit as number | undefined,
    })
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
