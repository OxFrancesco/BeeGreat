import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireEconomyIdentity } from './economyLib/core'
import {
  continueAchievementBackfillPage,
  reconcileAchievementsForOwner,
} from './economyLib/achievements'
import {
  settleFatigueBatchPage,
  settleFatigueForOwner,
} from './economyLib/fatigue'
import { activateFocusShieldCommand } from './economyLib/focusShield'
import {
  abandonGoalCommand,
  completeGoalCommand,
  resurrectGoalCommand,
} from './economyLib/goalLifecycle'
import { spendHoneyCommand } from './economyLib/honeyLedger'
import { economySummary } from './economyLib/summary'

// The handler bodies live in economyLib/ (plain TypeScript helpers, no Convex
// functions): core.ts for identity/Hive/goal-stat primitives, fatigue.ts for
// Brain Fatigue settlement, taskRewards.ts for Task-completion economy,
// focusShield.ts and goalLifecycle.ts for booster and lifecycle commands,
// honeyLedger.ts for cosmetic spends, achievements.ts for reconciliation and
// backfill, and summary.ts for the read model. These re-exports keep the
// module surface other backend files import from './economy' unchanged.
export {
  ensureHive,
  findHive,
  requireEconomyIdentity,
} from './economyLib/core'
export type { IdentityKeys } from './economyLib/core'
export { settleFatigueForOwner } from './economyLib/fatigue'
export { economySummary } from './economyLib/summary'
export { completeTaskWithEconomy } from './economyLib/taskRewards'
export type { TaskCompletionResult } from './economyLib/taskRewards'

const achievementSummaryValidator = v.object({
  id: v.string(),
  title: v.string(),
  rank: v.optional(v.number()),
  kind: v.union(v.literal('goliebee'), v.literal('hive')),
})

const economySummaryValidator = v.object({
  royalJellyBalance: v.number(),
  brainFatigue: v.object({
    isActive: v.boolean(),
    dailyHoneyDrain: v.number(),
    rank: v.number(),
    affectedGoalCount: v.number(),
  }),
  geniusState: v.object({
    isActive: v.boolean(),
    verifiedGoalCount: v.number(),
    requiredGoalCount: v.number(),
  }),
  activeFocusShield: v.union(
    v.object({
      goalId: v.id('goals'),
      goalTitle: v.string(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  weeklyProgress: v.union(
    v.object({
      startedAt: v.number(),
      endsAt: v.number(),
      completedGoals: v.number(),
      requiredGoals: v.number(),
      completed: v.boolean(),
    }),
    v.null(),
  ),
  achievements: v.array(achievementSummaryValidator),
})

export const getSummary = query({
  args: {},
  returns: economySummaryValidator,
  handler: async (ctx) =>
    economySummary(ctx, await requireEconomyIdentity(ctx)),
})

export const settleNow = mutation({
  args: {},
  returns: v.object({ honeyRemoved: v.number(), honeyBalance: v.number() }),
  handler: async (ctx) =>
    settleFatigueForOwner(ctx, await requireEconomyIdentity(ctx)),
})

export const spendHoney = mutation({
  args: { requestId: v.string(), cosmeticId: v.string(), amount: v.number() },
  returns: v.object({ honeyBalance: v.number(), spent: v.number() }),
  handler: async (ctx, args) => spendHoneyCommand(ctx, args),
})

export const activateFocusShield = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({
    goalId: v.id('goals'),
    expiresAt: v.number(),
    royalJellyBalance: v.number(),
  }),
  handler: async (ctx, args) => activateFocusShieldCommand(ctx, args),
})

export const abandonGoal = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({ honeyRemoved: v.number(), honeyBalance: v.number() }),
  handler: async (ctx, args) => abandonGoalCommand(ctx, args),
})

export const resurrectGoal = mutation({
  args: { requestId: v.string(), goalId: v.id('goals') },
  returns: v.object({
    honeyRefunded: v.number(),
    honeyBalance: v.number(),
    royalJellyBalance: v.number(),
  }),
  handler: async (ctx, args) => resurrectGoalCommand(ctx, args),
})

export const completeGoal = mutation({
  args: {
    requestId: v.string(),
    goalId: v.id('goals'),
    confirmed: v.boolean(),
  },
  returns: v.object({ completed: v.boolean() }),
  handler: async (ctx, args) => completeGoalCommand(ctx, args),
})

export const reconcileAchievements = mutation({
  args: {},
  returns: v.object({ unlocked: v.number(), scoreAwarded: v.number() }),
  handler: async (ctx) => {
    const keys = await requireEconomyIdentity(ctx)
    return await reconcileAchievementsForOwner(ctx, keys)
  },
})

export const continueAchievementBackfill = internalMutation({
  args: {
    ownerKey: v.string(),
    userId: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ processed: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => continueAchievementBackfillPage(ctx, args),
})

/** Daily-sweep seam. A scheduler can call batches without exposing owner keys. */
export const settleFatigueBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    now: v.optional(v.number()),
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    processed: v.number(),
  }),
  handler: async (ctx, args) => settleFatigueBatchPage(ctx, args),
})
