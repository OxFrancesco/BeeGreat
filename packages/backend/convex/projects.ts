import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  canAccessGoalFocusLineage,
  deleteProjectFocusState,
  requireGoalFocusOwner,
} from './focusDeletion'

/** One project with its parent goal, for the project page header. */
export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity()
    const project = await ctx.db.get(projectId)
    if (
      !identity ||
      !project ||
      project.userId !== identity.subject ||
      !(await canAccessGoalFocusLineage(ctx, identity.tokenIdentifier, project.goalId))
    ) {
      return null
    }
    const goal = await ctx.db.get(project.goalId)
    return {
      id: project._id,
      title: project.title,
      status: project.status,
      due: project.due ?? null,
      beeImageUrl: project.beeImageUrl ?? null,
      goalId: project.goalId,
      goalTitle: goal?.title ?? null,
    }
  },
})

/** Sets or clears a project's coarse target date (a quarter or a year). */
export const setDue = mutation({
  args: {
    projectId: v.id('projects'),
    due: v.union(
      v.null(),
      v.object({
        year: v.number(),
        quarter: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { projectId, due }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== identity.subject) {
      throw new Error('Project not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, project.goalId, 'Project not found')
    if (due && due.quarter !== undefined && (due.quarter < 1 || due.quarter > 4)) {
      throw new Error('Quarter must be between 1 and 4')
    }
    await ctx.db.patch(projectId, { due: due ?? undefined })
  },
})

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    title: v.string(),
  },
  handler: async (ctx, { projectId, title }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== identity.subject) {
      throw new Error('Project not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, project.goalId, 'Project not found')
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A project needs a name')
    }
    await ctx.db.patch(projectId, { title: trimmed })
  },
})

/** Deletes a project together with all of its tasks. */
export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, project.goalId, 'Project not found')
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    for (const task of tasks) {
      await ctx.db.delete(task._id)
    }
    await deleteProjectFocusState(ctx, identity.tokenIdentifier, projectId)
    await ctx.db.delete(projectId)
  },
})

export const create = mutation({
  args: {
    goalId: v.id('goals'),
    title: v.string(),
  },
  handler: async (ctx, { goalId, title }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A project needs a name')
    }
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, goalId)
    return await ctx.db.insert('projects', {
      userId,
      goalId,
      title: trimmed,
      status: 'active',
    })
  },
})
