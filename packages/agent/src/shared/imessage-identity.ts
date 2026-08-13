import type { JsonValue } from '@flue/runtime'

export type ImessageServiceOptions = {
  convexSiteUrl?: string
  brokerSecret?: string
}

export type ImessageIdentityOperation =
  | 'resolve'
  | 'begin_link'
  | 'unlink'
  | 'status'
  | 'disconnect'
  | 'claim_delivery'
  | 'complete_delivery'
  | 'retry_delivery'

function siteUrl(convexUrl: string, configured?: string) {
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(convexUrl)
  if (!url.hostname.endsWith('.convex.cloud')) {
    throw new Error('CONVEX_SITE_URL is required for non-Convex-cloud URLs.')
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

/**
 * The bridge never holds the broker secret: sender resolution and magic-link
 * minting go through the worker, which forwards them to Convex here.
 */
export async function callImessageService<T extends JsonValue = JsonValue>(
  convexUrl: string,
  options: ImessageServiceOptions,
  operation: ImessageIdentityOperation,
  input: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<{ status: number; body: T }> {
  const secret = options.brokerSecret?.trim()
  if (!secret) {
    throw new Error(
      'Bee iMessage identity is not configured on this deployment.',
    )
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetcher(
      `${siteUrl(convexUrl, options.convexSiteUrl)}/internal/imessage`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ operation, ...input }),
        signal: controller.signal,
      },
    )
    const body = (await response.json().catch(() => null)) as T
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}
