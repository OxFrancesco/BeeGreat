import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { expect, test, vi } from 'vitest'
import type { Id } from './_generated/dataModel'
import { coveredDurationMs, DAY_MS, materializeFatigue } from './economyPolicy'
import schema from './schema'
import { modules } from './test.setup'

const createGoal = makeFunctionReference<
  'mutation',
  { title: string; finalGoal?: string },
  Id<'goals'>
>('goals:create')
const createProject = makeFunctionReference<
  'mutation',
  { goalId: Id<'goals'>; title: string },
  Id<'projects'>
>('projects:create')
const createTask = makeFunctionReference<
  'mutation',
  { projectId: Id<'projects'>; title: string },
  Id<'tasks'>
>('tasks:create')
const toggleTask = makeFunctionReference<
  'mutation',
  { taskId: Id<'tasks'> },
  null
>('tasks:toggle')
const settleNow = makeFunctionReference<
  'mutation',
  Record<string, never>,
  { honeyRemoved: number; honeyBalance: number }
>('economy:settleNow')
const abandonGoal = makeFunctionReference<
  'mutation',
  { requestId: string; goalId: Id<'goals'> },
  { honeyRemoved: number; honeyBalance: number }
>('economy:abandonGoal')
const resurrectGoal = makeFunctionReference<
  'mutation',
  { requestId: string; goalId: Id<'goals'> },
  { honeyRefunded: number; honeyBalance: number; royalJellyBalance: number }
>('economy:resurrectGoal')
const reconcileAchievements = makeFunctionReference<
  'mutation',
  Record<string, never>,
  { unlocked: number; scoreAwarded: number }
>('economy:reconcileAchievements')
const removeGoal = makeFunctionReference<
  'mutation',
  { goalId: Id<'goals'> },
  null
>('goals:remove')

test('continuous fatigue retains fractional Honey×milliseconds', () => {
  const half = materializeFatigue(DAY_MS / 2, 1, 0)
  expect(half).toEqual({ wholeHoney: 0, remainderHoneyMs: DAY_MS / 2 })
  expect(materializeFatigue(DAY_MS / 2, 1, half.remainderHoneyMs)).toEqual({
    wholeHoney: 1,
    remainderHoneyMs: 0,
  })
})

test('protection intervals are clamped and merged without double counting', () => {
  expect(
    coveredDurationMs(100, 500, [
      { from: 0, to: 180 },
      { from: 150, to: 300 },
      { from: 250, to: 350 },
      { from: 450, to: 700 },
    ]),
  ).toBe(300)
})

test('rank-four fatigue settles one Honey per day without debt', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|fatigue-owner'
  const owner = t.withIdentity({
    subject: 'fatigue-owner',
    tokenIdentifier: ownerKey,
  })
  for (let index = 1; index <= 4; index += 1) {
    await owner.mutation(createGoal, { title: `Goal ${index}` })
  }
  await t.run(async (ctx) => {
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    if (!hive) throw new Error('Hive missing')
    await ctx.db.patch('hives', hive._id, {
      honeyBalance: 1,
      fatigueSettledAt: Date.now() - DAY_MS,
    })
  })
  const settled = await owner.mutation(settleNow, {})
  expect(settled).toEqual({ honeyRemoved: 1, honeyBalance: 0 })

  await t.run(async (ctx) => {
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    if (!hive) throw new Error('Hive missing')
    await ctx.db.patch('hives', hive._id, {
      fatigueSettledAt: Date.now() - DAY_MS,
    })
  })
  expect(await owner.mutation(settleNow, {})).toMatchObject({
    honeyRemoved: 0,
    honeyBalance: 0,
  })
})

test('expired Focus Shield protects the portion of its settlement interval', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|shield-window-owner'
  const owner = t.withIdentity({
    subject: 'shield-window-owner',
    tokenIdentifier: ownerKey,
  })
  const goalIds: Id<'goals'>[] = []
  for (let index = 1; index <= 4; index += 1) {
    goalIds.push(await owner.mutation(createGoal, { title: `Goal ${index}` }))
  }
  const from = Date.now() - DAY_MS
  await t.run(async (ctx) => {
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    if (!hive) throw new Error('Hive missing')
    await ctx.db.patch('hives', hive._id, {
      honeyBalance: 10,
      fatigueSettledAt: from,
    })
    await ctx.db.insert('boosterActivations', {
      ownerKey,
      userId: 'shield-window-owner',
      goalId: goalIds[3],
      kind: 'focus-shield',
      activatedAt: from,
      expiresAt: from + DAY_MS / 2,
    })
  })

  expect(await owner.mutation(settleNow, {})).toEqual({
    honeyRemoved: 0,
    honeyBalance: 10,
  })
})

