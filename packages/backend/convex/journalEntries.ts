import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

const MAX_BODY_LENGTH = 50_000
const MAX_TITLE_LENGTH = 160
const MAX_TIME_ZONE_LENGTH = 100
const MAX_TIMELINE_ENTRIES = 100
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30
const MAX_PHOTOS = 10

const photoValidator = v.object({
  id: v.id('journalAttachments'),
  kind: v.literal('photo'),
  url: v.string(),
  mimeType: v.string(),
  fileName: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  createdAt: v.number(),
})

const journalEntryValidator = v.object({
  id: v.id('journalEntries'),
  localDate: v.string(),
  timeZone: v.string(),
  occurredAt: v.number(),
  title: v.string(),
  body: v.string(),
  tags: v.array(v.string()),
  isPinned: v.boolean(),
  isFavorite: v.boolean(),
  coverPhoto: v.union(photoValidator, v.null()),
  attachmentCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const monthDayValidator = v.object({
  localDate: v.string(),
  entryCount: v.number(),
  hasPhoto: v.boolean(),
})

type AuthContext = QueryCtx | MutationCtx

async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to use your journal',
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
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    year < 1 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    invalidArgument('localDate must be a valid calendar date')
  }
}

function validateMonthStart(monthStart: string) {
  validateLocalDate(monthStart)
  if (!monthStart.endsWith('-01')) invalidArgument('monthStart must be the first day of a month')
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

function validateOccurredAt(occurredAt: number) {
  if (!Number.isSafeInteger(occurredAt) || occurredAt <= 0) {
    invalidArgument('occurredAt must be a positive timestamp')
  }
}

function validateEntryMoment(localDate: string, timeZone: string, occurredAt: number) {
  validateLocalDate(localDate)
  validateTimeZone(timeZone)
  validateOccurredAt(occurredAt)
  if (localDateForTimestamp(occurredAt, timeZone) !== localDate) {
    invalidArgument('localDate must match occurredAt in timeZone')
  }
}

function validateLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_TIMELINE_ENTRIES) {
    invalidArgument(`limit must be an integer between 1 and ${MAX_TIMELINE_ENTRIES}`)
  }
}

function validateTitle(title: string) {
  if (title.length > MAX_TITLE_LENGTH) {
    invalidArgument(`title must be at most ${MAX_TITLE_LENGTH} characters`)
  }
}

function validateBody(body: string) {
  if (body.length > MAX_BODY_LENGTH) {
    invalidArgument(`body must be at most ${MAX_BODY_LENGTH} characters`)
  }
}

function normalizeTags(tags: string[]) {
  if (tags.length > MAX_TAGS) invalidArgument(`An entry can have at most ${MAX_TAGS} tags`)
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/\s+/g, ' ')
    if (!tag || tag.length > MAX_TAG_LENGTH) {
      invalidArgument(`Tags must be between 1 and ${MAX_TAG_LENGTH} characters`)
    }
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(tag)
  }
  return normalized
}

function validatePhotoMetadata(args: {
  mimeType: string
  fileName?: string
  width?: number
  height?: number
}) {
  if (!/^image\/[A-Za-z0-9.+-]+$/.test(args.mimeType) || args.mimeType.length > 100) {
    invalidArgument('mimeType must describe an image')
  }
  if (args.fileName !== undefined && (!args.fileName.trim() || args.fileName.length > 255)) {
    invalidArgument('fileName must be between 1 and 255 characters')
  }
  for (const dimension of [args.width, args.height]) {
    if (dimension !== undefined && (!Number.isFinite(dimension) || dimension <= 0)) {
      invalidArgument('Photo dimensions must be positive numbers')
    }
  }
}

async function attachmentView(ctx: AuthContext, attachment: Doc<'journalAttachments'>) {
  const url = await ctx.storage.getUrl(attachment.storageId)
  if (!url) return null
  return {
    id: attachment._id,
    kind: attachment.kind,
    url,
    mimeType: attachment.mimeType,
    ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
    ...(attachment.width !== undefined ? { width: attachment.width } : {}),
    ...(attachment.height !== undefined ? { height: attachment.height } : {}),
    createdAt: attachment.createdAt,
  }
}

