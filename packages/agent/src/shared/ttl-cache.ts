/**
 * Tiny per-key TTL cache for agent-init lookups. Module state lives as long as
 * the Durable Object instance stays warm, so consecutive messages in an active
 * conversation skip repeat lookups. Callers must never cache failures.
 */
export interface TtlCache<T> {
  get(key: string): T | undefined
  set(key: string, value: T, ttlMs: number): void
}

export function createTtlCache<T>(): TtlCache<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>()
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key, value, ttlMs) {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs })
    },
  }
}
