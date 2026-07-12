import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import {
  callFocusService,
  isoTimestamp,
  type FocusServiceOptions,
} from './focus-client.ts'

const recurrenceInput = v.object({
  frequency: v.picklist(['daily', 'weekly', 'monthly', 'yearly']),
  interval: v.optional(
    v.pipe(v.number(), v.description('Repeat every N frequency units; defaults to 1')),
  ),
  firstOccurrenceAt: v.pipe(
    v.string(),
    v.description('ISO-8601 date-time for the first occurrence, including an offset'),
  ),
})

function recurrencePayload(
  recurrence:
    | {
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
        interval?: number
        firstOccurrenceAt: string
      }
    | undefined,
) {
  if (!recurrence) return undefined
  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval ?? 1,
    firstOccurrenceAt: isoTimestamp(
      recurrence.firstOccurrenceAt,
      'First occurrence',
    ),
  }
}

// The agent instance id is the user id; the focus broker scopes every tool to it.
export function createBeeTools(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
) {

  return [
    defineTool({
      name: 'get_goals',
      description:
        'List the user\u2019s active goals (three is healthy; seven is the hard maximum) with their projects, open/done task counts, and their final goal, if set.',
      async run() {
        return await callFocusService(
          userId,
          convexUrl,
          options,
          'get_goals',
        )
      },
    }),

    defineTool({
      name: 'list_tasks',
      description:
        'List the user\u2019s tasks, optionally filtered by goal id or status.',
      input: v.object({
        goalId: v.optional(
          v.pipe(v.string(), v.description('Goal id from get_goals')),
        ),
        status: v.optional(v.picklist(['todo', 'done'])),
      }),
      async run({ input }) {
        return await callFocusService(
          userId,
          convexUrl,
          options,
          'list_tasks',
          input,
        )
      },
    }),

    defineTool({
      name: 'create_goal',
      description:
        'Create one Active Goal for the user. Use only when the user explicitly asks to create or track a Goal.',
      input: v.object({
        title: v.pipe(v.string(), v.description('Concise Goal title')),
        finalGoal: v.optional(
          v.pipe(v.string(), v.description('Clear definition of the intended outcome')),
        ),
      }),
      async run({ input }) {
        return await callFocusService(
          userId,
          convexUrl,
          options,
          'create_goal',
          input,
        )
      },
    }),

    defineTool({
      name: 'create_project',
      description:
        'Create a Project under an existing Goal, optionally recurring on a durable calendar schedule.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        title: v.pipe(v.string(), v.description('Project title')),
        recurrence: v.optional(recurrenceInput),
      }),
      async run({ input }) {
        return await callFocusService(
          userId,
          convexUrl,
          options,
          'create_project',
          {
            ...input,
            recurrence: recurrencePayload(input.recurrence),
          },
        )
      },
    }),

    defineTool({
      name: 'create_task',
      description:
        'Create a Task under a Goal and optional Project, optionally recurring on a durable calendar schedule.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        projectId: v.optional(
          v.pipe(v.string(), v.description('Project id from get_goals; General is used if omitted')),
        ),
        title: v.pipe(v.string(), v.description('Task title')),
        dueAt: v.optional(
          v.pipe(v.string(), v.description('ISO-8601 due date-time including an offset')),
        ),
        recurrence: v.optional(recurrenceInput),
      }),
      async run({ input }) {
        const { dueAt, ...rest } = input
        return await callFocusService(
          userId,
          convexUrl,
          options,
          'create_task',
          {
            ...rest,
            dueDate: dueAt ? isoTimestamp(dueAt, 'Due date') : undefined,
            recurrence: recurrencePayload(input.recurrence),
          },
        )
      },
    }),

  ]
}
