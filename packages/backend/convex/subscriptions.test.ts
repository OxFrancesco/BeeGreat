import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'
import { REVENUECAT_MONTHLY_PRODUCT_ID } from './revenueCatWebhook'

function authenticated(t: ReturnType<typeof convexTest>, subject: string) {
  return t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer.example.test|${subject}`,
  })
}

function lifecycleEvent(
  overrides: Partial<{
    eventId: string
    type: string
    appUserId: string
    environment: 'SANDBOX' | 'PRODUCTION'
    productId: string
    entitlementIds: string[]
    purchasedAtMs: number
    expirationAtMs: number
    gracePeriodExpirationAtMs: number
    cancelReason: string
    eventTimestampMs: number
    receivedAt: number
    transferredFrom: string[]
    transferredTo: string[]
  }> = {},
) {
  return {
    eventId: 'evt_initial',
    type: 'INITIAL_PURCHASE',
    appUserId: 'user_owner',
    environment: 'PRODUCTION' as const,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    entitlementIds: ['pro'],
    purchasedAtMs: 500,
    expirationAtMs: 2_000,
    eventTimestampMs: 1_000,
    receivedAt: 1_001,
    transferredFrom: [],
    transferredTo: [],
    ...overrides,
  }
}

test('lifecycle events are idempotent and cancellation keeps access until expiration', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent(),
    ),
  ).resolves.toEqual({ status: 'applied' })
  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent(),
    ),
  ).resolves.toEqual({ status: 'duplicate', outcome: 'applied' })
  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent({
        eventId: 'evt_cancel',
        type: 'CANCELLATION',
        eventTimestampMs: 1_100,
      }),
    ),
  ).resolves.toEqual({ status: 'applied' })

  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_500,
    }),
  ).toMatchObject({ active: true, expiresAt: 2_000 })
})

test('expiration ordering cannot let an old period revoke a newer renewal', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent(),
  )
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({
      eventId: 'evt_renewal',
      type: 'RENEWAL',
      purchasedAtMs: 2_000,
      expirationAtMs: 3_000,
      eventTimestampMs: 1_500,
    }),
  )

  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent({
        eventId: 'evt_old_expiration',
        type: 'EXPIRATION',
        purchasedAtMs: 500,
        expirationAtMs: 2_000,
        eventTimestampMs: 1_900,
      }),
    ),
  ).resolves.toEqual({
    status: 'stale',
    reason: 'older_subscription_period',
  })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 2_500,
    }),
  ).toMatchObject({ active: true, expiresAt: 3_000 })

  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({
      eventId: 'evt_current_expiration',
      type: 'EXPIRATION',
      purchasedAtMs: 2_000,
      expirationAtMs: 3_000,
      eventTimestampMs: 3_100,
    }),
  )
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 2_500,
    }),
  ).toMatchObject({ active: false, expiresAt: 3_000 })
})

test('a current-period customer-support refund revokes access immediately', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({ expirationAtMs: 3_000 }),
  )

  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent({
        eventId: 'evt_refund',
        type: 'CANCELLATION',
        cancelReason: 'CUSTOMER_SUPPORT',
        expirationAtMs: 1_200,
        eventTimestampMs: 1_100,
      }),
    ),
  ).resolves.toEqual({ status: 'applied' })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_150,
    }),
  ).toMatchObject({ active: false, expiresAt: 1_200 })
})

test('billing issues preserve access through RevenueCat grace expiration', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({
      eventId: 'evt_billing_issue',
      type: 'BILLING_ISSUE',
      expirationAtMs: 2_000,
      gracePeriodExpirationAtMs: 2_500,
      eventTimestampMs: 1_500,
      receivedAt: 1_501,
    }),
  )

  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 2_200,
    }),
  ).toMatchObject({ active: true, expiresAt: 2_500 })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 2_501,
    }),
  ).toMatchObject({ active: false, expiresAt: 2_500 })
})

test('sandbox state is isolated and unexpected products never grant access', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent(),
  )
  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent({
        eventId: 'evt_wrong_product',
        appUserId: 'user_other',
        productId: 'com.example.other',
      }),
    ),
  ).resolves.toEqual({ status: 'ignored', reason: 'unexpected_product' })
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({
      eventId: 'evt_sandbox_expiration',
      type: 'EXPIRATION',
      environment: 'SANDBOX',
      eventTimestampMs: 2_100,
    }),
  )

  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_500,
    }),
  ).toMatchObject({ active: true, environment: 'PRODUCTION' })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_other',
      now: 1_500,
    }),
  ).toMatchObject({ active: false })
})

test('a transfer moves known entitlement state to the destination', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent(),
  )
  await expect(
    t.mutation(
      internal.subscriptions.applyRevenueCatEvent,
      lifecycleEvent({
        eventId: 'evt_transfer',
        type: 'TRANSFER',
        appUserId: undefined,
        productId: undefined,
        entitlementIds: [],
        purchasedAtMs: undefined,
        expirationAtMs: undefined,
        eventTimestampMs: 1_500,
        transferredFrom: ['user_owner'],
        transferredTo: ['user_destination'],
      }),
    ),
  ).resolves.toEqual({
    status: 'applied',
    reason: 'transfer_state_moved',
  })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_600,
    }),
  ).toMatchObject({ active: false })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_destination',
      now: 1_600,
    }),
  ).toMatchObject({
    active: true,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    expiresAt: 2_000,
  })
})

test('REST reconciliation caches an exact grant and authoritative inactivity revokes it', async () => {
  const t = convexTest(schema, modules)
  await expect(
    t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
      userId: 'user_owner',
      checkedAt: 1_000,
      active: true,
      productId: REVENUECAT_MONTHLY_PRODUCT_ID,
      environment: 'PRODUCTION',
      periodStartedAt: 500,
      expiresAt: 2_000,
    }),
  ).resolves.toMatchObject({
    active: true,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    refreshedAt: 1_000,
  })

  const cached = await t.run(async (ctx) =>
    ctx.db
      .query('subscriptionStatusChecks')
      .withIndex('by_user', (q) => q.eq('userId', 'user_owner'))
      .unique(),
  )
  expect(cached).toMatchObject({
    active: true,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    checkedAt: 1_000,
    observedAt: 1_000,
  })

  await t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
    userId: 'user_owner',
    checkedAt: 1_600,
    active: false,
    reason: 'expired',
  })
  expect(
    await t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_601,
    }),
  ).toMatchObject({ active: false, refreshedAt: 1_600 })
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query('subscriptionStatusChecks')
        .withIndex('by_user', (q) => q.eq('userId', 'user_owner'))
        .unique(),
    ),
  ).toMatchObject({ active: false, reason: 'expired', checkedAt: 1_600 })
})

test('an older in-flight REST snapshot cannot overwrite a newer webhook', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({ expirationAtMs: 4_000 }),
  )
  await t.mutation(
    internal.subscriptions.applyRevenueCatEvent,
    lifecycleEvent({
      eventId: 'evt_newer_refund',
      type: 'CANCELLATION',
      cancelReason: 'CUSTOMER_SUPPORT',
      expirationAtMs: 2_400,
      eventTimestampMs: 2_000,
      receivedAt: 2_500,
    }),
  )

  // This request observed Customer Info before the refund webhook arrived but
  // completed afterward. Completion time must refresh cache age without being
  // allowed to reorder the older provider snapshot ahead of the webhook.
  await t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
    userId: 'user_owner',
    observedAt: 1_500,
    checkedAt: 3_000,
    active: true,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    environment: 'PRODUCTION',
    periodStartedAt: 500,
    expiresAt: 4_000,
  })

  await expect(
    t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 3_100,
    }),
  ).resolves.toMatchObject({ active: false, expiresAt: 2_400 })
})

test('REST responses are ordered by observation time rather than completion time', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
    userId: 'user_owner',
    observedAt: 2_000,
    checkedAt: 2_500,
    active: false,
    reason: 'missing_entitlement',
  })

  // An older lookup returning later cannot replace the newer inactive result.
  await t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
    userId: 'user_owner',
    observedAt: 1_000,
    checkedAt: 3_000,
    active: true,
    productId: REVENUECAT_MONTHLY_PRODUCT_ID,
    environment: 'PRODUCTION',
    periodStartedAt: 500,
    expiresAt: 4_000,
  })

  await expect(
    t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 3_100,
    }),
  ).resolves.toMatchObject({ active: false, refreshedAt: 2_500 })
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query('subscriptionStatusChecks')
        .withIndex('by_user', (q) => q.eq('userId', 'user_owner'))
        .unique(),
    ),
  ).toMatchObject({
    active: false,
    observedAt: 2_000,
    checkedAt: 2_500,
  })
})

test('REST reconciliation rejects malformed active grants and cached wrong SKUs fail closed', async () => {
  const t = convexTest(schema, modules)
  await expect(
    t.mutation(internal.subscriptions.applyRevenueCatRestSnapshot, {
      userId: 'user_owner',
      checkedAt: 1_000,
      active: true,
      productId: 'com.example.other',
      environment: 'PRODUCTION',
      periodStartedAt: 500,
      expiresAt: 2_000,
    }),
  ).rejects.toThrow('Invalid active RevenueCat snapshot')

  await t.run(async (ctx) => {
    await ctx.db.insert('subscriptionEntitlements', {
      userId: 'user_owner',
      entitlementId: 'pro',
      productId: 'com.example.other',
      environment: 'PRODUCTION',
      active: true,
      periodStartedAt: 500,
      expiresAt: 2_000,
      latestEventId: 'legacy',
      latestEventType: 'INITIAL_PURCHASE',
      latestEventTimestampMs: 1_000,
      updatedAt: 1_000,
    })
  })
  await expect(
    t.query(internal.subscriptions.statusForUser, {
      userId: 'user_owner',
      now: 1_500,
    }),
  ).resolves.toMatchObject({ active: false, refreshedAt: 1_000 })
})

test('the app-facing query requires Clerk authentication', async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(api.subscriptions.status, {})).rejects.toThrow(
    'Not signed in',
  )
  await expect(
    authenticated(t, 'user_owner').query(api.subscriptions.status, {}),
  ).resolves.toMatchObject({ active: false, entitlementId: 'pro' })
})
