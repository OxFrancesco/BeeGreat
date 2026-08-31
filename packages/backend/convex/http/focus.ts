import * as Schema from 'effect/Schema'
import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import {
  AgentUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  type JsonValue,
} from './middleware'

const FocusRecurrence = Schema.Struct({
  frequency: Schema.Literals(['daily', 'weekly', 'monthly', 'yearly']),
  interval: Schema.Number,
  firstOccurrenceAt: Schema.Number,
})

const FocusRequest = Schema.Struct({
  userId: AgentUserId,
  operation: Schema.String,
})

const OwnerKeyField = Schema.Struct({ ownerKey: Schema.String })

const ChannelSource = Schema.Struct({
  source: Schema.Literal('imessage'),
  sourceAddress: Schema.String,
})

const TranscriptSync = Schema.Struct({
  threadId: Schema.Number,
  messages: Schema.mutable(Schema.Array(Schema.Unknown)),
})

const ConversationTitle = Schema.Struct({
  threadId: Schema.Number,
  title: Schema.String,
})

const FirstFocusConfirmation = Schema.Struct({
  requestId: Schema.String,
  goalTitle: Schema.String,
  projectTitle: Schema.String,
  taskTitle: Schema.String,
  highlightExpiresAt: Schema.optional(Schema.Number),
})

const FirstFocusCancellation = Schema.Struct({
  requestId: Schema.String,
  goalTitle: Schema.String,
  projectTitle: Schema.String,
  taskTitle: Schema.String,
})

const HighlightCompletion = Schema.Struct({
  requestId: Schema.String,
  taskId: Schema.String,
})

const Web3ActionLookup = Schema.Struct({ actionId: Schema.String })

const Web3ActionDecision = Schema.Struct({
  actionId: Schema.String,
  summary: Schema.String,
})

const GoalIdField = Schema.Struct({ goalId: Schema.optional(Schema.String) })

const TaskStatusField = Schema.Struct({
  status: Schema.optional(Schema.Literals(['todo', 'done'])),
})

const GoalCreation = Schema.Struct({
  title: Schema.String,
  finalGoal: Schema.optional(Schema.String),
})

const ProjectCreation = Schema.Struct({
  goalId: Schema.String,
  title: Schema.String,
  recurrence: Schema.optional(FocusRecurrence),
})

const TaskCreation = Schema.Struct({
  goalId: Schema.String,
  projectId: Schema.optional(Schema.String),
  title: Schema.String,
  dueDate: Schema.optional(Schema.Number),
  recurrence: Schema.optional(FocusRecurrence),
})

