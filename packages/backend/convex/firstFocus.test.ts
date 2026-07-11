import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { expect, test } from 'vitest'
import type { Id } from './_generated/dataModel'
import schema from './schema'
import { modules } from './test.setup'

type Bundle = {
  goalId: Id<'goals'>
  projectId: Id<'projects'>
  taskId: Id<'tasks'>
  highlightId: Id<'highlights'>
  golieBeeId: Id<'golieBees'>
}

type ConfirmPlanResult =
  { status: 'cancelled'; bundle: null } | { status: 'created' | 'existing'; bundle: Bundle }

const confirmPlan = makeFunctionReference<
  'mutation',
  {
    requestId: string
    confirmed: boolean
    goalTitle: string
    goalOutcome?: string
    projectTitle: string
    taskTitle: string
    highlightExpiresAt: number
  },
  ConfirmPlanResult
>('firstFocus:confirmPlan')

type CurrentHive = {
  hive: { honeyBalance: number; honeycombScore: number }
  activeGoals: Array<{
    goalId: Id<'goals'>
    title: string
    finalGoal: string | null
    golieBee: {
      golieBeeId: Id<'golieBees'>
      seed: string
      variant: 'mvp-default'
      status: 'active'
    }
  }>
  activeHighlight: {
    highlightId: Id<'highlights'>
    goalId: Id<'goals'>
    projectId: Id<'projects'>
    taskId: Id<'tasks'>
    title: string
    expiresAt: number
  } | null
  latestVerifiedProgress: {
    eventId: Id<'verifiedProgressEvents'>
    goalId: Id<'goals'>
    taskId: Id<'tasks'>
    occurredAt: number
    honeyDelta: number
    scoreDelta: number
  } | null
}

type CompleteHighlightResult = {
  status: 'completed' | 'already_completed'
  taskId: Id<'tasks'>
  honeyAwarded: number
  scoreAwarded: number
  honeyBalance: number
  honeycombScore: number
}

const getCurrent = makeFunctionReference<'query', Record<string, never>, CurrentHive>(
  'firstFocus:getCurrent',
)
const completeHighlight = makeFunctionReference<
  'mutation',
  { requestId: string; taskId: Id<'tasks'> },
  CompleteHighlightResult
>('firstFocus:completeHighlight')
const toggleTask = makeFunctionReference<'mutation', { taskId: Id<'tasks'> }, null>('tasks:toggle')
const completeAgentTask = makeFunctionReference<
  'mutation',
  { userId: string; taskId: Id<'tasks'> },
  { id: Id<'tasks'>; title: string; status: 'done' }
>('agent:completeTask')
const removeGoal = makeFunctionReference<
  'mutation',
  { goalId: Id<'goals'> },
  null
>('goals:remove')
const updateGoal = makeFunctionReference<
  'mutation',
  { goalId: Id<'goals'>; title: string },
  null
>('goals:update')
const removeProject = makeFunctionReference<
  'mutation',
  { projectId: Id<'projects'> },
  null
>('projects:remove')
const removeTask = makeFunctionReference<
  'mutation',
  { taskId: Id<'tasks'> },
  null
>('tasks:remove')
const deleteAgentGoal = makeFunctionReference<
  'mutation',
  { userId: string; goalId: Id<'goals'> },
  { id: Id<'goals'>; title: string; deleted: boolean }
>('agent:deleteGoal')
const createAgentGoal = makeFunctionReference<
  'mutation',
  { userId: string; title: string; finalGoal?: string },
  { id: Id<'goals'>; title: string }
>('agent:createGoal')
const deleteAgentProject = makeFunctionReference<
  'mutation',
  { userId: string; projectId: Id<'projects'> },
  { id: Id<'projects'>; title: string; deleted: boolean }
>('agent:deleteProject')
const deleteAgentTask = makeFunctionReference<
  'mutation',
  { userId: string; taskId: Id<'tasks'> },
  { id: Id<'tasks'>; title: string; deleted: boolean }
>('agent:deleteTask')
const getAgentGoals = makeFunctionReference<
  'query',
  { userId: string },
  Array<{ id: Id<'goals'>; title: string }>
