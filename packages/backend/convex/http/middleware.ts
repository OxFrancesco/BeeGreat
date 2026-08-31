import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import type { Id, TableNames } from '../_generated/dataModel'
import { env } from '../_generated/server'
import { isClerkUserId } from '../revenueCatWebhook'

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

export function jsonResponse<Body>(
  body: Body,
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

/** A JSON value as produced by `JSON.parse` on a request body. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** Clerk user id as validated by `isClerkUserId`. */
export const ClerkUserId = Schema.String.pipe(
  Schema.check(Schema.makeFilter((value) => isClerkUserId(value))),
)

/** Clerk user id in the form the agent credential-broker endpoints accept. */
export const AgentUserId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^user_[A-Za-z0-9]+$/)),
)

/**
 * Decodes a parsed JSON request body against an endpoint's request schema.
 * Returns the decoded domain value, or null when the body does not match.
 */
export function decodeRequestBody<Decoded, Encoded>(
  schema: Schema.Codec<Decoded, Encoded>,
  body: JsonValue,
): Decoded | null {
  const result = Schema.decodeUnknownResult(schema)(body)
  return Result.isSuccess(result) ? result.success : null
}

/**
 * Reads one property of a parsed JSON body, resolving null when the body is
 * not a JSON object or the property is absent or null.
 */
export function jsonObjectProperty(body: JsonValue, key: string): JsonValue {
  if (body instanceof Object && !Array.isArray(body)) {
    return body[key] ?? null
  }
  return null
}

/** Brands a request-supplied document id string for a Convex function call. */
export function requestDocumentId<Table extends TableNames>(
  id: string,
): Id<Table> {
  // SAFETY: `Id` is a compile-time brand over the plain id string carried in
  // the JSON body. Every internal function receiving this value re-validates
  // it at runtime through its `v.id(table)` argument validator and rejects ids
  // that do not reference the expected table.
  return id as Id<Table>
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
  return request.json().catch(() => null)
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
): Promise<{ ok: true; body: JsonValue } | { ok: false; response: Response }> {
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
    return { ok: true, body: JSON.parse(rawBody || 'null') }
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
