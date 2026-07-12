import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'
import { nextOccurrenceAt } from './recurrence'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-10-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('agent focus creation', () => {
  test('creates an Active Goal and its GolieBee through the trusted service seam', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('hives', {
        ownerKey: 'issuer|user_agent_goal',
        userId: 'user_agent_goal',
        honeyBalance: 0,
        honeycombScore: 0,
      })
    })

    const created = await t.mutation(internal.agentFocus.createGoal, {
      userId: 'user_agent_goal',
      title: '  Ship BeeGreat  ',
      finalGoal: 'Release a stable version',
    })

    expect(created.title).toBe('Ship BeeGreat')
    const stored = await t.run(async (ctx) => ({
      goal: await ctx.db.get('goals', created.id),
      bee: await ctx.db
        .query('golieBees')
        .withIndex('by_goal_id', (q) => q.eq('goalId', created.id))
        .unique(),
    }))
    expect(stored.goal).toMatchObject({ status: 'active', title: 'Ship BeeGreat' })
    expect(stored.bee).toMatchObject({
      ownerKey: 'issuer|user_agent_goal',
      status: 'active',
    })
  })

  test('creates and idempotently materializes a recurring Task', async () => {
    const t = convexTest(schema, modules)
    const seeded = await t.run(async (ctx) => {
      await ctx.db.insert('hives', {
        ownerKey: 'issuer|user_recurring_task',
        userId: 'user_recurring_task',
        honeyBalance: 0,
        honeycombScore: 0,
      })
      await ctx.db.insert('userPreferences', {
        ownerKey: 'issuer|user_recurring_task',
        userId: 'user_recurring_task',
        timeZone: 'Europe/Rome',
        updatedAt: Date.now(),
      })
      const goalId = await ctx.db.insert('goals', {
        userId: 'user_recurring_task',
        title: 'Stay organized',
        status: 'active',
      })
      await ctx.db.insert('golieBees', {
        ownerKey: 'issuer|user_recurring_task',
        userId: 'user_recurring_task',
        goalId,
        seed: goalId,
        variant: 'mvp-default',
        status: 'active',
      })
      const projectId = await ctx.db.insert('projects', {
        userId: 'user_recurring_task',
        goalId,
        title: 'Weekly planning',
        status: 'active',
      })
      return { goalId, projectId }
    })
    const firstOccurrenceAt = Date.parse('2026-10-19T09:00:00+02:00')

    const created = await t.mutation(internal.agentFocus.createTask, {
      userId: 'user_recurring_task',
      goalId: seeded.goalId,
      projectId: seeded.projectId,
      title: 'Plan the week',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        firstOccurrenceAt,
      },
    })
    expect(created.recurring).toBe(true)

    const initial = await t.run(async (ctx) => ctx.db.get('tasks', created.id))
    expect(initial?.dueDate).toBe(firstOccurrenceAt)
    expect(initial?.recurrenceScheduleId).toBeDefined()
    const scheduleId = initial!.recurrenceScheduleId!
    const schedule = await t.run(async (ctx) =>
      ctx.db.get('recurrenceSchedules', scheduleId),
    )
    expect(schedule?.timeZone).toBe('Europe/Rome')

    await t.mutation(internal.recurrence.materialize, {
      scheduleId,
      occurrenceAt: schedule!.nextRunAt,
    })
    await t.mutation(internal.recurrence.materialize, {
      scheduleId,
      occurrenceAt: schedule!.nextRunAt,
    })

    const occurrences = await t.run(async (ctx) =>
      ctx.db
        .query('tasks')
        .withIndex(
          'by_recurrence_schedule_id_and_recurrence_occurrence_at',
          (q) => q.eq('recurrenceScheduleId', scheduleId),
        )
        .collect(),
    )
    expect(occurrences).toHaveLength(2)
    expect(occurrences.map((task) => task.dueDate)).toEqual([
      firstOccurrenceAt,
      schedule!.nextRunAt,
    ])
  })

  test('creates and idempotently materializes a recurring Project', async () => {
    const t = convexTest(schema, modules)
    const goalId = await t.run(async (ctx) => {
      await ctx.db.insert('hives', {
        ownerKey: 'issuer|user_recurring_project',
        userId: 'user_recurring_project',
        honeyBalance: 0,
        honeycombScore: 0,
      })
      const id = await ctx.db.insert('goals', {
        userId: 'user_recurring_project',
        title: 'Run the business',
        status: 'active',
      })
      await ctx.db.insert('golieBees', {
        ownerKey: 'issuer|user_recurring_project',
        userId: 'user_recurring_project',
        goalId: id,
        seed: id,
        variant: 'mvp-default',
        status: 'active',
      })
      return id
    })
    const firstOccurrenceAt = Date.parse('2026-10-05T09:00:00Z')
    const created = await t.mutation(internal.agentFocus.createProject, {
      userId: 'user_recurring_project',
      goalId,
      title: 'Monthly close',
      recurrence: {
        frequency: 'monthly',
        interval: 1,
        firstOccurrenceAt,
      },
    })
    expect(created.recurring).toBe(true)

    const initial = await t.run(async (ctx) =>
      ctx.db.get('projects', created.id),
    )
    const scheduleId = initial!.recurrenceScheduleId!
    const schedule = await t.run(async (ctx) =>
      ctx.db.get('recurrenceSchedules', scheduleId),
    )
    await t.mutation(internal.recurrence.materialize, {
      scheduleId,
      occurrenceAt: schedule!.nextRunAt,
    })
    await t.mutation(internal.recurrence.materialize, {
      scheduleId,
      occurrenceAt: schedule!.nextRunAt,
    })

    const occurrences = await t.run(async (ctx) =>
      ctx.db
        .query('projects')
        .withIndex(
          'by_recurrence_schedule_id_and_recurrence_occurrence_at',
          (q) => q.eq('recurrenceScheduleId', scheduleId),
        )
        .collect(),
    )
    expect(occurrences).toHaveLength(2)
    expect(occurrences.map((project) => project.recurrenceOccurrenceAt)).toEqual([
      firstOccurrenceAt,
      schedule!.nextRunAt,
    ])
  })
})

describe('calendar recurrence', () => {
  test('preserves local wall time across daylight-saving changes', () => {
    const beforeDstEnd = Date.parse('2026-10-19T09:00:00+02:00')
    const afterDstEnd = nextOccurrenceAt(
      beforeDstEnd,
      { frequency: 'weekly', interval: 1 },
      'Europe/Rome',
    )
    expect(new Date(afterDstEnd).toISOString()).toBe('2026-10-26T08:00:00.000Z')
  })

  test('clamps monthly recurrence to the target month', () => {
    const january31 = Date.parse('2026-01-31T09:00:00+01:00')
    const february = nextOccurrenceAt(
      january31,
      { frequency: 'monthly', interval: 1 },
      'Europe/Rome',
    )
    expect(new Date(february).toISOString()).toBe('2026-02-28T08:00:00.000Z')
  })
})
