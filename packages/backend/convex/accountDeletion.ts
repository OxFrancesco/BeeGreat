import { ConvexError, v } from 'convex/values'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import { internal } from './_generated/api'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, internalQuery, mutation } from './_generated/server'
import {
  beennectorProviderValidator,
  encryptedSecretValidator as beennectorEncryptedSecretValidator,
} from './beennectorValidators'
import {
  removeOwnerCrawlRunsBatch,
  removeOwnerWebsiteCacheBatch,
} from './bookmarkCrawl'
import { encryptedSecretValidator as healthEncryptedSecretValidator } from './googleHealthValidators'

// Ten documents keeps the mutation comfortably below Convex's 16 MiB
// transaction ceiling even when a Bookmark or message approaches the per-
// document size limit. It is also far below the 16,000 write ceiling.
const BATCH_SIZE = 10
const AWAITING_IDENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1_000
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000
const TOMBSTONE_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1_000
const STALLED_JOB_MS = 15 * 60 * 1_000
const WATCHDOG_BATCH_SIZE = 50

const activeStatusValidator = v.union(
  v.literal('awaiting_identity_deletion'),
  v.literal('external_cleanup'),
  v.literal('purging'),
  v.literal('tombstoned'),
)

type ActiveStatus =
  'awaiting_identity_deletion' | 'external_cleanup' | 'purging' | 'tombstoned'

// Each scheduled mutation visits exactly one stage and deletes at most one
// batch. References and child records precede their parent records.
const DATA_STAGES = [
  'subscriptionEntitlements',
  'subscriptionStatusChecks',
  'memorySourceLinks',
  'memoryRevisions',
  'memories',
  'chatMessages',
  'agentJobRuns',
  'agentJobGrants',
  'agentJobs',
  'chatThreads',
  'chatPreferences',
  'userPreferences',
  'publicProfileLinks',
  'publicProfileAliases',
  'publicProfiles',
  'highlights',
  'honeyLedgerEntries',
  'firstFocusBundles',
  'goalEconomyStats',
  'verifiedProgressEvents',
  'honeyEconomyEntries',
  'royalJellyLedgerEntries',
  'economyCommandReceipts',
  'weeklyProgressRosters',
  'achievementUnlocks',
  'achievementBackfillStates',
  'boosterActivations',
  'anonymizedEconomyEvents',
  'recurrenceSchedules',
  'bookmarkCrawlRuns',
  'bookmarkCrawlCache',
  'bookmarks',
  'chatgptAuthSessions',
  'chatgptCredentials',
  'chatgptGatePreferences',
  'googleHealthAuthSessions',
  'googleHealthCredentials',
  'telegramAuthSessions',
  'telegramConnections',
  'imessageLinkSessions',
  'imessageDeliveries',
  'imessageConnections',
  'journalAttachments',
  'journalEntries',
  'healthJournalEntries',
  'nfcActionExecutions',
  'nfcActions',
  'beennectorAuthSessions',
  'beennectorCredentials',
  'beennectorDeliveries',
  'powerups',
  'devinSessions',
  'beeSiteDeployments',
  'beeSiteUsage',
  'beeSites',
  'wallets',
  'web3Actions',
  'tasks',
  'projects',
  'golieBees',
  'goals',
  'hives',
] as const

// This enumerates every user-data stage in schema.ts. The crawl-cache stage
// removes only owner-scoped websites; public tweet/video artifacts contain no
// account identity. `posts` and privacy-minimized provider metadata are global;
// `accountDeletionJobs` retains only a bounded safety-sweep tombstone.
//
// BeeGreat production has one fixed Clerk issuer. Legacy tables and RevenueCat
// App User IDs store only that issuer's Clerk subject, so subject-keyed stages
// deliberately erase every matching row. Supporting multiple Clerk issuers
// would require migrating those tables to ownerKey before enabling that issuer.

type DataStage = (typeof DATA_STAGES)[number]