>('agent:getGoals')
const listAgentTasks = makeFunctionReference<
  'query',
  { userId: string; goalId?: Id<'goals'>; status?: 'todo' | 'done' },
  Array<{ id: Id<'tasks'>; title: string }>
>('agent:listTasks')
const createAgentProject = makeFunctionReference<
  'mutation',
  { userId: string; goalId: Id<'goals'>; title: string },
  { id: Id<'projects'>; title: string; goal: string }
>('agent:createProject')
const updateAgentProject = makeFunctionReference<
  'mutation',
  { userId: string; projectId: Id<'projects'>; title: string },
  { id: Id<'projects'>; title: string }
>('agent:updateProject')
const createAgentTask = makeFunctionReference<
  'mutation',
  {
    userId: string
    goalId: Id<'goals'>
    projectId?: Id<'projects'>
    title: string
    dueDate?: number
  },
  { id: Id<'tasks'>; title: string; goal: string }
>('agent:createTask')
const updateAgentTask = makeFunctionReference<
  'mutation',
  { userId: string; taskId: Id<'tasks'>; title?: string; dueDate?: number | null },
  { id: Id<'tasks'>; title: string }
>('agent:updateTask')
const listGoals = makeFunctionReference<
  'query',
  Record<string, never>,
  Array<{ id: Id<'goals'>; title: string }>
>('goals:list')
const getGoal = makeFunctionReference<
  'query',
  { goalId: Id<'goals'> },
  { id: Id<'goals'>; title: string } | null
>('goals:get')
const getProject = makeFunctionReference<
  'query',
  { projectId: Id<'projects'> },
  { id: Id<'projects'>; title: string } | null
>('projects:get')
const listTasksByProject = makeFunctionReference<
  'query',
  { projectId: Id<'projects'> },
  Array<{ id: Id<'tasks'>; title: string }>
>('tasks:listByProject')
const getTaskStatuses = makeFunctionReference<
  'query',
  { taskIds: string[] },
  Array<{ id: string; status: 'todo' | 'done' }>
>('tasks:statuses')
const createProject = makeFunctionReference<
  'mutation',
  { goalId: Id<'goals'>; title: string },
  Id<'projects'>
>('projects:create')
const updateProject = makeFunctionReference<
  'mutation',
  { projectId: Id<'projects'>; title: string },
  null
>('projects:update')
const setProjectDue = makeFunctionReference<
  'mutation',
  { projectId: Id<'projects'>; due: null | { year: number; quarter?: number } },
  null
>('projects:setDue')
const createTask = makeFunctionReference<
  'mutation',
  { projectId: Id<'projects'>; title: string; parentTaskId?: Id<'tasks'>; dueDate?: number },
  Id<'tasks'>
>('tasks:create')
const updateTask = makeFunctionReference<
  'mutation',
  { taskId: Id<'tasks'>; title: string },
  null
>('tasks:update')
const setTaskDueDate = makeFunctionReference<
  'mutation',
  { taskId: Id<'tasks'>; dueDate: number | null },
  null
>('tasks:setDueDate')

function plan(
  requestId: string,
  overrides: Partial<{
    confirmed: boolean
    goalTitle: string
    goalOutcome: string
    projectTitle: string
    taskTitle: string
    highlightExpiresAt: number
  }> = {},
) {
  return {
    requestId,
    confirmed: true,
    goalTitle: 'Launch BeeGreat',
    goalOutcome: "A useful beta is in people's hands",
    projectTitle: 'Ship the first-focus loop',
    taskTitle: 'Record the first plan',
    highlightExpiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

test('confirmed first-focus plan creates its complete bundle atomically', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|first-focus-owner',
  })
  const result = await owner.mutation(confirmPlan, plan('first-plan-1'))

  expect(result).toMatchObject({
    status: 'created',
    bundle: {
      goalId: expect.any(String),
      projectId: expect.any(String),
      taskId: expect.any(String),
      highlightId: expect.any(String),
      golieBeeId: expect.any(String),
    },
  })
  expect((await owner.query(getCurrent, {})).activeGoals[0]?.golieBee.seed).toBe('first-plan-1')
})

