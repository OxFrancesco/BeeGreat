import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { settleFatigueForOwner } from './economy'
import {
  countAccessibleActiveGoals,
  getGoalFocusOwner,
} from './focusDeletion'
import { MAX_ACTIVE_GOALS } from './focusConstants'
import { createRecurrenceSchedule } from './recurrence'
import { recurrenceInputValidator } from './recurrenceValidators'

const recurrenceSummaryValidator = v.object({
  frequency: v.union(
    v.literal('daily'),
    v.literal('weekly'),
    v.literal('monthly'),
    v.literal('yearly'),
  ),
  interval: v.number(),
  timeZone: v.string(),
  nextRunAt: v.number(),
})

const projectSummaryValidator = v.object({
  id: v.id('projects'),
  title: v.string(),
  recurrence: v.union(v.null(), recurrenceSummaryValidator),
})

const goalSummaryValidator = v.object({
  id: v.id('goals'),
  title: v.string(),
  finalGoal: v.union(v.null(), v.string()),
  projects: v.array(projectSummaryValidator),
  openTasks: v.number(),
  doneTasks: v.number(),
})

const taskSummaryValidator = v.object({
  id: v.id('tasks'),
  goalId: v.id('goals'),
  projectId: v.union(v.null(), v.id('projects')),
  title: v.string(),
  status: v.union(v.literal('todo'), v.literal('done')),
  dueDate: v.union(v.null(), v.number()),
  recurrence: v.union(v.null(), recurrenceSummaryValidator),
})

type ReadCtx = QueryCtx | MutationCtx

async function serviceHive(ctx: ReadCtx, userId: string) {
  const hive = await ctx.db
    .query('hives')
    .withIndex('by_user_id', (q) => q.eq('userId', userId))
    .unique()
  if (!hive) {
    throw new ConvexError({
      code: 'HIVE_SETUP_REQUIRED',
      message: 'Finish the first-focus setup in BeeGreat before creating more work.',
    })
  }
  return hive
}

async function serviceTimeZone(ctx: ReadCtx, userId: string) {
  const preference = await ctx.db
    .query('userPreferences')
    .withIndex('by_user_id', (q) => q.eq('userId', userId))
    .unique()
  return preference?.timeZone ?? 'UTC'
}

async function requireServiceGoal(
  ctx: ReadCtx,
  userId: string,
  goalId: Id<'goals'>,
) {
  const [goal, hive] = await Promise.all([
    ctx.db.get('goals', goalId),
    serviceHive(ctx, userId),
  ])
  if (!goal || goal.userId !== userId || goal.status !== 'active') {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Active Goal not found' })
  }
  const ownerKey = await getGoalFocusOwner(ctx, goalId)
  if (ownerKey && ownerKey !== hive.ownerKey) {
    throw new ConvexError({ code: 'NOT_FOUND', message: 'Active Goal not found' })
  }
  return { goal, hive }
}

async function recurrenceSummary(
  ctx: ReadCtx,
  scheduleId?: Id<'recurrenceSchedules'>,
) {
  if (!scheduleId) return null
  const schedule = await ctx.db.get('recurrenceSchedules', scheduleId)
  if (!schedule || !schedule.active) return null
  return {
    frequency: schedule.frequency,
    interval: schedule.interval,
    timeZone: schedule.timeZone,
    nextRunAt: schedule.nextRunAt,
  }
}

function validatedTitle(title: string, kind: 'Goal' | 'Project' | 'Task') {
  const trimmed = title.trim()
  if (!trimmed) {
    throw new ConvexError({
      code: 'INVALID_TITLE',
      message: `A ${kind.toLowerCase()} needs a name`,
    })
  }
  return trimmed
}

function validateRecurrence(
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
    firstOccurrenceAt: number
  } | undefined,
) {
  if (!recurrence) return
  if (
    !Number.isFinite(recurrence.firstOccurrenceAt) ||
    !Number.isInteger(recurrence.interval) ||
    recurrence.interval < 1 ||
    recurrence.interval > 365
  ) {
    throw new ConvexError({
      code: 'INVALID_RECURRENCE',
      message: 'Recurrence needs a valid first date and an interval from 1 to 365',
    })
  }
}

