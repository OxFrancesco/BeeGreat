import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  ClerkUserId,
  decodeRequestBody,
  jsonResponse,
  parseLimitedJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  requireJsonContentType,
} from './middleware'

const BeeSitesRequest = Schema.Struct({
  userId: ClerkUserId,
  operation: Schema.String,
})

const SitePreparation = Schema.Struct({
  title: Schema.String,
  siteId: Schema.optional(Schema.String),
  suggestedSlug: Schema.optional(Schema.String),
})

const SiteDeployment = Schema.Struct({
  siteId: Schema.String,
  version: Schema.String,
  kind: Schema.Literals(['preview', 'production']),
  pageCount: Schema.Number,
  fileCount: Schema.Number,
  totalBytes: Schema.Number,
})

const DeploymentCompletion = Schema.Struct({
  deploymentId: Schema.String,
  manifestKey: Schema.String,
})

const DeploymentFailure = Schema.Struct({
  deploymentId: Schema.String,
  error: Schema.String,
})

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
  const body = decodeRequestBody(BeeSitesRequest, parsedBody.body)
  if (!body) {
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
        const preparation = decodeRequestBody(SitePreparation, parsedBody.body)
        if (!preparation) {
          return jsonResponse({ error: 'Invalid site preparation' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.prepareForAgent, {
            userId: body.userId,
            siteId:
              preparation.siteId === undefined
                ? undefined
                : requestDocumentId<'beeSites'>(preparation.siteId),
            title: preparation.title,
            suggestedSlug: preparation.suggestedSlug,
          }),
          200,
        )
      }
      case 'begin_deployment': {
        const deployment = decodeRequestBody(SiteDeployment, parsedBody.body)
        if (!deployment) {
          return jsonResponse({ error: 'Invalid site deployment' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.beginDeployment, {
            userId: body.userId,
            siteId: requestDocumentId<'beeSites'>(deployment.siteId),
            version: deployment.version,
            kind: deployment.kind,
            pageCount: deployment.pageCount,
            fileCount: deployment.fileCount,
            totalBytes: deployment.totalBytes,
          }),
          200,
        )
      }
      case 'complete_deployment': {
        const completion = decodeRequestBody(
          DeploymentCompletion,
          parsedBody.body,
        )
        if (!completion) {
          return jsonResponse({ error: 'Invalid deployment completion' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.beeSites.completeDeployment, {
            userId: body.userId,
            deploymentId: requestDocumentId<'beeSiteDeployments'>(
              completion.deploymentId,
            ),
            manifestKey: completion.manifestKey,
          }),
          200,
        )
      }
      case 'fail_deployment': {
        const failure = decodeRequestBody(DeploymentFailure, parsedBody.body)
        if (!failure) {
          return jsonResponse({ error: 'Invalid deployment failure' }, 400)
        }
        await ctx.runMutation(internal.beeSites.failDeployment, {
          userId: body.userId,
          deploymentId: requestDocumentId<'beeSiteDeployments'>(
            failure.deploymentId,
          ),
          error: failure.error,
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
