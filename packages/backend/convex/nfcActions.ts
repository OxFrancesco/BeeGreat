import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { adjustHydrationForIdentity } from './healthJournal'
import {
  nfcActionDefinitionValidator,
  nfcActionOutcomeValidator,
} from './nfcActionValidators'

const TAG_ORIGIN = 'https://beegreat.app'
const MAX_ACTIONS = 20
const MAX_LABEL_LENGTH = 60
const MIN_HYDRATION_ML = 50
const MAX_HYDRATION_ML = 2_000
const DUPLICATE_WINDOW_MS = 4_000
const UNDO_WINDOW_MS = 5 * 60 * 1_000
const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/

const actionValidator = v.object({
  _id: v.id('nfcActions'),
  label: v.string(),
  enabled: v.boolean(),
  definition: nfcActionDefinitionValidator,
  tagUrl: v.string(),
  lastExecutedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const executionResultValidator = v.object({
  duplicate: v.boolean(),
  executionId: v.id('nfcActionExecutions'),
  action: v.object({
    label: v.string(),
    definition: nfcActionDefinitionValidator,
  }),
  outcome: nfcActionOutcomeValidator,
})

const undoResultValidator = v.object({
  action: v.object({
    label: v.string(),
    definition: nfcActionDefinitionValidator,
  }),
  outcome: nfcActionOutcomeValidator,
  undoneAt: v.number(),
})

type AuthContext = QueryCtx | MutationCtx
type Identity = { ownerKey: string; userId: string }

async function requireIdentity(ctx: AuthContext): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to use NFC actions',
    })
  }
  return { ownerKey: identity.tokenIdentifier, userId: identity.subject }
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: 'INVALID_ARGUMENT', message })
}

function unavailable(): never {
  throw new ConvexError({
    code: 'NOT_FOUND',
    message: 'This tap action is not available',
  })
}

function normalizeLabel(label: string) {
  const normalized = label.trim().replace(/\s+/g, ' ')
  if (normalized.length === 0 || normalized.length > MAX_LABEL_LENGTH) {
    invalidArgument(
      `label must be between 1 and ${MAX_LABEL_LENGTH} characters`,
    )
  }
  return normalized
}

function validateDefinition(definition: Doc<'nfcActions'>['definition']) {
  const actionType: 'hydration' = definition.type
  if (
    actionType === 'hydration' &&
    (!Number.isSafeInteger(definition.amountMl) ||
      definition.amountMl < MIN_HYDRATION_ML ||
      definition.amountMl > MAX_HYDRATION_ML)
  ) {
    invalidArgument(
      `hydration amount must be an integer between ${MIN_HYDRATION_ML} and ${MAX_HYDRATION_ML} millilitres`,
    )
  }
}

function validatePublicId(publicId: string) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) unavailable()
  return publicId
}

function tagUrl(publicId: string) {
  return `${TAG_ORIGIN}/tap/${publicId}`
}

function normalizeAction(action: Doc<'nfcActions'>) {
  return {
    _id: action._id,
    label: action.label,
    enabled: action.enabled,
    definition: action.definition,
    tagUrl: tagUrl(action.publicId),
    lastExecutedAt: action.lastExecutedAt ?? null,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  }
}

function executionResult(
  execution: Doc<'nfcActionExecutions'>,
  duplicate: boolean,
) {
  return {
    duplicate,
    executionId: execution._id,
    action: {
      label: execution.actionLabel,
      definition: execution.definition,
    },
    outcome: execution.outcome,
  }
}

async function findOwnedAction(
  ctx: AuthContext,
  actionId: Id<'nfcActions'>,
  ownerKey: string,
) {
  const action = await ctx.db.get('nfcActions', actionId)
  if (!action || action.ownerKey !== ownerKey) unavailable()
  return action
}

export const list = query({
  args: {},
  returns: v.array(actionValidator),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx)
    const actions = await ctx.db
      .query('nfcActions')
      .withIndex('by_owner_key_and_created_at', (q) =>
        q.eq('ownerKey', ownerKey),
      )
      .order('desc')
      .take(MAX_ACTIONS)
    return actions.map(normalizeAction)
  },
})

export const create = mutation({
  args: {
    label: v.string(),
    definition: nfcActionDefinitionValidator,
  },
  returns: actionValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const label = normalizeLabel(args.label)
    validateDefinition(args.definition)
    const existing = await ctx.db
      .query('nfcActions')
      .withIndex('by_owner_key_and_created_at', (q) =>
        q.eq('ownerKey', identity.ownerKey),
      )
      .take(MAX_ACTIONS)
    if (existing.length >= MAX_ACTIONS) {
      invalidArgument(`You can create up to ${MAX_ACTIONS} NFC actions`)
    }

    const now = Date.now()
    const actionId = await ctx.db.insert('nfcActions', {
      ...identity,
      publicId: crypto.randomUUID().replaceAll('-', ''),
      label,
      enabled: true,
      definition: args.definition,
      createdAt: now,
      updatedAt: now,
    })
    const action = await ctx.db.get('nfcActions', actionId)
    if (!action) throw new Error('NFC action disappeared during creation')
    return normalizeAction(action)
  },
})

