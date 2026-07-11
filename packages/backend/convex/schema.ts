import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  memoryProvenanceValidator,
  memoryRetentionValidator,
  memoryValueValidator,
} from './memoryValidators'

export default defineSchema({
  posts: defineTable({
    id: v.string(),
    title: v.string(),
    body: v.string(),
  }).index('id', ['id']),

  goals: defineTable({
    userId: v.string(),
    title: v.string(),
    finalGoal: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('archived')),
  }).index('by_user', ['userId', 'status']),

  // One global economy balance per authenticated Hive. These fields remain
  // isolated from legacy goal rows so existing data needs no backfill.
  hives: defineTable({
    ownerKey: v.string(),
    // Clerk subject retained only to relate new rows to legacy Goal data.
    userId: v.string(),
    honeyBalance: v.number(),
    honeycombScore: v.number(),
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
    status: v.literal('active'),
  })
    .index('by_owner_key_and_goal_id', ['ownerKey', 'goalId'])
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
    projectId: v.id('projects'),
    taskId: v.id('tasks'),
    kind: v.literal('task-completed'),
    honeyDelta: v.number(),
    scoreDelta: v.number(),
    occurredAt: v.number(),
  })
    .index('by_owner_key_and_request_id', ['ownerKey', 'requestId'])
    .index('by_owner_key_and_task_id', ['ownerKey', 'taskId'])
    .index('by_owner_key_and_occurred_at', ['ownerKey', 'occurredAt']),

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

  projects: defineTable({
    userId: v.string(),
    goalId: v.id('goals'),
    title: v.string(),
    status: v.union(v.literal('active'), v.literal('completed'), v.literal('archived')),
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

  // Crossmint smart wallets created by the WebTree power-up, one per user+chain.
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
  }).index('by_owner_key_and_memory_id_and_revision', ['ownerKey', 'memoryId', 'revision']),

  memorySourceLinks: defineTable({
    ownerKey: v.string(),
    derivedMemoryId: v.id('memories'),
    sourceMemoryId: v.id('memories'),
    relationship: v.union(v.literal('supports'), v.literal('summarizes')),
    createdAt: v.number(),
  })
    .index('by_owner_key_and_derived_memory_id', ['ownerKey', 'derivedMemoryId'])
    .index('by_owner_key_and_source_memory_id', ['ownerKey', 'sourceMemoryId']),
})
