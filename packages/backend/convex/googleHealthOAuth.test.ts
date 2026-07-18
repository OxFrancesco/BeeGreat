// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  createGoogleHealthAuthorization,
  GOOGLE_HEALTH_SCOPES,
  GoogleHealthOAuthError,
  revokeGoogleHealthToken,
} from './googleHealthOAuth'

const original = {
  clientId: process.env.GOOGLE_HEALTH_CLIENT_ID,
  redirectUri: process.env.GOOGLE_HEALTH_REDIRECT_URI,
}

beforeEach(() => {
  process.env.GOOGLE_HEALTH_CLIENT_ID =
    'client-fixture.apps.googleusercontent.com'
  process.env.GOOGLE_HEALTH_REDIRECT_URI =
    'https://example.convex.site/google-health/oauth/callback'
})

afterEach(() => {
  if (original.clientId === undefined)
    delete process.env.GOOGLE_HEALTH_CLIENT_ID
  else process.env.GOOGLE_HEALTH_CLIENT_ID = original.clientId
  if (original.redirectUri === undefined)
    delete process.env.GOOGLE_HEALTH_REDIRECT_URI
  else process.env.GOOGLE_HEALTH_REDIRECT_URI = original.redirectUri
})

test('authorization requests offline read-only access with PKCE and CSRF state', () => {
  const first = createGoogleHealthAuthorization()
  const second = createGoogleHealthAuthorization()
  const url = new URL(first.authorizationUrl)

  expect(url.origin + url.pathname).toBe(
    'https://accounts.google.com/o/oauth2/v2/auth',
  )
  expect(url.searchParams.get('access_type')).toBe('offline')
  expect(url.searchParams.get('prompt')).toBe('consent')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
  expect(url.searchParams.get('state')).toBe(first.state)
  expect(url.searchParams.get('scope')?.split(' ')).toEqual([
    ...GOOGLE_HEALTH_SCOPES,
  ])
  expect(
    GOOGLE_HEALTH_SCOPES.every((scope) => scope.endsWith('.readonly')),
  ).toBe(true)
  expect(first.state).not.toBe(second.state)
  expect(first.codeVerifier).not.toBe(second.codeVerifier)
})

test('revocation posts the token and treats an already-invalid grant as complete', async () => {
  const fetchMock = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    expect(String(input)).toBe('https://oauth2.googleapis.com/revoke')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'content-type': 'application/x-www-form-urlencoded',
    })
    expect(init?.body).toBe('token=refresh%2Ftoken')
    return new Response(null, { status: 400 })
  }

  await expect(
    revokeGoogleHealthToken('refresh/token', fetchMock),
  ).resolves.toBeUndefined()
})

test('revocation marks only transient upstream failures retryable', async () => {
  const transientError = await revokeGoogleHealthToken('token', async () =>
    new Response(null, { status: 503 }),
  ).catch((error: unknown) => error)
  expect(transientError).toBeInstanceOf(GoogleHealthOAuthError)
  expect(transientError).toMatchObject({
    code: 'revoke_http_503',
    retryable: true,
  })
  const permanentError = await revokeGoogleHealthToken('token', async () =>
    new Response(null, { status: 403 }),
  ).catch((error: unknown) => error)
  expect(permanentError).toBeInstanceOf(GoogleHealthOAuthError)
  expect(permanentError).toMatchObject({
    code: 'revoke_http_403',
    retryable: false,
  })
})
