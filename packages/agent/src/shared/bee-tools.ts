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
        'List the user\u2019s active goals (max 3) with their projects, open/done task counts, and their final goal, if set.',
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
      name: 'update_goal',
      description:
        'Rename a goal or update its final-goal description.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        title: v.optional(v.pipe(v.string(), v.description('New goal title'))),
        finalGoal: v.optional(
          v.pipe(v.string(), v.description('New description of the deeper outcome behind this goal')),
        ),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.updateGoal, { userId, ...input })
      },
    }),

    defineTool({
      name: 'delete_goal',
      description:
        'PERMANENTLY delete a goal with ALL of its projects and tasks. Destructive and irreversible: only call after the user has explicitly confirmed the deletion in this conversation.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.deleteGoal, { userId, ...input })
      },
    }),

    defineTool({
      name: 'create_project',
      description:
        'Create a project under one of the user\u2019s goals. Projects group related tasks (goal \u2192 project \u2192 task).',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        title: v.pipe(v.string(), v.description('Short project title, e.g. "Training plan"')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.createProject, { userId, ...input })
      },
    }),

    defineTool({
      name: 'update_project',
      description: 'Rename a project.',
      input: v.object({
        projectId: v.pipe(v.string(), v.description('Project id from get_goals')),
        title: v.pipe(v.string(), v.description('New project title')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.updateProject, { userId, ...input })
      },
    }),

    defineTool({
      name: 'delete_project',
      description:
        'PERMANENTLY delete a project with ALL of its tasks. Destructive and irreversible: only call after the user has explicitly confirmed the deletion in this conversation.',
      input: v.object({
        projectId: v.pipe(v.string(), v.description('Project id from get_goals')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.deleteProject, { userId, ...input })
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
      description:
        'Create a task under one of the user\u2019s goals. Pass projectId when the user names a project; otherwise the task is filed in that goal\u2019s "General" project.',
      input: v.object({
        goalId: v.pipe(v.string(), v.description('Goal id from get_goals')),
        projectId: v.optional(
          v.pipe(v.string(), v.description('Project id from get_goals, when the user names one')),
        ),
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

    defineTool({
      name: 'update_task',
      description: 'Rename a task or change its due date.',
      input: v.object({
        taskId: v.pipe(v.string(), v.description('Task id from list_tasks')),
        title: v.optional(v.pipe(v.string(), v.description('New task title'))),
        dueDate: v.optional(
          v.pipe(
            v.union([v.number(), v.null_()]),
            v.description('New due date as a Unix timestamp in milliseconds, or null to remove it'),
          ),
        ),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.updateTask, { userId, ...input })
      },
    }),

    defineTool({
      name: 'delete_task',
      description:
        'PERMANENTLY delete a task (and its subtasks). Destructive and irreversible: only call after the user has explicitly confirmed the deletion in this conversation.',
      input: v.object({
        taskId: v.pipe(v.string(), v.description('Task id from list_tasks')),
      }),
      async run({ input }) {
        return await convex.mutation(api.agent.deleteTask, { userId, ...input })
      },
    }),
  ]
}
