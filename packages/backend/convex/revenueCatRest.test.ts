import { describe, expect, test } from 'vitest'
import {
  deleteRevenueCatCustomer,
  fetchRevenueCatSubscription,
  parseRevenueCatCustomerInfo,
} from './revenueCatRest'
import { REVENUECAT_MONTHLY_PRODUCT_ID } from './revenueCatWebhook'

const NOW = Date.parse('2026-07-16T12:00:00.000Z')

function customerInfo(
  overrides: {
    entitlementProduct?: string
    expiresDate?: string
    gracePeriodExpiresDate?: string | null
    subscriptionGracePeriodExpiresDate?: string | null
    purchaseDate?: string
    isSandbox?: boolean
    refundedAt?: string | null
  } = {},
) {
  const productId =
    overrides.entitlementProduct ?? REVENUECAT_MONTHLY_PRODUCT_ID
  return {
    request_date_ms: NOW,
    subscriber: {
      entitlements: {
        pro: {
          product_identifier: productId,
          purchase_date:
            overrides.purchaseDate ?? '2026-07-01T12:00:00.000Z',
          expires_date:
            overrides.expiresDate ?? '2026-08-01T12:00:00.000Z',
          grace_period_expires_date:
            overrides.gracePeriodExpiresDate ?? null,
        },
      },
      subscriptions: {
        [REVENUECAT_MONTHLY_PRODUCT_ID]: {
          is_sandbox: overrides.isSandbox ?? false,
          refunded_at: overrides.refundedAt ?? null,
          grace_period_expires_date:
            overrides.subscriptionGracePeriodExpiresDate ?? null,
        },
      },
    },
  }
}

describe('parseRevenueCatCustomerInfo', () => {
  test('accepts only the exact active pro monthly entitlement', () => {
    expect(parseRevenueCatCustomerInfo(customerInfo(), NOW)).toEqual({
      ok: true,
      snapshot: {
        active: true,
        productId: REVENUECAT_MONTHLY_PRODUCT_ID,
        environment: 'PRODUCTION',
        periodStartedAt: Date.parse('2026-07-01T12:00:00.000Z'),
        expiresAt: Date.parse('2026-08-01T12:00:00.000Z'),
      },
    })
  })

  test('fails closed for a wrong SKU and an expired entitlement', () => {
    expect(
      parseRevenueCatCustomerInfo(
        customerInfo({ entitlementProduct: 'com.example.other' }),
        NOW,
      ),
    ).toEqual({
      ok: true,
      snapshot: { active: false, reason: 'unexpected_product' },
    })
    expect(
      parseRevenueCatCustomerInfo(
        customerInfo({ expiresDate: '2026-07-15T12:00:00.000Z' }),
        NOW,
      ),
    ).toEqual({
      ok: true,
      snapshot: { active: false, reason: 'expired' },
    })
  })

  test('accepts a valid grace period and rejects malformed Customer Info', () => {
    const graceExpiry = '2026-07-20T12:00:00.000Z'
    expect(
      parseRevenueCatCustomerInfo(
        customerInfo({
          expiresDate: '2026-07-15T12:00:00.000Z',
          subscriptionGracePeriodExpiresDate: graceExpiry,
          isSandbox: true,
        }),
        NOW,
      ),
    ).toMatchObject({
      ok: true,
      snapshot: {
        active: true,
        environment: 'SANDBOX',
        expiresAt: Date.parse(graceExpiry),
      },
    })
    expect(parseRevenueCatCustomerInfo({ subscriber: {} }, NOW)).toEqual({
      ok: false,
      error: 'invalid_response',
    })
  })
})

describe('fetchRevenueCatSubscription', () => {
  test('never calls RevenueCat without a server secret', async () => {
    let called = false
    const fetchMock = async () => {
      called = true
      return Response.json(customerInfo())
    }
    await expect(
      fetchRevenueCatSubscription('user_owner', undefined, NOW, fetchMock),
    ).resolves.toEqual({ status: 'unavailable', reason: 'configuration' })
    expect(called).toBe(false)
  })

  test('authenticates the encoded customer lookup and parses active state', async () => {
    const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        'https://api.revenuecat.com/v1/subscribers/user_owner',
      )
      expect(init?.headers).toEqual({
        authorization: 'Bearer server-secret',
        accept: 'application/json',
      })
      return Response.json(customerInfo())
    }
    await expect(
      fetchRevenueCatSubscription(
        'user_owner',
        'server-secret',
        NOW,
        fetchMock,
      ),
    ).resolves.toMatchObject({ status: 'ok', snapshot: { active: true } })
  })

  test('reports network and malformed responses as unavailable', async () => {
    await expect(
      fetchRevenueCatSubscription(
        'user_owner',
        'server-secret',
        NOW,
        async () => {
          throw new Error('offline')
        },
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'network' })
    await expect(
      fetchRevenueCatSubscription(
        'user_owner',
        'server-secret',
        NOW,
        async () => Response.json({ nope: true }),
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'invalid_response' })
  })
})

describe('deleteRevenueCatCustomer', () => {
  test('does not call RevenueCat without a server secret', async () => {
    let called = false
    await expect(
      deleteRevenueCatCustomer('user_owner', undefined, async () => {
        called = true
        return new Response(null, { status: 204 })
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'configuration',
      retryable: false,
    })
    expect(called).toBe(false)
  })

  test('authenticates deletion and treats an absent customer as complete', async () => {
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(input)).toBe(
        'https://api.revenuecat.com/v1/subscribers/user%2Fowner',
      )
      expect(init?.method).toBe('DELETE')
      expect(init?.headers).toEqual({
        authorization: 'Bearer server-secret',
        accept: 'application/json',
      })
      return new Response(null, { status: 404 })
    }
    await expect(
      deleteRevenueCatCustomer('user/owner', 'server-secret', fetchMock),
    ).resolves.toEqual({ status: 'deleted' })
  })

  test('retries transient failures but settles permanent upstream rejection', async () => {
    await expect(
      deleteRevenueCatCustomer('user_owner', 'server-secret', async () =>
        new Response(null, { status: 503 }),
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'upstream',
      retryable: true,
    })
    await expect(
      deleteRevenueCatCustomer('user_owner', 'server-secret', async () =>
        new Response(null, { status: 403 }),
      ),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'upstream',
      retryable: false,
    })
  })
})
