/**
 * The one sanctioned `as unknown as T` double-cast in this package.
 *
 * Some values arrive through interfaces that are typed too loosely (the
 * Cloudflare Worker `env`, `globalThis.process` under `flue run`/tests, and
 * provider webhook payloads whose exact shape the channel narrows field by
 * field). Re-typing them requires an unchecked cast; funneling every such
 * cast through this helper keeps the trust boundary explicit, greppable, and
 * in a single canonical place instead of scattered `as unknown as` pairs.
 *
 * This performs NO runtime validation — call it only on values whose shape is
 * guaranteed by the platform or verified by the caller afterwards.
 */
export function trustedCast<T>(value: unknown): T {
  return value as T
}
