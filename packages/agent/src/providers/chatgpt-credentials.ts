export interface ChatGptCredentialEnv {
  CONVEX_URL: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  BRIDGE_SECRET?: string
}

export type ChatGptCredentialResolution =
  | { status: 'connected'; accessToken: string; expiresAt: number }
  | { status: 'disconnected' | 'needs_reauth' | 'unavailable' }

function convexSiteUrl(env: ChatGptCredentialEnv) {
  if (env.CONVEX_SITE_URL) return env.CONVEX_SITE_URL.replace(/\/$/, '')
  const url = new URL(env.CONVEX_URL)
  if (!url.hostname.endsWith('.convex.cloud')) {
    throw new Error('CONVEX_SITE_URL is required for non-Convex-cloud URLs.')
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  return url.origin
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export async function resolveChatGptCredential(
  userId: string,
  env: ChatGptCredentialEnv,
): Promise<ChatGptCredentialResolution> {
  // BRIDGE_SECRET is accepted only as a local migration fallback. Production
  // deployments should configure the narrower broker secret explicitly.
  const brokerSecret =
    env.AGENT_CREDENTIAL_BROKER_SECRET?.trim() ?? env.BRIDGE_SECRET?.trim()
  if (!brokerSecret) return { status: 'unavailable' }

  const endpoint = `${convexSiteUrl(env)}/internal/chatgpt/token`
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${brokerSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId }),
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timeout)
      return { status: 'unavailable' }
    }
    clearTimeout(timeout)

    if (response.ok) {
      const body = (await response.json()) as {
        accessToken?: unknown
        expiresAt?: unknown
      }
      if (
        typeof body.accessToken !== 'string' ||
        typeof body.expiresAt !== 'number'
      ) {
        return { status: 'unavailable' }
      }
      return {
        status: 'connected',
        accessToken: body.accessToken,
        expiresAt: body.expiresAt,
      }
    }
    if (response.status === 404) return { status: 'disconnected' }
    if (response.status === 401) return { status: 'needs_reauth' }
    if (response.status !== 503 || attempt === 2) {
      return { status: 'unavailable' }
    }
    const retryAfter = Number(response.headers.get('retry-after') ?? '1')
    await wait(Math.min(Math.max(retryAfter, 0.25), 2) * 1000)
  }
  return { status: 'unavailable' }
}
