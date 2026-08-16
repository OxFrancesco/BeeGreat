import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { httpAction } from '../_generated/server'
import { jsonResponse, readJsonBody, requireBrokerSecret } from './middleware'

type FocusRecurrence = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  firstOccurrenceAt: number
}

function focusRecurrence(value: unknown): FocusRecurrence | undefined | null {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    (record.frequency !== 'daily' &&
      record.frequency !== 'weekly' &&
      record.frequency !== 'monthly' &&
      record.frequency !== 'yearly') ||
    typeof record.interval !== 'number' ||
    typeof record.firstOccurrenceAt !== 'number'
  ) {
    return null
  }
  return {
    frequency: record.frequency,
    interval: record.interval,
    firstOccurrenceAt: record.firstOccurrenceAt,
  }
}

export const focus = httpAction(async (ctx, request) => {
  const authError = requireBrokerSecret(request)
  if (authError) return authError
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (
    !body ||
    typeof body.userId !== 'string' ||
    !/^user_[A-Za-z0-9]+$/.test(body.userId) ||
    typeof body.operation !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid focus request' }, 400)
  }

  try {
    let result: unknown
    const channelOwnerKey =
      typeof body.ownerKey === 'string' &&
      body.ownerKey.endsWith(`|${body.userId}`)
        ? body.ownerKey
        : undefined
    if (body.operation.startsWith('channel_') && !channelOwnerKey) {
      return jsonResponse({ error: 'Invalid channel identity' }, 400)
    }
    if (body.operation === 'channel_context') {
      if (
        body.source !== 'imessage' ||
        typeof body.sourceAddress !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid channel source' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.getContext, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        source: body.source,
        sourceAddress: body.sourceAddress,
      })
    } else if (body.operation === 'channel_create_thread') {
      if (
        body.source !== 'imessage' ||
        typeof body.sourceAddress !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid channel source' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.createThread, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        source: body.source,
        sourceAddress: body.sourceAddress,
      })
    } else if (body.operation === 'channel_sync_transcript') {
      if (
        typeof body.threadId !== 'number' ||
        !Array.isArray(body.messages)
      ) {
        return jsonResponse({ error: 'Invalid transcript sync' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.syncTranscript, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        threadId: body.threadId,
        messages: body.messages as Array<{
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
      if (
        typeof body.threadId !== 'number' ||
        typeof body.title !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid conversation title' }, 400)
      }
      result = await ctx.runMutation(internal.channelActions.titleThread, {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        threadId: body.threadId,
        title: body.title,
      })
    } else if (body.operation === 'channel_confirm_first_focus') {
      if (
        typeof body.requestId !== 'string' ||
        typeof body.goalTitle !== 'string' ||
        typeof body.projectTitle !== 'string' ||
        typeof body.taskTitle !== 'string' ||
        (body.highlightExpiresAt !== undefined &&
          typeof body.highlightExpiresAt !== 'number')
      ) {
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
          requestId: body.requestId,
          goalTitle: body.goalTitle,
          projectTitle: body.projectTitle,
          taskTitle: body.taskTitle,
          highlightExpiresAt: body.highlightExpiresAt as number | undefined,
        },
      )
    } else if (body.operation === 'channel_cancel_first_focus') {
      if (
        typeof body.requestId !== 'string' ||
        typeof body.goalTitle !== 'string' ||
        typeof body.projectTitle !== 'string' ||
        typeof body.taskTitle !== 'string'
      ) {
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
          requestId: body.requestId,
          goalTitle: body.goalTitle,
          projectTitle: body.projectTitle,
          taskTitle: body.taskTitle,
        },
      )
    } else if (body.operation === 'channel_complete_highlight') {
      if (
        typeof body.requestId !== 'string' ||
        typeof body.taskId !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid Highlight completion' }, 400)
      }
      result = await ctx.runMutation(
        internal.channelActions.completeHighlight,
        {
          userId: body.userId,
          ownerKey: channelOwnerKey!,
          requestId: body.requestId,
          taskId: body.taskId as Id<'tasks'>,
        },
      )
    } else if (body.operation === 'channel_get_web3_action') {
      if (typeof body.actionId !== 'string') {
        return jsonResponse({ error: 'Invalid Web3 action' }, 400)
      }
      result = await ctx.runQuery(internal.web3Actions.getForUser, {
        userId: body.userId,
        actionId: body.actionId as Id<'web3Actions'>,
      })
    } else if (
      body.operation === 'channel_confirm_web3' ||
      body.operation === 'channel_cancel_web3'
    ) {
      if (
        typeof body.actionId !== 'string' ||
        typeof body.summary !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid Web3 action' }, 400)
      }
      const args = {
        userId: body.userId,
        ownerKey: channelOwnerKey!,
        actionId: body.actionId as Id<'web3Actions'>,
        summary: body.summary,
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
      if (body.goalId !== undefined && typeof body.goalId !== 'string') {
        return jsonResponse({ error: 'Invalid Goal id' }, 400)
      }
      if (
        body.status !== undefined &&
        body.status !== 'todo' &&
        body.status !== 'done'
      ) {
        return jsonResponse({ error: 'Invalid Task status' }, 400)
      }
      result = await ctx.runQuery(internal.agentFocus.listTasks, {
        userId: body.userId,
        goalId: body.goalId as Id<'goals'> | undefined,
        status: body.status as 'todo' | 'done' | undefined,
      })
    } else if (body.operation === 'create_goal') {
      if (
        typeof body.title !== 'string' ||
        (body.finalGoal !== undefined && typeof body.finalGoal !== 'string')
      ) {
        return jsonResponse({ error: 'Invalid Goal' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createGoal, {
        userId: body.userId,
        title: body.title,
        finalGoal: body.finalGoal as string | undefined,
      })
    } else if (body.operation === 'create_project') {
      const recurrence = focusRecurrence(body.recurrence)
      if (
        typeof body.goalId !== 'string' ||
        typeof body.title !== 'string' ||
        recurrence === null
      ) {
        return jsonResponse({ error: 'Invalid Project' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createProject, {
        userId: body.userId,
        goalId: body.goalId as Id<'goals'>,
        title: body.title,
        recurrence,
      })
    } else if (body.operation === 'create_task') {
      const recurrence = focusRecurrence(body.recurrence)
      if (
        typeof body.goalId !== 'string' ||
        typeof body.title !== 'string' ||
        (body.projectId !== undefined &&
          typeof body.projectId !== 'string') ||
        (body.dueDate !== undefined && typeof body.dueDate !== 'number') ||
        recurrence === null
      ) {
        return jsonResponse({ error: 'Invalid Task' }, 400)
      }
      result = await ctx.runMutation(internal.agentFocus.createTask, {
        userId: body.userId,
        goalId: body.goalId as Id<'goals'>,
        projectId: body.projectId as Id<'projects'> | undefined,
        title: body.title,
        dueDate: body.dueDate as number | undefined,
        recurrence,
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