export const update = mutation({
  args: {
    actionId: v.id('nfcActions'),
    label: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    definition: v.optional(nfcActionDefinitionValidator),
  },
  returns: actionValidator,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const action = await findOwnedAction(ctx, args.actionId, ownerKey)
    if (args.definition) validateDefinition(args.definition)

    await ctx.db.patch('nfcActions', action._id, {
      ...(args.label !== undefined
        ? { label: normalizeLabel(args.label) }
        : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      ...(args.definition !== undefined ? { definition: args.definition } : {}),
      updatedAt: Date.now(),
    })
    const updated = await ctx.db.get('nfcActions', action._id)
    if (!updated) throw new Error('NFC action disappeared during update')
    return normalizeAction(updated)
  },
})

export const remove = mutation({
  args: { actionId: v.id('nfcActions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx)
    const action = await findOwnedAction(ctx, args.actionId, ownerKey)
    await ctx.db.delete(action._id)
    return null
  },
})

export const execute = mutation({
  args: {
    publicId: v.string(),
    localDate: v.string(),
    timeZone: v.string(),
  },
  returns: executionResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const publicId = validatePublicId(args.publicId)
    const action = await ctx.db
      .query('nfcActions')
      .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
      .unique()
    if (!action || action.ownerKey !== identity.ownerKey || !action.enabled) {
      unavailable()
    }

    const now = Date.now()
    if (
      action.lastExecutionId &&
      action.lastExecutedAt &&
      now - action.lastExecutedAt < DUPLICATE_WINDOW_MS
    ) {
      const previous = await ctx.db.get(
        'nfcActionExecutions',
        action.lastExecutionId,
      )
      if (
        previous &&
        previous.ownerKey === identity.ownerKey &&
        !previous.undoneAt
      ) {
        return executionResult(previous, true)
      }
    }

    let outcome: Doc<'nfcActionExecutions'>['outcome']
    switch (action.definition.type) {
      case 'hydration': {
        const hydration = await adjustHydrationForIdentity(ctx, identity, {
          localDate: args.localDate,
          timeZone: args.timeZone,
          deltaMl: action.definition.amountMl,
        })
        outcome = {
          type: 'hydration',
          localDate: args.localDate,
          timeZone: args.timeZone,
          appliedMl: hydration.appliedDeltaMl,
        }
        break
      }
    }

    const executionId = await ctx.db.insert('nfcActionExecutions', {
      ...identity,
      actionId: action._id,
      actionLabel: action.label,
      definition: action.definition,
      outcome,
      executedAt: now,
    })
    await ctx.db.patch('nfcActions', action._id, {
      lastExecutionId: executionId,
      lastExecutedAt: now,
    })
    const execution = await ctx.db.get('nfcActionExecutions', executionId)
    if (!execution) throw new Error('NFC action execution disappeared')
    return executionResult(execution, false)
  },
})

export const undo = mutation({
  args: { executionId: v.id('nfcActionExecutions') },
  returns: undoResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const execution = await ctx.db.get('nfcActionExecutions', args.executionId)
    if (!execution || execution.ownerKey !== identity.ownerKey) unavailable()
    if (execution.undoneAt) {
      invalidArgument('This tap action has already been undone')
    }
    const now = Date.now()
    if (now - execution.executedAt > UNDO_WINDOW_MS) {
      invalidArgument('This tap action can no longer be undone')
    }

    let outcome: Doc<'nfcActionExecutions'>['outcome']
    switch (execution.outcome.type) {
      case 'hydration': {
        const hydration =
          execution.outcome.appliedMl === 0
            ? null
            : await adjustHydrationForIdentity(ctx, identity, {
                localDate: execution.outcome.localDate,
                timeZone: execution.outcome.timeZone,
                deltaMl: -execution.outcome.appliedMl,
              })
        outcome = {
          ...execution.outcome,
          appliedMl: hydration ? -hydration.appliedDeltaMl : 0,
        }
        break
      }
    }

    await ctx.db.patch('nfcActionExecutions', execution._id, { undoneAt: now })
    return {
      action: {
        label: execution.actionLabel,
        definition: execution.definition,
      },
      outcome,
      undoneAt: now,
    }
  },
})
