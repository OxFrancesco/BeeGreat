import { makeFunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

type JournalEntry = {
  id: Id<'journalEntries'>
  localDate: string
  timeZone: string
  occurredAt: number
  title: string
  body: string
  tags: string[]
  isPinned: boolean
  isFavorite: boolean
  coverPhoto: null
  attachmentCount: number
  createdAt: number
  updatedAt: number
}

const journalEntries = {
  createDraft: makeFunctionReference<
    'mutation',
    { localDate: string; timeZone: string; occurredAt: number },
    JournalEntry
  >('journalEntries:createDraft'),
  update: makeFunctionReference<
    'mutation',
    {
      entryId: Id<'journalEntries'>
      title?: string
      body?: string
      tags?: string[]
      localDate?: string
      timeZone?: string
      occurredAt?: number
      isPinned?: boolean
      isFavorite?: boolean
    },
    JournalEntry
  >('journalEntries:update'),
  listRecent: makeFunctionReference<
    'query',
    { limit: number; throughDate: string },
    JournalEntry[]
  >('journalEntries:listRecent'),
  listDay: makeFunctionReference<
    'query',
    { localDate: string },
    JournalEntry[]
  >('journalEntries:listDay'),
  listMonth: makeFunctionReference<
    'query',
    { monthStart: string },
    { localDate: string; entryCount: number; hasPhoto: boolean }[]
  >('journalEntries:listMonth'),
  get: makeFunctionReference<
    'query',
    { entryId: Id<'journalEntries'> },
    JournalEntry | null
  >('journalEntries:get'),
  remove: makeFunctionReference<
    'mutation',
    { entryId: Id<'journalEntries'> },
    null
  >('journalEntries:remove'),
  search: makeFunctionReference<
    'query',
    { query: string },
    JournalEntry[]
  >('journalEntries:search'),
  importLegacy: makeFunctionReference<
    'mutation',
    Record<string, never>,
    { imported: number }
  >('journalEntries:importLegacy'),
}

const healthJournal = {
  saveJournal: makeFunctionReference<
    'mutation',
    { localDate: string; timeZone: string; journal: string },
    unknown
  >('healthJournal:saveJournal'),
}

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

describe('Journal entries', () => {
  test('multiple written entries can share a day while blank drafts stay out of the timeline', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('journal-owner'))
    const input = {
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
    }

    const morningDraft = await owner.mutation(journalEntries.createDraft, {
      ...input,
      occurredAt: Date.UTC(2026, 6, 19, 7, 30),
    })
    const eveningDraft = await owner.mutation(journalEntries.createDraft, {
      ...input,
      occurredAt: Date.UTC(2026, 6, 19, 20, 15),
    })
    await owner.mutation(journalEntries.createDraft, {
      ...input,
      occurredAt: Date.UTC(2026, 6, 19, 21, 0),
    })

    const morning = await owner.mutation(journalEntries.update, {
      entryId: morningDraft.id,
      title: 'A quiet start',
      body: 'Coffee on the balcony before the city woke up.',
    })
    const evening = await owner.mutation(journalEntries.update, {
      entryId: eveningDraft.id,
      body: 'Dinner with people I want to remember.',
      isFavorite: true,
    })

    const timeline = await owner.query(journalEntries.listRecent, {
      limit: 20,
      throughDate: input.localDate,
    })

    expect(timeline).toEqual([evening, morning])
    expect(timeline.map((entry) => entry.localDate)).toEqual([
      input.localDate,
      input.localDate,
    ])
  })

  test('entry reads, writes, and deletion stay private to the authenticated owner', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('private-owner', 'https://issuer-a.test'))
    const other = t.withIdentity(identity('private-owner', 'https://issuer-b.test'))
    const draft = await owner.mutation(journalEntries.createDraft, {
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
      occurredAt: Date.UTC(2026, 6, 19, 12),
    })
    const saved = await owner.mutation(journalEntries.update, {
      entryId: draft.id,
      body: 'Only I should be able to read this.',
    })

    expect(await owner.query(journalEntries.get, { entryId: saved.id })).toEqual(saved)
    expect(await other.query(journalEntries.get, { entryId: saved.id })).toBeNull()
    await expect(
      other.mutation(journalEntries.update, {
        entryId: saved.id,
        isPinned: true,
      }),
    ).rejects.toThrow(/not found/i)
    await expect(
      other.mutation(journalEntries.remove, { entryId: saved.id }),
    ).rejects.toThrow(/not found/i)

    expect(await owner.mutation(journalEntries.remove, { entryId: saved.id })).toBeNull()
    expect(await owner.query(journalEntries.get, { entryId: saved.id })).toBeNull()
    await expect(t.query(journalEntries.listRecent, {
      limit: 20,
      throughDate: '2026-07-19',
    })).rejects.toThrow(/sign in/i)
  })

  test('search finds the owner\'s written entries by title or body', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('search-owner'))
    const other = t.withIdentity(identity('other-search-owner'))
    const base = {
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
      occurredAt: Date.UTC(2026, 6, 19, 18),
    }

    const dinnerDraft = await owner.mutation(journalEntries.createDraft, base)
    const walkDraft = await owner.mutation(journalEntries.createDraft, {
      ...base,
      occurredAt: base.occurredAt + 1,
    })
    const privateDraft = await other.mutation(journalEntries.createDraft, base)
    const dinner = await owner.mutation(journalEntries.update, {
      entryId: dinnerDraft.id,
      title: 'Sunday dinner',
      body: 'Fresh pasta with everyone around the table.',
    })
    await owner.mutation(journalEntries.update, {
      entryId: walkDraft.id,
      title: 'Evening walk',
      body: 'The streets were unusually quiet.',
    })
    await other.mutation(journalEntries.update, {
      entryId: privateDraft.id,
      title: 'Private pasta recipe',
    })

    expect(await owner.query(journalEntries.search, { query: 'pasta' })).toEqual([
      dinner,
    ])
    expect(await owner.query(journalEntries.search, { query: '  ' })).toEqual([])
  })

  test('tags are normalized, searchable, and dates can be moved safely', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('metadata-owner'))
    const draft = await owner.mutation(journalEntries.createDraft, {
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
      occurredAt: Date.UTC(2026, 6, 19, 12),
    })
    const moved = await owner.mutation(journalEntries.update, {
      entryId: draft.id,
      body: 'A train crossed the coast at sunset.',
      tags: [' Travel ', 'train ride', 'travel'],
      localDate: '2026-07-18',
      occurredAt: Date.UTC(2026, 6, 18, 19),
    })

    expect(moved.tags).toEqual(['Travel', 'train ride'])
    expect(moved.localDate).toBe('2026-07-18')
    expect(await owner.query(journalEntries.search, { query: 'Travel' })).toEqual([
      moved,
    ])
    expect(await owner.query(journalEntries.listMonth, {
      monthStart: '2026-07-01',
    })).toEqual([
      { localDate: '2026-07-18', entryCount: 1, hasPhoto: false },
    ])
    expect(await owner.query(journalEntries.listDay, {
      localDate: '2026-07-18',
    })).toEqual([moved])

    await expect(
      owner.mutation(journalEntries.update, {
        entryId: draft.id,
        localDate: '2026-07-17',
      }),
    ).rejects.toThrow(/must match occurredAt/i)
  })

  test('legacy daily reflections import once as independent journal entries', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('legacy-owner'))
    await owner.mutation(healthJournal.saveJournal, {
      localDate: '2026-07-18',
      timeZone: 'Europe/Rome',
      journal: 'A reflection written before the journal timeline existed.',
    })
    await owner.mutation(healthJournal.saveJournal, {
      localDate: '2026-07-19',
      timeZone: 'Europe/Rome',
      journal: '',
    })

    expect(await owner.mutation(journalEntries.importLegacy, {})).toEqual({ imported: 1 })
    expect(await owner.mutation(journalEntries.importLegacy, {})).toEqual({ imported: 0 })
    const timeline = await owner.query(journalEntries.listRecent, {
      limit: 20,
      throughDate: '2026-07-19',
    })
    expect(timeline).toHaveLength(1)
    expect(timeline[0]).toMatchObject({
      localDate: '2026-07-18',
      title: '',
      body: 'A reflection written before the journal timeline existed.',
    })
  })
})