async function entryView(ctx: AuthContext, entry: Doc<'journalEntries'>) {
  const attachments = await ctx.db
    .query('journalAttachments')
    .withIndex('by_entry_id_and_created_at', (q) => q.eq('entryId', entry._id))
    .order('asc')
    .collect()
  const photos = (
    await Promise.all(attachments.map((attachment) => attachmentView(ctx, attachment)))
  ).filter((photo): photo is NonNullable<typeof photo> => photo !== null)
  return {
    id: entry._id,
    localDate: entry.localDate,
    timeZone: entry.timeZone,
    occurredAt: entry.occurredAt,
    title: entry.title,
    body: entry.body,
    tags: entry.tags ?? [],
    isPinned: entry.isPinned,
    isFavorite: entry.isFavorite,
    coverPhoto: photos[0] ?? null,
    attachmentCount: photos.length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

function hasContent(entry: Awaited<ReturnType<typeof entryView>>) {
  return (
    entry.title.trim().length > 0 ||
    entry.body.trim().length > 0 ||
    entry.attachmentCount > 0
  )
}

function localDateForTimestamp(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function nextMonthStart(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return `${String(next.getUTCFullYear()).padStart(4, '0')}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export const createDraft = mutation({
  args: {
    localDate: v.string(),
    timeZone: v.string(),
    occurredAt: v.number(),
  },
  returns: journalEntryValidator,
  handler: async (ctx, args) => {
    validateEntryMoment(args.localDate, args.timeZone, args.occurredAt)
    const identity = await requireIdentity(ctx)
    const now = Date.now()
    const entryId = await ctx.db.insert('journalEntries', {
      ...identity,
      localDate: args.localDate,
      timeZone: args.timeZone,
      occurredAt: args.occurredAt,
      title: '',
      body: '',
      tags: [],
      searchText: '',
      isPinned: false,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
    const entry = await ctx.db.get('journalEntries', entryId)
    if (!entry) throw new Error('Journal entry disappeared during creation')
    return entryView(ctx, entry)
  },
})

export const update = mutation({
  args: {
    entryId: v.id('journalEntries'),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    localDate: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    isPinned: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
  },
  returns: journalEntryValidator,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const entry = await ctx.db.get('journalEntries', args.entryId)
    if (!entry || entry.ownerKey !== ownerKey) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Journal entry not found' })
    }
    if (args.title !== undefined) validateTitle(args.title)
    if (args.body !== undefined) validateBody(args.body)

    const title = args.title ?? entry.title
    const body = args.body ?? entry.body
    const tags = args.tags === undefined ? (entry.tags ?? []) : normalizeTags(args.tags)
    const localDate = args.localDate ?? entry.localDate
    const timeZone = args.timeZone ?? entry.timeZone
    const occurredAt = args.occurredAt ?? entry.occurredAt
    validateEntryMoment(localDate, timeZone, occurredAt)

    await ctx.db.patch('journalEntries', args.entryId, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.body !== undefined ? { body: args.body } : {}),
      ...(args.tags !== undefined ? { tags } : {}),
      ...(args.localDate !== undefined ? { localDate } : {}),
      ...(args.timeZone !== undefined ? { timeZone } : {}),
      ...(args.occurredAt !== undefined ? { occurredAt } : {}),
      ...(args.isPinned !== undefined ? { isPinned: args.isPinned } : {}),
      ...(args.isFavorite !== undefined ? { isFavorite: args.isFavorite } : {}),
      searchText: `${title}\n${body}\n${tags.join(' ')}`.trim(),
      updatedAt: Date.now(),
    })
    const updated = await ctx.db.get('journalEntries', args.entryId)
    if (!updated) throw new Error('Journal entry disappeared during update')
    return entryView(ctx, updated)
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
      .query('journalEntries')
      .withIndex('by_owner_key_and_local_date_and_occurred_at', (q) =>
        q.eq('ownerKey', ownerKey).lte('localDate', args.throughDate),
      )
      .order('desc')
      .take(Math.min(MAX_TIMELINE_ENTRIES * 3, args.limit * 3))
    const views = await Promise.all(entries.map((entry) => entryView(ctx, entry)))
    return views.filter(hasContent).slice(0, args.limit)
  },
})

export const listDay = query({
  args: { localDate: v.string() },
  returns: v.array(journalEntryValidator),
  handler: async (ctx, args) => {
    validateLocalDate(args.localDate)
    const { ownerKey } = await requireIdentity(ctx)
    const entries = await ctx.db
      .query('journalEntries')
      .withIndex('by_owner_key_and_local_date_and_occurred_at', (q) =>
        q.eq('ownerKey', ownerKey).eq('localDate', args.localDate),
      )
      .order('desc')
      .collect()
    return (await Promise.all(entries.map((entry) => entryView(ctx, entry)))).filter(
      hasContent,
    )
  },
})

export const listMonth = query({
  args: { monthStart: v.string() },
  returns: v.array(monthDayValidator),
  handler: async (ctx, args) => {
    validateMonthStart(args.monthStart)
    const { ownerKey } = await requireIdentity(ctx)
    const entries = await ctx.db
      .query('journalEntries')
      .withIndex('by_owner_key_and_local_date_and_occurred_at', (q) =>
        q
          .eq('ownerKey', ownerKey)
          .gte('localDate', args.monthStart)
          .lt('localDate', nextMonthStart(args.monthStart)),
      )
      .collect()
    const views = (await Promise.all(entries.map((entry) => entryView(ctx, entry)))).filter(
      hasContent,
    )
    const days = new Map<string, { localDate: string; entryCount: number; hasPhoto: boolean }>()
    for (const entry of views) {
      const current = days.get(entry.localDate) ?? {
        localDate: entry.localDate,
        entryCount: 0,
        hasPhoto: false,
      }
      current.entryCount += 1
      current.hasPhoto ||= entry.attachmentCount > 0
      days.set(entry.localDate, current)
    }
    return [...days.values()].sort((left, right) => left.localDate.localeCompare(right.localDate))
  },
})

export const get = query({
  args: { entryId: v.id('journalEntries') },
  returns: v.union(journalEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const entry = await ctx.db.get('journalEntries', args.entryId)
    return entry?.ownerKey === ownerKey ? entryView(ctx, entry) : null
  },
})

export const search = query({
  args: { query: v.string() },
  returns: v.array(journalEntryValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const searchQuery = args.query.trim().slice(0, 500)
    if (!searchQuery) return []
    const entries = await ctx.db
      .query('journalEntries')
      .withSearchIndex('search_text', (q) =>
        q.search('searchText', searchQuery).eq('ownerKey', ownerKey),
      )
      .take(50)
    return Promise.all(entries.map((entry) => entryView(ctx, entry)))
  },
})

export const listPhotos = query({
  args: { entryId: v.id('journalEntries') },
  returns: v.array(photoValidator),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const entry = await ctx.db.get('journalEntries', args.entryId)
    if (!entry || entry.ownerKey !== ownerKey) return []
    const attachments = await ctx.db
      .query('journalAttachments')
      .withIndex('by_entry_id_and_created_at', (q) => q.eq('entryId', args.entryId))
      .order('asc')
      .collect()
    return (
      await Promise.all(attachments.map((attachment) => attachmentView(ctx, attachment)))
    ).filter((photo): photo is NonNullable<typeof photo> => photo !== null)
  },
})

export const generatePhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return ctx.storage.generateUploadUrl()
  },
})

export const addPhoto = mutation({
  args: {
    entryId: v.id('journalEntries'),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  returns: photoValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const entry = await ctx.db.get('journalEntries', args.entryId)
    if (!entry || entry.ownerKey !== identity.ownerKey) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Journal entry not found' })
    }
    validatePhotoMetadata(args)
    if (!(await ctx.storage.getUrl(args.storageId))) invalidArgument('Uploaded photo not found')
    const existing = await ctx.db
      .query('journalAttachments')
      .withIndex('by_entry_id_and_created_at', (q) => q.eq('entryId', args.entryId))
      .collect()
    if (existing.length >= MAX_PHOTOS) {
      invalidArgument(`An entry can have at most ${MAX_PHOTOS} photos`)
    }
    const attachmentId = await ctx.db.insert('journalAttachments', {
      ...identity,
      entryId: args.entryId,
      kind: 'photo',
      storageId: args.storageId,
      mimeType: args.mimeType,
      ...(args.fileName !== undefined ? { fileName: args.fileName.trim() } : {}),
      ...(args.width !== undefined ? { width: args.width } : {}),
      ...(args.height !== undefined ? { height: args.height } : {}),
      createdAt: Date.now(),
    })
    await ctx.db.patch('journalEntries', args.entryId, { updatedAt: Date.now() })
    const attachment = await ctx.db.get('journalAttachments', attachmentId)
    if (!attachment) throw new Error('Journal photo disappeared during creation')
    const view = await attachmentView(ctx, attachment)
    if (!view) throw new Error('Journal photo storage disappeared during creation')
    return view
  },
})

export const removePhoto = mutation({
  args: { attachmentId: v.id('journalAttachments') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const attachment = await ctx.db.get('journalAttachments', args.attachmentId)
    if (!attachment || attachment.ownerKey !== ownerKey) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Journal photo not found' })
    }
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete('journalAttachments', attachment._id)
    await ctx.db.patch('journalEntries', attachment.entryId, { updatedAt: Date.now() })
    return null
  },
})

export const remove = mutation({
  args: { entryId: v.id('journalEntries') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const entry = await ctx.db.get('journalEntries', args.entryId)
    if (!entry || entry.ownerKey !== ownerKey) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Journal entry not found' })
    }
    const attachments = await ctx.db
      .query('journalAttachments')
      .withIndex('by_entry_id_and_created_at', (q) => q.eq('entryId', args.entryId))
      .collect()
    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.storageId)
      await ctx.db.delete('journalAttachments', attachment._id)
    }
    await ctx.db.delete('journalEntries', args.entryId)
    return null
  },
})

export const importLegacy = mutation({
  args: {},
  returns: v.object({ imported: v.number() }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const legacyEntries = await ctx.db
      .query('healthJournalEntries')
      .withIndex('by_owner_key_and_local_date', (q) => q.eq('ownerKey', identity.ownerKey))
      .take(500)
    let imported = 0

    for (const legacy of legacyEntries) {
      const body = legacy.journal?.trim() ?? ''
      if (!body) continue
      const existing = await ctx.db
        .query('journalEntries')
        .withIndex('by_owner_key_and_legacy_local_date', (q) =>
          q.eq('ownerKey', identity.ownerKey).eq('legacyLocalDate', legacy.localDate),
        )
        .unique()
      if (existing) continue

      await ctx.db.insert('journalEntries', {
        ...identity,
        localDate: legacy.localDate,
        timeZone: legacy.timeZone,
        occurredAt: legacy.createdAt,
        title: '',
        body: legacy.journal ?? '',
        tags: [],
        searchText: legacy.journal ?? '',
        isPinned: false,
        isFavorite: false,
        legacyLocalDate: legacy.localDate,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      })
      imported += 1
    }

    return { imported }
  },
})
