import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { countAccessibleActiveGoals } from './focusDeletion'
import { MAX_ACTIVE_GOALS } from './focusConstants'
import {
  completeTaskWithEconomy,
  economySummary,
  settleFatigueForOwner,
} from './economy'

const bundleValidator = v.object({
  goalId: v.id('goals'),
  projectId: v.id('projects'),
  taskId: v.id('tasks'),
  highlightId: v.id('highlights'),
  golieBeeId: v.id('golieBees'),
})

const confirmPlanResultValidator = v.union(
  v.object({ status: v.literal('cancelled'), bundle: v.null() }),
  v.object({ status: v.literal('created'), bundle: bundleValidator }),
  v.object({ status: v.literal('existing'), bundle: bundleValidator }),
)

const currentHiveValidator = v.object({
  hive: v.object({
    honeyBalance: v.number(),
    honeycombScore: v.number(),
    royalJellyBalance: v.number(),
  }),
  activeGoals: v.array(
    v.object({
      goalId: v.id('goals'),
      title: v.string(),
      finalGoal: v.union(v.string(), v.null()),
      golieBee: v.object({
        golieBeeId: v.id('golieBees'),
        seed: v.string(),
        variant: v.literal('mvp-default'),
        status: v.literal('active'),
      }),
    }),
  ),
  activeHighlight: v.union(
    v.object({
      highlightId: v.id('highlights'),
      goalId: v.id('goals'),
      projectId: v.id('projects'),
      taskId: v.id('tasks'),
      title: v.string(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  latestVerifiedProgress: v.union(
    v.object({
      eventId: v.id('verifiedProgressEvents'),
      goalId: v.id('goals'),
      taskId: v.id('tasks'),
      occurredAt: v.number(),
      honeyDelta: v.number(),
      scoreDelta: v.number(),
    }),
    v.null(),
  ),
  economy: v.object({
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
    achievements: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        rank: v.optional(v.number()),
        kind: v.union(v.literal('goliebee'), v.literal('hive')),
      }),
    ),
  }),
})

const completeHighlightResultValidator = v.object({
  status: v.union(v.literal('completed'), v.literal('already_completed')),
  taskId: v.id('tasks'),
  honeyAwarded: v.number(),
  scoreAwarded: v.number(),
  honeyBalance: v.number(),
  honeycombScore: v.number(),
})

type IdentityKeys = {
  ownerKey: string
  userId: string
}

async function requireIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<IdentityKeys> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    })
  }
  return {
    ownerKey: identity.tokenIdentifier,
    userId: identity.subject,
  }
}

function requiredText(value: string, field: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ConvexError({
      code: 'INVALID_PLAN',
      message: `${field} cannot be empty`,
    })
  }
  return trimmed
}

function bundleFromReceipt(receipt: Doc<'firstFocusBundles'>) {
  return {
    goalId: receipt.goalId,
    projectId: receipt.projectId,
    taskId: receipt.taskId,
    highlightId: receipt.highlightId,
    golieBeeId: receipt.golieBeeId,
  }
}

async function findHive(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  return await ctx.db
    .query('hives')
    .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
    .unique()
}

async function findGolieBees(ctx: QueryCtx, ownerKey: string) {
  return await ctx.db
    .query('golieBees')
    .withIndex('by_owner_key_and_status', (q) =>
      q.eq('ownerKey', ownerKey).eq('status', 'active'),
    )
    .take(MAX_ACTIVE_GOALS)
}

async function findActiveHighlights(ctx: QueryCtx, ownerKey: string) {
  return await ctx.db
    .query('highlights')
    .withIndex('by_owner_key_and_status', (q) =>
      q.eq('ownerKey', ownerKey).eq('status', 'active'),
    )
    .take(2)
}

async function findLatestProgress(ctx: QueryCtx, ownerKey: string) {
  const events = await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_occurred_at', (q) =>
      q.eq('ownerKey', ownerKey),
    )
    .order('desc')
    .take(1)
  return events[0] ?? null
}

