import { defineTool } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import * as v from 'valibot'

// The agent instance id is the user id: tools can only touch that user's data.
export function createBeeTools(userId: string, convexUrl: string) {
  const convex = new ConvexHttpClient(convexUrl)
  const api = anyApi

  return [
    defineTool({
      name: 'get_goals',
      description:
        'List the user\u2019s active goals (max 3) with open/done task counts and their final goal, if set.',
      async run() {
        return await convex.query(api.agent.getGoals, { userId })
      },
    }),

    defineTool({
      name: 'create_goal',
      description:
        'Create a new active goal. Fails when the user already has 3 active goals \u2014 relay that limit to the user.',
      input: v.object({
        title: v.pipe(v.string(), v.description('Short goal title, e.g. "Get healthier"')),
        finalGoal: v.optional(
          v.pipe(v.string(), v.description('The deeper outcome behind this goal, if the user shared it')),
        ),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.createGoal, { userId, ...input })
      },
    }),

    defineTool({
      name: 'list_tasks',
      description: 'List the user\u2019s tasks, optionally filtered by goal id or status.',
      input: v.object({
        goalId: v.optional(v.pipe(v.string(), v.description('Goal id from get_goals'))),
        status: v.optional(v.picklist(['todo', 'done'])),
      }),
      async run({ input }) {
        return await convex.query(api.agent.listTasks, { userId, ...input })
      },
    }),

    defineTool({
      name: 'create_task',
      description: 'Create a task under one of the user\u2019s goals.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        title: v.string(),
        dueDate: v.optional(
          v.pipe(v.number(), v.description('Due date as a Unix timestamp in milliseconds')),
        ),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.createTask, { userId, ...input })
      },
    }),

    defineTool({
      name: 'complete_task',
      description: 'Mark a task as done.',
      input: v.object({
        taskId: v.pipe(v.string(), v.description('Task id from list_tasks')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.completeTask, { userId, ...input })
      },
    }),
  ]
}
