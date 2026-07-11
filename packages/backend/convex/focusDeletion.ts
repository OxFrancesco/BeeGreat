import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

export async function getGoalFocusOwner(
  ctx: QueryCtx | MutationCtx,
  goalId: Id<'goals'>,
) {
  const golieBee = await ctx.db
    .query('golieBees')
    .withIndex('by_goal_id', (q) => q.eq('goalId', goalId))
    .unique()
  return golieBee?.ownerKey ?? null
}

/** Legacy Goals have no GolieBee owner and keep subject-based app access. */
export async function canAccessGoalFocusLineage(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  goalId: Id<'goals'>,
) {
  const focusOwner = await getGoalFocusOwner(ctx, goalId)
  return focusOwner === null || focusOwner === ownerKey
}

/** Counts only Active Goals visible to one authenticated Hive owner. */
export async function countAccessibleActiveGoals(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  userId: string,
) {
  const activeGoals = await ctx.db
    .query('goals')
    .withIndex('by_user', (q) => q.eq('userId', userId).eq('status', 'active'))
    .collect()
  let count = 0
  for (const goal of activeGoals) {
    if (await canAccessGoalFocusLineage(ctx, ownerKey, goal._id)) count += 1
  }
  return count
}

/** Caller-supplied subjects never authorize access to token-owned focus rows. */
export async function requireGoalFocusOwner(
  ctx: MutationCtx,
  ownerKey: string,
  goalId: Id<'goals'>,
  notFoundMessage = 'Goal not found',
) {
  const focusOwner = await getGoalFocusOwner(ctx, goalId)
  if (focusOwner && focusOwner !== ownerKey) {
    throw new ConvexError({ code: 'NOT_FOUND', message: notFoundMessage })
  }
  return focusOwner
}

