import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'

const PROFILE_ORIGIN = 'https://bee.buddytools.org'
const MAX_DISPLAY_NAME_LENGTH = 60
const MAX_BIO_LENGTH = 180
const MAX_HANDLE_LENGTH = 30
const MIN_HANDLE_LENGTH = 2
const MAX_LINKS = 12
const MAX_LINK_LABEL_LENGTH = 40
const MAX_URL_LENGTH = 2_048
const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

const RESERVED_HANDLES = new Set([
  'about',
  'account',
  'admin',
  'api',
  'app',
  'bee',
  'beegreat',
  'developers',
  'help',
  'legal',
  'login',
  'logout',
  'p',
  'privacy',
  'profile',
  'report',
  'settings',
  'signin',
  'signup',
  'support',
  'tap',
  'terms',
  'www',
])

export const publicProfileProviderValidator = v.union(
  v.literal('instagram'),
  v.literal('linkedin'),
  v.literal('x'),
  v.literal('github'),
  v.literal('youtube'),
  v.literal('tiktok'),
  v.literal('facebook'),
  v.literal('website'),
  v.literal('other'),
)

const linkInputValidator = v.object({
  provider: publicProfileProviderValidator,
  label: v.string(),
  url: v.string(),
})

const publicLinkValidator = v.object({
  provider: publicProfileProviderValidator,
  label: v.string(),
  url: v.string(),
})

const profileResultValidator = v.object({
  handle: v.string(),
  displayName: v.string(),
  bio: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
  published: v.boolean(),
  profileUrl: v.string(),
  qrUrl: v.string(),
  links: v.array(publicLinkValidator),
  updatedAt: v.number(),
})

const publicResultValidator = v.union(v.null(), profileResultValidator)

type AuthContext = QueryCtx | MutationCtx
type Identity = { ownerKey: string; userId: string }
type LinkInput = {
  provider: Doc<'publicProfileLinks'>['provider']
  label: string
  url: string
}

async function requireIdentity(ctx: AuthContext): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to manage your public profile',
    })
  }
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject }
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: 'INVALID_ARGUMENT', message })
}

function normalizeText(value: string, field: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length === 0 || normalized.length > maxLength) {
    invalidArgument(`${field} must be between 1 and ${maxLength} characters`)
  }
  return normalized
}

function normalizeBio(value: string | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ')
  if (!normalized) return undefined
  if (normalized.length > MAX_BIO_LENGTH) {
    invalidArgument(`bio must be at most ${MAX_BIO_LENGTH} characters`)
  }
  return normalized
}

function handleCandidate(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .replace(/[-_]{2,}/g, '-')
    .slice(0, MAX_HANDLE_LENGTH)
}

function normalizeHandle(value: string) {
  const normalized = handleCandidate(value)
  if (
    normalized.length < MIN_HANDLE_LENGTH ||
    normalized.length > MAX_HANDLE_LENGTH ||
    !HANDLE_PATTERN.test(normalized)
  ) {
    invalidArgument(
      `handle must be ${MIN_HANDLE_LENGTH}–${MAX_HANDLE_LENGTH} letters, numbers, dashes, or underscores`,
    )
  }
  if (RESERVED_HANDLES.has(normalized)) {
    invalidArgument('That handle is reserved')
  }
  return normalized
}

function normalizeHttpsUrl(value: string, field: string) {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > MAX_URL_LENGTH) {
    invalidArgument(`${field} must be a valid HTTPS URL`)
  }
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    invalidArgument(`${field} must be a valid HTTPS URL`)
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    invalidArgument(`${field} must be a valid HTTPS URL`)
  }
  url.hash = ''
  return url.toString()
}

function normalizeAvatarUrl(value: string | undefined) {
  return value ? normalizeHttpsUrl(value, 'avatar') : undefined
}

function normalizeLinks(links: LinkInput[]) {
  if (links.length > MAX_LINKS) {
    invalidArgument(`profiles can contain at most ${MAX_LINKS} links`)
  }
  return links.map((link) => ({
    provider: link.provider,
    label: normalizeText(link.label, 'link label', MAX_LINK_LABEL_LENGTH),
    url: normalizeHttpsUrl(link.url, 'link'),
  }))
}

function randomPublicId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function profileUrl(handle: string) {
  return `${PROFILE_ORIGIN}/@${handle}`
}

function qrUrl(publicId: string) {
  return `${PROFILE_ORIGIN}/p/${publicId}`
}

async function handleOwner(ctx: AuthContext, handle: string) {
  const current = await ctx.db
    .query('publicProfiles')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .unique()
  if (current) return current._id
  const alias = await ctx.db
    .query('publicProfileAliases')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .unique()
  return alias?.profileId ?? null
}

async function availableHandle(
  ctx: MutationCtx,
  suggestion: string | undefined,
  publicId: string,
) {
  const rawBase = handleCandidate(suggestion ?? '') || 'beekeeper'
  const base = RESERVED_HANDLES.has(rawBase) ? 'beekeeper' : rawBase
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = `${base.slice(0, MAX_HANDLE_LENGTH - suffix.length)}${suffix}`
    if (
      candidate.length >= MIN_HANDLE_LENGTH &&
      HANDLE_PATTERN.test(candidate) &&
      !(await handleOwner(ctx, candidate))
    ) {
      return candidate
    }
  }
  return `bee-${publicId.slice(0, 10)}`
}

