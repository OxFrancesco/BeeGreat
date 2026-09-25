import * as Predicate from 'effect/Predicate'
import * as Schema from 'effect/Schema'
import { jsonRecord } from './jsonValue'
type JsonValue = Schema.Json
type JsonRecord = Schema.JsonObject
import { ConvexError } from 'convex/values'

export type RaindropItem = {
  id: number; url: string; title: string; excerpt: string; note: string
  tags: string[]; collectionId: number; important: boolean; cover: string
  updatedAt: string
}
export type RaindropCollection = { id: number; title: string; parentId: number | null }

export function object(value: JsonValue | undefined): JsonRecord {
  const record = jsonRecord(value)
  if (!record) throw new Error('Invalid Raindrop response')
  return record
}
function string(value: JsonValue | undefined): string { return Predicate.isString(value) ? value : '' }
export function integer(value: JsonValue | undefined): number {
  if (!Predicate.isNumber(value) || !Number.isSafeInteger(value)) throw new Error('Invalid Raindrop id')
  return value
}
export function safeUrl(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an HTTP or HTTPS link')
  return url.href
}
export function parseItem(value: JsonValue | undefined): RaindropItem {
  const item = object(value)
  return {
    id: integer(item._id), url: safeUrl(string(item.link)), title: string(item.title),
    excerpt: string(item.excerpt), note: string(item.note),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => Predicate.isString(tag)) : [],
    collectionId: integer(object(item.collection).$id), important: item.important === true,
    cover: string(item.cover), updatedAt: string(item.lastUpdate),
  }
}
export function parseItems(value: JsonRecord): RaindropItem[] {
  if (!Array.isArray(value.items)) throw new Error('Invalid Raindrop bookmarks response')
  return value.items.map(parseItem)
}
export function parseCollections(value: JsonRecord): RaindropCollection[] {
  if (!Array.isArray(value.items)) throw new Error('Invalid Raindrop collections response')
  return value.items.map((value) => {
    const item = object(value)
    return { id: integer(item._id), title: string(item.title), parentId: item.parent ? integer(object(item.parent).$id) : null }
  })
}
export async function request(token: string, path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: JsonValue): Promise<JsonRecord> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25_000) }
  if (body !== undefined) {
    if (method === 'GET') throw new Error('Raindrop GET requests cannot include a body')
    init.body = JSON.stringify(body)
  }
  const response = await fetch(`https://api.raindrop.io/rest/v1/${path}`, init)
  if (!response.ok) {
    const code = response.status === 401 ? 'RAINDROP_RECONNECT' : response.status === 429 ? 'RAINDROP_RATE_LIMIT' : 'RAINDROP_REQUEST_FAILED'
    const message = response.status === 401 ? 'Reconnect Raindrop to continue.' : response.status === 429 ? 'Raindrop is busy. Try again in a minute.' : 'Raindrop could not complete this request. Try again.'
    throw new ConvexError({ code, message })
  }
  const result = Schema.decodeUnknownSync(Schema.JsonObject)(await response.json())
  if (result.result === false) throw new Error('Raindrop could not complete this request')
  return object(result)
}
