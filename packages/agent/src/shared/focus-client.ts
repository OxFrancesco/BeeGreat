export type FocusServiceOptions = {
  convexSiteUrl?: string
  brokerSecret?: string
}

function siteUrl(convexUrl: string, configured?: string) {
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(convexUrl)
  if (!url.hostname.endsWith('.convex.cloud')) {
    throw new Error('CONVEX_SITE_URL is required for non-Convex-cloud URLs.')
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

export async function callFocusService<T extends JsonValue = JsonValue>(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
  operation: string,
  input: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const secret = options.brokerSecret?.trim()
  if (!secret) {
    throw new Error('Bee focus changes are not configured on this deployment.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetcher(`${siteUrl(convexUrl, options.convexSiteUrl)}/internal/focus`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId, operation, ...input }),
      signal: controller.signal,
    })
    const body = (await response.json().catch(() => null)) as
      | { error?: unknown }
      | T
      | null
    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `Focus service failed (HTTP ${response.status})`
      throw new Error(message)
    }
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}

export function isoTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO-8601 date and time with an offset.`)
  }
  return timestamp
}
import type { JsonValue } from '@flue/runtime'
