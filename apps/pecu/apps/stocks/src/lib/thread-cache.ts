export const THREAD_CACHE_LIMIT = 12;
export const THREAD_CACHE_BYTES = 4 * 1024 * 1024;

type Entry = {
  state: unknown | null;
  bytes: number;
  pending: boolean;
  retry: unknown | null;
};
// Map order is recency. Active history and unsent/retry controls are preserved.
export function trimThreadCache<K, T extends Entry>(
  cache: Map<K, T>,
  active: K,
) {
  for (const [id, entry] of cache) {
    if (id !== active && !entry.state && !entry.pending && !entry.retry)
      cache.delete(id);
  }
  let count = 0;
  let bytes = 0;
  for (const entry of cache.values()) {
    if (entry.state) count++;
    bytes += entry.bytes;
  }
  for (const [id, entry] of cache) {
    if (count <= THREAD_CACHE_LIMIT && bytes <= THREAD_CACHE_BYTES) break;
    if (id === active || !entry.state) continue;
    count--;
    bytes -= entry.bytes;
    if (entry.pending || entry.retry)
      cache.set(id, { ...entry, state: null, bytes: 0 });
    else cache.delete(id);
  }
  return cache;
}
export function historyBytes(state: unknown) {
  return state ? new TextEncoder().encode(JSON.stringify(state)).byteLength : 0;
}
