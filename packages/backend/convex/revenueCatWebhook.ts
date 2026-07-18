export const REVENUECAT_ENTITLEMENT_ID = 'pro'
export const REVENUECAT_MONTHLY_PRODUCT_ID =
  'com.beegreat.app.pro.monthly'

export type RevenueCatEnvironment = 'SANDBOX' | 'PRODUCTION'

export type ParsedRevenueCatEvent = {
  apiVersion: string
  eventId: string
  type: string
  appId?: string
  appUserId?: string
  originalAppUserId?: string
  aliases: string[]
  environment?: RevenueCatEnvironment
  productId?: string
  entitlementIds: string[]
  purchasedAtMs?: number
  expirationAtMs?: number
  gracePeriodExpirationAtMs?: number
  cancelReason?: string
  eventTimestampMs: number
  transferredFrom: string[]
  transferredTo: string[]
}

export type RevenueCatParseResult =
  | { ok: true; event: ParsedRevenueCatEvent }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
  )
}

function validTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

function optionalStringArray(
  value: unknown,
  field: string,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    !value.every((item) => validString(item, 255))
  ) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  return { ok: true, value: [...new Set(value as string[])] }
}

function optionalString(
  value: unknown,
  field: string,
  maxLength = 255,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true }
  if (!validString(value, maxLength)) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  return { ok: true, value: value as string }
}

function optionalTimestamp(
  value: unknown,
  field: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true }
  if (!validTimestamp(value)) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  return { ok: true, value: value as number }
}

/**
 * Parses only the RevenueCat fields used by the entitlement ledger. Unknown
 * fields are deliberately ignored so additive webhook changes stay forwards
 * compatible.
 */
export function parseRevenueCatWebhook(
  value: unknown,
): RevenueCatParseResult {
  if (!isRecord(value) || !validString(value.api_version, 20)) {
    return { ok: false, error: 'Invalid RevenueCat webhook envelope' }
  }
  if (!isRecord(value.event)) {
    return { ok: false, error: 'RevenueCat webhook event is required' }
  }

  const apiVersion = value.api_version
  const event = value.event
  const eventId = event.id
  const eventType = event.type
  const eventTimestampMs = event.event_timestamp_ms
  if (!validString(eventId, 255)) {
    return { ok: false, error: 'RevenueCat event id is required' }
  }
  if (!validString(eventType, 100)) {
    return { ok: false, error: 'RevenueCat event type is required' }
  }
  if (!validTimestamp(eventTimestampMs)) {
    return { ok: false, error: 'Invalid RevenueCat event timestamp' }
  }

  const appId = optionalString(event.app_id, 'app id')
  const appUserId = optionalString(event.app_user_id, 'app user id')
  const originalAppUserId = optionalString(
    event.original_app_user_id,
    'original app user id',
  )
  const productId = optionalString(event.product_id, 'product id')
  const purchasedAtMs = optionalTimestamp(
    event.purchased_at_ms,
    'purchase timestamp',
  )
  const expirationAtMs = optionalTimestamp(
    event.expiration_at_ms,
    'expiration timestamp',
  )
  const gracePeriodExpirationAtMs = optionalTimestamp(
    event.grace_period_expiration_at_ms,
    'grace period expiration timestamp',
  )
  const aliases = optionalStringArray(event.aliases, 'aliases')
  const transferredFrom = optionalStringArray(
    event.transferred_from,
    'transferred_from',
  )
  const transferredTo = optionalStringArray(
    event.transferred_to,
    'transferred_to',
  )
  if (!appId.ok) return appId
  if (!appUserId.ok) return appUserId
  if (!originalAppUserId.ok) return originalAppUserId
  if (!productId.ok) return productId
  if (!purchasedAtMs.ok) return purchasedAtMs
  if (!expirationAtMs.ok) return expirationAtMs
  if (!gracePeriodExpirationAtMs.ok) return gracePeriodExpirationAtMs
  if (!aliases.ok) return aliases
  if (!transferredFrom.ok) return transferredFrom
  if (!transferredTo.ok) return transferredTo

  const entitlementIds = optionalStringArray(
    event.entitlement_ids,
    'entitlement ids',
  )
  if (!entitlementIds.ok) return entitlementIds
  const deprecatedEntitlementId = optionalString(
    event.entitlement_id,
    'entitlement id',
  )
  if (!deprecatedEntitlementId.ok) return deprecatedEntitlementId
  const cancelReason = optionalString(event.cancel_reason, 'cancel reason', 100)
  if (!cancelReason.ok) return cancelReason
  const normalizedEntitlementIds = entitlementIds.value.length
    ? entitlementIds.value
    : deprecatedEntitlementId.value
      ? [deprecatedEntitlementId.value]
      : []

  let environment: RevenueCatEnvironment | undefined
  if (event.environment !== undefined && event.environment !== null) {
    if (
      event.environment !== 'SANDBOX' &&
      event.environment !== 'PRODUCTION'
    ) {
      return { ok: false, error: 'Invalid RevenueCat environment' }
    }
    environment = event.environment
  }

  return {
    ok: true,
    event: {
      apiVersion,
      eventId,
      type: eventType,
      ...(appId.value ? { appId: appId.value } : {}),
      ...(appUserId.value ? { appUserId: appUserId.value } : {}),
      ...(originalAppUserId.value
        ? { originalAppUserId: originalAppUserId.value }
        : {}),
      aliases: aliases.value,
      ...(environment ? { environment } : {}),
      ...(productId.value ? { productId: productId.value } : {}),
      entitlementIds: normalizedEntitlementIds,
      ...(purchasedAtMs.value !== undefined
        ? { purchasedAtMs: purchasedAtMs.value }
        : {}),
      ...(expirationAtMs.value !== undefined
        ? { expirationAtMs: expirationAtMs.value }
        : {}),
      ...(gracePeriodExpirationAtMs.value !== undefined
        ? { gracePeriodExpirationAtMs: gracePeriodExpirationAtMs.value }
        : {}),
      ...(cancelReason.value ? { cancelReason: cancelReason.value } : {}),
      eventTimestampMs,
      transferredFrom: transferredFrom.value,
      transferredTo: transferredTo.value,
    },
  }
}

export function isClerkUserId(value: string | undefined): value is string {
  return Boolean(value && /^user_[A-Za-z0-9]{1,128}$/.test(value))
}
