import { env } from '../_generated/server'

export function secretsMatch(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index++) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }
  return difference === 0
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers?: HeadersInit,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

/** Extracts the secret from an `Authorization: Bearer <secret>` header. */
export function bearerSecret(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
}

/**
 * Validates the shared agent credential-broker secret carried in the Bearer
 * Authorization header. Returns the 401 response on failure, or null when the
 * request is authorized.
 */
export function requireBrokerSecret(request: Request): Response | null {
  const configuredSecret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
  const suppliedSecret = bearerSecret(request)
  if (
    !configuredSecret ||
    !suppliedSecret ||
    !secretsMatch(configuredSecret, suppliedSecret)
  ) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  return null
}

/**
 * Requires an `application/json` Content-Type header. Returns the 415 response
 * on failure, or null when the header is acceptable.
 */
export function requireJsonContentType(request: Request): Response | null {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415)
  }
  return null
}

/**
 * Parses a JSON request body, resolving to null when the body is missing or
 * malformed (mirrors `request.json().catch(() => null)`).
 */
export async function readJsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null
}

type LimitedJsonOptions = {
  maxBytes: number
  /** Error message for the 413 responses when the body exceeds maxBytes. */
  tooLargeError: string
  /** When true, also reject early based on the content-length header. */
  checkContentLength?: boolean
  /**
   * When set, a JSON parse failure yields a 400 response with this error.
   * Otherwise a parse failure yields a null body (callers treat null as an
   * invalid request with their own error shape).
   */
  invalidJsonError?: string
}

/**
 * Reads and parses a size-limited JSON body (`JSON.parse(rawBody || 'null')`).
 * Returns either the parsed body or the exact error response to send.
 */
export async function parseLimitedJsonBody(
  request: Request,
  options: LimitedJsonOptions,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  if (options.checkContentLength) {
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      return {
        ok: false,
        response: jsonResponse({ error: options.tooLargeError }, 413),
      }
    }
  }
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > options.maxBytes) {
    return {
      ok: false,
      response: jsonResponse({ error: options.tooLargeError }, 413),
    }
  }
  try {
    return { ok: true, body: JSON.parse(rawBody || 'null') as unknown }
  } catch {
    if (options.invalidJsonError !== undefined) {
      return {
        ok: false,
        response: jsonResponse({ error: options.invalidJsonError }, 400),
      }
    }
    return { ok: true, body: null }
  }
}
