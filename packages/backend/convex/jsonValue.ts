import * as Predicate from 'effect/Predicate'

/** A value already produced by `JSON.parse` (HTTP bodies, provider responses). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonRecord = { [key: string]: JsonValue }

/**
 * Narrows a parsed-JSON payload to its record arm. The generic input lets an
 * I/O boundary hand over its freshly parsed body without re-annotating it.
 */
export function jsonRecord<Payload>(value: Payload): JsonRecord | undefined {
  if (value === null || !Predicate.isObject(value) || Array.isArray(value)) {
    return undefined
  }
  // SAFETY: a parsed-JSON value that is an object and not an array is exactly
  // the string-keyed record arm of the JsonValue union.
  return value as JsonRecord
}
