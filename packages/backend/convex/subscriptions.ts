import type { WithoutSystemFields } from 'convex/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { requireUserId } from './helpers'
import {
  isClerkUserId,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_MONTHLY_PRODUCT_ID,
} from './revenueCatWebhook'

const environmentValidator = v.union(
  v.literal('SANDBOX'),
  v.literal('PRODUCTION'),
)

const ACCESS_CONTINUES_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_PAUSED',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
])

type EntitlementContext = Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>

async function subscriptionStatus(
  ctx: EntitlementContext,
  userId: string,
  now: number,
) {
  const [rows, latestCheck] = await Promise.all([
    ctx.db
      .query('subscriptionEntitlements')
      .withIndex('by_user_and_entitlement', (q) =>
        q
          .eq('userId', userId)
          .eq('entitlementId', REVENUECAT_ENTITLEMENT_ID),
      )
      .collect(),
    ctx.db
      .query('subscriptionStatusChecks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first(),
  ])
  const activeRows = rows.filter(
    (row) =>
      row.active &&
      row.productId === REVENUECAT_MONTHLY_PRODUCT_ID &&
      row.expiresAt > now,
  )
  const active = activeRows.length > 0
  const latest = (active ? activeRows : rows).reduce<
    (typeof rows)[number] | undefined
  >(
    (current, row) =>
      !current || row.expiresAt > current.expiresAt ? row : current,
    undefined,
  )
  const refreshedAt = rows.reduce(
    (current, row) => Math.max(current, row.updatedAt),
    latestCheck?.checkedAt ?? 0,
  )

  return {
    active,
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    productId: active ? latest?.productId ?? null : null,
    environment: active ? latest?.environment ?? null : null,
    expiresAt: latest?.expiresAt ?? null,
    refreshedAt: refreshedAt > 0 ? refreshedAt : null,
  }
}

/** App-facing status for diagnostics; RevenueCat remains the paywall UI source. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return await subscriptionStatus(ctx, userId, Date.now())
  },
})

/** Trusted Worker-facing check used before any paid AI or voice request. */
export const statusForUser = internalQuery({
  args: { userId: v.string(), now: v.number() },
  handler: async (ctx, { userId, now }) =>
    await subscriptionStatus(ctx, userId, now),
})

/**
 * Persists a validated RevenueCat Customer Info lookup. A successful inactive
 * lookup revokes cached grants; an unavailable or malformed lookup never calls
 * this mutation and therefore cannot replace known state.
 */
export const applyRevenueCatRestSnapshot = internalMutation({
  args: {
    userId: v.string(),
    checkedAt: v.number(),
    observedAt: v.optional(v.number()),
    active: v.boolean(),
    productId: v.optional(v.string()),
    environment: v.optional(environmentValidator),
    periodStartedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const observedAt = args.observedAt ?? args.checkedAt
    if (observedAt > args.checkedAt) {
      throw new Error('Invalid RevenueCat snapshot timestamps')
    }
    if (
      args.active &&
      (args.productId !== REVENUECAT_MONTHLY_PRODUCT_ID ||
        args.environment === undefined ||
        args.periodStartedAt === undefined ||
        args.expiresAt === undefined ||
        args.expiresAt <= args.checkedAt)
    ) {
      throw new Error('Invalid active RevenueCat snapshot')
    }

    const [existingCheck, rows] = await Promise.all([
      ctx.db
        .query('subscriptionStatusChecks')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .first(),
      ctx.db
        .query('subscriptionEntitlements')
        .withIndex('by_user_and_entitlement', (q) =>
          q
            .eq('userId', args.userId)
            .eq('entitlementId', REVENUECAT_ENTITLEMENT_ID),
        )
        .collect(),
    ])
    const existingCheckObservedAt =
      existingCheck?.observedAt ?? existingCheck?.checkedAt ?? 0
    const hasNewerState =
      (existingCheck !== null && existingCheckObservedAt >= observedAt) ||
      rows.some((row) =>
        row.latestEventType === 'REST_RECONCILIATION'
          ? row.latestEventTimestampMs >= observedAt
          : row.updatedAt >= observedAt,
      )
    if (hasNewerState) {
      return await subscriptionStatus(ctx, args.userId, args.checkedAt)
    }

    if (!existingCheck || existingCheckObservedAt < observedAt) {
      const check: WithoutSystemFields<Doc<'subscriptionStatusChecks'>> = {
        userId: args.userId,
        checkedAt: args.checkedAt,
        observedAt,
        active: args.active,
      }
      if (args.productId) check.productId = args.productId
      if (args.environment) check.environment = args.environment
      if (args.periodStartedAt !== undefined) {
        check.periodStartedAt = args.periodStartedAt
      }
      if (args.expiresAt !== undefined) check.expiresAt = args.expiresAt
      if (args.reason) check.reason = args.reason
      if (existingCheck) {
        await ctx.db.replace(existingCheck._id, check)
      } else {
        await ctx.db.insert('subscriptionStatusChecks', check)
      }
    }

    const eventMetadata = {
      latestEventId: `rest:${observedAt}`,
      latestEventType: 'REST_RECONCILIATION',
      latestEventTimestampMs: observedAt,
      updatedAt: args.checkedAt,
    }

    if (!args.active) {
      for (const row of rows) {
        await ctx.db.patch(row._id, { active: false, ...eventMetadata })
      }
      return await subscriptionStatus(ctx, args.userId, args.checkedAt)
    }

    const environment = args.environment
    const periodStartedAt = args.periodStartedAt
    const expiresAt = args.expiresAt
    // The active branch above proves these are present; keeping this guard
    // makes that invariant explicit to TypeScript and future maintainers.
    if (
      environment === undefined ||
      periodStartedAt === undefined ||
      expiresAt === undefined
    ) {
      throw new Error('Invalid active RevenueCat snapshot')
    }
    const selected = rows.find((row) => row.environment === environment)
    for (const row of rows) {
      if (row.environment === environment) continue
      await ctx.db.patch(row._id, { active: false, ...eventMetadata })
    }
    const update = {
      userId: args.userId,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
      productId: REVENUECAT_MONTHLY_PRODUCT_ID,
      environment,
      active: true,
      periodStartedAt,
      expiresAt,
      ...eventMetadata,
    }
    if (!selected) {
      await ctx.db.insert('subscriptionEntitlements', update)
    } else {
      await ctx.db.patch(selected._id, update)
    }
    return await subscriptionStatus(ctx, args.userId, args.checkedAt)
  },
})

type ReceiptOutcome = 'applied' | 'ignored' | 'stale'
type ReceiptResult = { status: ReceiptOutcome; reason?: string }

/**
 * Applies the normalized subset of a RevenueCat webhook in one transaction.
 * Billing-period start is the primary ordering key because App Store can send
 * a renewal before that period starts. Event time breaks ties within a period.
 */
export const applyRevenueCatEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    appUserId: v.optional(v.string()),
    environment: v.optional(environmentValidator),
    productId: v.optional(v.string()),
    entitlementIds: v.array(v.string()),
    purchasedAtMs: v.optional(v.number()),
    expirationAtMs: v.optional(v.number()),
    gracePeriodExpirationAtMs: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
    eventTimestampMs: v.number(),
    receivedAt: v.number(),
    transferredFrom: v.array(v.string()),
    transferredTo: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query('revenueCatWebhookEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', args.eventId))
      .unique()
    if (duplicate) {
      return { status: 'duplicate' as const, outcome: duplicate.outcome }
    }

    const recordReceipt = async (
      outcome: ReceiptOutcome,
      reason?: string,
    ) => {
      const receipt: WithoutSystemFields<Doc<'revenueCatWebhookEvents'>> = {
        eventId: args.eventId,
        type: args.type,
        eventTimestampMs: args.eventTimestampMs,
        receivedAt: args.receivedAt,
        outcome,
      }
      if (args.environment) receipt.environment = args.environment
      if (args.productId) receipt.productId = args.productId
      if (reason) receipt.reason = reason
      await ctx.db.insert('revenueCatWebhookEvents', receipt)
      const result: ReceiptResult = { status: outcome }
      if (reason) result.reason = reason
      return result
    }

    if (args.type === 'TRANSFER') {
      let revoked = 0
      let moved = 0
      const sources = new Set(args.transferredFrom.filter(isClerkUserId))
      const destinations = [
        ...new Set(
          args.transferredTo.filter(
            (userId) => isClerkUserId(userId) && !sources.has(userId),
          ),
        ),
      ]
      const transferable = new Map<
        'SANDBOX' | 'PRODUCTION',
        {
          productId: string
          environment: 'SANDBOX' | 'PRODUCTION'
          periodStartedAt: number
          expiresAt: number
        }
      >()
      for (const userId of sources) {
        if (!isClerkUserId(userId)) continue
        const rows = await ctx.db
          .query('subscriptionEntitlements')
          .withIndex('by_user_and_entitlement', (q) =>
            q
              .eq('userId', userId)
              .eq('entitlementId', REVENUECAT_ENTITLEMENT_ID),
          )
          .collect()
        for (const row of rows) {
          if (
            (args.environment && row.environment !== args.environment) ||
            args.eventTimestampMs < row.latestEventTimestampMs
          ) {
            continue
          }
          if (row.active && row.expiresAt > args.receivedAt) {
            const current = transferable.get(row.environment)
            const rowPeriodStartedAt = row.periodStartedAt ?? 0
            if (
              !current ||
              rowPeriodStartedAt > current.periodStartedAt ||
              (rowPeriodStartedAt === current.periodStartedAt &&
                row.expiresAt > current.expiresAt)
            ) {
              transferable.set(row.environment, {
                productId: row.productId,
                environment: row.environment,
                periodStartedAt: rowPeriodStartedAt,
                expiresAt: row.expiresAt,
              })
            }
          }
          await ctx.db.patch(row._id, {
            active: false,
            latestEventId: args.eventId,
            latestEventType: args.type,
            latestEventTimestampMs: args.eventTimestampMs,
            updatedAt: args.receivedAt,
          })
          revoked += 1
        }
      }

      for (const userId of destinations) {
        for (const state of transferable.values()) {
          const existing = await ctx.db
            .query('subscriptionEntitlements')
            .withIndex('by_user_entitlement_and_environment', (q) =>
              q
                .eq('userId', userId)
                .eq('entitlementId', REVENUECAT_ENTITLEMENT_ID)
                .eq('environment', state.environment),
            )
            .unique()
          if (
            existing &&
            (state.periodStartedAt < (existing.periodStartedAt ?? 0) ||
              (state.periodStartedAt === (existing.periodStartedAt ?? 0) &&
                args.eventTimestampMs < existing.latestEventTimestampMs))
          ) {
            continue
          }
          const update = {
            userId,
            entitlementId: REVENUECAT_ENTITLEMENT_ID,
            productId: state.productId,
            environment: state.environment,
            active: true,
            periodStartedAt: state.periodStartedAt,
            expiresAt: state.expiresAt,
            latestEventId: args.eventId,
            latestEventType: args.type,
            latestEventTimestampMs: args.eventTimestampMs,
            updatedAt: args.receivedAt,
          }
          if (existing) {
            await ctx.db.patch(existing._id, update)
          } else {
            await ctx.db.insert('subscriptionEntitlements', update)
          }
          moved += 1
        }
      }
      return await recordReceipt(
        revoked > 0 || moved > 0 ? 'applied' : 'ignored',
        moved > 0
          ? 'transfer_state_moved'
          : destinations.length > 0
            ? 'transfer_destination_requires_reconciliation'
            : 'transfer_has_no_clerk_destination',
      )
    }

    const isRefund =
      args.type === 'CANCELLATION' &&
      args.cancelReason === 'CUSTOMER_SUPPORT'
    const grantsAccess =
      ACCESS_CONTINUES_EVENT_TYPES.has(args.type) ||
      (args.type === 'CANCELLATION' && !isRefund)
    const revokesAccess = args.type === 'EXPIRATION' || isRefund
    if (!grantsAccess && !revokesAccess) {
      return await recordReceipt('ignored', 'unsupported_event_type')
    }
    if (!isClerkUserId(args.appUserId)) {
      return await recordReceipt('ignored', 'invalid_clerk_app_user_id')
    }
    if (!args.environment) {
      return await recordReceipt('ignored', 'missing_environment')
    }
    if (args.productId !== REVENUECAT_MONTHLY_PRODUCT_ID) {
      return await recordReceipt('ignored', 'unexpected_product')
    }
    if (!args.entitlementIds.includes(REVENUECAT_ENTITLEMENT_ID)) {
      return await recordReceipt('ignored', 'missing_pro_entitlement')
    }
    if (args.purchasedAtMs === undefined) {
      return await recordReceipt('ignored', 'missing_purchase_timestamp')
    }
    if (args.expirationAtMs === undefined) {
      return await recordReceipt('ignored', 'missing_expiration')
    }
    const userId = args.appUserId
    const environment = args.environment
    const productId = args.productId
    const periodStartedAt = args.purchasedAtMs
    // RevenueCat considers a billing-issue entitlement active through grace;
    // the ordinary transaction expiration can already be in the past.
    const effectiveExpirationAtMs =
      args.type === 'BILLING_ISSUE'
        ? Math.max(
            args.expirationAtMs,
            args.gracePeriodExpirationAtMs ?? 0,
          )
        : args.expirationAtMs

    const existing = await ctx.db
      .query('subscriptionEntitlements')
      .withIndex('by_user_entitlement_and_environment', (q) =>
        q
          .eq('userId', userId)
          .eq('entitlementId', REVENUECAT_ENTITLEMENT_ID)
          .eq('environment', environment),
      )
      .unique()
    if (
      existing &&
      (periodStartedAt < (existing.periodStartedAt ?? 0) ||
        (periodStartedAt === (existing.periodStartedAt ?? 0) &&
          args.eventTimestampMs < existing.latestEventTimestampMs))
    ) {
      return await recordReceipt('stale', 'older_subscription_period')
    }

    const update = {
      userId,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
      productId,
      environment,
      active: grantsAccess,
      periodStartedAt,
      expiresAt: effectiveExpirationAtMs,
      latestEventId: args.eventId,
      latestEventType: args.type,
      latestEventTimestampMs: args.eventTimestampMs,
      updatedAt: args.receivedAt,
    }
    if (existing) {
      await ctx.db.patch(existing._id, update)
    } else {
      await ctx.db.insert('subscriptionEntitlements', update)
    }
    return await recordReceipt('applied')
  },
})
