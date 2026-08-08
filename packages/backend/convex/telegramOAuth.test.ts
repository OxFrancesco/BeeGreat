// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  createTelegramAuthorization,
  TELEGRAM_SCOPES,
} from './telegramOAuth'

const original = {
  clientId: process.env.TELEGRAM_OIDC_CLIENT_ID,
  redirectUri: process.env.TELEGRAM_OIDC_REDIRECT_URI,
}

beforeEach(() => {
  process.env.TELEGRAM_OIDC_CLIENT_ID = '123456789'
  process.env.TELEGRAM_OIDC_REDIRECT_URI =
    'https://example.convex.site/telegram/oauth/callback'
})

afterEach(() => {
  if (original.clientId === undefined) delete process.env.TELEGRAM_OIDC_CLIENT_ID
  else process.env.TELEGRAM_OIDC_CLIENT_ID = original.clientId
  if (original.redirectUri === undefined)
    delete process.env.TELEGRAM_OIDC_REDIRECT_URI
  else process.env.TELEGRAM_OIDC_REDIRECT_URI = original.redirectUri
})

test('Telegram authorization uses OIDC PKCE, nonce, and direct-message access', () => {
  const first = createTelegramAuthorization()
  const second = createTelegramAuthorization()
  const url = new URL(first.authorizationUrl)

  expect(url.origin + url.pathname).toBe('https://oauth.telegram.org/auth')
  expect(url.searchParams.get('client_id')).toBe('123456789')
  expect(url.searchParams.get('response_type')).toBe('code')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
  expect(url.searchParams.get('state')).toBe(first.state)
  expect(url.searchParams.get('nonce')).toBe(first.nonce)
  expect(url.searchParams.get('scope')?.split(' ')).toEqual([
    ...TELEGRAM_SCOPES,
  ])
  expect(first.state).not.toBe(second.state)
  expect(first.codeVerifier).not.toBe(second.codeVerifier)
  expect(first.nonce).not.toBe(second.nonce)
})
