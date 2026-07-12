'use node'

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const AUTH_BASE_URL = 'https://auth.openai.com'
const DEVICE_USER_CODE_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`
const DEVICE_TOKEN_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/token`
const TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`
const DEVICE_VERIFICATION_URI = `${AUTH_BASE_URL}/codex/device`
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`
const DEVICE_CODE_TTL_MS = 15 * 60 * 1000
const JWT_CLAIM_PATH = 'https://api.openai.com/auth'

export class OpenAiCodexAuthError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message = 'OpenAI Codex authentication failed',
  ) {
    super(message)
    this.name = 'OpenAiCodexAuthError'
  }
}

export type OpenAiCodexCredentials = {
  access: string
  refresh: string
  expiresAt: number
  accountId: string
}

type TokenPayload = {
  [JWT_CLAIM_PATH]?: { chatgpt_account_id?: string }
}

function upstreamError(status: number, code?: string) {
  if (status === 429) {
    return new OpenAiCodexAuthError('rate_limited', true)
  }
  if (status >= 500) {
    return new OpenAiCodexAuthError('upstream_unavailable', true)
  }
  return new OpenAiCodexAuthError(code ?? 'authorization_rejected', false)
}

async function responseErrorCode(response: Response) {
  try {
    const body = (await response.clone().json()) as {
      error?: string | { code?: string }
    }
    return typeof body.error === 'string' ? body.error : body.error?.code
  } catch {
    return undefined
  }
}

export function accountIdFromAccessToken(accessToken: string) {
  try {
    const segments = accessToken.split('.')
    if (segments.length !== 3 || !segments[1]) return null
    const payload = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    ) as TokenPayload
    const accountId = payload[JWT_CLAIM_PATH]?.chatgpt_account_id
    return typeof accountId === 'string' && accountId.length > 0 ? accountId : null
  } catch {
    return null
  }
}

async function tokenCredentials(response: Response): Promise<OpenAiCodexCredentials> {
  if (!response.ok) {
    throw upstreamError(response.status, await responseErrorCode(response))
  }
  const body = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (
    !body.access_token ||
    !body.refresh_token ||
    typeof body.expires_in !== 'number'
  ) {
    throw new OpenAiCodexAuthError('invalid_token_response', false)
  }
  const accountId = accountIdFromAccessToken(body.access_token)
  if (!accountId) {
    throw new OpenAiCodexAuthError('missing_account_id', false)
  }
  return {
    access: body.access_token,
    refresh: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    accountId,
  }
}

async function fetchAuth(input: string, init: RequestInit) {
  try {
    return await fetch(input, init)
  } catch {
    throw new OpenAiCodexAuthError('network_error', true)
  }
}

export async function startDeviceAuthorization() {
  const response = await fetchAuth(DEVICE_USER_CODE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new OpenAiCodexAuthError('device_auth_disabled', false)
    }
    throw upstreamError(response.status, await responseErrorCode(response))
  }
  const body = (await response.json()) as {
    device_auth_id?: string
    user_code?: string
    interval?: number | string
  }
  const intervalSeconds =
    typeof body.interval === 'string' ? Number(body.interval) : body.interval
  if (
    !body.device_auth_id ||
    !body.user_code ||
    typeof intervalSeconds !== 'number' ||
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds < 0
  ) {
    throw new OpenAiCodexAuthError('invalid_device_response', false)
  }
  return {
    deviceAuthId: body.device_auth_id,
    userCode: body.user_code,
    verificationUri: DEVICE_VERIFICATION_URI,
    intervalMs: Math.max(1_000, intervalSeconds * 1000),
    expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
  }
}

export type DevicePollResult =
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'complete'; authorizationCode: string; codeVerifier: string }

export async function pollDeviceAuthorization(
  deviceAuthId: string,
  userCode: string,
): Promise<DevicePollResult> {
  const response = await fetchAuth(DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }),
  })
  if (response.ok) {
    const body = (await response.json()) as {
      authorization_code?: string
      code_verifier?: string
    }
    if (!body.authorization_code || !body.code_verifier) {
      throw new OpenAiCodexAuthError('invalid_poll_response', false)
    }
    return {
      status: 'complete',
      authorizationCode: body.authorization_code,
      codeVerifier: body.code_verifier,
    }
  }
  if (response.status === 403 || response.status === 404) {
    return { status: 'pending' }
  }
  const errorCode = await responseErrorCode(response)
  if (errorCode === 'deviceauth_authorization_pending') {
    return { status: 'pending' }
  }
  if (errorCode === 'slow_down' || response.status === 429) {
    return { status: 'slow_down' }
  }
  throw upstreamError(response.status, errorCode)
}

export async function exchangeDeviceAuthorization(
  authorizationCode: string,
  codeVerifier: string,
) {
  const response = await fetchAuth(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: authorizationCode,
      code_verifier: codeVerifier,
      redirect_uri: DEVICE_REDIRECT_URI,
    }),
  })
  return tokenCredentials(response)
}

export async function refreshCredentials(refreshToken: string) {
  const response = await fetchAuth(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })
  return tokenCredentials(response)
}
