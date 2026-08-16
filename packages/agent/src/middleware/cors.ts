import type { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { binding, type AppEnvironment, type Bindings } from '../app-env.ts'

const LOCAL_WEB_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])
const STREAM_RESPONSE_HEADERS = [
  'Stream-Next-Offset',
  'Stream-Up-To-Date',
  'Location',
]

function isAllowedWebOrigin(env: Bindings, origin: string) {
  const configured = binding(env, 'WEB_ALLOWED_ORIGINS')
    ?.split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return configured?.length
    ? configured.includes(origin)
    : LOCAL_WEB_ORIGINS.has(origin)
}

// Browser Flue clients use a Clerk bearer token, which triggers an OPTIONS
// preflight. Keep the origin policy ahead of auth so production SSE can connect
// while unknown browser origins fail closed. Native clients send no Origin.
export const webOriginGate: MiddlewareHandler<AppEnvironment> = async (
  c,
  next,
) => {
  const origin = c.req.header('origin')
  if (origin && !isAllowedWebOrigin(c.env, origin)) {
    c.header('Vary', 'Origin')
    return c.json({ error: 'Origin is not allowed.' }, 403)
  }
  await next()
}

export const webCorsPolicy = cors({
  origin: (origin, c) =>
    origin && isAllowedWebOrigin(c.env as Bindings, origin) ? origin : null,
  allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  exposeHeaders: STREAM_RESPONSE_HEADERS,
  maxAge: 86_400,
})
