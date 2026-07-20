import { v } from 'convex/values'

/**
 * The NFC layer stores declarative actions. Each new use case adds one member
 * here and one execution adapter in nfcActions.ts; tags and deep links remain
 * unchanged.
 */
export const nfcActionDefinitionValidator = v.union(
  v.object({
    type: v.literal('hydration'),
    amountMl: v.number(),
  }),
)

/** Durable results make generic undo possible without teaching the client how
 * each action changed its underlying domain. */
export const nfcActionOutcomeValidator = v.union(
  v.object({
    type: v.literal('hydration'),
    localDate: v.string(),
    timeZone: v.string(),
    appliedMl: v.number(),
  }),
)
