// @vitest-environment node

import { afterEach, beforeEach, expect, test } from 'vitest'
import { createBeennectorAuthorization } from './beennectorOAuth'

const names = [
  'BEENNECTOR_OAUTH_REDIRECT_URI',
  'GITHUB_BEENNECTOR_CLIENT_ID',
  'GITHUB_BEENNECTOR_CLIENT_SECRET',
  'LINEAR_BEENNECTOR_CLIENT_ID',
  'LINEAR_BEENNECTOR_CLIENT_SECRET',
  'NOTION_BEENNECTOR_CLIENT_ID',
  'NOTION_BEENNECTOR_CLIENT_SECRET',
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
})

afterEach(() => {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name]
    else process.env[name] = original[name]
  }
})

test('GitHub and Linear authorization use PKCE while Notion uses scoped page selection', () => {
  const github = createBeennectorAuthorization('github')
  const linear = createBeennectorAuthorization('linear')
  const notion = createBeennectorAuthorization('notion')
  const githubUrl = new URL(github.authorizationUrl)
  const linearUrl = new URL(linear.authorizationUrl)
  const notionUrl = new URL(notion.authorizationUrl)

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
  expect(new Set([github.state, linear.state, notion.state]).size).toBe(3)
})