/** Removes the live focus-world rows owned by a Goal inside its caller's mutation. */
export async function deleteGoalFocusState(
  ctx: MutationCtx,
  ownerKey: string,
  goalId: Id<'goals'>,
) {
  await requireGoalFocusOwner(ctx, ownerKey, goalId)
  const [
    golieBee,
    highlights,
    firstFocusBundles,
    progressEvents,
    honeyLedger,
    honeyEconomy,
    goalStats,
    goalAchievements,
    boosters,
    commandReceipts,
    weeklyRosters,
    achievementBackfill,
  ] = await Promise.all([
    ctx.db
      .query('golieBees')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .unique(),
    ctx.db
      .query('highlights')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('firstFocusBundles')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('verifiedProgressEvents')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('honeyLedgerEntries')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('honeyEconomyEntries')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('goalEconomyStats')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .unique(),
    ctx.db
      .query('achievementUnlocks')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('boosterActivations')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('economyCommandReceipts')
      .withIndex('by_owner_key_and_goal_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('goalId', goalId),
      )
      .collect(),
    ctx.db
      .query('weeklyProgressRosters')
      .withIndex('by_owner_key_and_started_at', (q) =>
        q.eq('ownerKey', ownerKey),
      )
      .collect(),
    ctx.db
      .query('achievementBackfillStates')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .unique(),
  ])

  // Privacy deletion preserves anonymous accounting and Hive totals while
  // removing every Goal/Task/bee identifier from retained history.
  for (const event of progressEvents) {
    await ctx.db.insert('anonymizedEconomyEvents', {
      ownerKey: event.ownerKey,
      userId: event.userId,
      kind: 'verified-progress',
      honeyDelta: event.honeyDelta,
      scoreDelta: event.scoreDelta,
      occurredAt: event.occurredAt,
    })
  }
  for (const entry of honeyLedger) {
    await ctx.db.insert('anonymizedEconomyEvents', {
      ownerKey: entry.ownerKey,
      userId: entry.userId,
      kind: 'honey-ledger',
      honeyDelta: entry.delta,
      scoreDelta: 0,
      occurredAt: entry.occurredAt,
    })
    await ctx.db.delete('honeyLedgerEntries', entry._id)
  }
  for (const entry of honeyEconomy) {
    await ctx.db.insert('anonymizedEconomyEvents', {
      ownerKey: entry.ownerKey,
      userId: entry.userId,
      kind: 'honey-economy',
      honeyDelta: entry.delta,
      scoreDelta: 0,
      occurredAt: entry.occurredAt,
    })
    await ctx.db.delete('honeyEconomyEntries', entry._id)
  }
  for (const event of progressEvents) {
    await ctx.db.delete('verifiedProgressEvents', event._id)
  }
  if (goalStats) await ctx.db.delete('goalEconomyStats', goalStats._id)
  for (const unlock of goalAchievements) {
    await ctx.db.insert('anonymizedEconomyEvents', {
      ownerKey: unlock.ownerKey,
      userId: unlock.userId,
      kind: 'achievement',
      honeyDelta: 0,
      scoreDelta: unlock.scoreAwarded,
      occurredAt: unlock.unlockedAt,
    })
    await ctx.db.delete('achievementUnlocks', unlock._id)
  }
  for (const booster of boosters) {
    await ctx.db.delete('boosterActivations', booster._id)
  }
  for (const receipt of commandReceipts) {
    await ctx.db.delete('economyCommandReceipts', receipt._id)
  }
  for (const roster of weeklyRosters) {
    if (!roster.goalIds.some((id) => id === goalId)) continue
    const wasSatisfied = roster.satisfiedGoalIds.some((id) => id === goalId)
    await ctx.db.patch('weeklyProgressRosters', roster._id, {
      goalIds: roster.goalIds.filter((id) => id !== goalId),
      satisfiedGoalIds: roster.satisfiedGoalIds.filter((id) => id !== goalId),
      anonymousRequiredCount: (roster.anonymousRequiredCount ?? 0) + 1,
      anonymousSatisfiedCount:
        (roster.anonymousSatisfiedCount ?? 0) + (wasSatisfied ? 1 : 0),
    })
  }
  if (achievementBackfill) {
    await ctx.db.patch('achievementBackfillStates', achievementBackfill._id, {
      recentGoalProgress: achievementBackfill.recentGoalProgress.filter(
        (entry) => entry.goalId !== goalId,
      ),
    })
  }
  for (const highlight of highlights) {
    await ctx.db.delete('highlights', highlight._id)
  }
  if (golieBee) {
    await ctx.db.delete('golieBees', golieBee._id)
  }
  for (const bundle of firstFocusBundles) {
    await ctx.db.delete('firstFocusBundles', bundle._id)
  }
}

export async function deleteProjectFocusState(
  ctx: MutationCtx,
  ownerKey: string,
  projectId: Id<'projects'>,
) {
  const [highlights, firstFocusBundles] = await Promise.all([
    ctx.db
      .query('highlights')
      .withIndex('by_owner_key_and_project_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('projectId', projectId),
      )
      .collect(),
    ctx.db
      .query('firstFocusBundles')
      .withIndex('by_owner_key_and_project_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('projectId', projectId),
      )
      .collect(),
  ])
  for (const highlight of highlights) {
    await ctx.db.delete('highlights', highlight._id)
  }
  for (const bundle of firstFocusBundles) {
    await ctx.db.delete('firstFocusBundles', bundle._id)
  }
}

export async function deleteTaskFocusState(
  ctx: MutationCtx,
  ownerKey: string,
  taskIds: Id<'tasks'>[],
) {
  for (const taskId of taskIds) {
    const [highlights, firstFocusBundles] = await Promise.all([
      ctx.db
        .query('highlights')
        .withIndex('by_owner_key_and_task_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('taskId', taskId),
        )
        .collect(),
      ctx.db
        .query('firstFocusBundles')
        .withIndex('by_owner_key_and_task_id', (q) =>
          q.eq('ownerKey', ownerKey).eq('taskId', taskId),
        )
        .collect(),
    ])
    for (const highlight of highlights) {
      await ctx.db.delete('highlights', highlight._id)
    }
    for (const bundle of firstFocusBundles) {
      await ctx.db.delete('firstFocusBundles', bundle._id)
    }
  }
}
