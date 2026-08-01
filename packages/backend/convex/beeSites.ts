import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'

const SITES_ORIGIN = 'https://sites.buddytools.org'
const MAX_TITLE_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 240
const MAX_SLUG_LENGTH = 48
const MIN_SLUG_LENGTH = 2
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const VERSION_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/
const MAX_FILES_PER_SITE = 100
const FREE_MAX_BYTES = 10 * 1024 * 1024
const PRO_MAX_BYTES = 50 * 1024 * 1024
const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1_000

const FREE_LIMITS = {
  tier: 'free' as const,
  sites: 1,
  pagesPerSite: 5,
  generationsPerMonth: 15,
  publishesPerMonth: 20,
}

const PRO_LIMITS = {
  tier: 'pro' as const,
  sites: 5,
  pagesPerSite: 25,
  generationsPerMonth: 100,
  publishesPerMonth: 200,
}

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'beegreat',
  'help',
  'preview',
  'privacy',
  'report',
  'support',
  'terms',
  'www',
])

const limitsValidator = v.object({
  tier: v.union(v.literal('free'), v.literal('pro')),
  sites: v.number(),
  pagesPerSite: v.number(),
  generationsPerMonth: v.number(),
  publishesPerMonth: v.number(),
})

const siteStatusValidator = v.union(
  v.literal('draft'),
  v.literal('published'),
  v.literal('unpublished'),
  v.literal('suspended'),
)

const siteResultValidator = v.object({
  siteId: v.id('beeSites'),
  slug: v.string(),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  status: siteStatusValidator,
  pageCount: v.number(),
  publicUrl: v.string(),
  updatedAt: v.number(),
  limits: limitsValidator,
})

const creatorSiteResultValidator = v.object({
  siteId: v.id('beeSites'),
  slug: v.string(),
  title: v.string(),
  status: siteStatusValidator,
  publicUrl: v.string(),
  limits: limitsValidator,
  generationRemaining: v.number(),
})

const agentSiteResultValidator = v.object({
  siteId: v.id('beeSites'),
  slug: v.string(),
  title: v.string(),
  status: siteStatusValidator,
  pageCount: v.number(),
  publicUrl: v.string(),
})

type AuthContext = QueryCtx | MutationCtx

async function requireUserId(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to manage Bee Sites',
    })
  }
  return identity.subject
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: 'INVALID_ARGUMENT', message })
}

function normalizeTitle(value: string) {
  const title = value.trim().replace(/\s+/g, ' ')
  if (!title || title.length > MAX_TITLE_LENGTH) {
    invalidArgument(`Site title must be between 1 and ${MAX_TITLE_LENGTH} characters`)
  }
  return title
}

function normalizeDescription(value: string | undefined) {
  const description = value?.trim().replace(/\s+/g, ' ')
  if (!description) return undefined
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    invalidArgument(
      `Site description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    )
  }
  return description
}

function slugCandidate(value: string) {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
}

function normalizeSlug(value: string) {
  const slug = slugCandidate(value)
  if (
    slug.length < MIN_SLUG_LENGTH ||
    !SLUG_PATTERN.test(slug) ||
    RESERVED_SLUGS.has(slug)
  ) {
    invalidArgument('Choose a different site address')
  }
  return slug
}

function publicUrl(slug: string) {
  return `${SITES_ORIGIN}/${slug}`
}

function resultForSite(
  site: Doc<'beeSites'>,
  limits: typeof FREE_LIMITS | typeof PRO_LIMITS,
) {
  return {
    siteId: site._id,
    slug: site.slug,
    title: site.title,
    description: site.description ?? null,
    status: site.status,
    pageCount: site.pageCount,
    publicUrl: publicUrl(site.slug),
    updatedAt: site.updatedAt,
    limits,
  }
}

async function limitsForUser(ctx: AuthContext, userId: string) {
  const entitlements = await ctx.db
    .query('subscriptionEntitlements')
    .withIndex('by_user_and_entitlement', (q) =>
      q.eq('userId', userId).eq('entitlementId', 'pro'),
    )
    .take(10)
  const now = Date.now()
  return entitlements.some(
    (entitlement) =>
      entitlement.active &&
      entitlement.productId === 'com.beegreat.app.pro.monthly' &&
      entitlement.expiresAt > now,
  )
    ? PRO_LIMITS
    : FREE_LIMITS
}

async function availableSlug(ctx: MutationCtx, suggestion: string) {
  const rawBase = slugCandidate(suggestion)
  const base =
    rawBase.length >= MIN_SLUG_LENGTH && !RESERVED_SLUGS.has(rawBase)
      ? rawBase
      : 'bee-site'
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffix.length)}${suffix}`
    if (
      candidate.length >= MIN_SLUG_LENGTH &&
      SLUG_PATTERN.test(candidate) &&
      !(await ctx.db
        .query('beeSites')
        .withIndex('by_slug', (q) => q.eq('slug', candidate))
        .unique())
    ) {
      return candidate
    }
  }
  throw new ConvexError({
    code: 'SLUG_UNAVAILABLE',
    message: 'Could not reserve that site address. Try another name.',
  })
}

