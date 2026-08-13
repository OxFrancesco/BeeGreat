export type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'

export type ConnectedBeennector = {
  provider: BeennectorProvider
  accountName?: string
  workspaceName?: string
  googleServices?: GoogleWorkspaceService[]
}

export type GoogleWorkspaceService =
  | 'mail'
  | 'calendar'
  | 'drive'
  | 'contacts'
  | 'tasks'
  | 'forms'

export type BeennectorRuntime = {
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

export async function callBeennectorService<T>(
  convexUrl: string,
  runtime: BeennectorRuntime,
  input: Record<string, unknown>,
): Promise<T> {
  const secret = runtime.brokerSecret?.trim()
  if (!secret) {
    throw new Error('Beennectors are not configured on this Bee deployment.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(
      `${siteUrl(convexUrl, runtime.convexSiteUrl)}/internal/beennectors`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    )
    const body = (await response.json().catch(() => null)) as
      | { error?: unknown }
      | T
      | null
    if (!response.ok) {
      const message =
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : `Beennector service failed (HTTP ${response.status})`
      throw new Error(message)
    }
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}