async function removeDocuments<TableName extends TableNames>(
  ctx: MutationCtx,
  documents: Doc<TableName>[],
) {
  for (const document of documents) {
    await ctx.db.delete(document._id)
  }
  return documents.length
}

// The eraser is data-driven end to end: DATA_STAGES fixes the deletion order
// and STAGE_REMOVERS supplies one remover per stage. Keying the Record by
// DataStage makes a missing (or extra) entry a compile error.
type StageRemover = (
  ctx: MutationCtx,
  ownerKey: string,
  userId: string,
) => Promise<number>

// Standard stages differ only in their table and owner-scoped index. Each
// entry builds the index-scoped query — keeping `withIndex` fully typed per
// table — while this shared driver applies take(BATCH_SIZE) and deletes.
// Genuinely special stages (storage cascades, shared batch helpers) stay as
// explicit custom removers below.
function removesBatch(
  buildQuery: (
    ctx: MutationCtx,
    ownerKey: string,
    userId: string,
  ) => { take(count: number): Promise<Doc<TableNames>[]> },
): StageRemover {
  return async (ctx, ownerKey, userId) =>
    removeDocuments<TableNames>(
      ctx,
      await buildQuery(ctx, ownerKey, userId).take(BATCH_SIZE),
    )
}

const STAGE_REMOVERS = {
  subscriptionEntitlements: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('subscriptionEntitlements').withIndex('by_user_and_entitlement', (q) => q.eq('userId', userId))),
  subscriptionStatusChecks: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('subscriptionStatusChecks').withIndex('by_user', (q) => q.eq('userId', userId))),
  memorySourceLinks: removesBatch((ctx, ownerKey) => ctx.db.query('memorySourceLinks').withIndex('by_owner_key_and_derived_memory_id', (q) => q.eq('ownerKey', ownerKey))),
  memoryRevisions: removesBatch((ctx, ownerKey) => ctx.db.query('memoryRevisions').withIndex('by_owner_key_and_memory_id_and_revision', (q) => q.eq('ownerKey', ownerKey))),
  memories: removesBatch((ctx, ownerKey) => ctx.db.query('memories').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  chatMessages: removesBatch((ctx, ownerKey) => ctx.db.query('chatMessages').withIndex('by_owner_key_and_thread_id_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  imessageDeliveries: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('imessageDeliveries').withIndex('by_user', (q) => q.eq('userId', userId))),
  agentJobRuns: removesBatch((ctx, ownerKey) => ctx.db.query('agentJobRuns').withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  agentJobGrants: removesBatch((ctx, ownerKey) => ctx.db.query('agentJobGrants').withIndex('by_owner_key_and_requested_at', (q) => q.eq('ownerKey', ownerKey))),
  agentJobs: removesBatch((ctx, ownerKey) => ctx.db.query('agentJobs').withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  chatThreads: removesBatch((ctx, ownerKey) => ctx.db.query('chatThreads').withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  chatPreferences: removesBatch((ctx, ownerKey) => ctx.db.query('chatPreferences').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  userPreferences: removesBatch((ctx, ownerKey) => ctx.db.query('userPreferences').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  publicProfileLinks: removesBatch((ctx, ownerKey) => ctx.db.query('publicProfileLinks').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  publicProfileAliases: removesBatch((ctx, ownerKey) => ctx.db.query('publicProfileAliases').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  publicProfiles: removesBatch((ctx, ownerKey) => ctx.db.query('publicProfiles').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  highlights: removesBatch((ctx, ownerKey) => ctx.db.query('highlights').withIndex('by_owner_key_and_status', (q) => q.eq('ownerKey', ownerKey))),
  honeyLedgerEntries: removesBatch((ctx, ownerKey) => ctx.db.query('honeyLedgerEntries').withIndex('by_owner_key_and_goal_id', (q) => q.eq('ownerKey', ownerKey))),
  firstFocusBundles: removesBatch((ctx, ownerKey) => ctx.db.query('firstFocusBundles').withIndex('by_owner_key_and_request_id', (q) => q.eq('ownerKey', ownerKey))),
  goalEconomyStats: removesBatch((ctx, ownerKey) => ctx.db.query('goalEconomyStats').withIndex('by_owner_key_and_goal_id', (q) => q.eq('ownerKey', ownerKey))),
  verifiedProgressEvents: removesBatch((ctx, ownerKey) => ctx.db.query('verifiedProgressEvents').withIndex('by_owner_key_and_occurred_at', (q) => q.eq('ownerKey', ownerKey))),
  honeyEconomyEntries: removesBatch((ctx, ownerKey) => ctx.db.query('honeyEconomyEntries').withIndex('by_owner_key_and_occurred_at', (q) => q.eq('ownerKey', ownerKey))),
  royalJellyLedgerEntries: removesBatch((ctx, ownerKey) => ctx.db.query('royalJellyLedgerEntries').withIndex('by_owner_key_and_occurred_at', (q) => q.eq('ownerKey', ownerKey))),
  economyCommandReceipts: removesBatch((ctx, ownerKey) => ctx.db.query('economyCommandReceipts').withIndex('by_owner_key_and_request_id', (q) => q.eq('ownerKey', ownerKey))),
  weeklyProgressRosters: removesBatch((ctx, ownerKey) => ctx.db.query('weeklyProgressRosters').withIndex('by_owner_key_and_started_at', (q) => q.eq('ownerKey', ownerKey))),
  achievementUnlocks: removesBatch((ctx, ownerKey) => ctx.db.query('achievementUnlocks').withIndex('by_owner_key_and_unlocked_at', (q) => q.eq('ownerKey', ownerKey))),
  achievementBackfillStates: removesBatch((ctx, ownerKey) => ctx.db.query('achievementBackfillStates').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
  boosterActivations: removesBatch((ctx, ownerKey) => ctx.db.query('boosterActivations').withIndex('by_owner_key_and_kind_and_expires_at', (q) => q.eq('ownerKey', ownerKey))),
  anonymizedEconomyEvents: removesBatch((ctx, ownerKey) => ctx.db.query('anonymizedEconomyEvents').withIndex('by_owner_key_and_occurred_at', (q) => q.eq('ownerKey', ownerKey))),
  recurrenceSchedules: removesBatch((ctx, ownerKey) => ctx.db.query('recurrenceSchedules').withIndex('by_owner_key_and_active', (q) => q.eq('ownerKey', ownerKey))),
  // The bookmark-crawl module owns these batch helpers and their cascades.
  bookmarkCrawlRuns: (ctx, ownerKey) =>
    removeOwnerCrawlRunsBatch(ctx, ownerKey, BATCH_SIZE),
  bookmarkCrawlCache: (ctx, ownerKey) =>
    removeOwnerWebsiteCacheBatch(ctx, ownerKey, BATCH_SIZE),
  bookmarks: removesBatch((ctx, ownerKey) => ctx.db.query('bookmarks').withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  chatgptAuthSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('chatgptAuthSessions').withIndex('by_user', (q) => q.eq('userId', userId))),
  chatgptCredentials: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('chatgptCredentials').withIndex('by_user', (q) => q.eq('userId', userId))),
  chatgptGatePreferences: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('chatgptGatePreferences').withIndex('by_user', (q) => q.eq('userId', userId))),
  googleHealthAuthSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('googleHealthAuthSessions').withIndex('by_user', (q) => q.eq('userId', userId))),
  googleHealthCredentials: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('googleHealthCredentials').withIndex('by_user', (q) => q.eq('userId', userId))),
  telegramAuthSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('telegramAuthSessions').withIndex('by_user', (q) => q.eq('userId', userId))),
  telegramConnections: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('telegramConnections').withIndex('by_user', (q) => q.eq('userId', userId))),
  imessageLinkSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('imessageLinkSessions').withIndex('by_user', (q) => q.eq('userId', userId))),
  imessageConnections: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('imessageConnections').withIndex('by_user', (q) => q.eq('userId', userId))),
  // Cascades beyond the row: each attachment's stored blob is deleted too.
  journalAttachments: async (ctx, ownerKey) => {
    const attachments = await ctx.db
      .query('journalAttachments')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .take(BATCH_SIZE)
    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.storageId)
      await ctx.db.delete(attachment._id)
    }
    return attachments.length
  },
  journalEntries: removesBatch((ctx, ownerKey) => ctx.db.query('journalEntries').withIndex('by_owner_key_and_local_date_and_occurred_at', (q) => q.eq('ownerKey', ownerKey))),
  healthJournalEntries: removesBatch((ctx, ownerKey) => ctx.db.query('healthJournalEntries').withIndex('by_owner_key_and_local_date', (q) => q.eq('ownerKey', ownerKey))),
  nfcActionExecutions: removesBatch((ctx, ownerKey) => ctx.db.query('nfcActionExecutions').withIndex('by_owner_key_and_executed_at', (q) => q.eq('ownerKey', ownerKey))),
  nfcActions: removesBatch((ctx, ownerKey) => ctx.db.query('nfcActions').withIndex('by_owner_key_and_created_at', (q) => q.eq('ownerKey', ownerKey))),
  beennectorAuthSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beennectorAuthSessions').withIndex('by_user_and_provider', (q) => q.eq('userId', userId))),
  beennectorCredentials: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beennectorCredentials').withIndex('by_user_and_provider', (q) => q.eq('userId', userId))),
  beennectorDeliveries: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beennectorDeliveries').withIndex('by_user', (q) => q.eq('userId', userId))),
  powerups: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('powerups').withIndex('by_user', (q) => q.eq('userId', userId))),
  devinSessions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('devinSessions').withIndex('by_user_and_updated_at', (q) => q.eq('userId', userId))),
  beeSiteDeployments: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beeSiteDeployments').withIndex('by_user_id_and_created_at', (q) => q.eq('userId', userId))),
  beeSiteUsage: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beeSiteUsage').withIndex('by_user_id_and_month_key', (q) => q.eq('userId', userId))),
  beeSites: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('beeSites').withIndex('by_user_id_and_updated_at', (q) => q.eq('userId', userId))),
  wallets: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('wallets').withIndex('by_user', (q) => q.eq('userId', userId))),
  web3Actions: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('web3Actions').withIndex('by_user', (q) => q.eq('userId', userId))),
  tasks: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('tasks').withIndex('by_user', (q) => q.eq('userId', userId))),
  projects: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('projects').withIndex('by_user', (q) => q.eq('userId', userId))),
  golieBees: removesBatch((ctx, ownerKey) => ctx.db.query('golieBees').withIndex('by_owner_key_and_goal_id', (q) => q.eq('ownerKey', ownerKey))),
  goals: removesBatch((ctx, _ownerKey, userId) => ctx.db.query('goals').withIndex('by_user', (q) => q.eq('userId', userId))),
  hives: removesBatch((ctx, ownerKey) => ctx.db.query('hives').withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))),
} satisfies Record<DataStage, StageRemover>