async function requireOwnedSite(
  ctx: MutationCtx,
  userId: string,
  siteId: Doc<'beeSites'>['_id'],
) {
  const site = await ctx.db.get('beeSites', siteId)
  if (!site || site.userId !== userId) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: "You can't manage another user's Bee Site",
    })
  }
  return site
}

function currentMonthKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 7)
}

async function usageForUser(ctx: MutationCtx, userId: string) {
  const monthKey = currentMonthKey()
  const usage = await ctx.db
    .query('beeSiteUsage')
    .withIndex('by_user_id_and_month_key', (q) =>
      q.eq('userId', userId).eq('monthKey', monthKey),
    )
    .unique()
  return { monthKey, usage }
}

async function createSiteForUser(
  ctx: MutationCtx,
  userId: string,
  titleInput: string,
  suggestedSlug: string | undefined,
  limits: typeof FREE_LIMITS | typeof PRO_LIMITS,
) {
  const existing = await ctx.db
    .query('beeSites')
    .withIndex('by_user_id_and_updated_at', (q) => q.eq('userId', userId))
    .take(limits.sites + 1)
  if (existing.length >= limits.sites) {
    throw new ConvexError({
      code: 'SITE_LIMIT_REACHED',
      message:
        limits.tier === 'pro'
          ? `Pro accounts can publish up to ${limits.sites} Bee Sites`
          : 'Free accounts can publish one Bee Site',
    })
  }
  const title = normalizeTitle(titleInput)
  const slug = await availableSlug(ctx, suggestedSlug ?? title)
  const now = Date.now()
  const siteId = await ctx.db.insert('beeSites', {
    userId,
    slug,
    title,
    status: 'draft',
    pageCount: 0,
    createdAt: now,
    updatedAt: now,
  })
  return (await ctx.db.get('beeSites', siteId))!
}

export const create = mutation({
  args: {
    title: v.string(),
    suggestedSlug: v.optional(v.string()),
  },
  returns: siteResultValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const limits = await limitsForUser(ctx, userId)
    const site = await createSiteForUser(
      ctx,
      userId,
      args.title,
      args.suggestedSlug,
      limits,
    )
    return resultForSite(site, limits)
  },
})

export const listMine = query({
  args: {},
  returns: v.object({
    sites: v.array(siteResultValidator),
    limits: limitsValidator,
  }),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const limits = await limitsForUser(ctx, userId)
    const sites = await ctx.db
      .query('beeSites')
      .withIndex('by_user_id_and_updated_at', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limits.sites)
    return {
      sites: sites.map((site) => resultForSite(site, limits)),
      limits,
    }
  },
})

export const publicBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      description: v.union(v.string(), v.null()),
      version: v.string(),
      assetPrefix: v.string(),
      publicUrl: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const slug = slugCandidate(args.slug)
    if (!slug || slug !== args.slug || !SLUG_PATTERN.test(slug)) return null
    const site = await ctx.db
      .query('beeSites')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (
      !site ||
      site.status !== 'published' ||
      !site.activeDeploymentId
    ) {
      return null
    }
    const deployment = await ctx.db.get(
      'beeSiteDeployments',
      site.activeDeploymentId,
    )
    if (
      !deployment ||
      deployment.status !== 'ready' ||
      deployment.kind !== 'production' ||
      !deployment.manifestKey
    ) {
      return null
    }
    return {
      title: site.title,
      description: site.description ?? null,
      version: deployment.version,
      assetPrefix: deployment.manifestKey,
      publicUrl: publicUrl(site.slug),
    }
  },
})

export const publicPreviewByVersion = query({
  args: { version: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      assetPrefix: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!VERSION_PATTERN.test(args.version)) return null
    const deployment = await ctx.db
      .query('beeSiteDeployments')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .unique()
    if (
      !deployment ||
      deployment.kind !== 'preview' ||
      deployment.status !== 'ready' ||
      !deployment.expiresAt ||
      deployment.expiresAt <= Date.now() ||
      !deployment.manifestKey
    ) {
      return null
    }
    return { assetPrefix: deployment.manifestKey }
  },
})

