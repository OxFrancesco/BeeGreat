import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  memoryProvenanceValidator,
  memoryRetentionValidator,
  memoryValueValidator,
} from './memoryValidators'
import {
  chatgptAuthSessionStatusValidator,
  chatgptCredentialStatusValidator,
  encryptedSecretValidator,
} from './chatgptAuthValidators'
import {
  googleHealthCredentialStatusValidator,
  googleHealthSessionStatusValidator,
} from './googleHealthValidators'
import {
  beennectorCredentialStatusValidator,
  beennectorProviderValidator,
  beennectorSessionStatusValidator,
} from './beennectorValidators'

export default defineSchema({
  posts: defineTable({
    id: v.string(),
    title: v.string(),
    body: v.string(),
  }).index('id', ['id']),

  // Server-owned RevenueCat state. Environment is part of the key so a
  // delayed sandbox event can never revoke a production entitlement (or the
  // reverse). `expiresAt` also makes access fail closed if a webhook is lost.
  subscriptionEntitlements: defineTable({
    userId: v.string(),
    entitlementId: v.string(),
    productId: v.string(),
    environment: v.union(v.literal('SANDBOX'), v.literal('PRODUCTION')),
    active: v.boolean(),
    // Optional only for the short rollout window from the first ledger schema.
    periodStartedAt: v.optional(v.number()),
    expiresAt: v.number(),
    latestEventId: v.string(),
    latestEventType: v.string(),
    latestEventTimestampMs: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_and_entitlement', ['userId', 'entitlementId'])
    .index('by_user_entitlement_and_environment', [
      'userId',
      'entitlementId',
      'environment',
    ]),

  // Records the latest authoritative Customer Info reconciliation. This lets
  // paid endpoints briefly reuse a fail-closed result without requiring the
  // optional RevenueCat webhook integration or calling RevenueCat per request.
  subscriptionStatusChecks: defineTable({
    userId: v.string(),
    checkedAt: v.number(),
    // When the upstream snapshot began being observed. This is separate from
    // `checkedAt` so a slow older request cannot appear newer when it returns.
    observedAt: v.optional(v.number()),
    active: v.boolean(),
    productId: v.optional(v.string()),
    environment: v.optional(
      v.union(v.literal('SANDBOX'), v.literal('PRODUCTION')),
    ),
    periodStartedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  }).index('by_user', ['userId']),

  // RevenueCat retries with the same event id. Keeping the receipt makes the
  // webhook mutation idempotent and records why unsupported events were
  // ignored without storing the full customer payload.
  revenueCatWebhookEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    environment: v.optional(
      v.union(v.literal('SANDBOX'), v.literal('PRODUCTION')),
    ),
    productId: v.optional(v.string()),
    eventTimestampMs: v.number(),
    receivedAt: v.number(),
    outcome: v.union(
      v.literal('applied'),
      v.literal('ignored'),
      v.literal('stale'),
    ),
    reason: v.optional(v.string()),
  }).index('by_event_id', ['eventId']),

  // Durable two-phase privacy-erasure cursor. Preparing a row is deliberately
  // non-destructive: a matching capability or Clerk `user.deleted` webhook
  // must activate it before cleanup starts. A minimal tombstone remains for a
  // bounded safety window so watchdog sweeps can remove late writes.
  accountDeletionJobs: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    status: v.optional(
      v.union(
        v.literal('awaiting_identity_deletion'),
        v.literal('external_cleanup'),
        v.literal('purging'),
        v.literal('tombstoned'),
      ),
    ),
    activationTokenHash: v.optional(v.string()),
    stageIndex: v.number(),
    focusGoalId: v.optional(v.id('goals')),
    focusStage: v.optional(
      v.union(
        v.literal('tasks'),
        v.literal('projects'),
        v.literal('golieBees'),
        v.literal('goal'),
      ),
    ),
    deletedDocuments: v.number(),
    passDeletedDocuments: v.number(),
    externalCleanupAttempts: v.optional(v.number()),
    externalCleanupNextAttemptAt: v.optional(v.number()),
    // Records only the outcome of the just-in-time Apple preflight. Provider
    // tokens and Apple client credentials are never persisted in Convex.
    appleRevocationStatus: v.optional(
      v.union(v.literal('revoked'), v.literal('no_token')),
    ),
    appleRevocationCompletedAt: v.optional(v.number()),
    activatedAt: v.optional(v.number()),
    tombstonedAt: v.optional(v.number()),
    nextSweepAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_key', ['ownerKey'])
    .index('by_user_id', ['userId'])
    .index('by_status_and_updated_at', ['status', 'updatedAt'])
    .index('by_status_and_expires_at', ['status', 'expiresAt'])
    .index('by_status_and_next_sweep_at', ['status', 'nextSweepAt']),

  // Short-lived, durable device-authorization state. The device auth id is
  // encrypted because possession is sufficient to poll the upstream flow.
  chatgptAuthSessions: defineTable({
    userId: v.string(),
    status: chatgptAuthSessionStatusValidator,
    encryptedDeviceAuthId: v.optional(encryptedSecretValidator),
    userCode: v.optional(v.string()),
    verificationUri: v.optional(v.string()),
    intervalMs: v.optional(v.number()),
    nextPollAt: v.optional(v.number()),
    expiresAt: v.number(),
    attemptCount: v.number(),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // One encrypted ChatGPT OAuth credential per Clerk user. Access and refresh
  // tokens never leave trusted backend/agent boundaries or reach app clients.
  chatgptCredentials: defineTable({
    userId: v.string(),
    status: chatgptCredentialStatusValidator,
    encryptedAccess: v.optional(encryptedSecretValidator),
    encryptedRefresh: v.optional(encryptedSecretValidator),
    expiresAt: v.optional(v.number()),
    accountIdHash: v.optional(v.string()),
    refreshLeaseId: v.optional(v.string()),
    refreshLeaseExpiresAt: v.optional(v.number()),
    lastRefreshAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // ChatGPT connection is optional. A row here means the user skipped the
  // connect gate; the agent then bills through the default OpenRouter model.
  chatgptGatePreferences: defineTable({
    userId: v.string(),
    skippedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Convex is the account-wide source of truth for Bee conversations. Flue
  // still executes agent turns, while these rows make thread navigation and
  // transcripts reactive across every signed-in device.
  chatThreads: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    threadId: v.number(),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_key_and_thread_id', ['ownerKey', 'threadId'])
    .index('by_owner_key_and_created_at', ['ownerKey', 'createdAt']),

  chatPreferences: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    activeThreadId: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_key', ['ownerKey']),

  userPreferences: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    timeZone: v.string(),
    updatedAt: v.number(),
  })
    .index('by_owner_key', ['ownerKey'])
    .index('by_user_id', ['userId']),

  // One Bee Healthy journal row per authenticated owner and local calendar day.
  // Mood and journal remain optional so hydration-only check-ins stay lightweight.
  healthJournalEntries: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    localDate: v.string(),
    mood: v.optional(
      v.union(
        v.literal('awful'),
        v.literal('bad'),
        v.literal('okay'),
        v.literal('good'),
        v.literal('great'),
      ),
    ),
    hydrationMl: v.number(),
    journal: v.optional(v.string()),
    timeZone: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_key_and_local_date', ['ownerKey', 'localDate']),

  journalEntries: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    localDate: v.string(),
    timeZone: v.string(),
    occurredAt: v.number(),
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    searchText: v.string(),
    isPinned: v.boolean(),
    isFavorite: v.boolean(),
    legacyLocalDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_key_and_local_date_and_occurred_at', [
      'ownerKey',
      'localDate',
      'occurredAt',
    ])
    .index('by_owner_key_and_legacy_local_date', [
      'ownerKey',
      'legacyLocalDate',
    ])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['ownerKey'],
    }),

  journalAttachments: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    entryId: v.id('journalEntries'),
    kind: v.literal('photo'),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_entry_id_and_created_at', ['entryId', 'createdAt'])
    .index('by_owner_key', ['ownerKey']),

  chatMessages: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    threadId: v.number(),
    messageId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    // Flue message parts are versioned by Flue. Keeping their JSON envelope
    // intact preserves tool/reasoning parts without weakening our schema.
    contentJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_key_and_thread_id_and_created_at', [
      'ownerKey',
      'threadId',
      'createdAt',
    ])
    .index('by_owner_key_and_thread_id_and_message_id', [
      'ownerKey',
      'threadId',
      'messageId',
    ]),

  // Short-lived PKCE state for the Google Health consent redirect. The state
  // is hashed for lookup and the verifier is encrypted at rest.
  googleHealthAuthSessions: defineTable({
    userId: v.string(),
    stateHash: v.string(),
    status: googleHealthSessionStatusValidator,
    encryptedCodeVerifier: v.optional(encryptedSecretValidator),
    expiresAt: v.number(),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_state_hash', ['stateHash']),

  // One encrypted, read-only Google Health credential per Clerk user.
  googleHealthCredentials: defineTable({
    userId: v.string(),
    status: googleHealthCredentialStatusValidator,
    encryptedAccess: v.optional(encryptedSecretValidator),
    encryptedRefresh: v.optional(encryptedSecretValidator),
    expiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
    refreshLeaseId: v.optional(v.string()),
    refreshLeaseExpiresAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Beennectors are durable account/workspace connections, not optional
  // PowerBee capability packs. OAuth state and credentials therefore live in
  // their own domain and tokens never reach app clients or the agent worker.
  beennectorAuthSessions: defineTable({
    userId: v.string(),
    provider: beennectorProviderValidator,
    stateHash: v.string(),
    status: beennectorSessionStatusValidator,
    encryptedCodeVerifier: v.optional(encryptedSecretValidator),
    expiresAt: v.number(),
    errorCode: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user_and_provider', ['userId', 'provider'])
    .index('by_state_hash', ['stateHash']),

  // One encrypted connection per Clerk user and provider. `externalAccountId`
  // and `workspaceId` let verified Flue webhooks resolve their Bee owner.
  beennectorCredentials: defineTable({
    userId: v.string(),
    provider: beennectorProviderValidator,
    status: beennectorCredentialStatusValidator,
    encryptedAccess: v.optional(encryptedSecretValidator),
    encryptedRefresh: v.optional(encryptedSecretValidator),
    expiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
    externalAccountId: v.string(),
    externalAccountName: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    botId: v.optional(v.string()),
    refreshLeaseId: v.optional(v.string()),
    refreshLeaseExpiresAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_user_and_provider', ['userId', 'provider'])
    .index('by_provider_and_external_account', [
      'provider',
      'externalAccountId',
    ])
    .index('by_provider_and_workspace', ['provider', 'workspaceId']),

  // Flue verifies signatures; this table supplies application-owned durable
  // deduplication before a provider delivery is dispatched to Bee.
  beennectorDeliveries: defineTable({
    provider: beennectorProviderValidator,
    deliveryId: v.string(),
    userId: v.string(),
    receivedAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_provider_and_delivery', ['provider', 'deliveryId'])
    .index('by_user', ['userId'])
    .index('by_expires_at', ['expiresAt']),

  goals: defineTable({
    userId: v.string(),
    title: v.string(),
    finalGoal: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('parked'),
      v.literal('completed'),
      v.literal('abandoned'),
      v.literal('archived'),
    ),
    // Optional migration fields. Activation time is the stable tie-breaker for
    // Brain Fatigue ranks; legacy rows fall back to `_creationTime`.
    activatedAt: v.optional(v.number()),
    lifecycleUpdatedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    abandonedAt: v.optional(v.number()),
    resurrectedAt: v.optional(v.number()),
  }).index('by_user', ['userId', 'status']),

  // One global economy balance per authenticated Hive. These fields remain
  // isolated from legacy goal rows so existing data needs no backfill.
  hives: defineTable({
    ownerKey: v.string(),
    // Clerk subject retained only to relate new rows to legacy Goal data.
    userId: v.string(),
    honeyBalance: v.number(),
    honeycombScore: v.number(),
    royalJellyBalance: v.optional(v.number()),
    fatigueSettledAt: v.optional(v.number()),
    geniusActivatedAt: v.optional(v.number()),
    lastRoyalJellyEarnedAt: v.optional(v.number()),
    // Bounded denormalization for the exact rolling Task reward cap.
    rewardedTaskTimestamps: v.optional(v.array(v.number())),
  })
    .index('by_owner_key', ['ownerKey'])
    .index('by_user_id', ['userId']),

  // A Goal owns exactly one GolieBee. The preset variant keeps the MVP
  // deterministic while generated/custom variants remain deferred.
  golieBees: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    goalId: v.id('goals'),
    // Optional during rollout so existing GolieBees remain readable. All new
    // creation paths persist a stable seed; readers fall back to the row id.
    seed: v.optional(v.string()),
    variant: v.literal('mvp-default'),
    status: v.union(
      v.literal('active'),
      v.literal('hall-of-fame'),
      v.literal('ghosty'),
    ),
  })
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_owner_key_and_status', ['ownerKey', 'status'])
    .index('by_goal_id', ['goalId']),

  highlights: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    goalId: v.id('goals'),
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    status: v.union(v.literal('active'), v.literal('expired')),
    expiresAt: v.number(),
    expiredAt: v.optional(v.number()),
  })
    .index('by_owner_key_and_status', ['ownerKey', 'status'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_owner_key_and_project_id', ['ownerKey', 'projectId'])
    .index('by_owner_key_and_task_id', ['ownerKey', 'taskId'])
    .index('by_task_id', ['taskId']),

  verifiedProgressEvents: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    requestId: v.string(),
    goalId: v.id('goals'),
    projectId: v.optional(v.id('projects')),
    taskId: v.id('tasks'),
    kind: v.literal('task-completed'),
    honeyDelta: v.number(),
    scoreDelta: v.number(),
    occurredAt: v.number(),
    rewardEligible: v.optional(v.boolean()),
    rewardReason: v.optional(
      v.union(
        v.literal('awarded'),
        v.literal('rolling-cap'),
        v.literal('exhausted'),
      ),
    ),
    geniusActivated: v.optional(v.boolean()),
    achievementBackfilledAt: v.optional(v.number()),
  })
    .index('by_owner_key_and_request_id', ['ownerKey', 'requestId'])
    .index('by_owner_key_and_task_id', ['ownerKey', 'taskId'])
    .index('by_owner_key_and_occurred_at', ['ownerKey', 'occurredAt'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId']),

  honeyLedgerEntries: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    goalId: v.id('goals'),
    progressEventId: v.id('verifiedProgressEvents'),
    delta: v.number(),
    balanceAfter: v.number(),
    occurredAt: v.number(),
  })
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_progress_event_id', ['progressEventId']),

  // Durable idempotency receipt for atomic first-focus confirmation.
  firstFocusBundles: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    requestId: v.string(),
    goalId: v.id('goals'),
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    highlightId: v.id('highlights'),
    golieBeeId: v.id('golieBees'),
  })
    .index('by_owner_key_and_request_id', ['ownerKey', 'requestId'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_owner_key_and_project_id', ['ownerKey', 'projectId'])
    .index('by_owner_key_and_task_id', ['ownerKey', 'taskId']),

  // Per-Goal counters keep abandonment and continuous fatigue bounded and
  // deterministic without replaying an unbounded ledger.
  goalEconomyStats: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    goalId: v.id('goals'),
    honeyEarned: v.number(),
    honeyFatigueRemoved: v.number(),
    honeyAbandonmentRemoved: v.number(),
    lastAbandonmentRemoved: v.optional(v.number()),
    honeyResurrectionRefunded: v.number(),
    fatigueRemainderMs: v.number(),
    taskProgressCount: v.number(),
    backfilledProgressCount: v.optional(v.number()),
    lastVerifiedProgressAt: v.optional(v.number()),
    resurrectionRefundClaimed: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_goal_id', ['goalId']),

  // General Honey ledger for non-VPE economy changes. The receipt key makes
  // every externally-triggered effect idempotent.
  honeyEconomyEntries: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    receiptKey: v.string(),
    goalId: v.optional(v.id('goals')),
    kind: v.union(
      v.literal('fatigue'),
      v.literal('cosmetic-spend'),
      v.literal('abandonment'),
      v.literal('resurrection-refund'),
    ),
    delta: v.number(),
    balanceAfter: v.number(),
    occurredAt: v.number(),
  })
    .index('by_owner_key_and_receipt_key', ['ownerKey', 'receiptKey'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_owner_key_and_occurred_at', ['ownerKey', 'occurredAt']),

  royalJellyLedgerEntries: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    receiptKey: v.string(),
    kind: v.union(
      v.literal('weekly-progress'),
      v.literal('focus-shield'),
      v.literal('resurrection'),
    ),
    delta: v.number(),
    balanceAfter: v.number(),
    occurredAt: v.number(),
  })
    .index('by_owner_key_and_receipt_key', ['ownerKey', 'receiptKey'])
    .index('by_owner_key_and_occurred_at', ['ownerKey', 'occurredAt']),

  economyCommandReceipts: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    requestId: v.string(),
    kind: v.union(
      v.literal('cosmetic-spend'),
      v.literal('focus-shield'),
      v.literal('abandonment'),
      v.literal('resurrection'),
      v.literal('goal-completion'),
    ),
    fingerprint: v.string(),
    goalId: v.optional(v.id('goals')),
    honeyDelta: v.number(),
    honeyBalance: v.number(),
    royalJellyBalance: v.number(),
    expiresAt: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    occurredAt: v.number(),
  })
    .index('by_owner_key_and_request_id', ['ownerKey', 'requestId'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId']),

  weeklyProgressRosters: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    startedAt: v.number(),
    endsAt: v.number(),
    goalIds: v.array(v.id('goals')),
    satisfiedGoalIds: v.array(v.id('goals')),
    // Privacy deletion converts removed Goal references into anonymous slots
    // without shrinking or retroactively satisfying the fixed weekly roster.
    anonymousRequiredCount: v.optional(v.number()),
    anonymousSatisfiedCount: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    royalJellyAwarded: v.optional(v.number()),
  }).index('by_owner_key_and_started_at', ['ownerKey', 'startedAt']),

  achievementUnlocks: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    achievementKey: v.string(),
    scope: v.union(v.literal('goal'), v.literal('hive')),
    goalId: v.optional(v.id('goals')),
    scoreAwarded: v.number(),
    unlockedAt: v.number(),
  })
    .index('by_owner_key_and_achievement_key', ['ownerKey', 'achievementKey'])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
    .index('by_owner_key_and_unlocked_at', ['ownerKey', 'unlockedAt']),

  achievementBackfillStates: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    cursor: v.union(v.string(), v.null()),
    recentGoalProgress: v.array(
      v.object({ goalId: v.id('goals'), occurredAt: v.number() }),
    ),
    geniusDetected: v.boolean(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_owner_key', ['ownerKey']),

  boosterActivations: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    goalId: v.id('goals'),
    kind: v.literal('focus-shield'),
    activatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_owner_key_and_kind_and_expires_at', [
      'ownerKey',
      'kind',
      'expiresAt',
    ])
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId']),

  // Goal deletion copies economy history here before removing content-linked
  // identifiers. Hive totals and Hive-scoped badges remain intact.
  anonymizedEconomyEvents: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    kind: v.union(
      v.literal('verified-progress'),
      v.literal('honey-ledger'),
      v.literal('honey-economy'),
      v.literal('achievement'),
    ),
    honeyDelta: v.number(),
    scoreDelta: v.number(),
    occurredAt: v.number(),
  }).index('by_owner_key_and_occurred_at', ['ownerKey', 'occurredAt']),

  projects: defineTable({
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived'),
    ),
    // Coarse target date: a quarter (year + quarter 1-4) or a whole year.
    due: v.optional(
      v.object({
        year: v.number(),
        quarter: v.optional(v.number()),
      }),
    ),
    // Generated bee avatar (FAL -> R2), filled in once bee generation lands.
    beeImageUrl: v.optional(v.string()),
    recurrenceScheduleId: v.optional(v.id('recurrenceSchedules')),
    recurrenceOccurrenceAt: v.optional(v.number()),
  })
    .index('by_user', ['userId', 'status'])
    .index('by_goal', ['goalId', 'status'])
    .index('by_goal_and_user', ['goalId', 'userId'])
    .index('by_recurrence_schedule_id_and_recurrence_occurrence_at', [
      'recurrenceScheduleId',
      'recurrenceOccurrenceAt',
    ]),

  recurrenceSchedules: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    kind: v.union(v.literal('task'), v.literal('project')),
    goalId: v.id('goals'),
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    frequency: v.union(
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('monthly'),
      v.literal('yearly'),
    ),
    interval: v.number(),
    timeZone: v.string(),
    firstOccurrenceAt: v.number(),
    nextRunAt: v.number(),
    lastRunAt: v.optional(v.number()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_owner_key_and_active', ['ownerKey', 'active'])
    .index('by_user_id_and_active', ['userId', 'active']),

  // Opt-in capability packs. A row exists once the user has touched the toggle;
  // absence means the power-up was never enabled. Catalog lives in powerups.ts.
  powerups: defineTable({
    userId: v.string(),
    powerupId: v.string(),
    enabled: v.boolean(),
  }).index('by_user', ['userId', 'powerupId']),

  // Devin sessions launched through Bee. The upstream session remains the
  // source of truth; this bounded cache establishes BeeGreat ownership and
  // gives the agent a safe list of sessions it may inspect or follow up on.
  devinSessions: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    title: v.optional(v.string()),
    url: v.string(),
    status: v.union(
      v.literal('new'),
      v.literal('claimed'),
      v.literal('running'),
      v.literal('exit'),
      v.literal('error'),
      v.literal('suspended'),
      v.literal('resuming'),
    ),
    statusDetail: v.optional(v.string()),
    pullRequests: v.array(
      v.object({ url: v.string(), state: v.optional(v.string()) }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSyncedAt: v.number(),
  })
    .index('by_user_and_updated_at', ['userId', 'updatedAt'])
    .index('by_session_id', ['sessionId']),

  // Crossmint smart wallets created by the Web3 power-up, one per user+chain.
  // The source of truth is Crossmint (keyed by owner `userId:<clerk id>`); this
  // table is a cache so queries and the app can show the wallet without an API call.
  wallets: defineTable({
    userId: v.string(),
    chain: v.string(),
    address: v.string(),
  }).index('by_user', ['userId', 'chain']),

  tasks: defineTable({
    userId: v.string(),
    goalId: v.id('goals'),
    // Optional while pre-projects tasks still exist; new tasks always set it.
    projectId: v.optional(v.id('projects')),
    // Set when this task is a subtask of another task in the same project.
    parentTaskId: v.optional(v.id('tasks')),
    title: v.string(),
    status: v.union(v.literal('todo'), v.literal('done')),
    labels: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // How many times the due date was pushed back (honey penalty input).
    postponeCount: v.optional(v.number()),
    recurrenceScheduleId: v.optional(v.id('recurrenceSchedules')),
    recurrenceOccurrenceAt: v.optional(v.number()),
  })
    .index('by_user', ['userId', 'status'])
    .index('by_goal', ['goalId', 'status'])
    .index('by_goal_and_user', ['goalId', 'userId'])
    .index('by_project', ['projectId'])
    .index('by_recurrence_schedule_id_and_recurrence_occurrence_at', [
      'recurrenceScheduleId',
      'recurrenceOccurrenceAt',
    ]),

  bookmarks: defineTable({
    ownerKey: v.string(),
    userId: v.string(),
    url: v.string(),
    normalizedUrl: v.string(),
    kind: v.union(
      v.literal('website'),
      v.literal('tweet'),
      v.literal('youtube'),
    ),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('ready'),
      v.literal('failed'),
    ),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    labels: v.array(v.string()),
    note: v.optional(v.string()),
    content: v.optional(v.string()),
    searchText: v.string(),
    meta: v.optional(
      v.object({
        siteName: v.optional(v.string()),
        author: v.optional(v.string()),
        handle: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        faviconUrl: v.optional(v.string()),
        publishedAt: v.optional(v.number()),
        tweetId: v.optional(v.string()),
        videoId: v.optional(v.string()),
        durationSeconds: v.optional(v.number()),
      }),
    ),
    transcriptSource: v.optional(
      v.union(v.literal('captions'), v.literal('scribe')),
    ),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_key_and_created_at', ['ownerKey', 'createdAt'])
    .index('by_owner_key_and_normalized_url', ['ownerKey', 'normalizedUrl'])
    .index('by_owner_key_and_kind_and_created_at', [
      'ownerKey',
      'kind',
      'createdAt',
    ])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['ownerKey', 'kind'],
    }),

  // Shared, server-only source cache. User-owned bookmark fields never live
  // here; the short lease prevents concurrent saves of the same canonical URL
  // from issuing duplicate provider crawls.
  bookmarkCrawlCache: defineTable({
    normalizedUrl: v.string(),
    kind: v.union(
      v.literal('website'),
      v.literal('tweet'),
      v.literal('youtube'),
    ),
    status: v.union(v.literal('processing'), v.literal('ready')),
    leaseOwnerBookmarkId: v.optional(v.id('bookmarks')),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    meta: v.optional(
      v.object({
        siteName: v.optional(v.string()),
        author: v.optional(v.string()),
        handle: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        faviconUrl: v.optional(v.string()),
        publishedAt: v.optional(v.number()),
        tweetId: v.optional(v.string()),
        videoId: v.optional(v.string()),
        durationSeconds: v.optional(v.number()),
      }),
    ),
    transcriptSource: v.optional(
      v.union(v.literal('captions'), v.literal('scribe')),
    ),
    scrapedAt: v.optional(v.number()),
    expiresAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_normalized_url', ['normalizedUrl'])
    .index('by_expires_at', ['expiresAt']),

  memories: defineTable({
    ownerKey: v.string(),
    value: memoryValueValidator,
    provenance: memoryProvenanceValidator,
    retention: memoryRetentionValidator,
    currentRevision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner_key', ['ownerKey']),

  memoryRevisions: defineTable({
    ownerKey: v.string(),
    memoryId: v.id('memories'),
    revision: v.number(),
    value: memoryValueValidator,
    reason: v.string(),
    createdAt: v.number(),
  }).index('by_owner_key_and_memory_id_and_revision', [
    'ownerKey',
    'memoryId',
    'revision',
  ]),

  memorySourceLinks: defineTable({
    ownerKey: v.string(),
    derivedMemoryId: v.id('memories'),
    sourceMemoryId: v.id('memories'),
    relationship: v.union(v.literal('supports'), v.literal('summarizes')),
    createdAt: v.number(),
  })
    .index('by_owner_key_and_derived_memory_id', [
      'ownerKey',
      'derivedMemoryId',
    ])
    .index('by_owner_key_and_source_memory_id', ['ownerKey', 'sourceMemoryId']),
})
