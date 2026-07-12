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

export default defineSchema({
  posts: defineTable({
    id: v.string(),
    title: v.string(),
    body: v.string(),
  }).index('id', ['id']),

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
  })
    .index('by_user', ['userId', 'status'])
    .index('by_goal', ['goalId', 'status']),

  // Opt-in capability packs. A row exists once the user has touched the toggle;
  // absence means the power-up was never enabled. Catalog lives in powerups.ts.
  powerups: defineTable({
    userId: v.string(),
    powerupId: v.string(),
    enabled: v.boolean(),
  }).index('by_user', ['userId', 'powerupId']),

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
  })
    .index('by_user', ['userId', 'status'])
    .index('by_goal', ['goalId', 'status'])
    .index('by_project', ['projectId']),

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