export const save = mutation({
  args: {
    siteId: v.id('beeSites'),
    title: v.string(),
    description: v.optional(v.string()),
    slug: v.string(),
  },
  returns: siteResultValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const site = await requireOwnedSite(ctx, userId, args.siteId)
    const title = normalizeTitle(args.title)
    const description = normalizeDescription(args.description)
    const slug = normalizeSlug(args.slug)
    const slugOwner = await ctx.db
      .query('beeSites')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (slugOwner && slugOwner._id !== site._id) {
      throw new ConvexError({
        code: 'SLUG_UNAVAILABLE',
        message: 'That site address is already taken',
      })
    }
    await ctx.db.patch(site._id, {
      title,
      description,
      slug,
      updatedAt: Date.now(),
    })
    const limits = await limitsForUser(ctx, userId)
    return resultForSite((await ctx.db.get('beeSites', site._id))!, limits)
  },
})

export const unpublish = mutation({
  args: { siteId: v.id('beeSites') },
  returns: siteResultValidator,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const site = await requireOwnedSite(ctx, userId, args.siteId)
    if (site.status !== 'suspended') {
      await ctx.db.patch(site._id, {
        status: 'unpublished',
        updatedAt: Date.now(),
      })
    }
    const limits = await limitsForUser(ctx, userId)
    return resultForSite((await ctx.db.get('beeSites', site._id))!, limits)
  },
})

export const prepareForAgent = internalMutation({
  args: {
    userId: v.string(),
    siteId: v.optional(v.id('beeSites')),
    title: v.string(),
    suggestedSlug: v.optional(v.string()),
  },
  returns: creatorSiteResultValidator,
  handler: async (ctx, args) => {
    const limits = await limitsForUser(ctx, args.userId)
    const { monthKey, usage } = await usageForUser(ctx, args.userId)
    const generationCount = usage?.generationCount ?? 0
    if (generationCount >= limits.generationsPerMonth) {
      throw new ConvexError({
        code: 'GENERATION_LIMIT_REACHED',
        message: 'Monthly Bee Site generation limit reached',
      })
    }

    let site: Doc<'beeSites'> | null = null
    if (args.siteId) {
      site = await ctx.db.get('beeSites', args.siteId)
      if (!site || site.userId !== args.userId) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: "You can't manage another user's Bee Site",
        })
      }
    } else {
      site = await ctx.db
        .query('beeSites')
        .withIndex('by_user_id_and_updated_at', (q) =>
          q.eq('userId', args.userId),
        )
        .order('desc')
        .first()
    }
    site ??= await createSiteForUser(
      ctx,
      args.userId,
      args.title,
      args.suggestedSlug,
      limits,
    )

    const now = Date.now()
    if (usage) {
      await ctx.db.patch(usage._id, {
        generationCount: generationCount + 1,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('beeSiteUsage', {
        userId: args.userId,
        monthKey,
        generationCount: 1,
        publishCount: 0,
        updatedAt: now,
      })
    }

    return {
      siteId: site._id,
      slug: site.slug,
      title: site.title,
      status: site.status,
      publicUrl: publicUrl(site.slug),
      limits,
      generationRemaining: limits.generationsPerMonth - generationCount - 1,
    }
  },
})

export const listForAgent = internalQuery({
  args: { userId: v.string() },
  returns: v.array(agentSiteResultValidator),
  handler: async (ctx, args) => {
    const limits = await limitsForUser(ctx, args.userId)
    const sites = await ctx.db
      .query('beeSites')
      .withIndex('by_user_id_and_updated_at', (q) =>
        q.eq('userId', args.userId),
      )
      .order('desc')
      .take(limits.sites)
    return sites.map((site) => ({
      siteId: site._id,
      slug: site.slug,
      title: site.title,
      status: site.status,
      pageCount: site.pageCount,
      publicUrl: publicUrl(site.slug),
    }))
  },
})

