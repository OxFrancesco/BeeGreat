import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { nextOccurrenceAt, createRecurrenceSchedule } from './recurrence'
import { nextAgentJobRunAt } from './agentJobs'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

test('month and leap-year recurrences retain their original calendar day', () => {
  for (const [frequency, first, expected] of [
    ['monthly', '2027-01-31T09:00:00Z', '2027-03-31T09:00:00Z'],
    ['yearly', '2024-02-29T09:00:00Z', '2028-02-29T09:00:00Z'],
  ] as const) {
    const recurrence = { frequency, interval: 1, firstOccurrenceAt: Date.parse(first) }
    let next = recurrence.firstOccurrenceAt
    const count = frequency === 'monthly' ? 2 : 4
    for (let i = 0; i < count; i++) next = nextOccurrenceAt(next, recurrence, 'UTC')
    expect(new Date(next).toISOString()).toBe(new Date(expected).toISOString())
    expect(nextAgentJobRunAt({ ...recurrence, kind: 'calendar', timeZone: 'UTC' }, Date.parse(expected))).toBe(next)
  }
})

test('historical recurrence catch-up is bounded and goal deletion erases schedules', async () => {
  const t = convexTest(schema, modules)
  const userId = 'recurrence_owner'
  const ownerKey = `https://issuer.example.test|${userId}`
  const goalId = await t.run(ctx => ctx.db.insert('goals', { userId, title: 'Goal', status: 'active' }))
  await expect(t.run(ctx => createRecurrenceSchedule(ctx, {
    userId, ownerKey, kind: 'project', goalId, title: 'Ancient', timeZone: 'UTC',
    recurrence: { frequency: 'daily', interval: 1, firstOccurrenceAt: Date.parse('1900-01-01T09:00:00Z') },
  }))).rejects.toThrow('more recent')
  const scheduleId = await t.run(ctx => ctx.db.insert('recurrenceSchedules', {
    userId, ownerKey, kind: 'project', goalId, title: 'Private recurring title',
    frequency: 'monthly', interval: 1, timeZone: 'UTC', firstOccurrenceAt: Date.now(),
    nextRunAt: Date.now() + 60_000, active: true, createdAt: Date.now(),
  }))
  await t.withIdentity({ subject: userId, tokenIdentifier: ownerKey }).mutation(api.goals.remove, { goalId })
  expect(await t.run(ctx => ctx.db.get(scheduleId))).toBeNull()
  await expect(t.mutation(internal.recurrence.materialize, { scheduleId, occurrenceAt: Date.now() + 60_000 })).resolves.toBeNull()
})
