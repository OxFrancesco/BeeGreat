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
        const projects = await ctx.db
          .query('projects')
          .withIndex('by_goal', (q) => q.eq('goalId', goal._id).eq('status', 'active'))
          .collect()
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
          projects: projects.map((project) => ({ id: project._id, title: project.title })),
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

export const createProject = mutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.string(),
  },
  handler: async (ctx, { userId, goalId, title }) => {
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    const id = await ctx.db.insert('projects', { userId, goalId, title, status: 'active' })
    return { id, title, goal: goal.title }
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
        projectId: task.projectId ?? null,
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
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, { userId, goalId, projectId, title, dueDate }) => {
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }

    // The app renders tasks inside projects (goal -> project -> task), so a
    // task must always land in one. Fall back to a "General" project when the
    // agent doesn't specify one, creating it on first use.
    let resolvedProjectId = projectId
    if (resolvedProjectId) {
      const project = await ctx.db.get(resolvedProjectId)
      if (!project || project.userId !== userId || project.goalId !== goalId) {
        throw new Error('Project not found under this goal')
      }
    } else {
      const projects = await ctx.db
        .query('projects')
        .withIndex('by_goal', (q) => q.eq('goalId', goalId).eq('status', 'active'))
        .collect()
      const general = projects.find((project) => project.title === 'General')
      resolvedProjectId =
        general?._id ??
        (await ctx.db.insert('projects', {
          userId,
          goalId,
          title: 'General',
          status: 'active',
        }))
    }

    const id = await ctx.db.insert('tasks', {
      userId,
      goalId,
      projectId: resolvedProjectId,
      title,
      status: 'todo',
      dueDate,
    })
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
