import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUserId, requireUserId } from './helpers'

/** One project with its parent goal, for the project page header. */
export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const userId = await getUserId(ctx)
    const project = await ctx.db.get(projectId)
    if (!userId || !project || project.userId !== userId) {
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
    const userId = await requireUserId(ctx)
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found')
    }
    if (due && due.quarter !== undefined && (due.quarter < 1 || due.quarter > 4)) {
      throw new Error('Quarter must be between 1 and 4')
    }
    await ctx.db.patch(projectId, { due: due ?? undefined })
  },
})

export const create = mutation({
  args: {
    goalId: v.id('goals'),
    title: v.string(),
  },
  handler: async (ctx, { goalId, title }) => {
    const userId = await requireUserId(ctx)
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A project needs a name')
    }
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    return await ctx.db.insert('projects', {
      userId,
      goalId,
      title: trimmed,
      status: 'active',
    })
  },
})
