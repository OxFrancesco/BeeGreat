/**
 * What the sanitizer hands back for an attached value: the filtered/truncated
 * marker, a rebuilt tree, or the original leaf. Sentry SDKs let apps attach
 * any JavaScript value, so this is the honest closed union of leaf shapes.
 */
type SanitizedValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | object
  | null
  | undefined

/** The one structured field the sanitizer rewrites inside an attached payload. */
type SanitizedPayload = { url?: SanitizedValue }

type SentryLikeRequest = {
  url?: string
  headers?: Record<string, string>
  cookies?: unknown
  data?: unknown
  env?: unknown
  query_string?: unknown
}

export type SentryLikeBreadcrumb = {
  category?: string
  message?: string
  data?: object
}

/** Contact fields are typed so it is explicit that sanitization drops them. */
type SentryLikeUser = {
  id?: string | number
  email?: string
  ip_address?: string | null
  username?: string
}

export type SentryLikeEvent = {
  breadcrumbs?: SentryLikeBreadcrumb[]
  contexts?: object
  exception?: {
    values?: Array<{ type?: string; value?: string }>
  }
  extra?: object
  logentry?: {
    formatted?: string
    message?: string
    params?: unknown[]
  }
  message?: string
  request?: SentryLikeRequest
  transaction?: string
  user?: SentryLikeUser
}

const SAFE_REQUEST_HEADERS = new Set([
  'cf-ray',
  'content-type',
  'sentry-trace',
  'traceparent',
  'user-agent',
  'x-client-request-id',
  'x-request-id',
])

const SENSITIVE_KEY =
  /(?:^|_)(?:address|authorization|body|code|cookie|credential|email|health|message|password|phone|prompt|secret|session|text|token)(?:$|_)/i

const FILTERED = '[Filtered]'
const SENSITIVE_DIAGNOSTIC =
  /\b(?:authorization|body|code|cookie|credential|email|health|message|password|phone|prompt|secret|session|text|token|transcript)\b/i

/**
 * True for the plain key–value payloads the sanitizer recurses into.
 * `Object(value) === value` is the primitive test (it also admits objects
 * without a prototype), and functions are excluded like the arrays handled
 * separately by each caller.
 */
function isAttachedRecord<Value>(value: Value): value is Value & SanitizedPayload {
  return (
    Object(value) === value &&
    !Array.isArray(value) &&
    !(value instanceof Function)
  )
}

/** True only for primitive strings; boxing avoids invoking value `toString`s. */
function isStringValue<Value>(value: Value): value is Value & string {
  return Object(value) instanceof String
}

function isSensitiveKey(key: string) {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  return SENSITIVE_KEY.test(normalized)
}

function sanitizePathSegment(segment: string) {
  const decoded = decodeURIComponentSafely(segment)
  if (/^user_[A-Za-z0-9]+(?:~.*)?$/.test(decoded)) return '[user]'
  if (decoded.includes('@')) return FILTERED
  if (/^[A-Fa-f0-9-]{20,}$/.test(decoded)) return '[id]'
  if (/^\+?[\d(). -]{8,}$/.test(decoded)) return '[id]'
  return segment
}

function decodeURIComponentSafely(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function sanitizeUrl(value: string) {
  try {
    const url = new URL(value, 'https://beegreat.invalid')
    const pathname = url.pathname
      .split('/')
      .map(sanitizePathSegment)
      .join('/')
    return url.origin === 'https://beegreat.invalid'
      ? pathname
      : `${url.origin}${pathname}`
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

/** Removes user content and credential-like values from human-readable diagnostics. */
export function sanitizeDiagnosticText(value: string) {
  if (SENSITIVE_DIAGNOSTIC.test(value)) {
    return 'Sensitive diagnostic text filtered'
  }

  return value
    .replace(/https?:\/\/[^\s)\]}]+/gi, (url) => sanitizeUrl(url))
    .replace(/\buser_[A-Za-z0-9]+(?:~[^\s/]*)?/g, '[user]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, FILTERED)
    .replace(/\bBearer\s+\S+/gi, `Bearer ${FILTERED}`)
    .replace(/\beyJ[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+){1,2}\b/g, FILTERED)
}

function sanitizeAttached<Value extends SanitizedValue>(
  value: Value,
  key = '',
  depth = 0,
): SanitizedValue {
  if (isSensitiveKey(key)) return FILTERED
  if (depth >= 5) return '[Truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAttached(item, key, depth + 1))
  }
  if (!isAttachedRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitizeAttached(childValue, childKey, depth + 1),
    ]),
  )
}