async function removeDataBatch(
  ctx: MutationCtx,
  stage: DataStage,
  ownerKey: string,
  userId: string,
): Promise<number> {
  return STAGE_REMOVERS[stage](ctx, ownerKey, userId)
}

async function scheduleNext(
  ctx: MutationCtx,
  jobId: Id<'accountDeletionJobs'>,
) {
  await ctx.scheduler.runAfter(0, internal.accountDeletion.process, { jobId })
}

async function hashActivationToken(token: string) {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function activationTokensMatch(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function invalidDeletionCapability() {
  return new ConvexError({
    code: 'INVALID_DELETION_TOKEN',
    message: 'Invalid account-deletion capability',
  })
}

function validateActivationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
    throw invalidDeletionCapability()
  }
}

type DeletionJobGuard = {
  /** Ownership/status checks applied before the hash comparison. */
  authorize?: (job: Doc<'accountDeletionJobs'>) => boolean
}

/**
 * Shared deletion-capability guard for every job-scoped endpoint: validates
 * the token shape, loads the job, applies the caller's ownership/status
 * checks, then constant-time compares the activation-token hash. Every
 * failure throws the same INVALID_DELETION_TOKEN error so callers leak
 * nothing about which check failed.
 */
async function requireValidDeletionJob(
  ctx: QueryCtx,
  args: { jobId: Id<'accountDeletionJobs'>; activationToken: string },
  options?: DeletionJobGuard,
): Promise<Doc<'accountDeletionJobs'>>
async function requireValidDeletionJob(
  ctx: QueryCtx,
  args: { jobId: Id<'accountDeletionJobs'>; activationToken: string },
  options: DeletionJobGuard & {
    /** `activate` treats a missing job as already-finished cleanup. */
    allowMissingJob: true
  },
): Promise<Doc<'accountDeletionJobs'> | null>
async function requireValidDeletionJob(
  ctx: QueryCtx,
  args: { jobId: Id<'accountDeletionJobs'>; activationToken: string },
  options: DeletionJobGuard & { allowMissingJob?: boolean } = {},
): Promise<Doc<'accountDeletionJobs'> | null> {
  validateActivationToken(args.activationToken)
  const job = await ctx.db.get('accountDeletionJobs', args.jobId)
  if (!job) {
    if (options.allowMissingJob) return null
    throw invalidDeletionCapability()
  }
  if (options.authorize && !options.authorize(job)) {
    throw invalidDeletionCapability()
  }
  if (!job.activationTokenHash) {
    throw invalidDeletionCapability()
  }
  const suppliedHash = await hashActivationToken(args.activationToken)
  if (!activationTokensMatch(job.activationTokenHash, suppliedHash)) {
    throw invalidDeletionCapability()
  }
  return job
}