export const getContext = internalQuery({
  args: { userId: v.string() },
  returns: v.object({
    timeZone: v.string(),
    currentTime: v.number(),
  }),
  handler: async (ctx, args) => ({
    timeZone: await serviceTimeZone(ctx, args.userId),
    currentTime: Date.now(),
  }),
})

export const getGoals = internalQuery({
  args: { userId: v.string() },
  returns: v.array(goalSummaryValidator),
  handler: async (ctx, args) => {
    const goals = await ctx.db
      .query('goals')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('status', 'active'),
      )
      .take(MAX_ACTIVE_GOALS)
    return await Promise.all(
      goals.map(async (goal) => {
        const [projects, open, done] = await Promise.all([
          ctx.db
            .query('projects')
            .withIndex('by_goal', (q) =>
              q.eq('goalId', goal._id).eq('status', 'active'),
            )
            .take(200),
          ctx.db
            .query('tasks')
            .withIndex('by_goal', (q) =>
              q.eq('goalId', goal._id).eq('status', 'todo'),
            )
            .take(1_000),
          ctx.db
            .query('tasks')
            .withIndex('by_goal', (q) =>
              q.eq('goalId', goal._id).eq('status', 'done'),
            )
            .take(1_000),
        ])
        return {
          id: goal._id,
          title: goal.title,
          finalGoal: goal.finalGoal ?? null,
          projects: await Promise.all(
            projects.map(async (project) => ({
              id: project._id,
              title: project.title,
              recurrence: await recurrenceSummary(
                ctx,
                project.recurrenceScheduleId,
              ),
            })),
          ),
          openTasks: open.length,
          doneTasks: done.length,
        }
      }),
    )
  },
})

export const listTasks = internalQuery({
  args: {
    userId: v.string(),
    goalId: v.optional(v.id('goals')),
    status: v.optional(v.union(v.literal('todo'), v.literal('done'))),
  },
  returns: v.array(taskSummaryValidator),
  handler: async (ctx, args) => {
    const tasks = args.goalId
      ? await ctx.db
          .query('tasks')
          .withIndex('by_goal', (q) =>
            q.eq('goalId', args.goalId!).eq('status', args.status ?? 'todo'),
          )
          .take(1_000)
      : await ctx.db
          .query('tasks')
          .withIndex('by_user', (q) =>
            q.eq('userId', args.userId).eq('status', args.status ?? 'todo'),
          )
          .take(1_000)
    return await Promise.all(
      tasks
        .filter((task) => task.userId === args.userId)
        .map(async (task) => ({
          id: task._id,
          goalId: task.goalId,
          projectId: task.projectId ?? null,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate ?? null,
          recurrence: await recurrenceSummary(ctx, task.recurrenceScheduleId),
        })),
    )
  },
})

export const createGoal = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    finalGoal: v.optional(v.string()),
  },
  returns: v.object({ id: v.id('goals'), title: v.string() }),
  handler: async (ctx, args) => {
    const title = validatedTitle(args.title, 'Goal')
    const hive = await serviceHive(ctx, args.userId)
    const activeGoalCount = await countAccessibleActiveGoals(
      ctx,
      hive.ownerKey,
      args.userId,
    )
    if (activeGoalCount >= MAX_ACTIVE_GOALS) {
      throw new ConvexError({
        code: 'ACTIVE_GOAL_LIMIT',
        message: `A Hive can have at most ${MAX_ACTIVE_GOALS} Active Goals. Complete or park one before adding another.`,
      })
    }
    const now = Date.now()
    await settleFatigueForOwner(
      ctx,
      { ownerKey: hive.ownerKey, userId: args.userId },
      now,
    )
    const goalId = await ctx.db.insert('goals', {
      userId: args.userId,
      title,
      finalGoal: args.finalGoal?.trim() || undefined,
      status: 'active',
      activatedAt: now,
      lifecycleUpdatedAt: now,
    })
    await ctx.db.insert('golieBees', {
      ownerKey: hive.ownerKey,
      userId: args.userId,
      goalId,
      seed: goalId,
      variant: 'mvp-default',
      status: 'active',
    })
    return { id: goalId, title }
  },
})