/** Sanitizes one attached payload without losing its object contract. */
function sanitizeAttachedObject<Payload extends object>(payload: Payload): object {
  if (Array.isArray(payload)) {
    return payload.slice(0, 50).map((item) => sanitizeAttached(item, '', 1))
  }
  if (!isAttachedRecord(payload)) return payload

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      sanitizeAttached(value, key, 1),
    ]),
  )
}

function sanitizeHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return undefined
  const sanitized: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (SAFE_REQUEST_HEADERS.has(name.toLowerCase())) sanitized[name] = value
  }
  return sanitized
}

export function sanitizeSentryBreadcrumb<T extends SentryLikeBreadcrumb>(
  breadcrumb: T,
): T {
  const copy = { ...breadcrumb }
  const category = copy.category?.toLowerCase() ?? ''

  if (category.startsWith('console')) {
    copy.message = 'Console output redacted'
    copy.data = undefined
    return copy
  }

  if (copy.message) copy.message = sanitizeDiagnosticText(copy.message)

  if (copy.data) {
    const data = sanitizeAttachedObject(copy.data)
    if (isAttachedRecord(data) && isStringValue(data.url)) {
      data.url = sanitizeUrl(data.url)
    }
    copy.data = data
  }
  return copy
}

export function sanitizeSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const copy = { ...event }

  if (copy.request) {
    copy.request = {
      ...copy.request,
      ...(copy.request.url
        ? { url: sanitizeUrl(copy.request.url) }
        : undefined),
      headers: sanitizeHeaders(copy.request.headers),
      cookies: undefined,
      data: undefined,
      env: undefined,
      query_string: undefined,
    }
  }

  if (copy.user) {
    copy.user = copy.user.id === undefined ? undefined : { id: copy.user.id }
  }
  if (copy.transaction) {
    const methodAndPath = copy.transaction.match(/^([A-Z]+\s+)(.+)$/)
    copy.transaction = methodAndPath
      ? `${methodAndPath[1]}${sanitizeUrl(methodAndPath[2])}`
      : sanitizeUrl(copy.transaction)
  }
  if (copy.message) copy.message = sanitizeDiagnosticText(copy.message)
  if (copy.logentry) {
    copy.logentry = {
      ...copy.logentry,
      formatted: copy.logentry.formatted
        ? sanitizeDiagnosticText(copy.logentry.formatted)
        : undefined,
      message: copy.logentry.message
        ? sanitizeDiagnosticText(copy.logentry.message)
        : undefined,
      params: undefined,
    }
  }
  if (copy.exception?.values) {
    copy.exception = {
      ...copy.exception,
      values: copy.exception.values.map((exception) => ({
        ...exception,
        value: exception.value
          ? sanitizeDiagnosticText(exception.value)
          : undefined,
      })),
    }
  }
  if (copy.extra) copy.extra = sanitizeAttachedObject(copy.extra)
  if (copy.contexts) copy.contexts = sanitizeAttachedObject(copy.contexts)
  if (copy.breadcrumbs) {
    copy.breadcrumbs = copy.breadcrumbs.map(sanitizeSentryBreadcrumb)
  }

  return copy
}

export function toError(cause: unknown, fallback = 'Unexpected failure') {
  if (cause instanceof Error) return cause
  if (isStringValue(cause)) return new Error(cause)
  return new Error(fallback, { cause })
}
