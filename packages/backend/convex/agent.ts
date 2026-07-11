import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  countAccessibleActiveGoals,
  deleteGoalFocusState,
  deleteProjectFocusState,
  deleteTaskFocusState,
  getGoalFocusOwner,
} from './focusDeletion'
import { MAX_ACTIVE_GOALS } from './focusConstants'
import { completeTaskWithEconomy, settleFatigueForOwner } from './economy'

// Agent-facing surface, called by the Flue worker (packages/agent). Legacy-only
// operations still use userId; any path touching the new Hive world also
// requires a matching Clerk identity so userId never becomes authorization.

async function requireMatchingClerkIdentity(ctx: MutationCtx, userId: string) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required for Hive changes',
    })
  }
  if (identity.subject !== userId) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Authenticated user does not match the requested user',
    })
  }
  return identity
}

async function requireFocusOwnerIfPresent(
  ctx: MutationCtx,
  userId: string,
  goalId: Parameters<typeof getGoalFocusOwner>[1],
  notFoundMessage: string,
) {
  const focusOwner = await getGoalFocusOwner(ctx, goalId)
  if (!focusOwner) return null
  const identity = await requireMatchingClerkIdentity(ctx, userId)
  if (identity.tokenIdentifier !== focusOwner) {
    throw new ConvexError({ code: 'NOT_FOUND', message: notFoundMessage })
  }
  return focusOwner
}

async function canReadFocusGoal(
  ctx: QueryCtx,
  userId: string,
  goalId: Parameters<typeof getGoalFocusOwner>[1],
) {
  const focusOwner = await getGoalFocusOwner(ctx, goalId)
  if (!focusOwner) return true
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject === userId && identity.tokenIdentifier === focusOwner
}

export const getGoals = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) =>
        q.eq('userId', userId).eq('status', 'active'),
      )
      .collect()
    const visibleGoals = []
    for (const goal of goals) {
      if (await canReadFocusGoal(ctx, userId, goal._id)) visibleGoals.push(goal)
    }
    return Promise.all(
      visibleGoals.map(async (goal) => {
        const projects = await ctx.db
          .query('projects')
          .withIndex('by_goal', (q) =>
            q.eq('goalId', goal._id).eq('status', 'active'),
          )
          .collect()
        const open = await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) =>
            q.eq('goalId', goal._id).eq('status', 'todo'),
          )
          .collect()
        const done = await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) =>
            q.eq('goalId', goal._id).eq('status', 'done'),
          )
          .collect()
        return {
          id: goal._id,
          title: goal.title,
          finalGoal: goal.finalGoal ?? null,
          projects: projects.map((project) => ({
            id: project._id,
            title: project.title,
          })),
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
    const identity = await requireMatchingClerkIdentity(ctx, userId)
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) =>
        q.eq('ownerKey', identity.tokenIdentifier),
      )
      .unique()
    if (!hive) {
      throw new Error(
        'Hive setup is required before the agent can create a Goal',
      )
    }
    const activeGoalCount = await countAccessibleActiveGoals(
      ctx,
      identity.tokenIdentifier,
      userId,
    )
    if (activeGoalCount >= MAX_ACTIVE_GOALS) {
      throw new Error(
        `A Hive can have at most ${MAX_ACTIVE_GOALS} Active Goals. Complete or archive one before adding another.`,
      )
    }
    const now = Date.now()
    await settleFatigueForOwner(
      ctx,
      { ownerKey: identity.tokenIdentifier, userId },
      now,
    )
    const id = await ctx.db.insert('goals', {
      userId,
      title,
      finalGoal,
      status: 'active',
      activatedAt: now,
      lifecycleUpdatedAt: now,
    })
    await ctx.db.insert('golieBees', {
      ownerKey: identity.tokenIdentifier,
      userId,
      goalId: id,
      seed: id,
      variant: 'mvp-default',
      status: 'active',
    })
    return { id, title }
  },
})

export const updateGoal = mutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.optional(v.string()),
    finalGoal: v.optional(v.string()),
  },
  handler: async (ctx, { userId, goalId, title, finalGoal }) => {
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    await requireFocusOwnerIfPresent(ctx, userId, goalId, 'Goal not found')
    const patch: { title?: string; finalGoal?: string } = {}
    if (title?.trim()) patch.title = title.trim()
    if (finalGoal !== undefined) patch.finalGoal = finalGoal
    await ctx.db.patch(goalId, patch)
    return { id: goalId, title: patch.title ?? goal.title }
  },
})

/** Deletes a goal and everything in it (projects and tasks). */
export const deleteGoal = mutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
  },
  handler: async (ctx, { userId, goalId }) => {
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    const focusOwner = await requireFocusOwnerIfPresent(
      ctx,
      userId,
      goalId,
      'Goal not found',
    )
    if (focusOwner) {
      await settleFatigueForOwner(ctx, { ownerKey: focusOwner, userId })
    }
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_goal', (q) => q.eq('goalId', goalId))
      .collect()
    for (const task of tasks) {
      await ctx.db.delete(task._id)
    }
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_goal', (q) => q.eq('goalId', goalId))
      .collect()
    for (const project of projects) {
      await ctx.db.delete(project._id)
    }
    if (focusOwner) {
      await deleteGoalFocusState(ctx, focusOwner, goalId)
    }
    await ctx.db.delete(goalId)
    return { id: goalId, title: goal.title, deleted: true }
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
    await requireFocusOwnerIfPresent(ctx, userId, goalId, 'Goal not found')
    const id = await ctx.db.insert('projects', {
      userId,
      goalId,
      title,
      status: 'active',
    })
    return { id, title, goal: goal.title }
  },
})

