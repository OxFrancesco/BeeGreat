import { toError } from '@beegreat/observability'
import * as Sentry from '@sentry/cloudflare'
import type { Context } from 'hono'
import { trustedCast } from './shared/trusted-cast.ts'

export type Bindings = {
  ELEVENLABS_API_KEY: string
  ELEVENLABS_VOICE_ID?: string
  XAI_API_KEY?: string
  CLERK_JWT_ISSUER_DOMAIN: string
  BEE_CLERK_CLIENT_ID?: string
  CONVEX_URL?: string
  CONVEX_SITE_URL?: string
  AGENT_CREDENTIAL_BROKER_SECRET?: string
  REQUIRE_SUBSCRIPTION?: string
  // Shared secret for trusted service bridges (e.g. the iMessage bridge).
  BRIDGE_SECRET?: string
  SENTRY_DSN?: string
  SENTRY_ENVIRONMENT?: string
  SENTRY_RELEASE?: string
  WEB_ALLOWED_ORIGINS?: string
  FLUE_BEE_V2_AGENT: {
    getByName(name: string): { deleteAccountData(): Promise<void> }
  }
  BEE_SITES_BUCKET: {
    list(options: {
      prefix: string
      limit?: number
    }): Promise<{ objects: Array<{ key: string }> }>
    delete(keys: string[]): Promise<void>
  }
}

export type Variables = {
  userId: string
  authKind: 'bridge' | 'clerk'
}

export type AppEnvironment = { Bindings: Bindings; Variables: Variables }
export type AppContext = Context<AppEnvironment>

export function binding<K extends keyof Bindings>(
  env: Bindings,
  name: K,
): Bindings[K] | undefined {
  const configured =
    env[name] ??
    (trustedCast<{
      process?: { env?: Partial<Record<keyof Bindings, string>> }
    }>(globalThis).process?.env?.[name] as Bindings[K] | undefined)
  // Secrets pasted with a trailing newline produce invalid header values
  // ("Bearer <key>\n" throws TypeError deep inside fetch), so sanitize here.
  return typeof configured === 'string'
    ? ((configured.trim() || undefined) as Bindings[K] | undefined)
    : configured
}

export function captureWorkerFailure(
  error: unknown,
  operation: string,
  extra?: Record<string, unknown>,
) {
  Sentry.captureException(toError(error), {
    tags: { service: 'agent-worker', operation, handled: 'true' },
    extra,
  })
}

// Constant-time comparison so the bridge secret can't be probed byte-by-byte.
export function secretsMatch(a: string, b: string) {
  const encoder = new TextEncoder()
  const [bytesA, bytesB] = [encoder.encode(a), encoder.encode(b)]
  if (bytesA.length !== bytesB.length) return false
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i]
  return diff === 0
}

/**
 * Convex bridge wiring shared by every service-proxy route (channel actions,
 * bridge identity/outbox, CLI Telegram/iMessage). `convexUrl` may be missing;
 * each call site keeps its own exact "not configured" error response.
 */
export function convexBridgeTarget(env: Bindings) {
  return {
    convexUrl: binding(env, 'CONVEX_URL'),
    convexSiteUrl: binding(env, 'CONVEX_SITE_URL'),
    brokerSecret:
      binding(env, 'AGENT_CREDENTIAL_BROKER_SECRET') ??
      binding(env, 'BRIDGE_SECRET'),
  }
}