async function scheduleExternalCleanup(
  ctx: MutationCtx,
  jobId: Id<'accountDeletionJobs'>,
  delayMs = 0,
) {
  await ctx.scheduler.runAfter(
    delayMs,
    internal.accountDeletionActions.cleanup,
    { jobId },
  )
}

async function activateJob(ctx: MutationCtx, job: Doc<'accountDeletionJobs'>) {
  const status: ActiveStatus = job.status ?? 'purging'
  const now = Date.now()
  if (status === 'awaiting_identity_deletion') {
    await ctx.db.patch(job._id, {
      status: 'external_cleanup',
      activatedAt: now,
      externalCleanupAttempts: 0,
      externalCleanupNextAttemptAt: now,
      expiresAt: undefined,
      updatedAt: now,
    })
    await scheduleExternalCleanup(ctx, job._id)
    return 'external_cleanup' as const
  }
  if (status === 'external_cleanup') {
    await scheduleExternalCleanup(ctx, job._id)
  } else if (status === 'purging') {
    await scheduleNext(ctx, job._id)
  }
  return status
}

/**
 * Creates a non-destructive deletion intent. Cleanup is activated only after
 * Clerk confirms identity deletion, either through the capability mutation or
 * the signed `user.deleted` webhook. This ordering prevents a failed Clerk
 * deletion from leaving an active account whose BeeGreat data is already gone.
 */
