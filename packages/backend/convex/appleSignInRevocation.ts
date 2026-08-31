'use node'

import {
  createPrivateKey,
  sign as signBytes,
  type KeyObject,
} from 'node:crypto'
import * as Predicate from 'effect/Predicate'
import { jsonRecord } from './jsonValue'

const CLERK_API_BASE_URL = 'https://api.clerk.com/v1'
// Keep the direct BAPI call aligned with the installed @clerk/backend SDK.
const CLERK_API_VERSION = '2025-11-10'
const APPLE_REVOCATION_URL = 'https://appleid.apple.com/auth/revoke'
const APPLE_AUDIENCE = 'https://appleid.apple.com'
const REQUEST_TIMEOUT_MS = 10_000
const CLIENT_SECRET_TTL_SECONDS = 5 * 60

export type AppleSignInRevocationConfig = {
  clientId: string | undefined
  teamId: string | undefined
  keyId: string | undefined
  privateKey: string | undefined
}

type ValidAppleSignInRevocationConfig = {
  clientId: string
  teamId: string
  keyId: string
  privateKey: KeyObject
}

export class AppleSignInRevocationError extends Error {
  constructor(
    message: string,
    readonly reason:
      'configuration' | 'network' | 'upstream' | 'invalid_response',
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'AppleSignInRevocationError'
  }
}

function configurationError(message: string) {
  return new AppleSignInRevocationError(message, 'configuration', false)
}

function requiredValue(value: string | undefined, name: string) {
  const configured = value?.trim()
  if (!configured) throw configurationError(`${name} is not configured`)
  return configured
}

function parsePrivateKey(value: string | undefined) {
  const configured = requiredValue(value, 'APPLE_SIGN_IN_PRIVATE_KEY').replace(
    /\\n/g,
    '\n',
  )
  let key: KeyObject
  try {
    key = createPrivateKey(configured)
  } catch {
    throw configurationError('APPLE_SIGN_IN_PRIVATE_KEY is invalid')
  }
  const curve = key.asymmetricKeyDetails?.namedCurve
  if (
    key.asymmetricKeyType !== 'ec' ||
    (curve !== 'prime256v1' && curve !== 'P-256')
  ) {
    throw configurationError(
      'APPLE_SIGN_IN_PRIVATE_KEY must be an Apple P-256 private key',
    )
  }
  return key
}

function parseAppleConfig(
  config: AppleSignInRevocationConfig,
): ValidAppleSignInRevocationConfig {
  const clientId = requiredValue(config.clientId, 'APPLE_SIGN_IN_CLIENT_ID')
  const teamId = requiredValue(config.teamId, 'APPLE_SIGN_IN_TEAM_ID')
  const keyId = requiredValue(config.keyId, 'APPLE_SIGN_IN_KEY_ID')
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{2,254}$/.test(clientId)) {
    throw configurationError('APPLE_SIGN_IN_CLIENT_ID is invalid')
  }
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    throw configurationError('APPLE_SIGN_IN_TEAM_ID is invalid')
  }
  if (!/^[A-Z0-9]{10}$/.test(keyId)) {
    throw configurationError('APPLE_SIGN_IN_KEY_ID is invalid')
  }
  return {
    clientId,
    teamId,
    keyId,
    privateKey: parsePrivateKey(config.privateKey),
  }
}

type AppleClientSecretHeader = { alg: 'ES256'; kid: string }
type AppleClientSecretClaims = {
  iss: string
  iat: number
  exp: number
  aud: string
  sub: string
}

function encodeJson(value: AppleClientSecretHeader | AppleClientSecretClaims) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Creates a short-lived ES256 client secret accepted by Apple's REST API. */
export function createAppleClientSecret(
  config: AppleSignInRevocationConfig,
  now = Date.now(),
) {
  const parsed = parseAppleConfig(config)
  const issuedAt = Math.floor(now / 1_000)
  const header = encodeJson({ alg: 'ES256', kid: parsed.keyId })
  const payload = encodeJson({
    iss: parsed.teamId,
    iat: issuedAt,
    exp: issuedAt + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: parsed.clientId,
  })
  const signingInput = `${header}.${payload}`
  let signature: Buffer
  try {
    signature = signBytes('sha256', Buffer.from(signingInput), {
      key: parsed.privateKey,
      dsaEncoding: 'ieee-p1363',
    })
  } catch {
    throw configurationError('APPLE_SIGN_IN_PRIVATE_KEY could not sign')
  }
  if (signature.length !== 64) {
    throw configurationError(
      'APPLE_SIGN_IN_PRIVATE_KEY produced an invalid signature',
    )
  }
  return {
    clientId: parsed.clientId,
    clientSecret: `${signingInput}.${signature.toString('base64url')}`,
  }
}

