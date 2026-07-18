import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import {
  fetchRevenueCatSubscription,
  type RevenueCatRestSnapshot,
} from './revenueCatRest'

export const SUBSCRIPTION_STATUS_CACHE_TTL_MS = 60_000

type SubscriptionStatus = {
  active: boolean
  entitlementId: string
  productId: string | null
  environment: 'SANDBOX' | 'PRODUCTION' | null
  expiresAt: number | null
  refreshedAt: number | null
}

export type SubscriptionReconciliationResult =
  | { status: 'ok'; subscription: SubscriptionStatus }
  | {
      status: 'unavailable'
      reason: 'configuration' | 'network' | 'upstream' | 'invalid_response'
    }

function snapshotAtCheckTime(
  snapshot: RevenueCatRestSnapshot,
  checkedAt: number,
): RevenueCatRestSnapshot {
  if (snapshot.active && snapshot.expiresAt <= checkedAt) {
    return { active: false, reason: 'expired' }
  }
  return snapshot
}

/**
 * Resolves paid access for trusted backend callers. A fresh server-owned
 * ledger is reused briefly; stale or absent state is reconciled directly from
 * RevenueCat Customer Info. Provider failures never fall back to stale access.
 */
export const statusForAgent = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<SubscriptionReconciliationResult> => {
    const lookupStartedAt = Date.now()
    const cached: SubscriptionStatus = await ctx.runQuery(
      internal.subscriptions.statusForUser,
      { userId, now: lookupStartedAt },
    )
    const cacheAge =
      cached.refreshedAt === null
        ? null
        : lookupStartedAt - cached.refreshedAt
    if (
      cacheAge !== null &&
      cacheAge >= 0 &&
      cacheAge <= SUBSCRIPTION_STATUS_CACHE_TTL_MS
    ) {
      return { status: 'ok', subscription: cached }
    }

    const remote = await fetchRevenueCatSubscription(
      userId,
      env.REVENUECAT_SECRET_API_KEY,
      lookupStartedAt,
    )
    if (remote.status === 'unavailable') return remote

    const checkedAt = Date.now()
    const snapshot = snapshotAtCheckTime(remote.snapshot, checkedAt)
    const subscription: SubscriptionStatus = await ctx.runMutation(
      internal.subscriptions.applyRevenueCatRestSnapshot,
      {
        userId,
        observedAt: lookupStartedAt,
        checkedAt,
        active: snapshot.active,
        ...(snapshot.active
          ? {
              productId: snapshot.productId,
              environment: snapshot.environment,
              periodStartedAt: snapshot.periodStartedAt,
              expiresAt: snapshot.expiresAt,
            }
          : { reason: snapshot.reason }),
      },
    )
    return { status: 'ok', subscription }
  },
})
