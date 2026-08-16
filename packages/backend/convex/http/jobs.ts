import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { httpAction } from '../_generated/server'
import { isClerkUserId } from '../revenueCatWebhook'
import { jsonResponse, readJsonBody, requireBrokerSecret } from './middleware'

// Private Job bridge used by Bee's natural-language tools and by the Job run
// itself to settle its Convex ledger row. App clients use authenticated Convex
// functions directly and never receive this shared secret.
export const jobsInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !isClerkUserId(body.userId) ||
    typeof body.operation !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid Job request' }, 400)
  }
  try {
    switch (body.operation) {
      case 'list':
        return jsonResponse(
          await ctx.runQuery(internal.agentJobs.listForAgent, {
            userId: body.userId,
          }),
          200,
        )
      case 'create': {
        if (
          typeof body.title !== 'string' ||
          typeof body.instruction !== 'string' ||
          !Array.isArray(body.delivery) ||
          !body.schedule ||
          typeof body.schedule !== 'object' ||
          Array.isArray(body.schedule)
        ) {
          return jsonResponse({ error: 'Invalid Job definition' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.agentJobs.createForAgent, {
            userId: body.userId,
            title: body.title,
            instruction: body.instruction,
            schedule: body.schedule as never,
            delivery: body.delivery as never,
          }),
          200,
        )
      }
      case 'update': {
        if (typeof body.jobId !== 'string') {
          return jsonResponse({ error: 'Invalid Job id' }, 400)
        }
        return jsonResponse(
          await ctx.runMutation(internal.agentJobs.updateForAgent, {
            userId: body.userId,
            jobId: body.jobId as Id<'agentJobs'>,
            ...(typeof body.title === 'string' ? { title: body.title } : {}),
            ...(typeof body.instruction === 'string'
              ? { instruction: body.instruction }
              : {}),
            ...(body.schedule &&
            typeof body.schedule === 'object' &&
            !Array.isArray(body.schedule)
              ? { schedule: body.schedule as never }
              : {}),
            ...(Array.isArray(body.delivery)
              ? { delivery: body.delivery as never }
              : {}),
          }),
          200,
        )
      }
      case 'pause':
      case 'resume':
      case 'cancel':
      case 'run_now': {
        if (typeof body.jobId !== 'string') {
          return jsonResponse({ error: 'Invalid Job id' }, 400)
        }
        const result = await ctx.runMutation(
          internal.agentJobs.manageForAgent,
          {
            userId: body.userId,
            jobId: body.jobId as Id<'agentJobs'>,
            operation: body.operation,
          },
        )
        return jsonResponse({ ok: true, result }, 200)
      }
      case 'finish': {
        if (
          typeof body.runId !== 'string' ||
          (body.status !== 'succeeded' &&
            body.status !== 'failed' &&
            body.status !== 'needs_attention')
        ) {
          return jsonResponse({ error: 'Invalid Job completion' }, 400)
        }
        await ctx.runMutation(internal.agentJobRuns.finishForAgent, {
          userId: body.userId,
          runId: body.runId as Id<'agentJobRuns'>,
          status: body.status,
          ...(typeof body.summary === 'string'
            ? { summary: body.summary }
            : {}),
          ...(typeof body.error === 'string' ? { error: body.error } : {}),
        })
        return jsonResponse({ ok: true }, 200)
      }
      case 'waiting_external': {
        if (typeof body.runId !== 'string') {
          return jsonResponse({ error: 'Invalid Job run id' }, 400)
        }
        await ctx.runMutation(
          internal.agentJobRuns.markWaitingExternalForAgent,
          {
            userId: body.userId,
            runId: body.runId as Id<'agentJobRuns'>,
            ...(typeof body.summary === 'string'
              ? { summary: body.summary }
              : {}),
          },
        )
        return jsonResponse({ ok: true }, 200)
      }
      default:
        return jsonResponse({ error: 'Unknown Job operation' }, 400)
    }
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Job request failed',
      },
      400,
    )
  }
})