async function timedFetch(
  input: string | URL,
  init: RequestInit,
  fetchImpl: typeof fetch,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Reads Apple OAuth access tokens held by Clerk. An empty, structurally valid
 * response is the only no-token result; auth, network, and parse failures fail
 * closed so they can never be mistaken for a user without a revocable token.
 */
export async function fetchClerkAppleAccessTokens(
  userId: string,
  clerkSecretKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
) {
  const secretKey = requiredValue(clerkSecretKey, 'CLERK_SECRET_KEY')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  let body: unknown
  try {
    response = await fetchImpl(
      `${CLERK_API_BASE_URL}/users/${encodeURIComponent(userId)}/oauth_access_tokens/oauth_apple?paginated=true`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${secretKey}`,
          accept: 'application/json',
          'Clerk-API-Version': CLERK_API_VERSION,
        },
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      const configuration = response.status === 401 || response.status === 403
      throw new AppleSignInRevocationError(
        'Clerk rejected the Apple token lookup',
        configuration ? 'configuration' : 'upstream',
        !configuration && (response.status === 429 || response.status >= 500),
      )
    }
    try {
      body = await response.json()
    } catch {
      if (controller.signal.aborted) {
        throw new AppleSignInRevocationError(
          'Clerk token lookup timed out',
          'network',
          true,
        )
      }
      throw new AppleSignInRevocationError(
        'Clerk returned an invalid Apple token response',
        'invalid_response',
        false,
      )
    }
  } catch (error) {
    if (error instanceof AppleSignInRevocationError) throw error
    throw new AppleSignInRevocationError(
      'Could not reach Clerk while preparing account deletion',
      'network',
      true,
    )
  } finally {
    clearTimeout(timeout)
  }
  const record = jsonRecord(body)
  if (
    !record ||
    !Array.isArray(record.data) ||
    !Number.isSafeInteger(record.total_count) ||
    Number(record.total_count) < record.data.length ||
    Number(record.total_count) > record.data.length
  ) {
    throw new AppleSignInRevocationError(
      'Clerk returned an invalid or incomplete Apple token response',
      'invalid_response',
      false,
    )
  }
  if (record.data.length === 0) return []
  const tokens: string[] = []
  for (const entry of record.data) {
    const token = jsonRecord(entry)?.token
    if (!Predicate.isString(token) || !token.trim()) {
      throw new AppleSignInRevocationError(
        'Clerk returned an invalid Apple token response',
        'invalid_response',
        false,
      )
    }
    tokens.push(token.trim())
  }
  return [...new Set(tokens)]
}

export async function revokeAppleAccessTokens(
  tokens: string[],
  config: AppleSignInRevocationConfig,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
) {
  if (tokens.length === 0) return
  const { clientId, clientSecret } = createAppleClientSecret(config, now)
  for (const token of new Set(tokens)) {
    let response: Response
    try {
      response = await timedFetch(
        APPLE_REVOCATION_URL,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            token,
            token_type_hint: 'access_token',
          }).toString(),
          cache: 'no-store',
          redirect: 'error',
        },
        fetchImpl,
      )
    } catch {
      throw new AppleSignInRevocationError(
        'Could not reach Apple token revocation',
        'network',
        true,
      )
    }
    if (response.status !== 200) {
      throw new AppleSignInRevocationError(
        'Apple token revocation was rejected',
        response.status === 400 ? 'configuration' : 'upstream',
        response.status === 429 || response.status >= 500,
      )
    }
  }
}

export async function revokeClerkAppleTokensBeforeDeletion(
  userId: string,
  clerkSecretKey: string | undefined,
  config: AppleSignInRevocationConfig,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<'revoked' | 'no_token'> {
  const tokens = await fetchClerkAppleAccessTokens(
    userId,
    clerkSecretKey,
    fetchImpl,
  )
  if (tokens.length === 0) return 'no_token'
  await revokeAppleAccessTokens(tokens, config, now, fetchImpl)
  return 'revoked'
}
