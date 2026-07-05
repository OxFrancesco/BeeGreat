import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUserId, requireUserId } from './helpers'

/** All tasks in a project (todo + done), flat; the client builds the tree. */
export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const userId = await getUserId(ctx)
    const project = await ctx.db.get(projectId)
    if (!userId || !project || project.userId !== userId) {
      return []
    }
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    return tasks.map((task) => ({
      id: task._id,
      title: task.title,
      status: task.status,
      parentTaskId: task.parentTaskId ?? null,
      labels: task.labels ?? [],
      dueDate: task.dueDate ?? null,
      completedAt: task.completedAt ?? null,
    }))
  },
})

/**
 * Live status for task ids referenced by agent-generated UI cards. Accepts
 * raw strings (agent output) and silently drops ids that don't resolve to
 * one of the caller's tasks.
 */
export const statuses = query({
  args: { taskIds: v.array(v.string()) },
  handler: async (ctx, { taskIds }) => {
    const userId = await getUserId(ctx)
    if (!userId) return []
    const result: { id: string; status: 'todo' | 'done' }[] = []
    for (const raw of taskIds) {
      const taskId = ctx.db.normalizeId('tasks', raw)
      if (!taskId) continue
      const task = await ctx.db.get(taskId)
      if (task && task.userId === userId) {
        result.push({ id: taskId, status: task.status })
      }
    }
    return result
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    title: v.string(),
    parentTaskId: v.optional(v.id('tasks')),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, title, parentTaskId, dueDate }) => {
    const userId = await requireUserId(ctx)
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A task needs a name')
    }
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found')
    }
    if (parentTaskId) {
      const parent = await ctx.db.get(parentTaskId)
      if (!parent || parent.projectId !== projectId) {
        throw new Error('Parent task not found in this project')
      }
      if (parent.parentTaskId) {
        throw new Error('Subtasks cannot have their own subtasks')
      }
    }
    return await ctx.db.insert('tasks', {
      userId,
      goalId: project.goalId,
      projectId,
      parentTaskId,
      title: trimmed,
      status: 'todo',
      dueDate,
    })
  },
})

export const toggle = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const userId = await requireUserId(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    if (task.status === 'todo') {
      await ctx.db.patch(taskId, { status: 'done', completedAt: Date.now() })
    } else {
      await ctx.db.patch(taskId, { status: 'todo', completedAt: undefined })
    }
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    title: v.string(),
  },
  handler: async (ctx, { taskId, title }) => {
    const userId = await requireUserId(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A task needs a name')
    }
    await ctx.db.patch(taskId, { title: trimmed })
  },
})

/** Sets or clears a task's due date (epoch millis). */
export const setDueDate = mutation({
  args: {
    taskId: v.id('tasks'),
    dueDate: v.union(v.null(), v.number()),
  },
  handler: async (ctx, { taskId, dueDate }) => {
    const userId = await requireUserId(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    await ctx.db.patch(taskId, { dueDate: dueDate ?? undefined })
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const userId = await requireUserId(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== userId) {
      throw new Error('Task not found')
    }
    // Delete subtasks first so none are orphaned.
    if (!task.parentTaskId && task.projectId) {
      const siblings = await ctx.db
        .query('tasks')
        .withIndex('by_project', (q) => q.eq('projectId', task.projectId))
        .collect()
      for (const subtask of siblings.filter((t) => t.parentTaskId === taskId)) {
        await ctx.db.delete(subtask._id)
      }
    }
    await ctx.db.delete(taskId)
  },
})