export const focus = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const raw = await readJsonBody<JsonValue>(request)
  const body = decodeRequestBody(FocusRequest, raw)
  if (!body) {
    return jsonResponse({ error: 'Invalid focus request' }, 400)
  }

  try {
    let result: unknown
    const ownerKeyField = decodeRequestBody(OwnerKeyField, raw)
    const channelOwnerKey =
      ownerKeyField && ownerKeyField.ownerKey.endsWith(`|${body.userId}`)
        ? ownerKeyField.ownerKey
        : undefined
    if (body.operation.startsWith('channel_') && !channelOwnerKey) {
      return jsonResponse({ error: 'Invalid channel identity' }, 400)
    }
    if (body.operation === 'channel_context') {
      const channel = decodeRequestBody(ChannelSource, raw)
      if (!channel) {
        return jsonResponse({ error: 'Invalid channel source' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.getContext, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        source: channel.source,
        sourceAddress: channel.sourceAddress,
      })
    } else if (body.operation === 'channel_create_thread') {
      const channel = decodeRequestBody(ChannelSource, raw)
      if (!channel) {
        return jsonResponse({ error: 'Invalid channel source' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.createThread, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        source: channel.source,
        sourceAddress: channel.sourceAddress,
      })
    } else if (body.operation === 'channel_sync_transcript') {
      const sync = decodeRequestBody(TranscriptSync, raw)
      if (!sync) {
        return jsonResponse({ error: 'Invalid transcript sync' }, 400)
      }
      // SAFETY: Each transcript message is deliberately validated only as a
      // JSON value here: internal.channelActions.syncTranscript re-validates
      // every message field with its Convex argument validators and rejects
      // malformed entries, surfacing as this handler's catch-all 400.
      result = await ctx.runMutation(internal.channelActions.syncTranscript, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        threadId: sync.threadId,
        messages: sync.messages as Array<{
          id: string
          role: 'user' | 'assistant'
          contentJson: string
          createdAt: number
        }>,
      })
    } else if (body.operation === 'channel_create_cli_thread') {
      result = await ctx.runMutation(
        internal.channelActions.createCliThread,
        {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
        },
      )
    } else if (body.operation === 'channel_title_thread') {
      const title = decodeRequestBody(ConversationTitle, raw)
      if (!title) {
        return jsonResponse({ error: 'Invalid conversation title' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.titleThread, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        threadId: title.threadId,
        title: title.title,
      })
    } else if (body.operation === 'channel_confirm_first_focus') {
      const confirmation = decodeRequestBody(FirstFocusConfirmation, raw)
      if (!confirmation) {
        return jsonResponse(
          { error: 'Invalid first-focus confirmation' },
          400,
        )
      }
      result = await ctx.runMutation(
        internal.channelActions.confirmFirstFocus,
        {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          requestId: confirmation.requestId,
          goalTitle: confirmation.goalTitle,
          projectTitle: confirmation.projectTitle,
          taskTitle: confirmation.taskTitle,
          highlightExpiresAt: confirmation.highlightExpiresAt,
        },
      )
    } else if (body.operation === 'channel_cancel_first_focus') {
      const cancellation = decodeRequestBody(FirstFocusCancellation, raw)
      if (!cancellation) {
        return jsonResponse(
          { error: 'Invalid first-focus cancellation' },
          400,
        )
      }
      result = await ctx.runMutation(
        internal.channelActions.cancelFirstFocus,
        {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          requestId: cancellation.requestId,
          goalTitle: cancellation.goalTitle,
          projectTitle: cancellation.projectTitle,
          taskTitle: cancellation.taskTitle,
        },
      )
    } else if (body.operation === 'channel_complete_highlight') {
      const completion = decodeRequestBody(HighlightCompletion, raw)
      if (!completion) {
        return jsonResponse({ error: 'Invalid Highlight completion' }, 400)
      }
      result = await ctx.runMutation(
        internal.channelActions.completeHighlight,
        {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          requestId: completion.requestId,
          taskId: requestDocumentId<'tasks'>(completion.taskId),
        },
      )
    } else if (body.operation === 'channel_get_web3_action') {
      const lookup = decodeRequestBody(Web3ActionLookup, raw)
      if (!lookup) {
        return jsonResponse({ error: 'Invalid Web3 action' }, 400)
      }
      result = await ctx.runQuery(internal.web3Actions.getForUser, {
        userId: body.userId,
        actionId: requestDocumentId<'web3Actions'>(lookup.actionId),
      })
    } else if (
      body.operation === 'channel_confirm_web3' ||
      body.operation === 'channel_cancel_web3'
    ) {
      const decision = decodeRequestBody(Web3ActionDecision, raw)
      if (!decision) {
        return jsonResponse({ error: 'Invalid Web3 action' }, 400)
      }
      const args = {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        actionId: requestDocumentId<'web3Actions'>(decision.actionId),
        summary: decision.summary,
      }
      result =
        body.operation === 'channel_confirm_web3'
          ? await ctx.runMutation(internal.channelActions.confirmWeb3, args)
          : await ctx.runMutation(internal.channelActions.cancelWeb3, args)
    } else if (body.operation === 'get_context') {
      result = await ctx.runQuery(internal.agentFocus.getContext, {
        userId: body.userId,
      })
    } else if (body.operation === 'get_goals') {
      result = await ctx.runQuery(internal.agentFocus.getGoals, {
        userId: body.userId,
      })
    } else if (body.operation === 'list_tasks') {
      const goalIdField = decodeRequestBody(GoalIdField, raw)
      if (!goalIdField) {
        return jsonResponse({ error: 'Invalid Goal id' }, 400)
      }
      const statusField = decodeRequestBody(TaskStatusField, raw)
      if (!statusField) {
        return jsonResponse({ error: 'Invalid Task status' }, 400)
      }
      result = await ctx.runQuery(internal.agentFocus.listTasks, {
        userId: body.userId,
        goalId:
          goalIdField.goalId === undefined
            ? undefined
            : requestDocumentId<'goals'>(goalIdField.goalId),
        status: statusField.status,
      })
    } else if (body.operation === 'create_goal') {
      const goal = decodeRequestBody(GoalCreation, raw)
      if (!goal) {
        return jsonResponse({ error: 'Invalid Goal' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createGoal, {
        userId: body.userId,
        title: goal.title,
        finalGoal: goal.finalGoal,
      })
    } else if (body.operation === 'create_project') {
      const project = decodeRequestBody(ProjectCreation, raw)
      if (!project) {
        return jsonResponse({ error: 'Invalid Project' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createProject, {
        userId: body.userId,
        goalId: requestDocumentId<'goals'>(project.goalId),
        title: project.title,
        recurrence: project.recurrence,
      })
    } else if (body.operation === 'create_task') {
      const task = decodeRequestBody(TaskCreation, raw)
      if (!task) {
        return jsonResponse({ error: 'Invalid Task' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createTask, {
        userId: body.userId,
        goalId: requestDocumentId<'goals'>(task.goalId),
        projectId:
          task.projectId === undefined
            ? undefined
            : requestDocumentId<'projects'>(task.projectId),
        title: task.title,
        dueDate: task.dueDate,
        recurrence: task.recurrence,
      })
    } else {
      return jsonResponse({ error: 'Unknown focus operation' }, 400)
    }
    return jsonResponse(result, 200)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Focus request failed'
    return jsonResponse({ error: message }, 400)
  }
})
