import type { WithoutSystemFields } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'

const MAX_HYDRATION_ML = 10_000
const MAX_HYDRATION_DELTA_ML = 2_000
const MAX_JOURNAL_LENGTH = 5_000
const MAX_RECENT_ENTRIES = 31
const MAX_TIME_ZONE_LENGTH = 100

const moodValidator = v.union(
  v.literal('awful'),
  v.literal('bad'),
  v.literal('okay'),
  v.literal('good'),
  v.literal('great'),
)

const journalEntryFields = {
  localDate: v.string(),
  mood: v.union(moodValidator, v.null()),
  hydrationMl: v.number(),
  journal: v.string(),
  timeZone: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}

const journalEntryValidator = v.object(journalEntryFields)
const hydrationAdjustmentValidator = v.object({
  ...journalEntryFields,
  appliedDeltaMl: v.number(),
})

type AuthContext = QueryCtx | MutationCtx
type Mood = Doc<'healthJournalEntries'>['mood']
type EntryPatch = {
  mood?: Mood
  hydrationMl?: number
  journal?: string
}

export type HealthJournalIdentity = { ownerKey: string; userId: string }

async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to use Bee Healthy',
    })
  }
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject }
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: 'INVALID_ARGUMENT', message })
}

function validateLocalDate(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!match) invalidArgument('localDate must use YYYY-MM-DD format')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) {
    invalidArgument('localDate must be a valid calendar date')
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  if (day < 1 || day > daysInMonth[month - 1]) {
    invalidArgument('localDate must be a valid calendar date')
  }
}

function validateTimeZone(timeZone: string) {
  if (
    timeZone.length === 0 ||
    timeZone.length > MAX_TIME_ZONE_LENGTH ||
    timeZone.trim() !== timeZone ||
    !/^[A-Za-z0-9._+\-/]+$/.test(timeZone)
  ) {
    invalidArgument('timeZone must be a valid IANA time zone')
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
  } catch {
    invalidArgument('timeZone must be a valid IANA time zone')
  }
}

function validateJournal(journal: string) {
  if (journal.length > MAX_JOURNAL_LENGTH) {
    invalidArgument(`journal must be at most ${MAX_JOURNAL_LENGTH} characters`)
  }
}

function validateDelta(deltaMl: number) {
  if (
    !Number.isSafeInteger(deltaMl) ||
    deltaMl === 0 ||
    Math.abs(deltaMl) > MAX_HYDRATION_DELTA_ML
  ) {
    invalidArgument(
      `deltaMl must be a non-zero integer between -${MAX_HYDRATION_DELTA_ML} and ${MAX_HYDRATION_DELTA_ML}`,
    )
  }
}

function validateLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RECENT_ENTRIES) {
    invalidArgument(`limit must be an integer between 1 and ${MAX_RECENT_ENTRIES}`)
  }
}

