import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

type Mood = 'awful' | 'bad' | 'okay' | 'good' | 'great'

type JournalEntry = {
  localDate: string
  mood: Mood | null
  hydrationMl: number
  journal: string
  timeZone: string
  createdAt: number
  updatedAt: number
}

type HydrationAdjustment = JournalEntry & { appliedDeltaMl: number }

const healthJournal = {
  getByDate: makeFunctionReference<
    'query',
    { localDate: string },
    JournalEntry | null
  >('healthJournal:getByDate'),
  listRecent: makeFunctionReference<
    'query',
    { limit: number; throughDate: string },
    JournalEntry[]
  >('healthJournal:listRecent'),
  setMood: makeFunctionReference<
    'mutation',
    { localDate: string; timeZone: string; mood: Mood },
    JournalEntry
  >('healthJournal:setMood'),
  adjustHydration: makeFunctionReference<
    'mutation',
    { localDate: string; timeZone: string; deltaMl: number },
    HydrationAdjustment
  >('healthJournal:adjustHydration'),
  saveJournal: makeFunctionReference<
    'mutation',
    { localDate: string; timeZone: string; journal: string },
    JournalEntry
  >('healthJournal:saveJournal'),
}

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

describe('Bee Healthy daily journal', () => {
  test('partial updates preserve one normalized entry for the local day', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('healthy-owner'))

    const moodEntry = await owner.mutation(healthJournal.setMood, {
      localDate: '2026-07-17',
      timeZone: 'Europe/Rome',
      mood: 'great',
    })
    const journalEntry = await owner.mutation(healthJournal.saveJournal, {
      localDate: '2026-07-17',
      timeZone: 'Europe/Rome',
      journal: 'Felt focused after a long walk.',
    })
    const hydratedEntry = await owner.mutation(healthJournal.adjustHydration, {
      localDate: '2026-07-17',
      timeZone: 'Europe/Rome',
      deltaMl: 250,
    })

    expect(moodEntry).toMatchObject({
      localDate: '2026-07-17',
      mood: 'great',
      hydrationMl: 0,
      journal: '',
      timeZone: 'Europe/Rome',
    })
    expect(journalEntry).toMatchObject({
      mood: 'great',
      hydrationMl: 0,
      journal: 'Felt focused after a long walk.',
    })
    expect(hydratedEntry).toMatchObject({
      mood: 'great',
      hydrationMl: 250,
      appliedDeltaMl: 250,
      journal: 'Felt focused after a long walk.',
    })
    expect(hydratedEntry.createdAt).toBe(moodEntry.createdAt)
    const persisted = await owner.query(healthJournal.getByDate, {
      localDate: '2026-07-17',
    })
    expect(persisted).toMatchObject({
      mood: 'great',
      hydrationMl: 250,
      journal: 'Felt focused after a long walk.',
    })
    expect(persisted?.updatedAt).toBe(hydratedEntry.updatedAt)
    expect(
      await owner.query(healthJournal.listRecent, {
        limit: 7,
        throughDate: '2026-07-17',
      }),
    ).toEqual([persisted])
  })

  test('repeated writes are idempotent at one row per owner and local day', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('idempotent-owner'))
    const input = { localDate: '2026-07-17', timeZone: 'Europe/Rome' }

    const first = await owner.mutation(healthJournal.setMood, {
      ...input,
      mood: 'bad',
    })
    const second = await owner.mutation(healthJournal.setMood, {
      ...input,
      mood: 'great',
    })

    expect(second).toMatchObject({ mood: 'great', hydrationMl: 0, journal: '' })
    expect(second.createdAt).toBe(first.createdAt)
    expect(await owner.query(healthJournal.listRecent, { limit: 31, throughDate: '2026-07-17' })).toEqual([
      second,
    ])
  })

  test('rapid hydration adjustments accumulate atomically and clamp to safe bounds', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('hydration-owner'))
    const input = { localDate: '2026-07-18', timeZone: 'Europe/Rome' }

    await Promise.all(
      Array.from({ length: 8 }, () =>
        owner.mutation(healthJournal.adjustHydration, {
          ...input,
          deltaMl: 250,
        }),
      ),
    )
    expect(await owner.query(healthJournal.getByDate, { localDate: input.localDate })).toMatchObject(
      { hydrationMl: 2_000 },
    )

    for (let index = 0; index < 5; index += 1) {
      await owner.mutation(healthJournal.adjustHydration, {
        ...input,
        deltaMl: 2_000,
      })
    }
    expect(await owner.query(healthJournal.getByDate, { localDate: input.localDate })).toMatchObject(
      { hydrationMl: 10_000 },
    )

    const capped = await owner.mutation(healthJournal.adjustHydration, {
      ...input,
      deltaMl: 250,
    })
    expect(capped).toMatchObject({ hydrationMl: 10_000, appliedDeltaMl: 0 })

    for (let index = 0; index < 6; index += 1) {
      await owner.mutation(healthJournal.adjustHydration, {
        ...input,
        deltaMl: -2_000,
      })
    }
    expect(await owner.query(healthJournal.getByDate, { localDate: input.localDate })).toMatchObject(
      { hydrationMl: 0 },
    )
  })

  test('recent entries are bounded and ordered by descending local date', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('history-owner'))

    for (const localDate of ['2026-07-14', '2026-07-17', '2026-07-15']) {
      await owner.mutation(healthJournal.setMood, {
        localDate,
        timeZone: 'Europe/Rome',
        mood: 'good',
      })
    }

    await owner.mutation(healthJournal.setMood, {
      localDate: '2026-07-18',
      timeZone: 'Pacific/Kiritimati',
      mood: 'great',
    })

    const recent = await owner.query(healthJournal.listRecent, {
      limit: 2,
      throughDate: '2026-07-17',
    })
    expect(recent.map((entry) => entry.localDate)).toEqual([
      '2026-07-17',
      '2026-07-15',
    ])
  })

  test('authentication and token identifier isolate every journal operation', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('shared-subject', 'https://issuer-a.example.test'))
    const other = t.withIdentity(identity('shared-subject', 'https://issuer-b.example.test'))
    const localDate = '2026-07-17'

    await owner.mutation(healthJournal.saveJournal, {
      localDate,
      timeZone: 'Europe/Rome',
      journal: 'Private owner reflection',
    })

    expect(await other.query(healthJournal.getByDate, { localDate })).toBeNull()
    expect(
      await other.query(healthJournal.listRecent, {
        limit: 7,
        throughDate: localDate,
      }),
    ).toEqual([])

    await other.mutation(healthJournal.setMood, {
      localDate,
      timeZone: 'America/New_York',
      mood: 'bad',
    })
    expect(await owner.query(healthJournal.getByDate, { localDate })).toMatchObject({
      mood: null,
      journal: 'Private owner reflection',
      timeZone: 'Europe/Rome',
    })
    expect(await other.query(healthJournal.getByDate, { localDate })).toMatchObject({
      mood: 'bad',
      journal: '',
      timeZone: 'America/New_York',
    })

    await expect(t.query(healthJournal.getByDate, { localDate })).rejects.toThrow(
      'Sign in to use Bee Healthy',
    )
    await expect(
      t.mutation(healthJournal.adjustHydration, {
        localDate,
        timeZone: 'Europe/Rome',
        deltaMl: 250,
      }),
    ).rejects.toThrow('Sign in to use Bee Healthy')
  })

  test('rejects malformed dates, time zones, journals, deltas, and list bounds', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('validation-owner'))

    for (const localDate of ['2026-7-17', '2026-02-29', '0000-01-01']) {
      await expect(owner.query(healthJournal.getByDate, { localDate })).rejects.toThrow(
        /localDate/,
      )
    }

    for (const timeZone of ['Mars/Olympus_Mons', ' Europe/Rome']) {
      await expect(
        owner.mutation(healthJournal.setMood, {
          localDate: '2026-07-17',
          timeZone,
          mood: 'okay',
        }),
      ).rejects.toThrow(/timeZone/)
    }

    await expect(
      owner.mutation(healthJournal.saveJournal, {
        localDate: '2026-07-17',
        timeZone: 'Europe/Rome',
        journal: 'x'.repeat(5_001),
      }),
    ).rejects.toThrow(/journal/)

    for (const deltaMl of [0, 0.5, 2_001, -2_001]) {
      await expect(
        owner.mutation(healthJournal.adjustHydration, {
          localDate: '2026-07-17',
          timeZone: 'Europe/Rome',
          deltaMl,
        }),
      ).rejects.toThrow(/deltaMl/)
    }

    for (const limit of [0, 1.5, 32]) {
      await expect(
        owner.query(healthJournal.listRecent, {
          limit,
          throughDate: '2026-07-17',
        }),
      ).rejects.toThrow(/limit/)
    }

    await expect(
      owner.query(healthJournal.listRecent, {
        limit: 7,
        throughDate: '2026-02-29',
      }),
    ).rejects.toThrow(/throughDate|localDate/)
  })
})