test('cancellation and invalid confirmation leave the Hive unchanged', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|cancel-owner',
  })

  await expect(t.query(getCurrent, {})).rejects.toThrow('Authentication required')
  expect(await owner.mutation(confirmPlan, plan('cancelled-plan', { confirmed: false }))).toEqual({
    status: 'cancelled',
    bundle: null,
  })
  await expect(
    owner.mutation(confirmPlan, plan('invalid-plan', { taskTitle: '   ' })),
  ).rejects.toThrow('Task title cannot be empty')

  expect(await owner.query(getCurrent, {})).toEqual({
    hive: { honeyBalance: 0, honeycombScore: 0 },
    activeGoals: [],
    activeHighlight: null,
    latestVerifiedProgress: null,
  })
})

test('confirmation retry returns the original bundle without duplicating work', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|retry-owner',
  })

  const created = await owner.mutation(confirmPlan, plan('retry-plan'))
  const retried = await owner.mutation(confirmPlan, plan('retry-plan'))

  expect(created.status).toBe('created')
  expect(retried).toEqual({
    status: 'existing',
    bundle: created.bundle,
  })
  const current = await owner.query(getCurrent, {})
  expect(current.activeGoals).toHaveLength(1)
  expect(current.activeHighlight?.taskId).toBe(created.bundle?.taskId)
})

test('authenticated identities can see and complete only their own Highlight', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'shared-subject',
    tokenIdentifier: 'https://issuer-a.example.test|shared-subject',
  })
  const otherOwner = t.withIdentity({
    subject: 'shared-subject',
    tokenIdentifier: 'https://issuer-b.example.test|shared-subject',
  })
  const created = await owner.mutation(confirmPlan, plan('isolated-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  expect((await otherOwner.query(getCurrent, {})).activeGoals).toEqual([])
  await expect(
    otherOwner.mutation(completeHighlight, {
      requestId: 'foreign-completion',
      taskId: created.bundle.taskId,
    }),
  ).rejects.toThrow('Active Highlight not found')
  await expect(otherOwner.mutation(toggleTask, { taskId: created.bundle.taskId })).rejects.toThrow(
    'Task not found',
  )
  expect((await owner.query(getCurrent, {})).activeHighlight?.taskId).toBe(created.bundle.taskId)
})

test('same Clerk subject from another issuer cannot update or delete a focus-owned Goal', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'shared-focus-subject',
    tokenIdentifier: 'https://issuer-a.example.test|shared-focus-subject',
  })
  const otherIssuer = t.withIdentity({
    subject: 'shared-focus-subject',
    tokenIdentifier: 'https://issuer-b.example.test|shared-focus-subject',
  })
  const created = await owner.mutation(confirmPlan, plan('issuer-owned-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await expect(
    otherIssuer.mutation(updateGoal, {
      goalId: created.bundle.goalId,
      title: 'Stolen title',
    }),
  ).rejects.toThrow('Goal not found')
  await expect(
    otherIssuer.mutation(removeGoal, { goalId: created.bundle.goalId }),
  ).rejects.toThrow('Goal not found')

  expect((await owner.query(getCurrent, {})).activeGoals[0]?.title).toBe('Launch BeeGreat')
  expect((await owner.query(getCurrent, {})).activeHighlight?.taskId).toBe(created.bundle.taskId)
})