test('only the first eight once-ever Task completions earn rolling rewards', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|reward-cap-owner'
  const owner = t.withIdentity({
    subject: 'reward-cap-owner',
    tokenIdentifier: ownerKey,
  })
  const goalId = await owner.mutation(createGoal, { title: 'Reward cap' })
  const projectId = await owner.mutation(createProject, {
    goalId,
    title: 'Tasks',
  })
  for (let index = 1; index <= 9; index += 1) {
    const taskId = await owner.mutation(createTask, {
      projectId,
      title: `Task ${index}`,
    })
    await owner.mutation(toggleTask, { taskId })
  }
  await t.run(async (ctx) => {
    const events = await ctx.db
      .query('verifiedProgressEvents')
      .withIndex('by_owner_key_and_occurred_at', (q) =>
        q.eq('ownerKey', ownerKey),
      )
      .collect()
    expect(events).toHaveLength(9)
    expect(
      events.filter(
        (event) => event.honeyDelta === 5 && event.scoreDelta === 1,
      ),
    ).toHaveLength(8)
    expect(
      events.filter((event) => event.rewardReason === 'rolling-cap'),
    ).toHaveLength(1)
  })
})

test('reopened Tasks can complete again without a second reward', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|reopened-task-owner'
  const owner = t.withIdentity({
    subject: 'reopened-task-owner',
    tokenIdentifier: ownerKey,
  })
  const goalId = await owner.mutation(createGoal, { title: 'Keep the receipt' })
  const projectId = await owner.mutation(createProject, {
    goalId,
    title: 'One reward',
  })
  const taskId = await owner.mutation(createTask, {
    projectId,
    title: 'Complete me twice',
  })

  await owner.mutation(toggleTask, { taskId })
  await owner.mutation(toggleTask, { taskId })
  await owner.mutation(toggleTask, { taskId })

  await t.run(async (ctx) => {
    const task = await ctx.db.get('tasks', taskId)
    const events = await ctx.db
      .query('verifiedProgressEvents')
      .withIndex('by_owner_key_and_task_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('taskId', taskId),
      )
      .collect()
    expect(task?.status).toBe('done')
    expect(events).toHaveLength(1)
  })
})

test('each abandonment can be resurrected once and restores the same GolieBee', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|resurrection-owner'
  const owner = t.withIdentity({
    subject: 'resurrection-owner',
    tokenIdentifier: ownerKey,
  })
  const goalId = await owner.mutation(createGoal, { title: 'Come back' })
  const projectId = await owner.mutation(createProject, {
    goalId,
    title: 'Proof',
  })
  const taskId = await owner.mutation(createTask, {
    projectId,
    title: 'Earn Honey',
  })
  await owner.mutation(toggleTask, { taskId })
  let beeId: Id<'golieBees'> | null = null
  await t.run(async (ctx) => {
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    const bee = await ctx.db
      .query('golieBees')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .unique()
    if (!hive || !bee) throw new Error('Economy setup missing')
    beeId = bee._id
    await ctx.db.patch('hives', hive._id, { royalJellyBalance: 3 })
  })

  const firstAbandonment = { requestId: 'abandon:1', goalId }
  expect(await owner.mutation(abandonGoal, firstAbandonment)).toEqual({
    honeyRemoved: 5,
    honeyBalance: 0,
  })
  expect(await owner.mutation(abandonGoal, firstAbandonment)).toEqual({
    honeyRemoved: 5,
    honeyBalance: 0,
  })
  const firstResurrection = { requestId: 'resurrect:1', goalId }
  expect(await owner.mutation(resurrectGoal, firstResurrection)).toEqual({
    honeyRefunded: 2,
    honeyBalance: 2,
    royalJellyBalance: 0,
  })
  expect(await owner.mutation(resurrectGoal, firstResurrection)).toEqual({
    honeyRefunded: 2,
    honeyBalance: 2,
    royalJellyBalance: 0,
  })
  await t.run(async (ctx) => {
    const bee = await ctx.db.get('golieBees', beeId!)
    const goal = await ctx.db.get('goals', goalId)
    const hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    expect(bee?.status).toBe('active')
    expect(goal?.status).toBe('active')
    if (!hive) throw new Error('Hive missing after Resurrection')
    await ctx.db.patch('hives', hive._id, { royalJellyBalance: 3 })
  })

  expect(
    await owner.mutation(abandonGoal, {
      requestId: 'abandon:2',
      goalId,
    }),
  ).toEqual({
    honeyRemoved: 2,
    honeyBalance: 0,
  })
  expect(
    await owner.mutation(resurrectGoal, {
      requestId: 'resurrect:2',
      goalId,
    }),
  ).toEqual({
    honeyRefunded: 1,
    honeyBalance: 1,
    royalJellyBalance: 0,
  })
})

test('request ids cannot be reused for a different economy command', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'idempotency-owner',
    tokenIdentifier: 'https://issuer.example.test|idempotency-owner',
  })
  const firstGoalId = await owner.mutation(createGoal, { title: 'First' })
  const secondGoalId = await owner.mutation(createGoal, { title: 'Second' })

  await owner.mutation(abandonGoal, {
    requestId: 'shared-request',
    goalId: firstGoalId,
  })
  await expect(
    owner.mutation(abandonGoal, {
      requestId: 'shared-request',
      goalId: secondGoalId,
    }),
  ).rejects.toThrow('Request id was already used')
})