export const updateProject = mutation({
  args: {
    userId: v.string(),
    projectId: v.id('projects'),
    title: v.string(),
  },
  handler: async (ctx, { userId, projectId, title }) => {
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found')
    }
    await requireFocusOwnerIfPresent(
      ctx,
      userId,
      project.goalId,
      'Project not found',
    )
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A project needs a name')
    }
    await ctx.db.patch(projectId, { title: trimmed })
    return { id: projectId, title: trimmed }
  },
})

/** Deletes a project together with all of its tasks. */
export const deleteProject = mutation({
  args: {
    userId: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, { userId, projectId }) => {
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found')
    }
    const focusOwner = await requireFocusOwnerIfPresent(
      ctx,
      userId,
      project.goalId,
      'Project not found',
    )
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    for (const task of tasks) {
      await ctx.db.delete(task._id)
    }
    if (focusOwner) {
      await deleteProjectFocusState(ctx, focusOwner, projectId)
    }
    await ctx.db.delete(projectId)
    return { id: projectId, title: project.title, deleted: true }
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
          .withIndex('by_goal', (q) =>
            q.eq('goalId', goalId).eq('status', status ?? 'todo'),
          )
          .collect()
      : await ctx.db
          .query('tasks')
          .withIndex('by_user', (q) =>
            q.eq('userId', userId).eq('status', status ?? 'todo'),
          )
          .collect()
    const visibleTasks = []
    for (const task of tasks) {
      if (
        task.userId === userId &&
        (await canReadFocusGoal(ctx, userId, task.goalId))
      ) {
        visibleTasks.push(task)
      }
    }
    return visibleTasks.map((task) => ({
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
    await requireFocusOwnerIfPresent(ctx, userId, goalId, 'Goal not found')

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
        .withIndex('by_goal', (q) =>
          q.eq('goalId', goalId).eq('status', 'active'),
        )
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
    const focusOwner = await requireFocusOwnerIfPresent(
      ctx,
      userId,
      task.goalId,
      'Task not found',
    )
    const highlight = await ctx.db
      .query('highlights')
      .withIndex('by_task_id', (q) => q.eq('taskId', taskId))
      .unique()
    if (
      highlight &&
      highlight.userId === userId &&
      highlight.status === 'active' &&
      highlight.expiresAt > Date.now()
    ) {
      const identity = await requireMatchingClerkIdentity(ctx, userId)
      if (highlight.ownerKey !== identity.tokenIdentifier) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'Highlighted Task belongs to another authenticated user',
        })
      }
      throw new Error(
        'Active Highlights must be completed through an authenticated client',
      )
    }
    if (focusOwner) {
      await completeTaskWithEconomy(
        ctx,
        { ownerKey: focusOwner, userId },
        {
          requestId: `agent-task-completion:${taskId}`,
          task,
          projectId: task.projectId,
        },
      )
    } else {
      await ctx.db.patch(taskId, { status: 'done', completedAt: Date.now() })
    }
    return { id: taskId, title: task.title, status: 'done' }
  },
})

export const updateTask = mutation({
  args: {
    userId: v.string(),
    taskId: v.id('tasks'),
    title: v.optional(v.string()),
    // null clears the due date; a number sets it.
    dueDate: v.optional(v.union(v.null(), v.number())),
  },
  handler: async (ctx, { userId, taskId, title, dueDate }) => {
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    await requireFocusOwnerIfPresent(ctx, userId, task.goalId, 'Task not found')
    const patch: { title?: string; dueDate?: number | undefined } = {}
    if (title?.trim()) patch.title = title.trim()
    if (dueDate !== undefined) patch.dueDate = dueDate ?? undefined
    await ctx.db.patch(taskId, patch)
    return { id: taskId, title: patch.title ?? task.title }
  },
})

/** Deletes a task and any of its subtasks. */
export const deleteTask = mutation({
  args: {
    userId: v.string(),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, { userId, taskId }) => {
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    const focusOwner = await requireFocusOwnerIfPresent(
      ctx,
      userId,
      task.goalId,
      'Task not found',
    )
    const taskIds = [taskId]
    if (!task.parentTaskId && task.projectId) {
      const siblings = await ctx.db
        .query('tasks')
        .withIndex('by_project', (q) => q.eq('projectId', task.projectId))
        .collect()
      for (const subtask of siblings.filter((t) => t.parentTaskId === taskId)) {
        taskIds.push(subtask._id)
        await ctx.db.delete(subtask._id)
      }
    }
    if (focusOwner) {
      await deleteTaskFocusState(ctx, focusOwner, taskIds)
    }
    await ctx.db.delete(taskId)
    return { id: taskId, title: task.title, deleted: true }
  },
})