test('app reads and descendant mutations isolate focus-owned lineages by Clerk issuer', async () => {
  const t = convexTest(schema, modules)
  const subject = 'shared-app-lineage-subject'
  const owner = t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer-a.example.test|${subject}`,
  })
  const otherIssuer = t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer-b.example.test|${subject}`,
  })
  const created = await owner.mutation(confirmPlan, plan('app-lineage-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  expect(await otherIssuer.query(listGoals, {})).toEqual([])
  expect(await otherIssuer.query(getGoal, { goalId: created.bundle.goalId })).toBeNull()
  expect(await otherIssuer.query(getProject, { projectId: created.bundle.projectId })).toBeNull()
  expect(
    await otherIssuer.query(listTasksByProject, { projectId: created.bundle.projectId }),
  ).toEqual([])
  expect(
    await otherIssuer.query(getTaskStatuses, { taskIds: [created.bundle.taskId] }),
  ).toEqual([])

  await expect(
    otherIssuer.mutation(createProject, {
      goalId: created.bundle.goalId,
      title: 'Foreign project',
    }),
  ).rejects.toThrow('Goal not found')
  await expect(
    otherIssuer.mutation(updateProject, {
      projectId: created.bundle.projectId,
      title: 'Foreign project title',
    }),
  ).rejects.toThrow('Project not found')
  await expect(
    otherIssuer.mutation(setProjectDue, {
      projectId: created.bundle.projectId,
      due: { year: 2027, quarter: 1 },
    }),
  ).rejects.toThrow('Project not found')
  await expect(
    otherIssuer.mutation(removeProject, { projectId: created.bundle.projectId }),
  ).rejects.toThrow('Project not found')
  await expect(
    otherIssuer.mutation(createTask, {
      projectId: created.bundle.projectId,
      title: 'Foreign task',
    }),
  ).rejects.toThrow('Project not found')
  await expect(
    otherIssuer.mutation(toggleTask, { taskId: created.bundle.taskId }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(updateTask, {
      taskId: created.bundle.taskId,
      title: 'Foreign task title',
    }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(setTaskDueDate, {
      taskId: created.bundle.taskId,
      dueDate: Date.now() + 60_000,
    }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(removeTask, { taskId: created.bundle.taskId }),
  ).rejects.toThrow('Task not found')

  expect(await owner.query(listGoals, {})).toHaveLength(1)
  expect(await owner.query(listTasksByProject, { projectId: created.bundle.projectId })).toHaveLength(
    1,
  )
})

test('highlight completion records progress and advances the live Hive once', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|completion-owner',
  })
  const created = await owner.mutation(confirmPlan, plan('completion-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  const completed = await owner.mutation(completeHighlight, {
    requestId: 'completion-1',
    taskId: created.bundle.taskId,
  })
  const retried = await owner.mutation(completeHighlight, {
    requestId: 'completion-1',
    taskId: created.bundle.taskId,
  })
  const secondRequest = await owner.mutation(completeHighlight, {
    requestId: 'completion-2',
    taskId: created.bundle.taskId,
  })

  expect(completed).toEqual({
    status: 'completed',
    taskId: created.bundle.taskId,
    honeyAwarded: 5,
    scoreAwarded: 1,
    honeyBalance: 5,
    honeycombScore: 1,
  })
  expect(retried).toMatchObject({
    status: 'already_completed',
    honeyAwarded: 0,
    scoreAwarded: 0,
    honeyBalance: 5,
    honeycombScore: 1,
  })
  expect(secondRequest).toMatchObject({
    status: 'already_completed',
    honeyAwarded: 0,
    scoreAwarded: 0,
    honeyBalance: 5,
    honeycombScore: 1,
  })

  const current = await owner.query(getCurrent, {})
  expect(current.hive).toEqual({ honeyBalance: 5, honeycombScore: 1 })
  expect(current.activeHighlight).toBeNull()
  expect(current.latestVerifiedProgress).toMatchObject({
    goalId: created.bundle.goalId,
    taskId: created.bundle.taskId,
    honeyDelta: 5,
    scoreDelta: 1,
  })
})

test('authenticated legacy task completion settles an active Highlight', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|toggle-settlement-owner',
  })
  const created = await owner.mutation(confirmPlan, plan('toggle-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await owner.mutation(toggleTask, { taskId: created.bundle.taskId })

  const current = await owner.query(getCurrent, {})
  expect(current.activeHighlight).toBeNull()
  expect(current.hive).toEqual({ honeyBalance: 5, honeycombScore: 1 })
  expect(current.latestVerifiedProgress).toMatchObject({
    taskId: created.bundle.taskId,
    honeyDelta: 5,
    scoreDelta: 1,
  })
})

test('authenticated Goal deletion removes its GolieBee and active Highlight atomically', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|delete-focus-owner',
  })
  const created = await owner.mutation(confirmPlan, plan('delete-focus-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await owner.mutation(removeGoal, { goalId: created.bundle.goalId })

  expect(await owner.query(getCurrent, {})).toMatchObject({
    activeGoals: [],
    activeHighlight: null,
  })
  await t.run(async (ctx) => {
    expect(await ctx.db.get('golieBees', created.bundle!.golieBeeId)).toBeNull()
    expect(await ctx.db.get('highlights', created.bundle!.highlightId)).toBeNull()
  })

  const recreated = await owner.mutation(confirmPlan, plan('delete-focus-plan'))
  expect(recreated.status).toBe('created')
  expect(recreated.bundle).not.toEqual(created.bundle)
  expect((await owner.query(getCurrent, {})).activeGoals).toHaveLength(1)
})