test('retroactive Achievement backfill continues through every history page', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const ownerKey = 'https://issuer.example.test|backfill-owner'
    const userId = 'backfill-owner'
    const owner = t.withIdentity({ subject: userId, tokenIdentifier: ownerKey })
    const backgroundGoalId = await owner.mutation(createGoal, {
      title: 'Background history',
    })
    const targetGoalId = await owner.mutation(createGoal, {
      title: 'Later history',
    })
    const projectId = await owner.mutation(createProject, {
      goalId: backgroundGoalId,
      title: 'Imported history',
    })
    const occurredAt = Date.now() - DAY_MS

    await t.run(async (ctx) => {
      for (let index = 0; index < 129; index += 1) {
        const goalId = index === 128 ? targetGoalId : backgroundGoalId
        const taskId = await ctx.db.insert('tasks', {
          userId,
          projectId,
          goalId,
          title: `Imported Task ${index}`,
          status: 'done',
          completedAt: occurredAt + index,
        })
        await ctx.db.insert('verifiedProgressEvents', {
          ownerKey,
          userId,
          requestId: `imported:${index}`,
          goalId,
          projectId,
          taskId,
          kind: 'task-completed',
          honeyDelta: 0,
          scoreDelta: 0,
          occurredAt: occurredAt + index,
        })
      }
    })

    await owner.mutation(reconcileAchievements, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      const unlock = await ctx.db
        .query('achievementUnlocks')
        .withIndex('by_owner_key_and_achievement_key', (q) =>
          q
            .eq('ownerKey', ownerKey)
            .eq('achievementKey', `goal:${targetGoalId}:tasks:1`),
        )
        .unique()
      const state = await ctx.db
        .query('achievementBackfillStates')
        .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
        .unique()
      expect(unlock).not.toBeNull()
      expect(state?.completedAt).toBeTypeOf('number')
    })
  } finally {
    vi.useRealTimers()
  }
})

test('retroactive Genius requires seven Goals proven Active at the same time', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const ownerKey = 'https://issuer.example.test|historical-genius-owner'
    const userId = 'historical-genius-owner'
    const owner = t.withIdentity({ subject: userId, tokenIdentifier: ownerKey })
    const goalIds: Id<'goals'>[] = []
    for (let index = 0; index < 7; index += 1) {
      goalIds.push(
        await owner.mutation(createGoal, { title: `Sequential Goal ${index}` }),
      )
    }
    const projectId = await owner.mutation(createProject, {
      goalId: goalIds[0],
      title: 'Sequential history',
    })
    const base = Date.now() - DAY_MS

    await t.run(async (ctx) => {
      for (let index = 0; index < goalIds.length; index += 1) {
        const occurredAt = base + index * 1_000
        const goalId = goalIds[index]
        await ctx.db.patch('goals', goalId, {
          status: 'completed',
          activatedAt: occurredAt - 100,
          completedAt: occurredAt + 100,
          lifecycleUpdatedAt: occurredAt + 100,
        })
        const taskId = await ctx.db.insert('tasks', {
          userId,
          projectId,
          goalId,
          title: `Sequential Task ${index}`,
          status: 'done',
          completedAt: occurredAt,
        })
        await ctx.db.insert('verifiedProgressEvents', {
          ownerKey,
          userId,
          requestId: `sequential:${index}`,
          goalId,
          projectId,
          taskId,
          kind: 'task-completed',
          honeyDelta: 0,
          scoreDelta: 0,
          occurredAt,
        })
      }
    })

    await owner.mutation(reconcileAchievements, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (ctx) => {
      const genius = await ctx.db
        .query('achievementUnlocks')
        .withIndex('by_owner_key_and_achievement_key', (q) =>
          q.eq('ownerKey', ownerKey).eq('achievementKey', 'hive:first-genius'),
        )
        .unique()
      expect(genius).toBeNull()
    })
  } finally {
    vi.useRealTimers()
  }
})

test('privacy deletion anonymizes weekly roster slots without changing progress', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|roster-delete-owner'
  const userId = 'roster-delete-owner'
  const owner = t.withIdentity({ subject: userId, tokenIdentifier: ownerKey })
  const satisfiedGoalId = await owner.mutation(createGoal, {
    title: 'Satisfied Goal',
  })
  const pendingGoalId = await owner.mutation(createGoal, {
    title: 'Pending Goal',
  })
  const now = Date.now()
  const rosterId = await t.run(async (ctx) =>
    ctx.db.insert('weeklyProgressRosters', {
      ownerKey,
      userId,
      startedAt: now,
      endsAt: now + 7 * DAY_MS,
      goalIds: [satisfiedGoalId, pendingGoalId],
      satisfiedGoalIds: [satisfiedGoalId],
      anonymousRequiredCount: 0,
      anonymousSatisfiedCount: 0,
    }),
  )

  await owner.mutation(removeGoal, { goalId: satisfiedGoalId })
  await owner.mutation(removeGoal, { goalId: pendingGoalId })

  await t.run(async (ctx) => {
    const roster = await ctx.db.get('weeklyProgressRosters', rosterId)
    expect(roster).toMatchObject({
      goalIds: [],
      satisfiedGoalIds: [],
      anonymousRequiredCount: 2,
      anonymousSatisfiedCount: 1,
    })
  })
})
