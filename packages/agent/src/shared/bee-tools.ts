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
        'List the user\u2019s active goals (three is healthy; seven is the hard maximum) with their projects, open/done task counts, and their final goal, if set.',
      async run() {
        return await convex.query(api.agent.getGoals, { userId })
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
        return await convex.query(api.agent.listTasks, { userId, ...input })
      },
    }),

  ]
}