test('authenticated Project deletion removes its Highlight and first-focus receipt atomically', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|delete-project-owner'
  const owner = t.withIdentity({ tokenIdentifier: ownerKey })
  const created = await owner.mutation(confirmPlan, plan('delete-project-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await owner.mutation(removeProject, { projectId: created.bundle.projectId })

  expect(await owner.query(getCurrent, {})).toMatchObject({
    activeGoals: [expect.objectContaining({ goalId: created.bundle.goalId })],
    activeHighlight: null,
  })
  await t.run(async (ctx) => {
    expect(await ctx.db.get('highlights', created.bundle!.highlightId)).toBeNull()
    expect(
      await ctx.db
        .query('firstFocusBundles')
        .withIndex('by_owner_key_and_request_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('requestId', 'delete-project-plan'),
        )
        .unique(),
    ).toBeNull()
  })
})

test('authenticated Task deletion removes its Highlight and first-focus receipt atomically', async () => {
  const t = convexTest(schema, modules)
  const ownerKey = 'https://issuer.example.test|delete-task-owner'
  const owner = t.withIdentity({ tokenIdentifier: ownerKey })
  const created = await owner.mutation(confirmPlan, plan('delete-task-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await owner.mutation(removeTask, { taskId: created.bundle.taskId })

  expect(await owner.query(getCurrent, {})).toMatchObject({
    activeGoals: [expect.objectContaining({ goalId: created.bundle.goalId })],
    activeHighlight: null,
  })
  await t.run(async (ctx) => {
    expect(await ctx.db.get('highlights', created.bundle!.highlightId)).toBeNull()
    expect(
      await ctx.db
        .query('firstFocusBundles')
        .withIndex('by_owner_key_and_request_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('requestId', 'delete-task-plan'),
        )
        .unique(),
    ).toBeNull()
  })
})

test('legacy agent Goal deletion requires the matching Clerk identity for focus-world cleanup', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'agent-delete-owner',
    tokenIdentifier: 'https://issuer.example.test|agent-delete-owner',
  })
  const attacker = t.withIdentity({
    subject: 'agent-delete-attacker',
    tokenIdentifier: 'https://issuer.example.test|agent-delete-attacker',
  })
  const created = await owner.mutation(confirmPlan, plan('agent-delete-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await expect(
    t.mutation(deleteAgentGoal, {
      userId: 'agent-delete-owner',
      goalId: created.bundle.goalId,
    }),
  ).rejects.toThrow('Authentication required')
  await expect(
    attacker.mutation(deleteAgentGoal, {
      userId: 'agent-delete-owner',
      goalId: created.bundle.goalId,
    }),
  ).rejects.toThrow('Authenticated user does not match')

  await expect(
    owner.mutation(deleteAgentGoal, {
      userId: 'agent-delete-owner',
      goalId: created.bundle.goalId,
    }),
  ).resolves.toMatchObject({ deleted: true })
  await t.run(async (ctx) => {
    expect(await ctx.db.get('golieBees', created.bundle!.golieBeeId)).toBeNull()
    expect(await ctx.db.get('highlights', created.bundle!.highlightId)).toBeNull()
  })
})

test('legacy agent Project and Task deletion require Clerk identity only for focus-owned rows', async () => {
  const t = convexTest(schema, modules)
  const userId = 'agent-child-delete-owner'
  const ownerKey = `https://issuer.example.test|${userId}`
  const owner = t.withIdentity({ subject: userId, tokenIdentifier: ownerKey })

  const projectPlan = await owner.mutation(confirmPlan, plan('agent-project-delete-plan'))
  if (!projectPlan.bundle) throw new Error('Expected a confirmed bundle')
  await expect(
    t.mutation(deleteAgentProject, {
      userId,
      projectId: projectPlan.bundle.projectId,
    }),
  ).rejects.toThrow('Authentication required')
  await owner.mutation(deleteAgentProject, {
    userId,
    projectId: projectPlan.bundle.projectId,
  })

  const taskPlan = await owner.mutation(confirmPlan, plan('agent-task-delete-plan'))
  if (!taskPlan.bundle) throw new Error('Expected a confirmed bundle')
  await expect(
    t.mutation(deleteAgentTask, {
      userId,
      taskId: taskPlan.bundle.taskId,
    }),
  ).rejects.toThrow('Authentication required')
  await owner.mutation(deleteAgentTask, {
    userId,
    taskId: taskPlan.bundle.taskId,
  })

  await t.run(async (ctx) => {
    expect(await ctx.db.get('highlights', projectPlan.bundle!.highlightId)).toBeNull()
    expect(await ctx.db.get('highlights', taskPlan.bundle!.highlightId)).toBeNull()
    expect(
      await ctx.db
        .query('firstFocusBundles')
        .withIndex('by_owner_key_and_request_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('requestId', 'agent-project-delete-plan'),
        )
        .unique(),
    ).toBeNull()
    expect(
      await ctx.db
        .query('firstFocusBundles')
        .withIndex('by_owner_key_and_request_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('requestId', 'agent-task-delete-plan'),
        )
        .unique(),
    ).toBeNull()
  })
})

test('legacy agent cannot use caller-supplied userId to inspect or bypass an active Highlight', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'agent-highlight-owner',
    tokenIdentifier: 'https://issuer.example.test|agent-highlight-owner',
  })
  const created = await owner.mutation(confirmPlan, plan('agent-guard-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  await expect(
    t.mutation(completeAgentTask, {
      userId: 'agent-highlight-owner',
      taskId: created.bundle.taskId,
    }),
  ).rejects.toThrow('Authentication required')
  await expect(
    owner.mutation(completeAgentTask, {
      userId: 'agent-highlight-owner',
      taskId: created.bundle.taskId,
    }),
  ).rejects.toThrow('authenticated client')
  expect((await owner.query(getCurrent, {})).activeHighlight?.taskId).toBe(created.bundle.taskId)
})