export const beginDeployment = internalMutation({
  args: {
    userId: v.string(),
    siteId: v.id('beeSites'),
    version: v.string(),
    kind: v.union(v.literal('preview'), v.literal('production')),
    pageCount: v.number(),
    fileCount: v.number(),
    totalBytes: v.number(),
  },
  returns: v.object({
    deploymentId: v.id('beeSiteDeployments'),
    version: v.string(),
    slug: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const site = await requireOwnedSite(ctx, args.userId, args.siteId)
    const limits = await limitsForUser(ctx, args.userId)
    if (!VERSION_PATTERN.test(args.version)) {
      invalidArgument('Invalid Bee Site deployment version')
    }
    if (
      !Number.isInteger(args.pageCount) ||
      args.pageCount < 1 ||
      args.pageCount > limits.pagesPerSite
    ) {
      throw new ConvexError({
        code: 'PAGE_LIMIT_REACHED',
        message: `${limits.tier === 'pro' ? 'Pro' : 'Free'} Bee Sites can contain up to ${limits.pagesPerSite} pages`,
      })
    }
    if (
      !Number.isInteger(args.fileCount) ||
      args.fileCount < args.pageCount ||
      args.fileCount > MAX_FILES_PER_SITE
    ) {
      invalidArgument(`Bee Sites can contain up to ${MAX_FILES_PER_SITE} files`)
    }
    const maxBytes = limits.tier === 'pro' ? PRO_MAX_BYTES : FREE_MAX_BYTES
    if (
      !Number.isInteger(args.totalBytes) ||
      args.totalBytes < 1 ||
      args.totalBytes > maxBytes
    ) {
      invalidArgument(
        `Bee Site output must be smaller than ${maxBytes / 1024 / 1024} MB`,
      )
    }
    const duplicate = await ctx.db
      .query('beeSiteDeployments')
      .withIndex('by_version', (q) => q.eq('version', args.version))
      .unique()
    if (duplicate) {
      throw new ConvexError({
        code: 'DUPLICATE_DEPLOYMENT',
        message: 'That Bee Site deployment already exists',
      })
    }

    if (args.kind === 'production') {
      const { monthKey, usage } = await usageForUser(ctx, args.userId)
      const publishCount = usage?.publishCount ?? 0
      if (publishCount >= limits.publishesPerMonth) {
        throw new ConvexError({
          code: 'PUBLISH_LIMIT_REACHED',
          message: 'Monthly Bee Site publish limit reached',
        })
      }
      const now = Date.now()
      if (usage) {
        await ctx.db.patch(usage._id, {
          publishCount: publishCount + 1,
          updatedAt: now,
        })
      } else {
        await ctx.db.insert('beeSiteUsage', {
          userId: args.userId,
          monthKey,
          generationCount: 0,
          publishCount: 1,
          updatedAt: now,
        })
      }
    }

    const deploymentId = await ctx.db.insert('beeSiteDeployments', {
      userId: args.userId,
      siteId: site._id,
      version: args.version,
      kind: args.kind,
      status: 'uploading',
      pageCount: args.pageCount,
      fileCount: args.fileCount,
      totalBytes: args.totalBytes,
      ...(args.kind === 'preview'
        ? { expiresAt: Date.now() + PREVIEW_TTL_MS }
        : {}),
      createdAt: Date.now(),
    })
    return {
      deploymentId,
      version: args.version,
      slug: site.slug,
      publicUrl: publicUrl(site.slug),
    }
  },
})

export const completeDeployment = internalMutation({
  args: {
    userId: v.string(),
    deploymentId: v.id('beeSiteDeployments'),
    manifestKey: v.string(),
  },
  returns: siteResultValidator,
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get('beeSiteDeployments', args.deploymentId)
    if (!deployment || deployment.userId !== args.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: "You can't manage another user's Bee Site",
      })
    }
    if (deployment.status !== 'uploading') {
      throw new ConvexError({
        code: 'INVALID_DEPLOYMENT_STATE',
        message: 'Bee Site deployment is not awaiting completion',
      })
    }
    const expectedManifestKey = `users/${args.userId}/sites/${deployment.siteId}/deployments/${deployment.version}/`
    if (args.manifestKey !== expectedManifestKey) {
      invalidArgument('Invalid Bee Site asset location')
    }
    const site = await requireOwnedSite(ctx, args.userId, deployment.siteId)
    const now = Date.now()
    await ctx.db.patch(deployment._id, {
      status: 'ready',
      manifestKey: args.manifestKey,
      completedAt: now,
    })
    if (deployment.kind === 'production') {
      await ctx.db.patch(site._id, {
        status: 'published',
        pageCount: deployment.pageCount,
        activeDeploymentId: deployment._id,
        publishedAt: now,
        updatedAt: now,
      })
    }
    const limits = await limitsForUser(ctx, args.userId)
    return resultForSite((await ctx.db.get('beeSites', site._id))!, limits)
  },
})

export const failDeployment = internalMutation({
  args: {
    userId: v.string(),
    deploymentId: v.id('beeSiteDeployments'),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get('beeSiteDeployments', args.deploymentId)
    if (!deployment || deployment.userId !== args.userId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: "You can't manage another user's Bee Site",
      })
    }
    if (deployment.status === 'uploading') {
      await ctx.db.patch(deployment._id, {
        status: 'failed',
        error: args.error.trim().slice(0, 300) || 'Deployment failed',
        completedAt: Date.now(),
      })
    }
    return null
  },
})