export const prepare = mutation({
  args: {
    confirmation: v.literal('DELETE'),
    activationToken: v.string(),
  },
  returns: v.object({
    jobId: v.id('accountDeletionJobs'),
    status: activeStatusValidator,
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      })
    }
    validateActivationToken(args.activationToken)
    const activationTokenHash = await hashActivationToken(args.activationToken)

    const existing = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_owner_key', (q) =>
        q.eq('ownerKey', identity.tokenIdentifier),
      )
      .unique()
    if (existing) {
      const status: ActiveStatus = existing.status ?? 'purging'
      const patch: Partial<Doc<'accountDeletionJobs'>> = {
        activationTokenHash,
        updatedAt: Date.now(),
      }
      if (status === 'awaiting_identity_deletion') {
        patch.appleRevocationStatus = undefined
        patch.appleRevocationCompletedAt = undefined
        patch.expiresAt = Date.now() + AWAITING_IDENTITY_TTL_MS
      }
      await ctx.db.patch(existing._id, patch)
      return { jobId: existing._id, status }
    }

    const now = Date.now()
    const jobId = await ctx.db.insert('accountDeletionJobs', {
      ownerKey: identity.tokenIdentifier,
      userId: identity.subject,
      status: 'awaiting_identity_deletion',
      activationTokenHash,
      stageIndex: 0,
      deletedDocuments: 0,
      passDeletedDocuments: 0,
      externalCleanupAttempts: 0,
      expiresAt: now + AWAITING_IDENTITY_TTL_MS,
      createdAt: now,
      updatedAt: now,
    })
    return { jobId, status: 'awaiting_identity_deletion' as const }
  },
})

