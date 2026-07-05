import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Agent-facing surface, called by the Flue worker (packages/agent).
// The worker passes the agent instance id as userId. Once Clerk is wired
// into the worker these become authenticated via ctx.auth instead of args.

const MAX_ACTIVE_GOALS = 3

export const getGoals = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('status', 'active'))
      .collect()
    return Promise.all(
      goals.map(async (goal) => {
        const open = await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) => q.eq('goalId', goal._id).eq('status', 'todo'))
          .collect()
        const done = await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) => q.eq('goalId', goal._id).eq('status', 'done'))
          .collect()
        return {
          id: goal._id,
          title: goal.title,
          finalGoal: goal.finalGoal ?? null,
          openTasks: open.length,
          doneTasks: done.length,
        }
      }),
    )
  },
})

export const createGoal = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    finalGoal: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, finalGoal }) => {
    const active = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('status', 'active'))
      .collect()
    if (active.length >= MAX_ACTIVE_GOALS) {
      throw new Error(
        `You already have ${MAX_ACTIVE_GOALS} active goals. Archive one before adding another.`,
      )
    }
    const id = await ctx.db.insert('goals', { userId, title, finalGoal, status: 'active' })
    return { id, title }
  },
})

export const listTasks = query({
  args: {
    userId: v.string(),
    goalId: v.optional(v.id('goals')),
    status: v.optional(v.union(v.literal('todo'), v.literal('done'))),
  },
  handler: async (ctx, { userId, goalId, status }) => {
    const tasks = goalId
      ? await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) => q.eq('goalId', goalId).eq('status', status ?? 'todo'))
          .collect()
      : await ctx.db
          .query('tasks')
          .withIndex('by_user', (q) => q.eq('userId', userId).eq('status', status ?? 'todo'))
          .collect()
    return tasks
      .filter((task) => task.userId === userId)
      .map((task) => ({
        id: task._id,
        goalId: task.goalId,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate ?? null,
      }))
  },
})

export const createTask = mutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.string(),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, { userId, goalId, title, dueDate }) => {
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    const id = await ctx.db.insert('tasks', { userId, goalId, title, status: 'todo', dueDate })
    return { id, title, goal: goal.title }
  },
})

export const completeTask = mutation({
  args: {
    userId: v.string(),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, { userId, taskId }) => {
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    await ctx.db.patch(taskId, { status: 'done', completedAt: Date.now() })
    return { id: taskId, title: task.title, status: 'done' }
  },
})
