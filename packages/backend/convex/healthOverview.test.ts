import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'
import { shiftDay, trackerStreak } from './lib/healthStreaks'

const day = '2026-09-12'
const ownerId = { subject: 'health-owner', tokenIdentifier: 'https://test.example|health-owner' }

describe('health streak overview', () => {
  test('consecutive calendar days, grace for today, gaps, leap days and bounded records', () => {
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    const dates = new Set(['2026-09-08', '2026-09-10', '2026-09-11'])
    expect(trackerStreak(dates, day, '2026-09-01')).toMatchObject({ current: 2, best: 2, completedDays: 3, currentCapped: false })
    expect(trackerStreak(dates, '2026-09-13', '2026-09-01').current).toBe(0)
    expect(trackerStreak(dates, day, '2026-09-10')).toMatchObject({ current: 2, currentCapped: true })
  })
  test('uses actual goals and saved content, isolates owners, and updates after undo and deletion', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(ownerId)
    const args = { localDate: day, timeZone: 'Europe/Rome' }
    await owner.mutation(api.healthJournal.setMood, { ...args, mood: 'bad' })
    await owner.mutation(api.healthJournal.adjustHydration, { ...args, deltaMl: 2000 })
    const draft = await owner.mutation(api.journalEntries.createDraft, { ...args, occurredAt: Date.parse(`${day}T10:00:00Z`) })
    let stats = await owner.query(api.healthJournal.overview, { throughDate: day })
    expect(stats.mood.current).toBe(1)
    expect(stats.water.current).toBe(1)
    expect(stats.journal.current).toBe(0)
    await owner.mutation(api.journalEntries.update, { entryId: draft.id, expectedUpdatedAt: draft.updatedAt, body: 'A walk by the lake.' })
    stats = await owner.query(api.healthJournal.overview, { throughDate: day })
    expect(stats.journal.current).toBe(1)
    await owner.mutation(api.healthJournal.adjustHydration, { ...args, deltaMl: -250 })
    await owner.mutation(api.journalEntries.remove, { entryId: draft.id })
    stats = await owner.query(api.healthJournal.overview, { throughDate: day })
    expect(stats.water.current).toBe(0)
    expect(stats.journal.current).toBe(0)
    const other = t.withIdentity({ subject: 'other', tokenIdentifier: 'https://test.example|other' })
    expect((await other.query(api.healthJournal.overview, { throughDate: day })).mood.current).toBe(0)
    await expect(t.query(api.healthJournal.overview, { throughDate: day })).rejects.toThrow('Sign in')
  })
  test('counts unmigrated legacy journals and excludes future records', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(ownerId)
    await owner.mutation(api.healthJournal.saveJournal, { localDate: shiftDay(day, -1), timeZone: 'Europe/Rome', journal: 'Legacy reflection' })
    await owner.mutation(api.healthJournal.setMood, { localDate: shiftDay(day, 1), timeZone: 'Europe/Rome', mood: 'great' })
    const stats = await owner.query(api.healthJournal.overview, { throughDate: day })
    expect(stats.journal.current).toBe(1)
    expect(stats.mood.current).toBe(0)
  })
})

test('multiple entries count once and deleting a migrated note does not resurrect its legacy day', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(ownerId)
  const args = { localDate: day, timeZone: 'Europe/Rome' }
  await owner.mutation(api.healthJournal.saveJournal, { ...args, journal: 'An old daily note' })
  await owner.mutation(api.journalEntries.importLegacy, {})
  const imported = await owner.query(api.journalEntries.listDay, { localDate: day })
  expect(imported).toHaveLength(1)
  const draft = await owner.mutation(api.journalEntries.createDraft, { ...args, occurredAt: Date.parse(`${day}T11:00:00Z`) })
  await owner.mutation(api.journalEntries.update, { entryId: draft.id, expectedUpdatedAt: draft.updatedAt, title: 'Another entry' })
  expect((await owner.query(api.healthJournal.overview, { throughDate: day })).journal.completedDays).toBe(1)
  await owner.mutation(api.journalEntries.remove, { entryId: draft.id })
  await owner.mutation(api.journalEntries.remove, { entryId: imported[0].id })
  expect((await owner.query(api.healthJournal.overview, { throughDate: day })).journal.current).toBe(0)
})

test('calendar returns the whole month with partial water, empty days and leap boundaries', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(ownerId)
  await owner.mutation(api.healthJournal.adjustHydration, { localDate: '2024-02-29', timeZone: 'Europe/Rome', deltaMl: 750 })
  await owner.mutation(api.healthJournal.setMood, { localDate: '2024-02-29', timeZone: 'Europe/Rome', mood: 'awful' })
  await owner.mutation(api.healthJournal.saveJournal, { localDate: '2024-02-28', timeZone: 'Europe/Rome', journal: 'A leap week' })
  const feb = await owner.query(api.healthJournal.overview, { throughDate: '2024-02-29' })
  expect(feb.calendar).toHaveLength(29)
  expect(feb.calendar[0]).toEqual({ localDate: '2024-02-01', mood: false, water: 0, journal: false })
  expect(feb.calendar[27].journal).toBe(true)
  expect(feb.calendar[28]).toEqual({ localDate: '2024-02-29', mood: true, water: .375, journal: false })
  expect((await owner.query(api.healthJournal.overview, { throughDate: '2024-03-01' })).calendar).toEqual([{ localDate: '2024-03-01', mood: false, water: 0, journal: false }])
  await owner.mutation(api.healthJournal.adjustHydration, { localDate: '2024-02-29', timeZone: 'Europe/Rome', deltaMl: 2000 })
  expect((await owner.query(api.healthJournal.overview, { throughDate: '2024-02-29' })).calendar[28].water).toBe(1)
})
