import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_MONTHLY_PRODUCT_ID,
  type RevenueCatEnvironment,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isoTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Validates the exact entitlement/product pair from RevenueCat Customer Info.
 * Missing/expired purchases are valid inactive states; structurally invalid
 * responses are rejected so an outage cannot overwrite a known-good ledger.
 */
export function parseRevenueCatCustomerInfo(
  value: unknown,
  now: number,
):
  | { ok: true; snapshot: RevenueCatRestSnapshot }
  | { ok: false; error: 'invalid_response' } {
  if (!isRecord(value) || !isRecord(value.subscriber)) {
    return { ok: false, error: 'invalid_response' }
  }
  const { subscriber } = value
  if (!isRecord(subscriber.entitlements) || !isRecord(subscriber.subscriptions)) {
    return { ok: false, error: 'invalid_response' }
  }

  const entitlement = subscriber.entitlements[REVENUECAT_ENTITLEMENT_ID]
  if (entitlement === undefined || entitlement === null) {
    return {
      ok: true,
      snapshot: { active: false, reason: 'missing_entitlement' },
    }
  }
  if (!isRecord(entitlement)) {
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

  const subscription = subscriber.subscriptions[REVENUECAT_MONTHLY_PRODUCT_ID]
  if (!isRecord(subscription) || typeof subscription.is_sandbox !== 'boolean') {
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
  if (
    subscription.refunded_at !== undefined &&
    subscription.refunded_at !== null &&
    typeof subscription.refunded_at !== 'string'
  ) {
    return { ok: false, error: 'invalid_response' }
  }
  if (typeof subscription.refunded_at === 'string') {
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
      environment: subscription.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
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
