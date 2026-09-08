import { expect, test } from 'vitest'
import { isRevokedRefreshCode, isUnconsumedRefreshCode } from './credentialRefreshPolicy'

test('only explicit refresh revocation errors permit destroying saved credentials', () => {
  for (const code of ['network_error', 'invalid_client', 'unauthorized_client', 'invalid_token_response', 'missing_account_id', 'http_500']) {
    expect(isRevokedRefreshCode(code)).toBe(false)
  }
  for (const code of ['invalid_grant', 'refresh_token_reused', 'refresh_token_expired']) {
    expect(isRevokedRefreshCode(code)).toBe(true)
  }
})

test('only confirmed rejection or pre-request configuration releases a refresh lease', () => {
  for (const code of ['rate_limited', 'configuration_error', 'invalid_client', 'unauthorized_client']) expect(isUnconsumedRefreshCode(code)).toBe(true)
  for (const code of ['network_error', 'http_500', 'invalid_token_response', 'missing_account_id']) expect(isUnconsumedRefreshCode(code)).toBe(false)
})
