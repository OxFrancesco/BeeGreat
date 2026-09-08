export type ConnectionCallback = {
  kind: 'beennector' | 'google-health' | 'telegram'
  state: string
  code?: string
  errorCode?: string
}
const storageKey = 'beegreat.connection-callback'
const lifetime = 15 * 60_000

function parseCallback(value: unknown): ConnectionCallback | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (!['beennector', 'google-health', 'telegram'].includes(String(item.kind))) return null
  if (typeof item.state !== 'string' || !item.state || item.state.length > 8192) return null
  for (const key of ['code', 'errorCode']) {
    if (item[key] !== undefined && (typeof item[key] !== 'string' || (item[key]).length > 8192)) return null
  }
  return item as ConnectionCallback
}

export function readConnectionCallback(hash: string, storage: Storage, now = Date.now()): ConnectionCallback | null {
  const params = new URLSearchParams(hash.slice(1))
  if (params.has('kind') || params.has('state')) {
    const callback = parseCallback({ kind: params.get('kind'), state: params.get('state'), code: params.get('code') ?? undefined, errorCode: params.get('error') ?? undefined })
    storage.removeItem(storageKey)
    if (callback) storage.setItem(storageKey, JSON.stringify({ callback, expiresAt: now + lifetime }))
    return callback
  }
  try {
    const stored = JSON.parse(storage.getItem(storageKey) ?? 'null')
    if (stored && typeof stored.expiresAt === 'number' && stored.expiresAt > now && stored.expiresAt <= now + lifetime) return parseCallback(stored.callback)
  } catch { /* An invalid pending handoff cannot be resumed. */ }
  storage.removeItem(storageKey)
  return null
}

export function clearConnectionCallback(storage: Storage) {
  storage.removeItem(storageKey)
}
