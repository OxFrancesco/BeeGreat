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
      beeImageUrl: project.beeImageUrl ?? null,
      goalId: project.goalId,
      goalTitle: goal?.title ?? null,
    }
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
