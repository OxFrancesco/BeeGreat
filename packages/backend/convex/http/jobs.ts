import type { FunctionArgs } from 'convex/server'
import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  ClerkUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  type JsonValue,
} from './middleware'

const JobRequest = Schema.Struct({
  userId: ClerkUserId,
  operation: Schema.String,
})

const JobSchedule = Schema.Record(Schema.String, Schema.Unknown)

const JobDelivery = Schema.mutable(Schema.Array(Schema.Unknown))

const JobDefinition = Schema.Struct({
  title: Schema.String,
  instruction: Schema.String,
  schedule: JobSchedule,
  delivery: JobDelivery,
})

const JobIdField = Schema.Struct({ jobId: Schema.String })

const JobTitleField = Schema.Struct({ title: Schema.String })

const JobInstructionField = Schema.Struct({ instruction: Schema.String })

const JobScheduleField = Schema.Struct({ schedule: JobSchedule })

const JobDeliveryField = Schema.Struct({ delivery: JobDelivery })

const JobCompletion = Schema.Struct({
  runId: Schema.String,
  status: Schema.Literals(['succeeded', 'failed', 'needs_attention']),
})

const JobSummaryField = Schema.Struct({ summary: Schema.String })

const JobErrorField = Schema.Struct({ error: Schema.String })

const JobRunIdField = Schema.Struct({ runId: Schema.String })

// Private Job bridge used by Bee's natural-language tools and by the Job run
// itself to settle its Convex ledger row. App clients use authenticated Convex
// functions directly and never receive this shared secret.
export const jobsInternal = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(JobRequest, raw)
  if (!body) {
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
        const definition = decodeRequestBody(JobDefinition, raw)
        if (!definition) {
          return jsonResponse({ error: 'Invalid Job definition' }, 400)
        }
        // SAFETY: The schedule and delivery payloads are deliberately passed
        // through after shallow JSON validation: internal.agentJobs
        // .createForAgent re-validates their full structure with its Convex
        // argument validators, and a validation failure surfaces as this
        // handler's catch-all 400.
        return jsonResponse(
          await ctx.runMutation(internal.agentJobs.createForAgent, {
            userId: body.userId,
            title: definition.title,
            instruction: definition.instruction,
            schedule: definition.schedule as never,
            delivery: definition.delivery as never,
          }),
          200,
        )
      }
      case 'update': {
        const jobIdField = decodeRequestBody(JobIdField, raw)
        if (!jobIdField) {
          return jsonResponse({ error: 'Invalid Job id' }, 400)
        }
        const args: FunctionArgs<typeof internal.agentJobs.updateForAgent> = {
          userId: body.userId,
          jobId: requestDocumentId<'agentJobs'>(jobIdField.jobId),
        }
        const titleField = decodeRequestBody(JobTitleField, raw)
        if (titleField) args.title = titleField.title
        const instructionField = decodeRequestBody(JobInstructionField, raw)
        if (instructionField) args.instruction = instructionField.instruction
        const scheduleField = decodeRequestBody(JobScheduleField, raw)
        if (scheduleField) {
          // SAFETY: The schedule payload is deliberately passed through after
          // shallow JSON validation: internal.agentJobs.updateForAgent
          // re-validates its full structure with its Convex argument
          // validator, surfacing as this handler's catch-all 400.
          args.schedule = scheduleField.schedule as never
        }
        const deliveryField = decodeRequestBody(JobDeliveryField, raw)
        if (deliveryField) {
          // SAFETY: The delivery payload is deliberately passed through after
          // shallow JSON validation: internal.agentJobs.updateForAgent
          // re-validates its full structure with its Convex argument
          // validator, surfacing as this handler's catch-all 400.
          args.delivery = deliveryField.delivery as never
        }
        return jsonResponse(
          await ctx.runMutation(internal.agentJobs.updateForAgent, args),
          200,
        )
      }
      case 'pause':
      case 'resume':
      case 'cancel':
      case 'run_now': {
        const jobIdField = decodeRequestBody(JobIdField, raw)
        if (!jobIdField) {
          return jsonResponse({ error: 'Invalid Job id' }, 400)
        }
        const result = await ctx.runMutation(
          internal.agentJobs.manageForAgent,
          {
            userId: body.userId,
            jobId: requestDocumentId<'agentJobs'>(jobIdField.jobId),
            operation: body.operation,
          },
        )
        return jsonResponse({ ok: true, result }, 200)
      }
      case 'finish': {
        const completion = decodeRequestBody(JobCompletion, raw)
        if (!completion) {
          return jsonResponse({ error: 'Invalid Job completion' }, 400)
        }
        const args: FunctionArgs<
          typeof internal.agentJobRuns.finishForAgent
        > = {
          userId: body.userId,
          runId: requestDocumentId<'agentJobRuns'>(completion.runId),
          status: completion.status,
        }
        const summaryField = decodeRequestBody(JobSummaryField, raw)
        if (summaryField) args.summary = summaryField.summary
        const errorField = decodeRequestBody(JobErrorField, raw)
        if (errorField) args.error = errorField.error
        await ctx.runMutation(internal.agentJobRuns.finishForAgent, args)
        return jsonResponse({ ok: true }, 200)
      }
      case 'waiting_external': {
        const runIdField = decodeRequestBody(JobRunIdField, raw)
        if (!runIdField) {
          return jsonResponse({ error: 'Invalid Job run id' }, 400)
        }
        const args: FunctionArgs<
          typeof internal.agentJobRuns.markWaitingExternalForAgent
        > = {
          userId: body.userId,
          runId: requestDocumentId<'agentJobRuns'>(runIdField.runId),
        }
        const summaryField = decodeRequestBody(JobSummaryField, raw)
        if (summaryField) args.summary = summaryField.summary
        await ctx.runMutation(
          internal.agentJobRuns.markWaitingExternalForAgent,
          args,
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
