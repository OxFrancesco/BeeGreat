import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

export async function getGoalFocusOwner(ctx: QueryCtx | MutationCtx, goalId: Id<'goals'>) {
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
  const [golieBee, highlights, firstFocusBundles] = await Promise.all([
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
  ])

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
