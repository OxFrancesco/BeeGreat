import { env } from '../_generated/server'

export function oauthCompletionRedirect(request: Request, kind: 'beennector' | 'google-health' | 'telegram'): Response {
  const configured = env.WEB_APP_URL?.trim()
  if (!configured) return new Response('Connection callback is not configured', { status: 503 })
  const destination = new URL('/connect-callback', configured)
  if (destination.protocol !== 'https:' && destination.hostname !== 'localhost') {
    return new Response('Connection callback is not configured', { status: 503 })
  }
  const source = new URL(request.url)
  const payload = new URLSearchParams({ kind })
  for (const name of ['state', 'code', 'error']) {
    const value = source.searchParams.get(name)
    if (value && value.length <= 8192) payload.set(name, value)
  }
  destination.hash = payload.toString()
  return new Response(null, {
    status: 302,
    headers: { location: destination.toString(), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  })
}
