// Convex-backed sender identity for the iMessage bridge. Senders are linked
// to BeeGreat accounts through magic links minted by the agent worker; there
// is no static sender allowlist.

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type IdentityClientOptions = {
  agentUrl: string
  bridgeSecret: string
  fetcher?: Fetcher
  now?: () => number
}

export type BeginLinkResult =
  | { status: 'link'; url: string; expiresAt: number }
  | { status: 'throttled' }
  | { status: 'rate_limited' }
  | { status: 'invalid' }

/**
 * The worker's /bridge/identity endpoint answers every action with one JSON
 * envelope: `userId` for resolve, `url`/`expiresAt` for begin_link,
 * `disconnected` for unlink, and `error` on failures.
 */
export type IdentityActionBody = {
  userId?: string | null
  url?: string
  expiresAt?: number
  disconnected?: boolean
  error?: string
}

// A resolved user stays cached briefly so a burst of messages costs one
// lookup; unknown senders re-check quickly so a fresh link works right away.
const RESOLVED_TTL_MS = 5 * 60 * 1000
const UNRESOLVED_TTL_MS = 15 * 1000
// One welcome link per sender per window; extra messages don't re-send it.
const LINK_OFFER_INTERVAL_MS = 2 * 60 * 1000

/** Phone numbers compare without formatting; emails compare lowercased. */
export function normalizeAddress(address: string) {
  const trimmed = address.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : trimmed.replace(/[\s().-]/g, '')
}

export function createIdentityClient(options: IdentityClientOptions) {
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? Date.now
  const agentUrl = options.agentUrl.replace(/\/$/, '')
  const cache = new Map<string, { userId: string | null; expiresAt: number }>()
  const linkOffers = new Map<string, number>()

  async function identityAction(
    action: 'resolve' | 'begin_link' | 'unlink',
    address: string,
  ) {
    const response = await fetcher(`${agentUrl}/bridge/identity`, {
      method: 'POST',
      headers: {
        'x-bridge-secret': options.bridgeSecret,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action, address }),
    })
    // SAFETY: /bridge/identity is the bridge's own worker; every action
    // answers with the identity envelope, and an unparseable body is
    // normalized to null.
    const body = (await response.json().catch(() => null)) as
      | IdentityActionBody
      | null
    return { status: response.status, body }
  }

  return {
    /** Maps a normalized sender address to its BeeGreat user, if linked. */
    async resolve(address: string): Promise<string | null> {
      const cached = cache.get(address)
      if (cached && cached.expiresAt > now()) return cached.userId
      const { status, body } = await identityAction('resolve', address)
      if (status !== 200) {
        // Unknown state must not silently drop a linked user: surface the
        // failure to the caller instead of caching a guess.
        throw Object.assign(
          new Error(body?.error ?? `Sender resolution failed (HTTP ${status})`),
          { status },
        )
      }
      const userId = body?.userId ?? null
      cache.set(address, {
        userId,
        expiresAt: now() + (userId ? RESOLVED_TTL_MS : UNRESOLVED_TTL_MS),
      })
      return userId
    },

    /** Mints one magic link for an unknown sender, throttled per address. */
    async beginLink(address: string): Promise<BeginLinkResult> {
      const lastOffer = linkOffers.get(address)
      if (
        lastOffer !== undefined &&
        now() - lastOffer < LINK_OFFER_INTERVAL_MS
      ) {
        return { status: 'throttled' }
      }
      const { status, body } = await identityAction('begin_link', address)
      if (status === 429) return { status: 'rate_limited' }
      if (
        status !== 200 ||
        body?.url === undefined ||
        body.expiresAt === undefined
      ) {
        return { status: 'invalid' }
      }
      linkOffers.set(address, now())
      return { status: 'link', url: body.url, expiresAt: body.expiresAt }
    },

    /** Removes the sender's link (`/unlink`) and forgets the cached user. */
    async unlink(address: string): Promise<boolean> {
      const { status, body } = await identityAction('unlink', address)
      cache.delete(address)
      return status === 200 && body?.disconnected === true
    },

    /** A completed link invalidates any cached negative resolution. */
    forget(address: string) {
      cache.delete(address)
    },
  }
}

export type IdentityClient = ReturnType<typeof createIdentityClient>
