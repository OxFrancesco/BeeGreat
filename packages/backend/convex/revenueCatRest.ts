import * as Predicate from 'effect/Predicate'
import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_MONTHLY_PRODUCT_ID,
  revenueCatJsonRecord,
  type RevenueCatEnvironment,
  type RevenueCatJson,
} from './revenueCatWebhook'

const REVENUECAT_API_BASE_URL = 'https://api.revenuecat.com/v1'

export type RevenueCatRestSnapshot =
  | {
      active: true
      productId: typeof REVENUECAT_MONTHLY_PRODUCT_ID
      environment: RevenueCatEnvironment
      periodStartedAt: number
      expiresAt: number
    }
  | {
      active: false
      reason:
        | 'missing_entitlement'
        | 'unexpected_product'
        | 'expired'
        | 'refunded'
    }

export type RevenueCatRestResult =
  | { status: 'ok'; snapshot: RevenueCatRestSnapshot }
  | {
      status: 'unavailable'
      reason: 'configuration' | 'network' | 'upstream' | 'invalid_response'
    }

export type RevenueCatDeletionResult =
  | { status: 'deleted' }
  | {
      status: 'unavailable'
      reason: 'configuration' | 'network' | 'upstream'
      retryable: boolean
    }

function isoTimestamp(value: RevenueCatJson | undefined) {
  if (!Predicate.isString(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Validates the exact entitlement/product pair from RevenueCat Customer Info.
 * Missing/expired purchases are valid inactive states; structurally invalid
 * responses are rejected so an outage cannot overwrite a known-good ledger.
 */
export function parseRevenueCatCustomerInfo<Payload>(
  value: Payload,
  now: number,
):
  | { ok: true; snapshot: RevenueCatRestSnapshot }
  | { ok: false; error: 'invalid_response' } {
  const customerInfo = revenueCatJsonRecord(value)
  const subscriber = revenueCatJsonRecord(customerInfo?.subscriber)
  if (!customerInfo || !subscriber) {
    return { ok: false, error: 'invalid_response' }
  }
  const entitlements = revenueCatJsonRecord(subscriber.entitlements)
  const subscriptions = revenueCatJsonRecord(subscriber.subscriptions)
  if (!entitlements || !subscriptions) {
    return { ok: false, error: 'invalid_response' }
  }

  const rawEntitlement = entitlements[REVENUECAT_ENTITLEMENT_ID]
  if (rawEntitlement === undefined || rawEntitlement === null) {
    return {
      ok: true,
      snapshot: { active: false, reason: 'missing_entitlement' },
    }
  }
  const entitlement = revenueCatJsonRecord(rawEntitlement)
  if (!entitlement) {
    return { ok: false, error: 'invalid_response' }
  }
  if (entitlement.product_identifier !== REVENUECAT_MONTHLY_PRODUCT_ID) {
    return {
      ok: true,
      snapshot: { active: false, reason: 'unexpected_product' },
    }
  }

  const entitlementExpiresAt = isoTimestamp(entitlement.expires_date)
  const periodStartedAt = isoTimestamp(entitlement.purchase_date)
  const graceExpiresAt =
    entitlement.grace_period_expires_date === null ||
    entitlement.grace_period_expires_date === undefined
      ? null
      : isoTimestamp(entitlement.grace_period_expires_date)
  if (
    entitlementExpiresAt === null ||
    periodStartedAt === null ||
    (entitlement.grace_period_expires_date !== null &&
      entitlement.grace_period_expires_date !== undefined &&
      graceExpiresAt === null)
  ) {
    return { ok: false, error: 'invalid_response' }
  }

  const subscription = revenueCatJsonRecord(
    subscriptions[REVENUECAT_MONTHLY_PRODUCT_ID],
  )
  const isSandbox = subscription?.is_sandbox
  if (!subscription || !Predicate.isBoolean(isSandbox)) {
    return { ok: false, error: 'invalid_response' }
  }
  const subscriptionGraceExpiresAt =
    subscription.grace_period_expires_date === null ||
    subscription.grace_period_expires_date === undefined
      ? null
      : isoTimestamp(subscription.grace_period_expires_date)
  if (
    subscription.grace_period_expires_date !== null &&
    subscription.grace_period_expires_date !== undefined &&
    subscriptionGraceExpiresAt === null
  ) {
    return { ok: false, error: 'invalid_response' }
  }
  const refundedAt = subscription.refunded_at
  if (
    refundedAt !== undefined &&
    refundedAt !== null &&
    !Predicate.isString(refundedAt)
  ) {
    return { ok: false, error: 'invalid_response' }
  }
  if (Predicate.isString(refundedAt)) {
    return { ok: true, snapshot: { active: false, reason: 'refunded' } }
  }

  const expiresAt = Math.max(
    entitlementExpiresAt,
    graceExpiresAt ?? 0,
    subscriptionGraceExpiresAt ?? 0,
  )
  if (expiresAt <= now) {
    return { ok: true, snapshot: { active: false, reason: 'expired' } }
  }

  return {
    ok: true,
    snapshot: {
      active: true,
      productId: REVENUECAT_MONTHLY_PRODUCT_ID,
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      periodStartedAt,
      expiresAt,
    },
  }
}

export async function fetchRevenueCatSubscription(
  userId: string,
  apiKey: string | undefined,
  now: number,
  fetchImpl: typeof fetch = fetch,
): Promise<RevenueCatRestResult> {
  const secret = apiKey?.trim()
  if (!secret) return { status: 'unavailable', reason: 'configuration' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await fetchImpl(
      `${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${secret}`,
          accept: 'application/json',
        },
        signal: controller.signal,
      },
    )
  } catch {
    return { status: 'unavailable', reason: 'network' }
  } finally {
    clearTimeout(timeout)
  }
  if (response.status !== 200 && response.status !== 201) {
    return { status: 'unavailable', reason: 'upstream' }
  }
  const body = await response.json().catch(() => null)
  const parsed = parseRevenueCatCustomerInfo(body, now)
  return parsed.ok
    ? { status: 'ok', snapshot: parsed.snapshot }
    : { status: 'unavailable', reason: parsed.error }
}

/**
 * Removes BeeGreat's RevenueCat customer record. This does not cancel the
 * underlying Apple subscription, which remains controlled by the App Store.
 */
export async function deleteRevenueCatCustomer(
  userId: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<RevenueCatDeletionResult> {
  const secret = apiKey?.trim()
  if (!secret) {
    return {
      status: 'unavailable',
      reason: 'configuration',
      retryable: false,
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  let response: Response
  try {
    response = await fetchImpl(
      `${REVENUECAT_API_BASE_URL}/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${secret}`,
          accept: 'application/json',
        },
        signal: controller.signal,
      },
    )
  } catch {
    return { status: 'unavailable', reason: 'network', retryable: true }
  } finally {
    clearTimeout(timeout)
  }
  if (response.ok || response.status === 404) return { status: 'deleted' }
  return {
    status: 'unavailable',
    reason: 'upstream',
    retryable: response.status === 429 || response.status >= 500,
  }
}
