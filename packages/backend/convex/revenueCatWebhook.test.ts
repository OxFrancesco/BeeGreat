import { describe, expect, test } from 'vitest'
import {
  parseRevenueCatWebhook,
  REVENUECAT_MONTHLY_PRODUCT_ID,
} from './revenueCatWebhook'

describe('parseRevenueCatWebhook', () => {
  test('normalizes the lifecycle fields used by the entitlement ledger', () => {
    const result = parseRevenueCatWebhook({
      api_version: '1.0',
      event: {
        id: 'evt_1',
        type: 'INITIAL_PURCHASE',
        app_id: 'app_1',
        app_user_id: 'user_owner',
        original_app_user_id: '$RCAnonymousID:old',
        aliases: ['$RCAnonymousID:old', 'user_owner'],
        environment: 'SANDBOX',
        product_id: REVENUECAT_MONTHLY_PRODUCT_ID,
        entitlement_ids: ['pro'],
        purchased_at_ms: 500,
        event_timestamp_ms: 1_000,
        expiration_at_ms: 2_000,
        grace_period_expiration_at_ms: 2_500,
      },
    })

    expect(result).toEqual({
      ok: true,
      event: {
        apiVersion: '1.0',
        eventId: 'evt_1',
        type: 'INITIAL_PURCHASE',
        appId: 'app_1',
        appUserId: 'user_owner',
        originalAppUserId: '$RCAnonymousID:old',
        aliases: ['$RCAnonymousID:old', 'user_owner'],
        environment: 'SANDBOX',
        productId: REVENUECAT_MONTHLY_PRODUCT_ID,
        entitlementIds: ['pro'],
        purchasedAtMs: 500,
        expirationAtMs: 2_000,
        gracePeriodExpirationAtMs: 2_500,
        eventTimestampMs: 1_000,
        transferredFrom: [],
        transferredTo: [],
      },
    })
  })

  test('falls back to the deprecated single entitlement field', () => {
    const result = parseRevenueCatWebhook({
      api_version: '1.0',
      event: {
        id: 'evt_legacy',
        type: 'RENEWAL',
        event_timestamp_ms: 1_000,
        entitlement_id: 'pro',
      },
    })
    expect(result.ok && result.event.entitlementIds).toEqual(['pro'])
  })

  test('rejects malformed common and known optional fields', () => {
    expect(parseRevenueCatWebhook({ event: {} })).toMatchObject({ ok: false })
    expect(
      parseRevenueCatWebhook({
        api_version: '1.0',
        event: {
          id: 'evt_bad',
          type: 'RENEWAL',
          event_timestamp_ms: 1_000,
          entitlement_ids: 'pro',
        },
      }),
    ).toEqual({ ok: false, error: 'Invalid RevenueCat entitlement ids' })
    expect(
      parseRevenueCatWebhook({
        api_version: '1.0',
        event: {
          id: 'evt_bad_grace',
          type: 'BILLING_ISSUE',
          event_timestamp_ms: 1_000,
          grace_period_expiration_at_ms: 'later',
        },
      }),
    ).toEqual({
      ok: false,
      error: 'Invalid RevenueCat grace period expiration timestamp',
    })
  })
})
