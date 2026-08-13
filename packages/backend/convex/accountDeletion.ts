import { ConvexError, v } from 'convex/values'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import { internal } from './_generated/api'
import type { MutationCtx } from './_generated/server'
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

async function removeDataBatch(
  ctx: MutationCtx,
  stage: DataStage,
  ownerKey: string,
  userId: string,
): Promise<number> {
  switch (stage) {
    case 'subscriptionEntitlements':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('subscriptionEntitlements')
          .withIndex('by_user_and_entitlement', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'subscriptionStatusChecks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('subscriptionStatusChecks')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'memorySourceLinks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('memorySourceLinks')
          .withIndex('by_owner_key_and_derived_memory_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'memoryRevisions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('memoryRevisions')
          .withIndex('by_owner_key_and_memory_id_and_revision', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'memories':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('memories')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'chatMessages':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatMessages')
          .withIndex('by_owner_key_and_thread_id_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'imessageDeliveries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('imessageDeliveries')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'agentJobRuns':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('agentJobRuns')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'agentJobGrants':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('agentJobGrants')
          .withIndex('by_owner_key_and_requested_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'agentJobs':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('agentJobs')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'chatThreads':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatThreads')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'chatPreferences':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatPreferences')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'userPreferences':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('userPreferences')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'publicProfileLinks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('publicProfileLinks')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'publicProfileAliases':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('publicProfileAliases')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'publicProfiles':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('publicProfiles')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'highlights':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('highlights')
          .withIndex('by_owner_key_and_status', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'honeyLedgerEntries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('honeyLedgerEntries')
          .withIndex('by_owner_key_and_goal_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'firstFocusBundles':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('firstFocusBundles')
          .withIndex('by_owner_key_and_request_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'goalEconomyStats':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('goalEconomyStats')
          .withIndex('by_owner_key_and_goal_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'verifiedProgressEvents':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('verifiedProgressEvents')
          .withIndex('by_owner_key_and_occurred_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'honeyEconomyEntries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('honeyEconomyEntries')
          .withIndex('by_owner_key_and_occurred_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'royalJellyLedgerEntries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('royalJellyLedgerEntries')
          .withIndex('by_owner_key_and_occurred_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'economyCommandReceipts':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('economyCommandReceipts')
          .withIndex('by_owner_key_and_request_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'weeklyProgressRosters':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('weeklyProgressRosters')
          .withIndex('by_owner_key_and_started_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'achievementUnlocks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('achievementUnlocks')
          .withIndex('by_owner_key_and_unlocked_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'achievementBackfillStates':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('achievementBackfillStates')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
    case 'boosterActivations':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('boosterActivations')
          .withIndex('by_owner_key_and_kind_and_expires_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'anonymizedEconomyEvents':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('anonymizedEconomyEvents')
          .withIndex('by_owner_key_and_occurred_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'recurrenceSchedules':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('recurrenceSchedules')
          .withIndex('by_owner_key_and_active', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'bookmarkCrawlRuns':
      return removeOwnerCrawlRunsBatch(ctx, ownerKey, BATCH_SIZE)
    case 'bookmarkCrawlCache':
      return removeOwnerWebsiteCacheBatch(ctx, ownerKey, BATCH_SIZE)
    case 'bookmarks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('bookmarks')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'chatgptAuthSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatgptAuthSessions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'chatgptCredentials':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatgptCredentials')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'chatgptGatePreferences':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('chatgptGatePreferences')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'googleHealthAuthSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('googleHealthAuthSessions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'googleHealthCredentials':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('googleHealthCredentials')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'telegramAuthSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('telegramAuthSessions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'telegramConnections':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('telegramConnections')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'imessageLinkSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('imessageLinkSessions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'imessageConnections':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('imessageConnections')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'journalAttachments': {
      const attachments = await ctx.db
        .query('journalAttachments')
        .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
        .take(BATCH_SIZE)
      for (const attachment of attachments) {
        await ctx.storage.delete(attachment.storageId)
        await ctx.db.delete(attachment._id)
      }
      return attachments.length
    }
    case 'journalEntries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('journalEntries')
          .withIndex('by_owner_key_and_local_date_and_occurred_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'healthJournalEntries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('healthJournalEntries')
          .withIndex('by_owner_key_and_local_date', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'nfcActionExecutions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('nfcActionExecutions')
          .withIndex('by_owner_key_and_executed_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'nfcActions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('nfcActions')
          .withIndex('by_owner_key_and_created_at', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'beennectorAuthSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beennectorAuthSessions')
          .withIndex('by_user_and_provider', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'beennectorCredentials':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beennectorCredentials')
          .withIndex('by_user_and_provider', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'beennectorDeliveries':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beennectorDeliveries')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'powerups':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('powerups')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'devinSessions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('devinSessions')
          .withIndex('by_user_and_updated_at', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'beeSiteDeployments':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beeSiteDeployments')
          .withIndex('by_user_id_and_created_at', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'beeSiteUsage':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beeSiteUsage')
          .withIndex('by_user_id_and_month_key', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'beeSites':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('beeSites')
          .withIndex('by_user_id_and_updated_at', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'wallets':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('wallets')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'web3Actions':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('web3Actions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'tasks':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('tasks')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'projects':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('projects')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'golieBees':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('golieBees')
          .withIndex('by_owner_key_and_goal_id', (q) =>
            q.eq('ownerKey', ownerKey),
          )
          .take(BATCH_SIZE),
      )
    case 'goals':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('goals')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(BATCH_SIZE),
      )
    case 'hives':
      return removeDocuments(
        ctx,
        await ctx.db
          .query('hives')
          .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
          .take(BATCH_SIZE),
      )
  }
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

function validateActivationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
    throw new ConvexError({
      code: 'INVALID_DELETION_TOKEN',
      message: 'Invalid account-deletion capability',
    })
  }
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
      await ctx.db.patch(existing._id, {
        activationTokenHash,
        ...(status === 'awaiting_identity_deletion'
          ? {
              appleRevocationStatus: undefined,
              appleRevocationCompletedAt: undefined,
              expiresAt: Date.now() + AWAITING_IDENTITY_TTL_MS,
            }
          : {}),
        updatedAt: Date.now(),
      })
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
    validateActivationToken(args.activationToken)
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (
      !job ||
      job.status !== 'awaiting_identity_deletion' ||
      job.ownerKey !== args.ownerKey ||
      job.userId !== args.userId ||
      !job.activationTokenHash
    ) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
    const suppliedHash = await hashActivationToken(args.activationToken)
    if (!activationTokensMatch(job.activationTokenHash, suppliedHash)) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
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
    validateActivationToken(args.activationToken)
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (
      !job ||
      job.status !== 'awaiting_identity_deletion' ||
      job.ownerKey !== args.ownerKey ||
      job.userId !== args.userId ||
      !job.activationTokenHash
    ) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
    const suppliedHash = await hashActivationToken(args.activationToken)
    if (!activationTokensMatch(job.activationTokenHash, suppliedHash)) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
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
    validateActivationToken(args.activationToken)
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (!job) return { status: 'complete' as const }
    const suppliedHash = await hashActivationToken(args.activationToken)
    if (
      !job.activationTokenHash ||
      !activationTokensMatch(job.activationTokenHash, suppliedHash)
    ) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
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
    validateActivationToken(args.activationToken)
    const job = await ctx.db.get('accountDeletionJobs', args.jobId)
    if (!job || job.ownerKey !== identity.tokenIdentifier) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
    const suppliedHash = await hashActivationToken(args.activationToken)
    if (
      !job.activationTokenHash ||
      !activationTokensMatch(job.activationTokenHash, suppliedHash)
    ) {
      throw new ConvexError({
        code: 'INVALID_DELETION_TOKEN',
        message: 'Invalid account-deletion capability',
      })
    }
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