test('agent reads and every descendant mutation isolate focus-owned lineages by Clerk issuer', async () => {
  const t = convexTest(schema, modules)
  const userId = 'agent-lineage-owner'
  const owner = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer-a.example.test|${userId}`,
  })
  const otherIssuer = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer-b.example.test|${userId}`,
  })
  const created = await owner.mutation(confirmPlan, plan('agent-lineage-plan'))
  if (!created.bundle) throw new Error('Expected a confirmed bundle')

  expect(await t.query(getAgentGoals, { userId })).toEqual([])
  expect(await t.query(listAgentTasks, { userId })).toEqual([])
  expect(await otherIssuer.query(getAgentGoals, { userId })).toEqual([])
  expect(await otherIssuer.query(listAgentTasks, { userId })).toEqual([])
  expect(await owner.query(getAgentGoals, { userId })).toHaveLength(1)
  expect(await owner.query(listAgentTasks, { userId })).toHaveLength(1)

  await expect(
    t.mutation(createAgentProject, {
      userId,
      goalId: created.bundle.goalId,
      title: 'Unauthenticated project',
    }),
  ).rejects.toThrow('Authentication required')
  await expect(
    otherIssuer.mutation(createAgentProject, {
      userId,
      goalId: created.bundle.goalId,
      title: 'Foreign project',
    }),
  ).rejects.toThrow('Goal not found')
  await expect(
    otherIssuer.mutation(updateAgentProject, {
      userId,
      projectId: created.bundle.projectId,
      title: 'Foreign project title',
    }),
  ).rejects.toThrow('Project not found')
  await expect(
    otherIssuer.mutation(createAgentTask, {
      userId,
      goalId: created.bundle.goalId,
      projectId: created.bundle.projectId,
      title: 'Foreign task',
    }),
  ).rejects.toThrow('Goal not found')
  await expect(
    otherIssuer.mutation(completeAgentTask, {
      userId,
      taskId: created.bundle.taskId,
    }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(updateAgentTask, {
      userId,
      taskId: created.bundle.taskId,
      title: 'Foreign task title',
    }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(deleteAgentTask, {
      userId,
      taskId: created.bundle.taskId,
    }),
  ).rejects.toThrow('Task not found')
  await expect(
    otherIssuer.mutation(deleteAgentProject, {
      userId,
      projectId: created.bundle.projectId,
    }),
  ).rejects.toThrow('Project not found')

  expect((await owner.query(getAgentGoals, { userId }))[0]?.title).toBe('Launch BeeGreat')
  expect((await owner.query(listAgentTasks, { userId }))[0]?.title).toBe(
    'Record the first plan',
  )
})

