import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { getUserId, requireUserId } from './helpers'

export const MAX_ACTIVE_GOALS = 3

async function projectSummary(ctx: QueryCtx, project: Doc<'projects'>) {
  const tasks = await ctx.db
    .query('tasks')
    .withIndex('by_project', (q) => q.eq('projectId', project._id))
    .collect()
  const done = tasks.filter((task) => task.status === 'done').length
  return {
    id: project._id,
    title: project.title,
    status: project.status,
    beeImageUrl: project.beeImageUrl ?? null,
    doneTasks: done,
    totalTasks: tasks.length,
  }
}

/** Active goals with progress, for the Goals page slots. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx)
    if (!userId) return []
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
          projectCount: projects.length,
          openTasks: open.length,
          doneTasks: done.length,
        }
      }),
    )
  },
})

/** One goal with its projects and their progress, for the goal detail page. */
export const get = query({
  args: { goalId: v.id('goals') },
  handler: async (ctx, { goalId }) => {
    const userId = await getUserId(ctx)
    const goal = await ctx.db.get(goalId)
    if (!userId || !goal || goal.userId !== userId) {
      return null
    }
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_goal', (q) => q.eq('goalId', goal._id).eq('status', 'active'))
      .collect()
    return {
      id: goal._id,
      title: goal.title,
      finalGoal: goal.finalGoal ?? null,
      status: goal.status,
      projects: await Promise.all(projects.map((project) => projectSummary(ctx, project))),
    }
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    finalGoal: v.optional(v.string()),
  },
  handler: async (ctx, { title, finalGoal }) => {
    const userId = await requireUserId(ctx)
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A goal needs a name')
    }
    const active = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('status', 'active'))
      .collect()
    if (active.length >= MAX_ACTIVE_GOALS) {
      throw new Error(
        `All ${MAX_ACTIVE_GOALS} combs are full. Complete or archive a goal to free one up.`,
      )
    }
    return await ctx.db.insert('goals', { userId, title: trimmed, finalGoal, status: 'active' })
  },
})
