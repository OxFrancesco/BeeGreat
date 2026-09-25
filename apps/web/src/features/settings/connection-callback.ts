import { z } from 'zod'

const callbackSchema = z.object({
  kind: z.enum(['beennector', 'google-health', 'telegram']),
  state: z.string().min(1).max(8192),
  code: z.string().max(8192).optional(),
  errorCode: z.string().max(8192).optional(),
})
export type ConnectionCallback = z.infer<typeof callbackSchema>
type CallbackStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const storageKey = 'beegreat.connection-callback'
const lifetime = 15 * 60_000

export function readConnectionCallback(hash: string, storage: CallbackStorage, now = Date.now()): ConnectionCallback | null {
  const params = new URLSearchParams(hash.slice(1))
  if (params.has('kind') || params.has('state')) {
    const callback = callbackSchema.safeParse({ kind: params.get('kind'), state: params.get('state'), code: params.get('code') ?? undefined, errorCode: params.get('error') ?? undefined }).data ?? null
    storage.removeItem(storageKey)
    if (callback) storage.setItem(storageKey, JSON.stringify({ callback, expiresAt: now + lifetime }))
    return callback
  }
  try {
    const stored = z.object({ callback: callbackSchema, expiresAt: z.number().gt(now).lte(now + lifetime) }).safeParse(JSON.parse(storage.getItem(storageKey) ?? 'null'))
    if (stored.success) return stored.data.callback
  } catch { /* An invalid pending handoff cannot be resumed. */ }
  storage.removeItem(storageKey)
  return null
}

export function clearConnectionCallback(storage: CallbackStorage) {
  storage.removeItem(storageKey)
}
