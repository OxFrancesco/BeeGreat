import * as Sentry from '@sentry/cloudflare'
import type { MiddlewareHandler } from 'hono'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import {
  binding,
  captureWorkerFailure,
  secretsMatch,
  type AppEnvironment,
} from '../app-env.ts'
import { checkPaidSubscription } from '../subscription-gate'

/**
 * Routes that must be reachable WITHOUT a Clerk session or the bridge
 * secret+user pair. Rules are evaluated in order and any match skips the auth
 * gate entirely; every rule documents why its handler is safe on its own.
 */
const PUBLIC_PATH_RULES: ReadonlyArray<{
  matches(path: string): boolean
}> = [
  {
    // Provider webhook routes authenticate with the exact-body signature checks
    // in @flue/github, @flue/linear, and @flue/notion. They must reach Flue
    // without a Clerk token; no other channel route receives this exception.
    matches: (path) =>
      /^\/channels\/(github|linear|notion)\/webhook$/.test(path),
  },
  {
    // These routes authenticate their Convex caller with the same server-only
    // broker secret in their own handlers. Account deletion must remain
    // reachable after Clerk has deleted the user's identity and session, and
    // settled-action wake-ups arrive without any user session at all.
    matches: (path) =>
      path === '/internal/account-deletion' ||
      path === '/internal/web3-settled' ||
      path === '/internal/job-run',
  },
  {
    // Sender identity has no user yet (unknown senders are the point), so the
    // route verifies the bridge secret itself instead of this middleware.
    matches: (path) => path === '/bridge/identity',
  },
]

// Every route below requires a valid Clerk session token, or the bridge
// shared secret plus the user the bridge is acting for.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

export const authGate: MiddlewareHandler<AppEnvironment> = async (c, next) => {
  if (PUBLIC_PATH_RULES.some((rule) => rule.matches(c.req.path))) {
    await next()
    return
  }
  const bridgeSecret = c.req.header('x-bridge-secret')
  const bridgeUser = c.req.header('x-bridge-user')
  const configuredBridgeSecret = binding(c.env, 'BRIDGE_SECRET')
  if (
    bridgeSecret &&
    bridgeUser &&
    configuredBridgeSecret &&
    secretsMatch(bridgeSecret, configuredBridgeSecret)
  ) {
    c.set('userId', bridgeUser)
    c.set('authKind', 'bridge')
  } else {
    const issuer = binding(c.env, 'CLERK_JWT_ISSUER_DOMAIN')
    if (!issuer) {
      console.error('CLERK_JWT_ISSUER_DOMAIN is not configured')
      captureWorkerFailure(
        new Error('CLERK_JWT_ISSUER_DOMAIN is not configured'),
        'auth.configuration',
      )
      return c.json({ error: 'Auth is not configured.' }, 500)
    }

    const token = c.req.header('authorization')?.replace(/^Bearer /i, '')
    if (!token) {
      return c.json({ error: 'Sign in to talk to Bee.' }, 401)
    }

    jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer })
      if (!payload.sub) throw new Error('Token has no subject')
      const oauthClientId = binding(c.env, 'BEE_CLERK_CLIENT_ID')
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : payload.aud
          ? [payload.aud]
          : []
      if (
        audiences.length > 0 &&
        oauthClientId &&
        !audiences.includes(oauthClientId)
      ) {
        throw new Error('OAuth token has the wrong audience')
      }
      c.set('userId', payload.sub)
      c.set('authKind', 'clerk')
    } catch {
      return c.json({ error: 'Session expired. Sign in again.' }, 401)
    }
  }

  // Agent instances are keyed by Clerk user id (optionally suffixed with
  // `~<session>` for restarted conversations); users can only reach their own.
  const match = c.req.path.match(/^\/agents\/[^/]+\/([^/]+)/)
  if (match && decodeURIComponent(match[1]).split('~')[0] !== c.get('userId')) {
    return c.json({ error: "You can't access another user's agent." }, 403)
  }

  Sentry.setUser({ id: c.get('userId') })

  // BeeGreat Pro is optional: the hard gate only engages when a deployment
  // explicitly opts in with REQUIRE_SUBSCRIPTION=true.
  const requireSubscription =
    binding(c.env, 'REQUIRE_SUBSCRIPTION')?.trim().toLowerCase() === 'true'
  if (
    requireSubscription &&
    /^\/(?:agents(?:\/|$)|voice(?:\/|$))/.test(c.req.path)
  ) {
    const subscription = await checkPaidSubscription(c.get('userId'), {
      CONVEX_URL: binding(c.env, 'CONVEX_URL'),
      CONVEX_SITE_URL: binding(c.env, 'CONVEX_SITE_URL'),
      AGENT_CREDENTIAL_BROKER_SECRET: binding(
        c.env,
        'AGENT_CREDENTIAL_BROKER_SECRET',
      ),
    })
    if (subscription.status === 'inactive') {
      return c.json(
        {
          error:
            'BeeGreat Pro is required. Subscribe or restore in the signed-in BeeGreat iOS app, then try again.',
          code: 'SUBSCRIPTION_REQUIRED',
          recovery: {
            action: 'subscribe_or_restore',
            platform: 'ios',
          },
        },
        402,
      )
    }
    if (subscription.status === 'unavailable') {
      captureWorkerFailure(
        new Error('Subscription verification is unavailable'),
        'subscription.verify',
        { reason: subscription.reason },
      )
      c.header('retry-after', '5')
      return c.json(
        {
          error: 'Subscription verification is temporarily unavailable.',
          code: 'SUBSCRIPTION_UNAVAILABLE',
        },
        503,
      )
    }
  }

  await next()
}
