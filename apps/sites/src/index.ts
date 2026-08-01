import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

type BucketObject = {
  body: BodyInit | ReadableStream<Uint8Array>
  httpMetadata?: { contentType?: string; cacheControl?: string }
}

type SitesBucket = {
  get(key: string): Promise<BucketObject | null>
}

type Env = {
  CONVEX_URL: string
  BEE_SITES_BUCKET: SitesBucket
}

type SiteResolution = { assetPrefix: string } | null
type ResolveSite = (slug: string, env: Env) => Promise<SiteResolution>
type ResolvePreview = (version: string, env: Env) => Promise<SiteResolution>
const publicBySlug = makeFunctionReference<
  'query',
  { slug: string },
  SiteResolution
>('beeSites:publicBySlug')
const publicPreviewByVersion = makeFunctionReference<
  'query',
  { version: string },
  SiteResolution
>('beeSites:publicPreviewByVersion')

const SLUG = /^[a-z0-9][a-z0-9-]{1,47}$/
const PREVIEW_TOKEN = /^[a-f0-9]{32}$/
const ASSET_PREFIX = /^users\/[A-Za-z0-9_-]+\/sites\/[A-Za-z0-9_-]+\/deployments\/[A-Za-z0-9_-]+\/$/

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "connect-src 'none'",
    "media-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const

function headersFor(
  object: BucketObject,
  path: string,
  preview: boolean,
) {
  const headers = new Headers(SECURITY_HEADERS)
  headers.set(
    'content-type',
    object.httpMetadata?.contentType ??
      (path.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : 'application/octet-stream'),
  )
  headers.set(
    'cache-control',
    preview
      ? 'no-store'
      : object.httpMetadata?.cacheControl ??
          (path.endsWith('.html')
            ? 'public, max-age=60'
            : 'public, max-age=31536000, immutable'),
  )
  if (preview) headers.set('x-robots-tag', 'noindex, nofollow')
  return headers
}

function notFound() {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Site not found</title><body><main><h1>This Bee Site is not available.</h1></main></body></html>',
    {
      status: 404,
      headers: {
        ...SECURITY_HEADERS,
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  )
}

function parseSegments(pathname: string) {
  try {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
    if (
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          segment.includes('/') ||
          segment.includes('\\') ||
          segment.includes('\0'),
      )
    ) {
      return null
    }
    return segments
  } catch {
    return null
  }
}

function assetCandidates(segments: string[], trailingSlash: boolean) {
  if (!segments.length) return ['index.html']
  const path = segments.join('/')
  if (trailingSlash) return [`${path}/index.html`]
  const leaf = segments.at(-1) ?? ''
  return leaf.includes('.') ? [path] : [`${path}/index.html`, `${path}.html`]
}

async function serveAsset(
  request: Request,
  bucket: SitesBucket,
  assetPrefix: string,
  segments: string[],
  preview: boolean,
) {
  if (!ASSET_PREFIX.test(assetPrefix)) return notFound()
  const trailingSlash = new URL(request.url).pathname.endsWith('/')
  for (const path of assetCandidates(segments, trailingSlash)) {
    const object = await bucket.get(`${assetPrefix}${path}`)
    if (!object) continue
    return new Response(request.method === 'HEAD' ? null : object.body, {
      status: 200,
      headers: headersFor(object, path, preview),
    })
  }
  return notFound()
}

async function defaultResolveSite(slug: string, env: Env) {
  const client = new ConvexHttpClient(env.CONVEX_URL)
  return await client.query(publicBySlug, { slug })
}

async function defaultResolvePreview(version: string, env: Env) {
  const client = new ConvexHttpClient(env.CONVEX_URL)
  return await client.query(publicPreviewByVersion, { version })
}

export function createSitesWorker(
  dependencies: {
    resolveSite?: ResolveSite
    resolvePreview?: ResolvePreview
  } = {},
) {
  const resolveSite = dependencies.resolveSite ?? defaultResolveSite
  const resolvePreview = dependencies.resolvePreview ?? defaultResolvePreview
  return {
    async fetch(request: Request, env: Env) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { allow: 'GET, HEAD', ...SECURITY_HEADERS },
        })
      }
      const url = new URL(request.url)
      const segments = parseSegments(url.pathname)
      if (!segments?.length) return notFound()

      if (segments[0] === 'preview') {
        const token = segments[1]
        if (!token || !PREVIEW_TOKEN.test(token)) return notFound()
        const preview = await resolvePreview(token, env).catch(() => null)
        if (!preview) return notFound()
        return await serveAsset(
          request,
          env.BEE_SITES_BUCKET,
          preview.assetPrefix,
          segments.slice(2),
          true,
        )
      }

      const slug = segments[0]
      if (!SLUG.test(slug)) return notFound()
      const site = await resolveSite(slug, env).catch(() => null)
      if (!site) return notFound()
      return await serveAsset(
        request,
        env.BEE_SITES_BUCKET,
        site.assetPrefix,
        segments.slice(1),
        false,
      )
    },
  }
}

export default createSitesWorker()
