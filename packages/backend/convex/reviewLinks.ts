import { env } from './_generated/server'

export function reviewLink(kind: 'site' | 'comment', id: string) {
  const url = new URL('/review', env.WEB_APP_URL?.trim() || 'https://beegreat.app')
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('The review page is not configured.')
  url.searchParams.set(kind, id)
  return url.toString()
}