/**
 * Authorizes the Node action before it reads a provider token from Clerk.
 * Both the authenticated Clerk identity and the unguessable deletion
 * capability must still own the same non-destructive prepared job.
 */
export const authorizeAppleRevocation = internalQuery({
  args: {
    jobId: v.id('accountDeletionJobs'),
    activationToken: v.string(),
    ownerKey: v.string(),
    userId: v.string(),
  },
  returns: v.object({ userId: v.string() }),
  handler: async (ctx, args) => {
    const job = await requireValidDeletionJob(ctx, args, {
      authorize: (candidate) =>
        candidate.status === 'awaiting_identity_deletion' &&
        candidate.ownerKey === args.ownerKey &&
        candidate.userId === args.userId,
    })
    return { userId: job.userId }
  },
})

/** Revalidates ownership after the external calls and stores no credentials. */
export const completeAppleRevocation = internalMutation({
  args: {
    jobId: v.id('accountDeletionJobs'),
    activationToken: v.string(),
    ownerKey: v.string(),
    userId: v.string(),
    status: v.union(v.literal('revoked'), v.literal('no_token')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await requireValidDeletionJob(ctx, args, {
      authorize: (candidate) =>
        candidate.status === 'awaiting_identity_deletion' &&
        candidate.ownerKey === args.ownerKey &&
        candidate.userId === args.userId,
    })
    await ctx.db.patch(job._id, {
      appleRevocationStatus: args.status,
      appleRevocationCompletedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return null
  },
})

/** Activates cleanup after the client has successfully deleted the Clerk user. */
export const activate = mutation({
  args: {
    jobId: v.id('accountDeletionJobs'),
    activationToken: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('scheduled'), v.literal('complete')),
  }),
  handler: async (ctx, args) => {
    const job = await requireValidDeletionJob(ctx, args, {
      allowMissingJob: true,
    })
    if (!job) return { status: 'complete' as const }
    await activateJob(ctx, job)
    return { status: 'scheduled' as const }
  },
})

/**
 * Cancels only a still-prepared intent, and only while the same Clerk identity
 * can authenticate. A network error after successful Clerk deletion therefore
 * cannot accidentally cancel an already-authorized cleanup.
 */
export const cancel = mutation({
  args: {
    jobId: v.id('accountDeletionJobs'),
    activationToken: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('cancelled'), v.literal('already_activated')),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      })
    }
    const job = await requireValidDeletionJob(ctx, args, {
      authorize: (candidate) =>
        candidate.ownerKey === identity.tokenIdentifier,
    })
    if (job.status !== 'awaiting_identity_deletion') {
      return { status: 'already_activated' as const }
    }
    await ctx.db.delete('accountDeletionJobs', job._id)
    return { status: 'cancelled' as const }
  },
})