async function currentHive(ctx: QueryCtx, ownerKey: string) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  const keys = { ownerKey, userId: identity.subject }
  const [hive, golieBees, activeHighlights, latestProgress, economy] =
    await Promise.all([
      findHive(ctx, ownerKey),
      findGolieBees(ctx, ownerKey),
      findActiveHighlights(ctx, ownerKey),
      findLatestProgress(ctx, ownerKey),
      economySummary(ctx, keys),
    ])

  const activeGoals = []
  for (const golieBee of golieBees) {
    const goal = await ctx.db.get('goals', golieBee.goalId)
    if (!goal || goal.status !== 'active' || golieBee.status !== 'active')
      continue
    activeGoals.push({
      goalId: goal._id,
      title: goal.title,
      finalGoal: goal.finalGoal ?? null,
      golieBee: {
        golieBeeId: golieBee._id,
        seed: golieBee.seed ?? golieBee._id,
        variant: golieBee.variant,
        status: golieBee.status,
      },
    })
  }

  const now = Date.now()
  const highlight = activeHighlights.find((entry) => entry.expiresAt > now)
  const highlightedTask = highlight
    ? await ctx.db.get('tasks', highlight.taskId)
    : null

  return {
    hive: {
      honeyBalance: hive?.honeyBalance ?? 0,
      honeycombScore: hive?.honeycombScore ?? 0,
      royalJellyBalance: hive?.royalJellyBalance ?? 0,
    },
    activeGoals,
    activeHighlight:
      highlight && highlightedTask && highlightedTask.status === 'todo'
        ? {
            highlightId: highlight._id,
            goalId: highlight.goalId,
            projectId: highlight.projectId,
            taskId: highlight.taskId,
            title: highlightedTask.title,
            expiresAt: highlight.expiresAt,
          }
        : null,
    latestVerifiedProgress: latestProgress
      ? {
          eventId: latestProgress._id,
          goalId: latestProgress.goalId,
          taskId: latestProgress.taskId,
          occurredAt: latestProgress.occurredAt,
          honeyDelta: latestProgress.honeyDelta,
          scoreDelta: latestProgress.scoreDelta,
        }
      : null,
    economy,
  }
}

/** Authenticated, reactive summary for the current user's Hive. */
export const getCurrent = query({
  args: {},
  returns: currentHiveValidator,
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    return await currentHive(ctx, ownerKey)
  },
})

/**
 * Confirms the editable preview in one Convex transaction. `confirmed: false`
 * is deliberately a zero-write cancellation path.
 */
export const confirmPlan = mutation({
  args: {
    requestId: v.string(),
    confirmed: v.boolean(),
    goalTitle: v.string(),
    goalOutcome: v.optional(v.string()),
    projectTitle: v.string(),
    taskTitle: v.string(),
    highlightExpiresAt: v.number(),
  },
  returns: confirmPlanResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    if (!args.confirmed) {
      return { status: 'cancelled' as const, bundle: null }
    }

    const requestId = requiredText(args.requestId, 'Request id')
    const existing = await ctx.db
      .query('firstFocusBundles')
      .withIndex('by_owner_key_and_request_id', (q) =>
        q.eq('ownerKey', identity.ownerKey).eq('requestId', requestId),
      )
      .unique()
    if (existing) {
      return {
        status: 'existing' as const,
        bundle: bundleFromReceipt(existing),
      }
    }

    const goalTitle = requiredText(args.goalTitle, 'Goal title')
    const projectTitle = requiredText(args.projectTitle, 'Project title')
    const taskTitle = requiredText(args.taskTitle, 'Task title')
    const goalOutcome = args.goalOutcome?.trim() || undefined
    const now = Date.now()
    if (args.highlightExpiresAt <= now) {
      throw new ConvexError({
        code: 'INVALID_PLAN',
        message: 'Highlight expiry must be in the future',
      })
    }

    const activeGoalCount = await countAccessibleActiveGoals(
      ctx,
      identity.ownerKey,
      identity.userId,
    )
    if (activeGoalCount >= MAX_ACTIVE_GOALS) {
      throw new ConvexError({
        code: 'ACTIVE_GOAL_LIMIT',
        message: `A Hive can have at most ${MAX_ACTIVE_GOALS} Active Goals`,
      })
    }

    const priorHighlights = await ctx.db
      .query('highlights')
      .withIndex('by_owner_key_and_status', (q) =>
        q.eq('ownerKey', identity.ownerKey).eq('status', 'active'),
      )
      .take(2)
    for (const prior of priorHighlights) {
      await ctx.db.patch('highlights', prior._id, {
        status: 'expired',
        expiredAt: now,
      })
    }

    let hive = await ctx.db
      .query('hives')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', identity.ownerKey))
      .unique()
    if (!hive) {
      const hiveId = await ctx.db.insert('hives', {
        ...identity,
        honeyBalance: 0,
        honeycombScore: 0,
      })
      hive = await ctx.db.get('hives', hiveId)
    }
    if (!hive) throw new Error('Failed to create Hive')

    // Settle the prior activation roster before adding a new Brain Fatigue rank.
    await settleFatigueForOwner(ctx, identity, now)

    const goalId = await ctx.db.insert('goals', {
      userId: identity.userId,
      title: goalTitle,
      finalGoal: goalOutcome,
      status: 'active',
      activatedAt: now,
      lifecycleUpdatedAt: now,
    })
    const projectId = await ctx.db.insert('projects', {
      userId: identity.userId,
      goalId,
      title: projectTitle,
      status: 'active',
    })
    const taskId = await ctx.db.insert('tasks', {
      userId: identity.userId,
      goalId,
      projectId,
      title: taskTitle,
      status: 'todo',
    })
    const golieBeeId = await ctx.db.insert('golieBees', {
      ...identity,
      goalId,
      seed: requestId,
      variant: 'mvp-default',
      status: 'active',
    })
    const highlightId = await ctx.db.insert('highlights', {
      ...identity,
      goalId,
      projectId,
      taskId,
      status: 'active',
      expiresAt: args.highlightExpiresAt,
    })
    const bundle = {
      goalId,
      projectId,
      taskId,
      highlightId,
      golieBeeId,
    }
    await ctx.db.insert('firstFocusBundles', {
      ...identity,
      requestId,
      ...bundle,
    })
    return { status: 'created' as const, bundle }
  },
})