function normalizeEntry(entry: Doc<'healthJournalEntries'>) {
  return {
    localDate: entry.localDate,
    mood: entry.mood ?? null,
    hydrationMl: entry.hydrationMl,
    journal: entry.journal ?? '',
    timeZone: entry.timeZone,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

async function findEntry(ctx: AuthContext, ownerKey: string, localDate: string) {
  return await ctx.db
    .query('healthJournalEntries')
    .withIndex('by_owner_key_and_local_date', (q) =>
      q.eq('ownerKey', ownerKey).eq('localDate', localDate),
    )
    .unique()
}

async function upsertEntry(
  ctx: MutationCtx,
  identity: HealthJournalIdentity,
  localDate: string,
  timeZone: string,
  patch: EntryPatch,
) {
  const existing = await findEntry(ctx, identity.ownerKey, localDate)
  const now = Date.now()

  if (existing) {
    await ctx.db.patch('healthJournalEntries', existing._id, {
      ...patch,
      timeZone,
      updatedAt: now,
    })
    const updated = await ctx.db.get('healthJournalEntries', existing._id)
    if (!updated) throw new Error('Health journal entry disappeared during update')
    return updated
  }

  const document: WithoutSystemFields<Doc<'healthJournalEntries'>> = {
    ...identity,
    localDate,
    hydrationMl: patch.hydrationMl ?? 0,
    timeZone,
    createdAt: now,
    updatedAt: now,
  }
  if (patch.mood !== undefined) document.mood = patch.mood
  if (patch.journal !== undefined) document.journal = patch.journal
  const entryId = await ctx.db.insert('healthJournalEntries', document)
  const inserted = await ctx.db.get('healthJournalEntries', entryId)
  if (!inserted) throw new Error('Health journal entry disappeared during creation')
  return inserted
}

/** Shared domain operation used by direct controls and automation adapters. */
export async function adjustHydrationForIdentity(
  ctx: MutationCtx,
  identity: HealthJournalIdentity,
  args: { localDate: string; timeZone: string; deltaMl: number },
) {
  validateLocalDate(args.localDate)
  validateTimeZone(args.timeZone)
  validateDelta(args.deltaMl)

  const existing = await findEntry(ctx, identity.ownerKey, args.localDate)
  const previousHydrationMl = existing?.hydrationMl ?? 0
  const hydrationMl = Math.max(
    0,
    Math.min(MAX_HYDRATION_ML, previousHydrationMl + args.deltaMl),
  )
  const entry = await upsertEntry(ctx, identity, args.localDate, args.timeZone, {
    hydrationMl,
  })
  return {
    ...normalizeEntry(entry),
    appliedDeltaMl: hydrationMl - previousHydrationMl,
  }
}

export const getByDate = query({
  args: { localDate: v.string() },
  returns: v.union(journalEntryValidator, v.null()),
  handler: async (ctx, args) => {
    validateLocalDate(args.localDate)
    const { ownerKey } = await requireIdentity(ctx)
    const entry = await findEntry(ctx, ownerKey, args.localDate)
    return entry ? normalizeEntry(entry) : null
  },
})

export const listRecent = query({
  args: { limit: v.number(), throughDate: v.string() },
  returns: v.array(journalEntryValidator),
  handler: async (ctx, args) => {
    validateLimit(args.limit)
    validateLocalDate(args.throughDate)
    const { ownerKey } = await requireIdentity(ctx)
    const entries = await ctx.db
      .query('healthJournalEntries')
      .withIndex('by_owner_key_and_local_date', (q) =>
        q.eq('ownerKey', ownerKey).lte('localDate', args.throughDate),
      )
      .order('desc')
      .take(args.limit)
    return entries.map(normalizeEntry)
  },
})

export const setMood = mutation({
  args: {
    localDate: v.string(),
    timeZone: v.string(),
    mood: moodValidator,
  },
  returns: journalEntryValidator,
  handler: async (ctx, args) => {
    validateLocalDate(args.localDate)
    validateTimeZone(args.timeZone)
    const identity = await requireIdentity(ctx)
    const entry = await upsertEntry(ctx, identity, args.localDate, args.timeZone, {
      mood: args.mood,
    })
    return normalizeEntry(entry)
  },
})

export const adjustHydration = mutation({
  args: {
    localDate: v.string(),
    timeZone: v.string(),
    deltaMl: v.number(),
  },
  returns: hydrationAdjustmentValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    return adjustHydrationForIdentity(ctx, identity, args)
  },
})

export const saveJournal = mutation({
  args: {
    localDate: v.string(),
    timeZone: v.string(),
    journal: v.string(),
  },
  returns: journalEntryValidator,
  handler: async (ctx, args) => {
    validateLocalDate(args.localDate)
    validateTimeZone(args.timeZone)
    validateJournal(args.journal)
    const identity = await requireIdentity(ctx)
    const entry = await upsertEntry(ctx, identity, args.localDate, args.timeZone, {
      journal: args.journal,
    })
    return normalizeEntry(entry)
  },
})
