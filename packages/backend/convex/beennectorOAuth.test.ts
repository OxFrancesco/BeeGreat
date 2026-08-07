// @vitest-environment node

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  createBeennectorAuthorization,
  exchangeBeennectorCode,
  refreshBeennectorToken,
  revokeBeennectorToken,
} from './beennectorOAuth'

const names = [
  'BEENNECTOR_OAUTH_REDIRECT_URI',
  'GITHUB_BEENNECTOR_CLIENT_ID',
  'GITHUB_BEENNECTOR_CLIENT_SECRET',
  'LINEAR_BEENNECTOR_CLIENT_ID',
  'LINEAR_BEENNECTOR_CLIENT_SECRET',
  'NOTION_BEENNECTOR_CLIENT_ID',
  'NOTION_BEENNECTOR_CLIENT_SECRET',
  'GOOGLE_BEENNECTOR_CLIENT_ID',
  'GOOGLE_BEENNECTOR_CLIENT_SECRET',
] as const
const original = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
) as Record<(typeof names)[number], string | undefined>

beforeEach(() => {
  process.env.BEENNECTOR_OAUTH_REDIRECT_URI =
    'https://example.convex.site/beennectors/oauth/callback'
  process.env.GITHUB_BEENNECTOR_CLIENT_ID = 'github-client'
  process.env.GITHUB_BEENNECTOR_CLIENT_SECRET = 'github-secret'
  process.env.LINEAR_BEENNECTOR_CLIENT_ID = 'linear-client'
  process.env.LINEAR_BEENNECTOR_CLIENT_SECRET = 'linear-secret'
  process.env.NOTION_BEENNECTOR_CLIENT_ID = 'notion-client'
  process.env.NOTION_BEENNECTOR_CLIENT_SECRET = 'notion-secret'
  process.env.GOOGLE_BEENNECTOR_CLIENT_ID = 'google-client'
  process.env.GOOGLE_BEENNECTOR_CLIENT_SECRET = 'google-secret'
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name]
    else process.env[name] = original[name]
  }
})

test('GitHub, Linear, and Google use PKCE while Notion uses scoped page selection', () => {
  const github = createBeennectorAuthorization('github')
  const linear = createBeennectorAuthorization('linear')
  const notion = createBeennectorAuthorization('notion')
  const google = createBeennectorAuthorization('google')
  const githubUrl = new URL(github.authorizationUrl)
  const linearUrl = new URL(linear.authorizationUrl)
  const notionUrl = new URL(notion.authorizationUrl)
  const googleUrl = new URL(google.authorizationUrl)

  expect(githubUrl.origin + githubUrl.pathname).toBe(
    'https://github.com/login/oauth/authorize',
  )
  expect(githubUrl.searchParams.get('scope')).toBe('read:user repo')
  expect(githubUrl.searchParams.get('code_challenge_method')).toBe('S256')
  expect(github.codeVerifier).toBeTruthy()

  expect(linearUrl.origin + linearUrl.pathname).toBe(
    'https://linear.app/oauth/authorize',
  )
  expect(linearUrl.searchParams.get('scope')).toBe('read,comments:create')
  expect(linearUrl.searchParams.get('actor')).toBe('user')
  expect(linearUrl.searchParams.get('code_challenge_method')).toBe('S256')
  expect(linear.codeVerifier).toBeTruthy()

  expect(notionUrl.origin + notionUrl.pathname).toBe(
    'https://api.notion.com/v1/oauth/authorize',
  )
  expect(notionUrl.searchParams.get('owner')).toBe('user')
  expect(notion.codeVerifier).toBeUndefined()

  expect(googleUrl.origin + googleUrl.pathname).toBe(
    'https://accounts.google.com/o/oauth2/v2/auth',
  )
  expect(googleUrl.searchParams.get('access_type')).toBe('offline')
  expect(googleUrl.searchParams.get('code_challenge_method')).toBe('S256')
  expect(googleUrl.searchParams.get('scope')).toContain(
    'https://www.googleapis.com/auth/gmail.modify',
  )
  expect(googleUrl.searchParams.get('scope')).toContain(
    'https://www.googleapis.com/auth/drive',
  )
  expect(google.codeVerifier).toBeTruthy()
  expect(
    new Set([github.state, linear.state, notion.state, google.state]).size,
  ).toBe(4)
})

test('Google exchanges a PKCE code and resolves the connected account identity', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'google-access',
          refresh_token: 'google-refresh',
          expires_in: 3600,
          scope: 'openid email https://www.googleapis.com/auth/drive',
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub: 'google-subject',
          email: 'bee@example.com',
          name: 'Bee User',
        }),
        { status: 200 },
      ),
    )

  const before = Date.now()
  const result = await exchangeBeennectorCode(
    'google',
    'authorization-code',
    'pkce-verifier',
  )

  expect(result).toMatchObject({
    accessToken: 'google-access',
    refreshToken: 'google-refresh',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive'],
    identity: {
      externalAccountId: 'google-subject',
      externalAccountName: 'bee@example.com',
      workspaceName: 'Bee User',
    },
  })
  expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000)

  const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!
  expect(String(tokenUrl)).toBe('https://oauth2.googleapis.com/token')
  const tokenBody = new URLSearchParams(String(tokenInit?.body))
  expect(tokenBody.get('grant_type')).toBe('authorization_code')
  expect(tokenBody.get('code')).toBe('authorization-code')
  expect(tokenBody.get('code_verifier')).toBe('pkce-verifier')
  expect(tokenBody.get('client_secret')).toBe('google-secret')

  const [identityUrl, identityInit] = fetchMock.mock.calls[1]!
  expect(String(identityUrl)).toBe(
    'https://openidconnect.googleapis.com/v1/userinfo',
  )
  expect(new Headers(identityInit?.headers).get('authorization')).toBe(
    'Bearer google-access',
  )
})

test('Google refreshes and revokes brokered access tokens', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'google-access-2',
          expires_in: 1800,
          scope: 'openid email',
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 200 }))

  const refreshed = await refreshBeennectorToken('google', 'google-refresh')
  expect(refreshed).toMatchObject({
    accessToken: 'google-access-2',
    refreshToken: 'google-refresh',
    scopes: ['openid', 'email'],
  })

  const [refreshUrl, refreshInit] = fetchMock.mock.calls[0]!
  expect(String(refreshUrl)).toBe('https://oauth2.googleapis.com/token')
  const refreshBody = new URLSearchParams(String(refreshInit?.body))
  expect(refreshBody.get('grant_type')).toBe('refresh_token')
  expect(refreshBody.get('refresh_token')).toBe('google-refresh')

  await revokeBeennectorToken('google', 'google-access-2')
  const [revokeUrl, revokeInit] = fetchMock.mock.calls[1]!
  expect(String(revokeUrl)).toBe('https://oauth2.googleapis.com/revoke')
  expect(new URLSearchParams(String(revokeInit?.body)).get('token')).toBe(
    'google-access-2',
  )
})
