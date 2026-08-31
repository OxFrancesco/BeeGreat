/**
 * Hand-written JSON boundary types for the CLI, which has no schema library.
 * `JSON.parse` and `Response.json` results are typed as `JsonValue` at the
 * I/O edge and narrowed into owner types with the guards below, so no
 * `unknown` or type assertion leaks past the boundary.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** True for the plain objects `JSON.parse` produces (never arrays or primitives). */
export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return (
    value !== null &&
    value !== undefined &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function isJsonString(value: JsonValue | undefined): value is string {
  return String(value) === value;
}

/** JSON numbers are always finite; this also rejects strings and booleans. */
export function isFiniteJsonNumber(
  value: JsonValue | undefined,
): value is number {
  return Number.isFinite(value);
}
