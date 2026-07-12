'use node'

import { createHash, randomBytes } from 'node:crypto'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
  'https://www.googleapis.com/auth/googlehealth.settings.readonly',
] as const

export class GoogleHealthOAuthError extends Error {
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
    | 'GOOGLE_HEALTH_CLIENT_ID'
    | 'GOOGLE_HEALTH_CLIENT_SECRET'
    | 'GOOGLE_HEALTH_REDIRECT_URI',
) {
  const value = process.env[name]?.trim()
  if (!value)
    throw new GoogleHealthOAuthError(
      `${name} is not configured`,
      'configuration_error',
    )
  return value
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url')
}

export function createGoogleHealthAuthorization() {
  const state = base64Url(randomBytes(32))
  const codeVerifier = base64Url(randomBytes(48))
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const redirectUri = requiredEnv('GOOGLE_HEALTH_REDIRECT_URI')
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_HEALTH_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_HEALTH_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString()
  return { authorizationUrl: url.toString(), state, codeVerifier }
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

async function tokenRequest(params: URLSearchParams) {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
  } catch {
    throw new GoogleHealthOAuthError(
      'Could not reach Google OAuth',
      'network_error',
      true,
    )
  }
  const body = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok || !body.access_token || !body.expires_in) {
    const permanent =
      body.error === 'invalid_grant' || body.error === 'invalid_client'
    throw new GoogleHealthOAuthError(
      body.error_description ??
        body.error ??
        'Google OAuth token exchange failed',
      body.error ?? `http_${response.status}`,
      !permanent && (response.status === 429 || response.status >= 500),
    )
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1_000,
    scopes: body.scope?.split(' ').filter(Boolean) ?? [],
  }
}

export function exchangeGoogleHealthCode(code: string, codeVerifier: string) {
  return tokenRequest(
    new URLSearchParams({
      client_id: requiredEnv('GOOGLE_HEALTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_HEALTH_CLIENT_SECRET'),
      redirect_uri: requiredEnv('GOOGLE_HEALTH_REDIRECT_URI'),
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    }),
  )
}

export function refreshGoogleHealthToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      client_id: requiredEnv('GOOGLE_HEALTH_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_HEALTH_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  )
}