/** Signed Clerk `user.deleted` webhooks close the client crash/uninstall gap. */
export const activateFromClerkWebhook = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .collect()
    for (const job of jobs) {
      await activateJob(ctx, job)
    }
    return null
  },
})

export const getExternalCleanupPayload = internalQuery({
  args: { jobId: v.id('accountDeletionJobs') },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.string(),
      conversationIds: v.array(v.string()),
      googleHealthCredential: v.union(
        v.null(),
        v.object({
          encryptedAccess: v.optional(healthEncryptedSecretValidator),
          encryptedRefresh: v.optional(healthEncryptedSecretValidator),
        }),
      ),
      beennectorCredentials: v.array(
        v.object({
          provider: beennectorProviderValidator,
          encryptedAccess: v.optional(beennectorEncryptedSecretValidator),
          encryptedRefresh: v.optional(beennectorEncryptedSecretValidator),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (!job || job.status !== 'external_cleanup') return null
    const [threads, googleHealthCredential, beennectorCredentials] =
      await Promise.all([
        ctx.db
          .query('chatThreads')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', job.ownerKey),
          )
          .collect(),
        ctx.db
          .query('googleHealthCredentials')
          .withIndex('by_user', (q) => q.eq('userId', job.userId))
          .unique(),
        ctx.db
          .query('beennectorCredentials')
          .withIndex('by_user_and_provider', (q) => q.eq('userId', job.userId))
          .collect(),
      ])
    return {
      userId: job.userId,
      conversationIds: [
        job.userId,
        ...threads
          .filter((thread) => thread.threadId > 0)
          .map((thread) => `${job.userId}~${thread.threadId}`),
      ],
      googleHealthCredential: googleHealthCredential
        ? {
            encryptedAccess: googleHealthCredential.encryptedAccess,
            encryptedRefresh: googleHealthCredential.encryptedRefresh,
          }
        : null,
      beennectorCredentials: beennectorCredentials.map((credential) => ({
        provider: credential.provider,
        encryptedAccess: credential.encryptedAccess,
        encryptedRefresh: credential.encryptedRefresh,
      })),
    }
  },
})

export const finishExternalCleanup = internalMutation({
  args: {
    jobId: v.id('accountDeletionJobs'),
    retryableFailure: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (!job || job.status !== 'external_cleanup') return null
    const attempts = (job.externalCleanupAttempts ?? 0) + 1
    const now = Date.now()
    if (args.retryableFailure && attempts < 4) {
      const delayMs = Math.min(60_000 * 2 ** (attempts - 1), STALLED_JOB_MS)
      await ctx.db.patch(job._id, {
        externalCleanupAttempts: attempts,
        externalCleanupNextAttemptAt: now + delayMs,
        updatedAt: now,
      })
      await scheduleExternalCleanup(ctx, job._id, delayMs)
      return null
    }
    await ctx.db.patch(job._id, {
      status: 'purging',
      stageIndex: 0,
      passDeletedDocuments: 0,
      externalCleanupAttempts: attempts,
      externalCleanupNextAttemptAt: undefined,
      updatedAt: now,
    })
    await scheduleNext(ctx, job._id)
    return null
  },
})

export const process = internalMutation({
  args: { jobId: v.id('accountDeletionJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get('accountDeletionJobs', jobId)
    if (!job) return null
    if ((job.status ?? 'purging') !== 'purging') return null

    const stage = DATA_STAGES[job.stageIndex]
    if (stage) {
      const deleted = await removeDataBatch(
        ctx,
        stage,
        job.ownerKey,
        job.userId,
      )
      await ctx.db.patch(jobId, {
        stageIndex:
          deleted === BATCH_SIZE ? job.stageIndex : job.stageIndex + 1,
        deletedDocuments: job.deletedDocuments + deleted,
        passDeletedDocuments: job.passDeletedDocuments + deleted,
        updatedAt: Date.now(),
      })
      await scheduleNext(ctx, jobId)
      return null
    }

    if (job.passDeletedDocuments > 0) {
      await ctx.db.patch(jobId, {
        stageIndex: 0,
        focusGoalId: undefined,
        focusStage: undefined,
        passDeletedDocuments: 0,
        updatedAt: Date.now(),
      })
      await scheduleNext(ctx, jobId)
      return null
    }

    const now = Date.now()
    const tombstonedAt = job.tombstonedAt ?? now
    await ctx.db.patch(jobId, {
      status: 'tombstoned',
      stageIndex: 0,
      passDeletedDocuments: 0,
      tombstonedAt,
      nextSweepAt: now + TOMBSTONE_SWEEP_INTERVAL_MS,
      expiresAt: job.expiresAt ?? tombstonedAt + TOMBSTONE_RETENTION_MS,
      updatedAt: now,
    })
    return null
  },
})

/**
 * Repairs stalled cleanup and repeatedly sweeps active-system data while the
 * minimal tombstone is retained. Awaiting intents expire without ever purging.
 */
export const watchdog = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const staleBefore = now - STALLED_JOB_MS
    const [
      awaiting,
      externalCleanup,
      purging,
      tombstoned,
      expiredTombstoned,
      legacyPurging,
    ] = await Promise.all([
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_expires_at', (q) =>
          q.eq('status', 'awaiting_identity_deletion').lte('expiresAt', now),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_updated_at', (q) =>
          q.eq('status', 'external_cleanup').lte('updatedAt', staleBefore),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_updated_at', (q) =>
          q.eq('status', 'purging').lte('updatedAt', staleBefore),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_next_sweep_at', (q) =>
          q.eq('status', 'tombstoned').lte('nextSweepAt', now),
        )
        .take(WATCHDOG_BATCH_SIZE),
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_expires_at', (q) =>
          q.eq('status', 'tombstoned').lte('expiresAt', now),
        )
        .take(WATCHDOG_BATCH_SIZE),
      // `status` is optional only for jobs created by the pre-two-phase
      // release. Keep those resumable during the rollout instead of silently
      // stranding an already-authorized erasure cursor.
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_status_and_updated_at', (q) =>
          q.eq('status', undefined).lte('updatedAt', staleBefore),
        )
        .take(WATCHDOG_BATCH_SIZE),
    ])

    for (const job of awaiting) {
      if ((job.expiresAt ?? job.createdAt + AWAITING_IDENTITY_TTL_MS) <= now) {
        await ctx.db.delete('accountDeletionJobs', job._id)
      }
    }
    for (const job of externalCleanup) {
      if ((job.externalCleanupNextAttemptAt ?? 0) <= now) {
        await ctx.db.patch(job._id, { updatedAt: now })
        await scheduleExternalCleanup(ctx, job._id)
      }
    }
    for (const job of [...purging, ...legacyPurging]) {
      await ctx.db.patch(job._id, { status: 'purging', updatedAt: now })
      await scheduleNext(ctx, job._id)
    }
    const expiredTombstoneIds = new Set(
      expiredTombstoned.map((job) => job._id.toString()),
    )
    for (const job of expiredTombstoned) {
      await ctx.db.delete('accountDeletionJobs', job._id)
    }
    for (const job of tombstoned) {
      if (expiredTombstoneIds.has(job._id.toString())) continue
      if ((job.nextSweepAt ?? 0) <= now) {
        await ctx.db.patch(job._id, {
          status: 'purging',
          stageIndex: 0,
          passDeletedDocuments: 0,
          nextSweepAt: undefined,
          updatedAt: now,
        })
        await scheduleNext(ctx, job._id)
      }
    }
    return null
  },
})
