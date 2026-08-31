import * as Predicate from 'effect/Predicate'

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

/** A value already produced by `JSON.parse` (webhook bodies, REST responses). */
export type RevenueCatJson =
  | null
  | boolean
  | number
  | string
  | RevenueCatJson[]
  | { [key: string]: RevenueCatJson }

/**
 * Narrows a parsed-JSON payload to its record arm. The generic input lets the
 * HTTP boundary hand over the freshly parsed body without re-annotating it.
 */
export function revenueCatJsonRecord<Payload>(
  value: Payload,
): { [key: string]: RevenueCatJson } | undefined {
  if (value === null || !Predicate.isObject(value) || Array.isArray(value)) {
    return undefined
  }
  // SAFETY: RevenueCat payloads are parsed JSON, so an object that is not an
  // array is exactly a string-keyed record of parsed-JSON values.
  return value as { [key: string]: RevenueCatJson }
}

function validString(
  value: RevenueCatJson | undefined,
  maxLength: number,
): value is string {
  return (
    Predicate.isString(value) && value.length > 0 && value.length <= maxLength
  )
}

function validTimestamp(value: RevenueCatJson | undefined): value is number {
  return (
    Predicate.isNumber(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

function optionalStringArray(
  value: RevenueCatJson | undefined,
  field: string,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (!Array.isArray(value) || value.length > 100) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  const items: string[] = []
  for (const item of value) {
    if (!validString(item, 255)) {
      return { ok: false, error: `Invalid RevenueCat ${field}` }
    }
    items.push(item)
  }
  return { ok: true, value: [...new Set(items)] }
}

function optionalString(
  value: RevenueCatJson | undefined,
  field: string,
  maxLength = 255,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true }
  if (!validString(value, maxLength)) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  return { ok: true, value }
}

function optionalTimestamp(
  value: RevenueCatJson | undefined,
  field: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true }
  if (!validTimestamp(value)) {
    return { ok: false, error: `Invalid RevenueCat ${field}` }
  }
  return { ok: true, value }
}

/**
 * Parses only the RevenueCat fields used by the entitlement ledger. Unknown
 * fields are deliberately ignored so additive webhook changes stay forwards
 * compatible.
 */
export function parseRevenueCatWebhook<Payload>(
  value: Payload,
): RevenueCatParseResult {
  const envelope = revenueCatJsonRecord(value)
  if (!envelope || !validString(envelope.api_version, 20)) {
    return { ok: false, error: 'Invalid RevenueCat webhook envelope' }
  }
  const event = revenueCatJsonRecord(envelope.event)
  if (!event) {
    return { ok: false, error: 'RevenueCat webhook event is required' }
  }

  const apiVersion = envelope.api_version
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
  if (
    event.environment === 'SANDBOX' ||
    event.environment === 'PRODUCTION'
  ) {
    environment = event.environment
  } else if (event.environment !== undefined && event.environment !== null) {
    return { ok: false, error: 'Invalid RevenueCat environment' }
  }

  const parsedEvent: ParsedRevenueCatEvent = {
    apiVersion,
    eventId,
    type: eventType,
    aliases: aliases.value,
    entitlementIds: normalizedEntitlementIds,
    eventTimestampMs,
    transferredFrom: transferredFrom.value,
    transferredTo: transferredTo.value,
  }
  if (appId.value) parsedEvent.appId = appId.value
  if (appUserId.value) parsedEvent.appUserId = appUserId.value
  if (originalAppUserId.value) {
    parsedEvent.originalAppUserId = originalAppUserId.value
  }
  if (environment) parsedEvent.environment = environment
  if (productId.value) parsedEvent.productId = productId.value
  if (purchasedAtMs.value !== undefined) {
    parsedEvent.purchasedAtMs = purchasedAtMs.value
  }
  if (expirationAtMs.value !== undefined) {
    parsedEvent.expirationAtMs = expirationAtMs.value
  }
  if (gracePeriodExpirationAtMs.value !== undefined) {
    parsedEvent.gracePeriodExpirationAtMs = gracePeriodExpirationAtMs.value
  }
  if (cancelReason.value) parsedEvent.cancelReason = cancelReason.value

  return { ok: true, event: parsedEvent }
}

export function isClerkUserId(value: string | undefined): value is string {
  return Boolean(value && /^user_[A-Za-z0-9]{1,128}$/.test(value))
}
