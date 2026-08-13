import { makeFunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

type Definition =
  | { type: 'hydration'; amountMl: number }
  | { type: 'reminder' }
type Action = {
  _id: Id<'nfcActions'>
  label: string
  enabled: boolean
  definition: Definition
  completionCount: number
  tagUrl: string
  lastExecutedAt: number | null
  createdAt: number
  updatedAt: number
}
type Outcome =
  | {
      type: 'hydration'
      localDate: string
      timeZone: string
      appliedMl: number
    }
  | {
      type: 'reminder'
      localDate: string
      timeZone: string
      appliedCount: number
    }
type ExecutedAction = {
  label: string
  definition: Definition
  completionCount: number
}
type Execution = {
  duplicate: boolean
  executionId: Id<'nfcActionExecutions'>
  action: ExecutedAction
  outcome: Outcome
}

const nfcActions = {
  list: makeFunctionReference<'query', Record<string, never>, Action[]>(
    'nfcActions:list',
  ),
  create: makeFunctionReference<
    'mutation',
    { label: string; definition: Definition },
    Action
  >('nfcActions:create'),
  update: makeFunctionReference<
    'mutation',
    {
      actionId: Id<'nfcActions'>
      label?: string
      enabled?: boolean
      definition?: Definition
    },
    Action
  >('nfcActions:update'),
  remove: makeFunctionReference<
    'mutation',
    { actionId: Id<'nfcActions'> },
    null
  >('nfcActions:remove'),
  execute: makeFunctionReference<
    'mutation',
    { publicId: string; localDate: string; timeZone: string },
    Execution
  >('nfcActions:execute'),
  undo: makeFunctionReference<
    'mutation',
    { executionId: Id<'nfcActionExecutions'> },
    { action: ExecutedAction; outcome: Outcome; undoneAt: number }
  >('nfcActions:undo'),
}

const healthJournal = {
  getByDate: makeFunctionReference<
    'query',
    { localDate: string },
    { hydrationMl: number } | null
  >('healthJournal:getByDate'),
}

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

function publicId(action: Action) {
  return new URL(action.tagUrl).pathname.split('/').at(-1)!
}

describe('NFC actions', () => {
  test('keeps the tag URL stable while its server-side action changes', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('nfc-owner'))
    const created = await owner.mutation(nfcActions.create, {
      label: 'Desk bottle',
      definition: { type: 'hydration', amountMl: 250 },
    })
    const updated = await owner.mutation(nfcActions.update, {
      actionId: created._id,
      label: 'Large desk bottle',
      definition: { type: 'hydration', amountMl: 500 },
    })

    expect(created.tagUrl).toMatch(
      /^https:\/\/beegreat\.app\/tap\/[a-f0-9]{32}$/,
    )
    expect(updated).toMatchObject({
      label: 'Large desk bottle',
      enabled: true,
      definition: { type: 'hydration', amountMl: 500 },
      tagUrl: created.tagUrl,
    })
    expect(await owner.query(nfcActions.list, {})).toEqual([updated])
  })

  test('executes hydration through the generic seam and suppresses duplicate taps', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('hydration-tag-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Kitchen glass',
      definition: { type: 'hydration', amountMl: 250 },
    })
    const args = {
      publicId: publicId(action),
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
    }

    const first = await owner.mutation(nfcActions.execute, args)
    const duplicate = await owner.mutation(nfcActions.execute, args)

    expect(first).toMatchObject({
      duplicate: false,
      action: {
        label: 'Kitchen glass',
        definition: { type: 'hydration', amountMl: 250 },
        completionCount: 1,
      },
      outcome: { type: 'hydration', appliedMl: 250 },
    })
    expect(duplicate).toEqual({ ...first, duplicate: true })
    expect(
      await owner.query(healthJournal.getByDate, { localDate: args.localDate }),
    ).toMatchObject({ hydrationMl: 250 })
    expect(await owner.query(nfcActions.list, {})).toMatchObject([
      { _id: action._id, completionCount: 1 },
    ])
  })

  test('undo uses the execution snapshot and restores hydration', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('undo-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Gym bottle',
      definition: { type: 'hydration', amountMl: 750 },
    })
    const executed = await owner.mutation(nfcActions.execute, {
      publicId: publicId(action),
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
    })
    const undone = await owner.mutation(nfcActions.undo, {
      executionId: executed.executionId,
    })

    expect(undone).toMatchObject({
      action: { label: 'Gym bottle', completionCount: 0 },
      outcome: { type: 'hydration', appliedMl: 750 },
    })
    expect(
      await owner.query(healthJournal.getByDate, { localDate: '2026-07-19' }),
    ).toMatchObject({ hydrationMl: 0 })
    expect(await owner.query(nfcActions.list, {})).toMatchObject([
      { _id: action._id, completionCount: 0 },
    ])
    await expect(
      owner.mutation(nfcActions.undo, { executionId: executed.executionId }),
    ).rejects.toThrow('already been undone')
  })

  test('counts reminder taps, suppresses duplicates, and supports undo', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('reminder-tag-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Water the plants',
      definition: { type: 'reminder' },
    })
    const args = {
      publicId: publicId(action),
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
    }

    const first = await owner.mutation(nfcActions.execute, args)
    const duplicate = await owner.mutation(nfcActions.execute, args)

    expect(first).toMatchObject({
      duplicate: false,
      action: {
        label: 'Water the plants',
        definition: { type: 'reminder' },
        completionCount: 1,
      },
      outcome: {
        type: 'reminder',
        appliedCount: 1,
      },
    })
    expect(duplicate).toEqual({ ...first, duplicate: true })
    expect(await owner.query(nfcActions.list, {})).toMatchObject([
      { _id: action._id, completionCount: 1 },
    ])

    const undone = await owner.mutation(nfcActions.undo, {
      executionId: first.executionId,
    })
    expect(undone).toMatchObject({
      action: { completionCount: 0 },
      outcome: {
        type: 'reminder',
        appliedCount: -1,
      },
    })
    expect(await owner.query(nfcActions.list, {})).toMatchObject([
      { _id: action._id, completionCount: 0 },
    ])
  })

  test('undo survives action deletion and clamps the counter at zero', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('deleted-reminder-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Take out the bins',
      definition: { type: 'reminder' },
    })
    const executed = await owner.mutation(nfcActions.execute, {
      publicId: publicId(action),
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
    })
    await owner.mutation(nfcActions.remove, { actionId: action._id })

    const undone = await owner.mutation(nfcActions.undo, {
      executionId: executed.executionId,
    })
    expect(undone).toMatchObject({
      action: { label: 'Take out the bins', completionCount: 0 },
      outcome: { type: 'reminder', appliedCount: -1 },
    })
    expect(await owner.query(nfcActions.list, {})).toEqual([])
  })

  test("does not reveal or execute another owner's tag", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('private-owner'))
    const other = t.withIdentity(identity('other-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Private bottle',
      definition: { type: 'hydration', amountMl: 330 },
    })

    await expect(
      other.mutation(nfcActions.execute, {
        publicId: publicId(action),
        localDate: '2026-07-19',
        timeZone: 'Europe/Rome',
      }),
    ).rejects.toThrow('not available')
    expect(await other.query(nfcActions.list, {})).toEqual([])
  })

  test('disabled actions fail closed', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('disabled-owner'))
    const action = await owner.mutation(nfcActions.create, {
      label: 'Old bottle',
      definition: { type: 'hydration', amountMl: 250 },
    })
    await owner.mutation(nfcActions.update, {
      actionId: action._id,
      enabled: false,
    })

    await expect(
      owner.mutation(nfcActions.execute, {
        publicId: publicId(action),
        localDate: '2026-07-19',
        timeZone: 'Europe/Rome',
      }),
    ).rejects.toThrow('not available')
  })

  test('rejects malformed public ids before lookup', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('invalid-public-id-owner'))

    await expect(
      owner.mutation(nfcActions.execute, {
        publicId: '../not-a-tag',
        localDate: '2026-07-19',
        timeZone: 'Europe/Rome',
      }),
    ).rejects.toThrow('not available')
  })
})
