// Read model for the economy summary card: Royal Jelly balance, Brain
// Fatigue drain, Genius state, active Focus Shield, weekly progress, and
// unlocked achievements. Plain TypeScript helpers only — the Convex function
// definitions live in economy.ts.

import type { QueryCtx } from '../_generated/server'
import { fatigueDailyRateForRank, totalDailyFatigue } from '../economyPolicy'
import {
  activeEconomyGoals,
  activeFocusShield,
  findHive,
  geniusProgress,
  type IdentityKeys,
} from './core'
import { achievementPresentation } from './achievements'

export async function economySummary(
  ctx: QueryCtx,
  keys: IdentityKeys,
  now = Date.now(),
) {
  const [hive, goals, shield, rosterRows, unlocks] = await Promise.all([
    findHive(ctx, keys.ownerKey),
    activeEconomyGoals(ctx, keys),
    activeFocusShield(ctx, keys.ownerKey, now),
    ctx.db
      .query('weeklyProgressRosters')
      .withIndex('by_owner_key_and_started_at', (q) =>
        q.eq('ownerKey', keys.ownerKey),
      )
      .order('desc')
      .take(1),
    ctx.db
      .query('achievementUnlocks')
      .withIndex('by_owner_key_and_unlocked_at', (q) =>
        q.eq('ownerKey', keys.ownerKey),
      )
      .order('desc')
      .take(100),
  ])
  const genius = await geniusProgress(ctx, keys, goals, now)
  const shieldedRank = shield
    ? goals.findIndex((goal) => goal._id === shield.goalId) + 1
    : 0
  const shieldedRate =
    shieldedRank > 0 ? fatigueDailyRateForRank(shieldedRank) : 0
  const dailyHoneyDrain = genius.isActive
    ? 0
    : totalDailyFatigue(goals.length) - shieldedRate
  const shieldGoal = shield ? await ctx.db.get('goals', shield.goalId) : null
  const roster = rosterRows[0]
  return {
    royalJellyBalance: hive?.royalJellyBalance ?? 0,
    brainFatigue: {
      isActive: dailyHoneyDrain > 0,
      dailyHoneyDrain,
      rank: goals.length,
      affectedGoalCount: genius.isActive
        ? 0
        : goals.filter((_, index) => fatigueDailyRateForRank(index + 1) > 0)
            .length - (shieldedRate > 0 ? 1 : 0),
    },
    geniusState: genius,
    activeFocusShield:
      shield && shieldGoal
        ? {
            goalId: shield.goalId,
            goalTitle: shieldGoal.title,
            expiresAt: shield.expiresAt,
          }
        : null,
    weeklyProgress: roster
      ? {
          startedAt: roster.startedAt,
          endsAt: roster.endsAt,
          completedGoals:
            roster.satisfiedGoalIds.length +
            (roster.anonymousSatisfiedCount ?? 0),
          requiredGoals:
            roster.goalIds.length + (roster.anonymousRequiredCount ?? 0),
          completed: roster.completedAt !== undefined,
        }
      : null,
    achievements: unlocks.map((unlock) => achievementPresentation(unlock)),
  }
}
