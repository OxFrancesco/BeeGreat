import { ConvexError } from 'convex/values'

export type RaindropItem = {
  id: number; url: string; title: string; excerpt: string; note: string
  tags: string[]; collectionId: number; important: boolean; cover: string
  updatedAt: string
}
export type RaindropCollection = { id: number; title: string; parentId: number | null }

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Raindrop response')
  return Object.fromEntries(Object.entries(value))
}
function string(value: unknown): string { return typeof value === 'string' ? value : '' }
export function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('Invalid Raindrop id')
  return value
}
export function safeUrl(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an HTTP or HTTPS link')
  return url.href
}
export function parseItem(value: unknown): RaindropItem {
  const item = object(value)
  return {
    id: integer(item._id), url: safeUrl(string(item.link)), title: string(item.title),
    excerpt: string(item.excerpt), note: string(item.note),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    collectionId: integer(object(item.collection).$id), important: item.important === true,
    cover: string(item.cover), updatedAt: string(item.lastUpdate),
  }
}
export function parseItems(value: Record<string, unknown>): RaindropItem[] {
  if (!Array.isArray(value.items)) throw new Error('Invalid Raindrop bookmarks response')
  return value.items.map(parseItem)
}
export function parseCollections(value: Record<string, unknown>): RaindropCollection[] {
  if (!Array.isArray(value.items)) throw new Error('Invalid Raindrop collections response')
  return value.items.map((value) => {
    const item = object(value)
    return { id: integer(item._id), title: string(item.title), parentId: item.parent ? integer(object(item.parent).$id) : null }
  })
}
export async function request(token: string, path: string, method = 'GET', body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.raindrop.io/rest/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) {
    const code = response.status === 401 ? 'RAINDROP_RECONNECT' : response.status === 429 ? 'RAINDROP_RATE_LIMIT' : 'RAINDROP_REQUEST_FAILED'
    const message = response.status === 401 ? 'Reconnect Raindrop to continue.' : response.status === 429 ? 'Raindrop is busy. Try again in a minute.' : 'Raindrop could not complete this request. Try again.'
    throw new ConvexError({ code, message })
  }
  const result = object(await response.json())
  if (result.result === false) throw new Error('Raindrop could not complete this request')
  return result
}