export const createProject = internalMutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.string(),
    recurrence: v.optional(recurrenceInputValidator),
  },
  returns: v.object({
    id: v.id('projects'),
    title: v.string(),
    goal: v.string(),
    recurring: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const title = validatedTitle(args.title, 'Project')
    validateRecurrence(args.recurrence)
    const { goal, hive } = await requireServiceGoal(
      ctx,
      args.userId,
      args.goalId,
    )
    let recurrenceScheduleId: Id<'recurrenceSchedules'> | undefined
    if (args.recurrence) {
      recurrenceScheduleId = await createRecurrenceSchedule(ctx, {
        ownerKey: hive.ownerKey,
        userId: args.userId,
        kind: 'project',
        goalId: goal._id,
        title,
        recurrence: args.recurrence,
        timeZone: await serviceTimeZone(ctx, args.userId),
      })
    }
    const projectId = await ctx.db.insert('projects', {
      userId: args.userId,
      goalId: goal._id,
      title,
      status: 'active',
      recurrenceScheduleId,
      recurrenceOccurrenceAt: args.recurrence?.firstOccurrenceAt,
    })
    return {
      id: projectId,
      title,
      goal: goal.title,
      recurring: Boolean(recurrenceScheduleId),
    }
  },
})

async function resolveProject(
  ctx: MutationCtx,
  args: {
    userId: string
    goal: Doc<'goals'>
    projectId?: Id<'projects'>
  },
) {
  if (args.projectId) {
    const project = await ctx.db.get('projects', args.projectId)
    if (
      !project ||
      project.userId !== args.userId ||
      project.goalId !== args.goal._id ||
      project.status !== 'active'
    ) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Active Project not found under this Goal',
      })
    }
    return project
  }
  const projects = await ctx.db
    .query('projects')
    .withIndex('by_goal', (q) =>
      q.eq('goalId', args.goal._id).eq('status', 'active'),
    )
    .take(200)
  const general = projects.find((project) => project.title === 'General')
  if (general) return general
  const projectId = await ctx.db.insert('projects', {
    userId: args.userId,
    goalId: args.goal._id,
    title: 'General',
    status: 'active',
  })
  const created = await ctx.db.get('projects', projectId)
  if (!created) throw new Error('Failed to create General project')
  return created
}

export const createTask = internalMutation({
  args: {
    userId: v.string(),
    goalId: v.id('goals'),
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    dueDate: v.optional(v.number()),
    recurrence: v.optional(recurrenceInputValidator),
  },
  returns: v.object({
    id: v.id('tasks'),
    title: v.string(),
    goal: v.string(),
    project: v.string(),
    recurring: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const title = validatedTitle(args.title, 'Task')
    validateRecurrence(args.recurrence)
    const { goal, hive } = await requireServiceGoal(
      ctx,
      args.userId,
      args.goalId,
    )
    const project = await resolveProject(ctx, {
      userId: args.userId,
      goal,
      projectId: args.projectId,
    })
    let recurrenceScheduleId: Id<'recurrenceSchedules'> | undefined
    if (args.recurrence) {
      recurrenceScheduleId = await createRecurrenceSchedule(ctx, {
        ownerKey: hive.ownerKey,
        userId: args.userId,
        kind: 'task',
        goalId: goal._id,
        projectId: project._id,
        title,
        recurrence: args.recurrence,
        timeZone: await serviceTimeZone(ctx, args.userId),
      })
    }
    const taskId = await ctx.db.insert('tasks', {
      userId: args.userId,
      goalId: goal._id,
      projectId: project._id,
      title,
      status: 'todo',
      dueDate: args.recurrence?.firstOccurrenceAt ?? args.dueDate,
      recurrenceScheduleId,
      recurrenceOccurrenceAt: args.recurrence?.firstOccurrenceAt,
    })
    return {
      id: taskId,
      title,
      goal: goal.title,
      project: project.title,
      recurring: Boolean(recurrenceScheduleId),
    }
  },
})
