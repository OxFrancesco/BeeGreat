import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { httpAction } from '../_generated/server'
import { isClerkUserId } from '../revenueCatWebhook'
import {
  jsonResponse,
  parseLimitedJsonBody,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

export const beeSites = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const contentTypeError = requireJsonContentType(request)
  if (contentTypeError) return contentTypeError
  const parsedBody = await parseLimitedJsonBody(request, {
    maxBytes: 32 * 1024,
    tooLargeError: 'Bee Sites request is too large',
  })
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.body as Record<string, unknown> | null
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !isClerkUserId(body.userId) ||
    typeof body.operation !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid Bee Sites request' }, 400)
  }
  try {
    switch (body.operation) {
      case 'list':
        return jsonResponse(
          await ctx.runQuery(internal.beeSites.listForAgent, {
            userId: body.userId,
          }),
          200,
        )
      case 'prepare': {
        if (
          typeof body.title !== 'string' ||
          (body.siteId !== undefined && typeof body.siteId !== 'string') ||
          (body.suggestedSlug !== undefined &&
            typeof body.suggestedSlug !== 'string')
        ) {
          return jsonResponse({ error: 'Invalid site preparation' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.prepareForAgent, {
            userId: body.userId,
            siteId: body.siteId as Id<'beeSites'> | undefined,
            title: body.title,
            suggestedSlug: body.suggestedSlug as string | undefined,
          }),
          200,
        )
      }
      case 'begin_deployment': {
        if (
          typeof body.siteId !== 'string' ||
          typeof body.version !== 'string' ||
          (body.kind !== 'preview' && body.kind !== 'production') ||
          typeof body.pageCount !== 'number' ||
          typeof body.fileCount !== 'number' ||
          typeof body.totalBytes !== 'number'
        ) {
          return jsonResponse({ error: 'Invalid site deployment' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.beginDeployment, {
            userId: body.userId,
            siteId: body.siteId as Id<'beeSites'>,
            version: body.version,
            kind: body.kind,
            pageCount: body.pageCount,
            fileCount: body.fileCount,
            totalBytes: body.totalBytes,
          }),
          200,
        )
      }
      case 'complete_deployment': {
        if (
          typeof body.deploymentId !== 'string' ||
          typeof body.manifestKey !== 'string'
        ) {
          return jsonResponse({ error: 'Invalid deployment completion' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.completeDeployment, {
            userId: body.userId,
            deploymentId: body.deploymentId as Id<'beeSiteDeployments'>,
            manifestKey: body.manifestKey,
          }),
          200,
        )
      }
      case 'fail_deployment': {
        if (
          typeof body.deploymentId !== 'string' ||
          typeof body.error !== 'string'
        ) {
          return jsonResponse({ error: 'Invalid deployment failure' }, 400)
        }
        await ctx.runMutation(internal.beeSites.failDeployment, {
          userId: body.userId,
          deploymentId: body.deploymentId as Id<'beeSiteDeployments'>,
          error: body.error,
        })
        return jsonResponse({ ok: true }, 200)
      }
      default:
        return jsonResponse({ error: 'Unknown Bee Sites operation' }, 400)
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bee Sites request failed'
    return jsonResponse({ error: message }, 400)
  }
})
