'use node'

import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const ISSUER = 'https://oauth.telegram.org'
const AUTH_URL = `${ISSUER}/auth`
const TOKEN_URL = `${ISSUER}/token`
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))

export const TELEGRAM_SCOPES = [
  'openid',
  'profile',
  'telegram:bot_access',
] as const

export class TelegramOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
  ) {
    super(message)
  }
}

function requiredEnv(
  name:
    | 'TELEGRAM_OIDC_CLIENT_ID'
    | 'TELEGRAM_OIDC_CLIENT_SECRET'
    | 'TELEGRAM_OIDC_REDIRECT_URI',
) {
  const value = process.env[name]?.trim()
  if (!value)
    throw new TelegramOAuthError(
      `${name} is not configured`,
      'configuration_error',
    )
  return value
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url')
}

export function createTelegramAuthorization() {
  const state = base64Url(randomBytes(32))
  const codeVerifier = base64Url(randomBytes(48))
  const nonce = base64Url(randomBytes(32))
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: requiredEnv('TELEGRAM_OIDC_CLIENT_ID'),
    redirect_uri: requiredEnv('TELEGRAM_OIDC_REDIRECT_URI'),
    response_type: 'code',
    scope: TELEGRAM_SCOPES.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString()
  return { authorizationUrl: url.toString(), state, codeVerifier, nonce }
}

type TelegramTokenResponse = {
  id_token?: string
  scope?: string
  error?: string
  error_description?: string
}

export type TelegramIdentity = {
  telegramUserId: string
  displayName: string
  username?: string
  photoUrl?: string
}

export async function exchangeTelegramCode(
  code: string,
  codeVerifier: string,
  expectedNonce: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramIdentity> {
  const clientId = requiredEnv('TELEGRAM_OIDC_CLIENT_ID')
  const clientSecret = requiredEnv('TELEGRAM_OIDC_CLIENT_SECRET')
  let response: Response
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: requiredEnv('TELEGRAM_OIDC_REDIRECT_URI'),
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    })
  } catch {
    throw new TelegramOAuthError(
      'Could not reach Telegram Login',
      'network_error',
      true,
    )
  }
  const body = (await response.json().catch(() => ({}))) as TelegramTokenResponse
  if (!response.ok || !body.id_token) {
    throw new TelegramOAuthError(
      body.error_description ?? body.error ?? 'Telegram token exchange failed',
      body.error ?? `http_${response.status}`,
      response.status === 429 || response.status >= 500,
    )
  }

  let payload: Awaited<ReturnType<typeof jwtVerify>>['payload']
  try {
    ;({ payload } = await jwtVerify(body.id_token, JWKS, {
      issuer: ISSUER,
      audience: clientId,
      algorithms: ['RS256', 'ES256'],
    }))
  } catch {
    throw new TelegramOAuthError(
      'Telegram returned an invalid identity token',
      'invalid_id_token',
    )
  }
  if (payload.nonce !== expectedNonce) {
    throw new TelegramOAuthError(
      'Telegram returned an invalid login nonce',
      'invalid_nonce',
    )
  }
  const profileId = payload.id
  const telegramUserId =
    typeof profileId === 'number' && Number.isSafeInteger(profileId)
      ? String(profileId)
      : typeof profileId === 'string' && /^\d+$/.test(profileId)
        ? profileId
        : typeof payload.sub === 'string' && /^\d+$/.test(payload.sub)
          ? payload.sub
          : undefined
  if (!telegramUserId || typeof payload.name !== 'string') {
    throw new TelegramOAuthError(
      'Telegram identity is missing required profile claims',
      'invalid_profile',
    )
  }
  return {
    telegramUserId,
    displayName: payload.name,
    ...(typeof payload.preferred_username === 'string'
      ? { username: payload.preferred_username }
      : {}),
    ...(typeof payload.picture === 'string'
      ? { photoUrl: payload.picture }
      : {}),
  }
}
