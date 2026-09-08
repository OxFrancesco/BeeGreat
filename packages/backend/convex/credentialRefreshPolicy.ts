const REVOKED_REFRESH_CODES = new Set([
  'invalid_grant',
  'refresh_token_expired',
  'refresh_token_reused',
  'refresh_token_invalidated',
  'token_revoked',
])

export function isRevokedRefreshCode(code: string): boolean {
  return REVOKED_REFRESH_CODES.has(code)
}

export function isUnconsumedRefreshCode(code: string): boolean {
  return ['rate_limited', 'configuration_error', 'invalid_client', 'unauthorized_client'].includes(code)
}