async function findProgressByRequest(
  ctx: MutationCtx,
  ownerKey: string,
  requestId: string,
) {
  return await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_request_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('requestId', requestId),
    )
    .unique()
}

async function findProgressByTask(
  ctx: MutationCtx,
  ownerKey: string,
  taskId: Id<'tasks'>,
) {
  return await ctx.db
    .query('verifiedProgressEvents')
    .withIndex('by_owner_key_and_task_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('taskId', taskId),
    )
    .unique()
}

async function findHighlightByTask(
  ctx: MutationCtx,
  ownerKey: string,
  taskId: Id<'tasks'>,
) {
  return await ctx.db
    .query('highlights')
    .withIndex('by_owner_key_and_task_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('taskId', taskId),
    )
    .unique()
}

async function completeHighlightedTask(
  ctx: MutationCtx,
  keys: IdentityKeys,
  args: { requestId: string; taskId: Id<'tasks'> },
) {
  const requestId = requiredText(args.requestId, 'Request id')
  const priorRequest = await findProgressByRequest(
    ctx,
    keys.ownerKey,
    requestId,
  )
  if (priorRequest) {
    if (priorRequest.taskId !== args.taskId) {
      throw new ConvexError({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Request id was already used for another Task',
      })
    }
    const hive = await findHive(ctx, keys.ownerKey)
    return {
      status: 'already_completed' as const,
      taskId: args.taskId,
      honeyAwarded: 0,
      scoreAwarded: 0,
      honeyBalance: hive?.honeyBalance ?? 0,
      honeycombScore: hive?.honeycombScore ?? 0,
    }
  }

  const priorTaskProgress = await findProgressByTask(
    ctx,
    keys.ownerKey,
    args.taskId,
  )
  if (priorTaskProgress) {
    const hive = await findHive(ctx, keys.ownerKey)
    return {
      status: 'already_completed' as const,
      taskId: args.taskId,
      honeyAwarded: 0,
      scoreAwarded: 0,
      honeyBalance: hive?.honeyBalance ?? 0,
      honeycombScore: hive?.honeycombScore ?? 0,
    }
  }

  const highlight = await findHighlightByTask(ctx, keys.ownerKey, args.taskId)
  const now = Date.now()
  if (
    !highlight ||
    highlight.status !== 'active' ||
    highlight.expiresAt <= now
  ) {
    throw new ConvexError({
      code: 'HIGHLIGHT_NOT_ACTIVE',
      message: 'Active Highlight not found for this Task',
    })
  }

  const task = await ctx.db.get('tasks', args.taskId)
  if (!task || task.userId !== keys.userId) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Highlighted Task not found',
    })
  }
  if (task.status === 'done') {
    await ctx.db.patch('highlights', highlight._id, {
      status: 'expired',
      expiredAt: now,
    })
    const hive = await findHive(ctx, keys.ownerKey)
    return {
      status: 'already_completed' as const,
      taskId: args.taskId,
      honeyAwarded: 0,
      scoreAwarded: 0,
      honeyBalance: hive?.honeyBalance ?? 0,
      honeycombScore: hive?.honeycombScore ?? 0,
    }
  }

  await ctx.db.patch('highlights', highlight._id, {
    status: 'expired',
    expiredAt: now,
  })
  return await completeTaskWithEconomy(ctx, keys, {
    requestId,
    task,
    projectId: highlight.projectId,
    now,
  })
}

/** Completes only the caller's current highlighted Task, exactly once. */
export const completeHighlight = mutation({
  args: { requestId: v.string(), taskId: v.id('tasks') },
  returns: completeHighlightResultValidator,
  handler: async (ctx, args) => {
    const keys = await requireIdentity(ctx)
    return await completeHighlightedTask(ctx, keys, args)
  },
})

/**
 * Authenticated settlement seam for legacy task mutations. Returns null when
 * the Task is not the caller's current Highlight so callers can keep their
 * normal non-highlight behavior.
 */
export async function settleActiveHighlightForAuthenticatedTask(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
) {
  const keys = await requireIdentity(ctx)
  const highlight = await ctx.db
    .query('highlights')
    .withIndex('by_task_id', (q) => q.eq('taskId', taskId))
    .unique()
  if (highlight && highlight.ownerKey !== keys.ownerKey) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Highlighted Task not found',
    })
  }
  if (
    !highlight ||
    highlight.status !== 'active' ||
    highlight.expiresAt <= Date.now()
  ) {
    return null
  }
  return await completeHighlightedTask(ctx, keys, {
    requestId: `authenticated-task-completion:${taskId}`,
    taskId,
  })
}
