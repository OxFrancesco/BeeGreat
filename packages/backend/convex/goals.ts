import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import {
  canAccessGoalFocusLineage,
  countAccessibleActiveGoals,
  deleteGoalFocusState,
  requireGoalFocusOwner,
} from './focusDeletion'
import { MAX_ACTIVE_GOALS } from './focusConstants'

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject).eq('status', 'active'))
      .collect()
    const visibleGoals: Doc<'goals'>[] = []
    for (const goal of goals) {
      if (await canAccessGoalFocusLineage(ctx, identity.tokenIdentifier, goal._id)) {
        visibleGoals.push(goal)
      }
    }
    return Promise.all(
      visibleGoals.map(async (goal) => {
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
    const identity = await ctx.auth.getUserIdentity()
    const goal = await ctx.db.get(goalId)
    if (
      !identity ||
      !goal ||
      goal.userId !== identity.subject ||
      !(await canAccessGoalFocusLineage(ctx, identity.tokenIdentifier, goalId))
    ) {
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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A goal needs a name')
    }
    const accessibleActiveCount = await countAccessibleActiveGoals(
      ctx,
      identity.tokenIdentifier,
      userId,
    )
    if (accessibleActiveCount >= MAX_ACTIVE_GOALS) {
      throw new Error(
        `A Hive can have at most ${MAX_ACTIVE_GOALS} Active Goals. Complete or archive one before adding another.`,
      )
    }
    let hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.tokenIdentifier))
      .unique()
    if (!hive) {
      const hiveId = await ctx.db.insert('hives', {
        ownerKey: identity.tokenIdentifier,
        userId,
        honeyBalance: 0,
        honeycombScore: 0,
      })
      hive = await ctx.db.get('hives', hiveId)
    }
    if (!hive) throw new Error('Failed to create Hive')

    const goalId = await ctx.db.insert('goals', {
      userId,
      title: trimmed,
      finalGoal,
      status: 'active',
    })
    await ctx.db.insert('golieBees', {
      ownerKey: identity.tokenIdentifier,
      userId,
      goalId,
      seed: goalId,
      variant: 'mvp-default',
      status: 'active',
    })
    return goalId
  },
})

export const update = mutation({
  args: {
    goalId: v.id('goals'),
    title: v.string(),
  },
  handler: async (ctx, { goalId, title }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, goalId)
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('A goal needs a name')
    }
    await ctx.db.patch(goalId, { title: trimmed })
  },
})

/** Deletes a goal with everything in it (projects and tasks). */
export const remove = mutation({
  args: { goalId: v.id('goals') },
  handler: async (ctx, { goalId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const goal = await ctx.db.get(goalId)
    if (!goal || goal.userId !== userId) {
      throw new Error('Goal not found')
    }
    await requireGoalFocusOwner(ctx, identity.tokenIdentifier, goalId)
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
    await deleteGoalFocusState(ctx, identity.tokenIdentifier, goalId)
    await ctx.db.delete(goalId)
  },
})
