import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import type {
  RecurrenceFrequency,
  RecurrenceInput,
} from './recurrenceValidators'

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(timestamp: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  // SAFETY: the formatter is configured with exactly the numeric
  // year/month/day/hour/minute/second parts, so after dropping literals the
  // entries cover every ZonedParts key with a numeric value.
  return values as ZonedParts
}

function comparableTimestamp(parts: ZonedParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

function timestampForZonedParts(parts: ZonedParts, timeZone: string) {
  const target = comparableTimestamp(parts)
  let candidate = target
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = comparableTimestamp(zonedParts(candidate, timeZone))
    const adjustment = target - actual
    if (adjustment === 0) return candidate
    candidate += adjustment
  }
  return candidate
}

function addCalendarInterval(
  parts: ZonedParts,
  frequency: RecurrenceFrequency,
  interval: number,
): ZonedParts {
  if (frequency === 'monthly' || frequency === 'yearly') {
    const monthOffset =
      frequency === 'monthly'
        ? parts.year * 12 + (parts.month - 1) + interval
        : (parts.year + interval) * 12 + (parts.month - 1)
    const year = Math.floor(monthOffset / 12)
    const monthIndex = monthOffset % 12
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    return {
      ...parts,
      year,
      month: monthIndex + 1,
      day: Math.min(parts.day, lastDay),
    }
  }
  const date = new Date(comparableTimestamp(parts))
  date.setUTCDate(
    date.getUTCDate() + interval * (frequency === 'weekly' ? 7 : 1),
  )
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  }
}

/** Advances a calendar recurrence while preserving its wall-clock timezone. */
export function nextOccurrenceAt(
  occurrenceAt: number,
  recurrence: Pick<RecurrenceInput, 'frequency' | 'interval'>,
  timeZone: string,
) {
  const interval = Math.floor(recurrence.interval)
  if (interval < 1 || interval > 365) {
    throw new Error('Recurrence interval must be between 1 and 365')
  }
  const current = zonedParts(occurrenceAt, timeZone)
  const next = timestampForZonedParts(
    addCalendarInterval(current, recurrence.frequency, interval),
    timeZone,
  )
  if (next <= occurrenceAt) throw new Error('Recurrence did not advance')
  return next
}

export async function createRecurrenceSchedule(
  ctx: MutationCtx,
  args: {
    ownerKey: string
    userId: string
    kind: 'task' | 'project'
    goalId: Id<'goals'>
    projectId?: Id<'projects'>
    title: string
    recurrence: RecurrenceInput
    timeZone: string
  },
) {
  let nextRunAt = nextOccurrenceAt(
    args.recurrence.firstOccurrenceAt,
    args.recurrence,
    args.timeZone,
  )
  const now = Date.now()
  while (nextRunAt <= now) {
    nextRunAt = nextOccurrenceAt(nextRunAt, args.recurrence, args.timeZone)
  }
  const scheduleId = await ctx.db.insert('recurrenceSchedules', {
    ownerKey: args.ownerKey,
    userId: args.userId,
    kind: args.kind,
    goalId: args.goalId,
    projectId: args.projectId,
    title: args.title,
    frequency: args.recurrence.frequency,
    interval: Math.floor(args.recurrence.interval),
    timeZone: args.timeZone,
    firstOccurrenceAt: args.recurrence.firstOccurrenceAt,
    nextRunAt,
    active: true,
    createdAt: now,
  })
  await ctx.scheduler.runAt(nextRunAt, internal.recurrence.materialize, {
    scheduleId,
    occurrenceAt: nextRunAt,
  })
  return scheduleId
}

export const materialize = internalMutation({
  args: {
    scheduleId: v.id('recurrenceSchedules'),
    occurrenceAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get('recurrenceSchedules', args.scheduleId)
    if (
      !schedule ||
      !schedule.active ||
      schedule.nextRunAt !== args.occurrenceAt
    ) {
      return null
    }
    const goal = await ctx.db.get('goals', schedule.goalId)
    if (!goal || goal.userId !== schedule.userId || goal.status !== 'active') {
      await ctx.db.patch('recurrenceSchedules', schedule._id, { active: false })
      return null
    }

    if (schedule.kind === 'task') {
      const project = schedule.projectId
        ? await ctx.db.get('projects', schedule.projectId)
        : null
      if (
        !project ||
        project.userId !== schedule.userId ||
        project.goalId !== schedule.goalId ||
        project.status !== 'active'
      ) {
        await ctx.db.patch('recurrenceSchedules', schedule._id, {
          active: false,
        })
        return null
      }
      const existing = await ctx.db
        .query('tasks')
        .withIndex(
          'by_recurrence_schedule_id_and_recurrence_occurrence_at',
          (q) =>
            q
              .eq('recurrenceScheduleId', schedule._id)
              .eq('recurrenceOccurrenceAt', args.occurrenceAt),
        )
        .unique()
      if (!existing) {
        await ctx.db.insert('tasks', {
          userId: schedule.userId,
          goalId: schedule.goalId,
          projectId: project._id,
          title: schedule.title,
          status: 'todo',
          dueDate: args.occurrenceAt,
          recurrenceScheduleId: schedule._id,
          recurrenceOccurrenceAt: args.occurrenceAt,
        })
      }
    } else {
      const existing = await ctx.db
        .query('projects')
        .withIndex(
          'by_recurrence_schedule_id_and_recurrence_occurrence_at',
          (q) =>
            q
              .eq('recurrenceScheduleId', schedule._id)
              .eq('recurrenceOccurrenceAt', args.occurrenceAt),
        )
        .unique()
      if (!existing) {
        await ctx.db.insert('projects', {
          userId: schedule.userId,
          goalId: schedule.goalId,
          title: schedule.title,
          status: 'active',
          recurrenceScheduleId: schedule._id,
          recurrenceOccurrenceAt: args.occurrenceAt,
        })
      }
    }

    const nextRunAt = nextOccurrenceAt(
      args.occurrenceAt,
      schedule,
      schedule.timeZone,
    )
    await ctx.db.patch('recurrenceSchedules', schedule._id, {
      lastRunAt: args.occurrenceAt,
      nextRunAt,
    })
    await ctx.scheduler.runAt(nextRunAt, internal.recurrence.materialize, {
      scheduleId: schedule._id,
      occurrenceAt: nextRunAt,
    })
    return null
  },
})
