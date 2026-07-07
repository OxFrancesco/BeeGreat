import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

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
})