test('all Goal creation paths allow seven Active Goals but reject an eighth', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|seven-goal-owner',
  })
  const createGoal = makeFunctionReference<
    'mutation',
    { title: string; finalGoal?: string },
    Id<'goals'>
  >('goals:create')
  const authenticatedGoalIds: Id<'goals'>[] = []
  for (let goal = 1; goal <= 7; goal += 1) {
    authenticatedGoalIds.push(await owner.mutation(createGoal, { title: `Goal ${goal}` }))
  }
  const authenticatedGoals = (await owner.query(getCurrent, {})).activeGoals
  expect(authenticatedGoals).toHaveLength(7)
  for (const goalId of authenticatedGoalIds) {
    expect(authenticatedGoals.find((goal) => goal.goalId === goalId)?.golieBee.seed).toBe(goalId)
  }
  await expect(owner.mutation(createGoal, { title: 'Goal 8' })).rejects.toThrow('at most 7')

  await expect(
    t.mutation(createAgentGoal, {
      userId: 'uninitialized-agent-owner',
      title: 'Cannot exist yet',
    }),
  ).rejects.toThrow('Authentication required')

  const agentOwner = t.withIdentity({
    subject: 'agent-seven-goal-owner',
    tokenIdentifier: 'https://issuer.example.test|agent-seven-goal-owner',
  })
  await agentOwner.mutation(confirmPlan, plan('agent-hive-setup'))
  const agentGoalIds: Id<'goals'>[] = []
  for (let goal = 2; goal <= 7; goal += 1) {
    agentGoalIds.push(
      (
        await agentOwner.mutation(createAgentGoal, {
          userId: 'agent-seven-goal-owner',
          title: `Agent Goal ${goal}`,
        })
      ).id,
    )
  }
  const agentGoals = (await agentOwner.query(getCurrent, {})).activeGoals
  expect(agentGoals).toHaveLength(7)
  expect(agentGoals.find((goal) => goal.title === 'Launch BeeGreat')?.golieBee.seed).toBe(
    'agent-hive-setup',
  )
  for (const goalId of agentGoalIds) {
    expect(agentGoals.find((goal) => goal.goalId === goalId)?.golieBee.seed).toBe(goalId)
  }
  await expect(
    agentOwner.mutation(createAgentGoal, {
      userId: 'agent-seven-goal-owner',
      title: 'Agent Goal 8',
    }),
  ).rejects.toThrow('at most 7')
})

test('Active Goal limits are isolated by Clerk issuer for a shared subject', async () => {
  const t = convexTest(schema, modules)
  const subject = 'shared-limit-subject'
  const firstIssuer = t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer-a.example.test|${subject}`,
  })
  const secondIssuer = t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer-b.example.test|${subject}`,
  })
  const createGoal = makeFunctionReference<
    'mutation',
    { title: string; finalGoal?: string },
    Id<'goals'>
  >('goals:create')

  for (let goal = 1; goal <= 7; goal += 1) {
    await firstIssuer.mutation(createGoal, { title: `First issuer Goal ${goal}` })
  }
  await expect(
    secondIssuer.mutation(confirmPlan, plan('second-issuer-first-focus')),
  ).resolves.toMatchObject({ status: 'created' })
  await expect(
    secondIssuer.mutation(createAgentGoal, {
      userId: subject,
      title: 'Second issuer agent Goal',
    }),
  ).resolves.toMatchObject({ title: 'Second issuer agent Goal' })

  expect((await firstIssuer.query(getCurrent, {})).activeGoals).toHaveLength(7)
  expect((await secondIssuer.query(getCurrent, {})).activeGoals).toHaveLength(2)
})