async function uniquePublicId(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const publicId = randomPublicId()
    const existing = await ctx.db
      .query('publicProfiles')
      .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
      .unique()
    if (!existing) return publicId
  }
  throw new ConvexError({
    code: 'UNAVAILABLE',
    message: 'Could not create a public profile. Try again.',
  })
}

async function profileLinks(ctx: AuthContext, profileId: Id<'publicProfiles'>) {
  return await ctx.db
    .query('publicProfileLinks')
    .withIndex('by_profile_id_and_position', (q) => q.eq('profileId', profileId))
    .take(MAX_LINKS)
}

async function resultForProfile(ctx: AuthContext, profile: Doc<'publicProfiles'>) {
  const links = await profileLinks(ctx, profile._id)
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    published: profile.published,
    profileUrl: profileUrl(profile.handle),
    qrUrl: qrUrl(profile.publicId),
    links: links.map(({ provider, label, url }) => ({ provider, label, url })),
    updatedAt: profile.updatedAt,
  }
}

async function createProfile(
  ctx: MutationCtx,
  identity: Identity,
  input: { displayName: string; suggestedHandle?: string; avatarUrl?: string },
) {
  const publicId = await uniquePublicId(ctx)
  const handle = await availableHandle(ctx, input.suggestedHandle, publicId)
  const now = Date.now()
  const profileId = await ctx.db.insert('publicProfiles', {
    ownerKey: identity.ownerKey,
    userId: identity.userId,
    publicId,
    handle,
    displayName: normalizeText(
      input.displayName,
      'display name',
      MAX_DISPLAY_NAME_LENGTH,
    ),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    published: false,
    createdAt: now,
    updatedAt: now,
  })
  return (await ctx.db.get('publicProfiles', profileId))!
}

export const mine = query({
  args: {},
  returns: publicResultValidator,
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    const profile = await ctx.db
      .query('publicProfiles')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique()
    return profile ? await resultForProfile(ctx, profile) : null
  },
})

export const ensureMine = mutation({
  args: {
    displayName: v.string(),
    suggestedHandle: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('publicProfiles')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
      .unique()
    const profile = existing ?? (await createProfile(ctx, identity, args))
    return await resultForProfile(ctx, profile)
  },
})

export const saveMine = mutation({
  args: {
    handle: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    published: v.boolean(),
    links: v.array(linkInputValidator),
  },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('publicProfiles')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
      .unique()
    const requestedHandle = normalizeHandle(args.handle)
    const displayName = normalizeText(
      args.displayName,
      'display name',
      MAX_DISPLAY_NAME_LENGTH,
    )
    const bio = normalizeBio(args.bio)
    const avatarUrl = normalizeAvatarUrl(args.avatarUrl)
    const links = normalizeLinks(args.links)
    const profile =
      existing ??
      (await createProfile(ctx, identity, {
        displayName,
        suggestedHandle: requestedHandle,
        avatarUrl,
      }))

    const owner = await handleOwner(ctx, requestedHandle)
    if (owner && owner !== profile._id) {
      throw new ConvexError({
        code: 'HANDLE_UNAVAILABLE',
        message: 'That handle is already taken',
      })
    }

    const now = Date.now()
    if (profile.handle !== requestedHandle) {
      const existingAlias = await ctx.db
        .query('publicProfileAliases')
        .withIndex('by_handle', (q) => q.eq('handle', profile.handle))
        .unique()
      if (!existingAlias) {
        await ctx.db.insert('publicProfileAliases', {
          ownerKey: identity.ownerKey,
          profileId: profile._id,
          handle: profile.handle,
          createdAt: now,
        })
      }
    }

    const oldLinks = await profileLinks(ctx, profile._id)
    for (const link of oldLinks) await ctx.db.delete(link._id)
    for (const [position, link] of links.entries()) {
      await ctx.db.insert('publicProfileLinks', {
        ownerKey: identity.ownerKey,
        profileId: profile._id,
        ...link,
        position,
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.patch('publicProfiles', profile._id, {
      handle: requestedHandle,
      displayName,
      bio,
      avatarUrl,
      published: args.published,
      updatedAt: now,
    })
    return await resultForProfile(
      ctx,
      (await ctx.db.get('publicProfiles', profile._id))!,
    )
  },
})

export const byHandle = query({
  args: { handle: v.string() },
  returns: publicResultValidator,
  handler: async (ctx, args) => {
    const handle = handleCandidate(args.handle)
    if (!handle || !HANDLE_PATTERN.test(handle)) return null
    let profile = await ctx.db
      .query('publicProfiles')
      .withIndex('by_handle', (q) => q.eq('handle', handle))
      .unique()
    if (!profile) {
      const alias = await ctx.db
        .query('publicProfileAliases')
        .withIndex('by_handle', (q) => q.eq('handle', handle))
        .unique()
      profile = alias ? await ctx.db.get('publicProfiles', alias.profileId) : null
    }
    if (!profile?.published) return null
    return await resultForProfile(ctx, profile)
  },
})

export const byPublicId = query({
  args: { publicId: v.string() },
  returns: publicResultValidator,
  handler: async (ctx, args) => {
    if (!PUBLIC_ID_PATTERN.test(args.publicId)) return null
    const profile = await ctx.db
      .query('publicProfiles')
      .withIndex('by_public_id', (q) => q.eq('publicId', args.publicId))
      .unique()
    if (!profile?.published) return null
    return await resultForProfile(ctx, profile)
  },
})
