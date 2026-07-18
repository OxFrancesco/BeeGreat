export type SubscriptionGateEnv = {
  CONVEX_URL?: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
}

export type SubscriptionGateResult =
  | { status: 'active'; expiresAt: number }
  | { status: 'inactive' }
  | {
      status: 'unavailable'
      reason: 'configuration' | 'network' | 'upstream' | 'invalid_response'
    }

function convexSiteUrl(env: SubscriptionGateEnv) {
  const configured = env.CONVEX_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const cloudUrl = env.CONVEX_URL?.trim()
  if (!cloudUrl) return null
  const url = new URL(cloudUrl)
  if (!url.hostname.endsWith('.convex.cloud')) return null
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

/** Fail-closed server check for the Worker routes that incur paid AI costs. */
export async function checkPaidSubscription(
  userId: string,
  env: SubscriptionGateEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<SubscriptionGateResult> {
  const endpoint = convexSiteUrl(env)
  const secret = env.AGENT_CREDENTIAL_BROKER_SECRET?.trim()
  if (!endpoint || !secret) {
    return { status: 'unavailable', reason: 'configuration' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  let response: Response
  try {
    response = await fetchImpl(`${endpoint}/internal/subscription/status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    })
  } catch {
    return { status: 'unavailable', reason: 'network' }
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) return { status: 'unavailable', reason: 'upstream' }

  const body = (await response.json().catch(() => null)) as {
    active?: unknown
    expiresAt?: unknown
  } | null
  if (!body || typeof body.active !== 'boolean') {
    return { status: 'unavailable', reason: 'invalid_response' }
  }
  if (!body.active) return { status: 'inactive' }
  if (
    typeof body.expiresAt !== 'number' ||
    !Number.isFinite(body.expiresAt) ||
    body.expiresAt <= Date.now()
  ) {
    return { status: 'unavailable', reason: 'invalid_response' }
  }
  return { status: 'active', expiresAt: body.expiresAt }
}
