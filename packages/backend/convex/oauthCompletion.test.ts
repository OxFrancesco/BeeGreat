import { createHash } from 'node:crypto'
import { convexTest } from 'convex-test'
import { afterEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const encrypted = { version: 1 as const, iv: 'fixture', ciphertext: 'fixture', tag: 'fixture' }
const state = 'secret-state-for-connection'
const stateHash = createHash('sha256').update(state).digest('hex')
const userId = 'user_initiator'
const base = { userId, stateHash, encryptedCodeVerifier: encrypted, expiresAt: Date.now() + 600_000 }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

test('callbacks only forward code in a fragment and never activate credentials', async () => {
  vi.stubEnv('WEB_APP_URL', 'https://bee.example')
  const t = convexTest(schema, modules)
  for (const path of ['/beennectors/oauth/callback', '/google-health/oauth/callback', '/telegram/oauth/callback']) {
    const response = await t.fetch(`${path}?state=${state}&code=private-code`)
    expect(response.status).toBe(302)
    const destination = new URL(response.headers.get('location')!)
    expect(destination.origin).toBe('https://bee.example')
    expect(destination.pathname).toBe('/connect-callback')
    expect(destination.search).toBe('')
    expect(new URLSearchParams(destination.hash.slice(1)).get('code')).toBe('private-code')
    expect(response.headers.get('cache-control')).toBe('no-store')
  }
  expect(await t.run(ctx => ctx.db.query('beennectorCredentials').collect())).toEqual([])
})

test('copied consent URLs cannot link an account to a different signed-in user', async () => {
  const t = convexTest(schema, modules)
  await t.mutation(internal.beennectors.createSession, { ...base, provider: 'github' })
  await t.mutation(internal.googleHealthAuth.createSession, base)
  await t.mutation(internal.telegram.createSession, { ...base, client: 'browser', encryptedNonce: encrypted })
  const victim = t.withIdentity({ subject: 'user_victim', tokenIdentifier: 'issuer|user_victim' })
  const providerFetch = vi.fn(() => { throw new Error('Provider exchange must not run') })
  vi.stubGlobal('fetch', providerFetch)
  expect(await victim.action(api.beennectorAuthActions.completeAuthorization, { state, code: 'victim-code' })).toMatchObject({ ok: false })
  expect(await victim.action(api.googleHealthAuthActions.completeAuthorization, { state, code: 'victim-code' })).toMatchObject({ ok: false })
  expect(await victim.action(api.telegramAuthActions.completeAuthorization, { state, code: 'victim-code' })).toMatchObject({ ok: false })
  expect(providerFetch).not.toHaveBeenCalled()
  await expect(t.action(api.beennectorAuthActions.completeAuthorization, { state, code: 'code' })).rejects.toThrow('Sign in')
  for (const sessions of await t.run(async ctx => [
    await ctx.db.query('beennectorAuthSessions').collect(),
    await ctx.db.query('googleHealthAuthSessions').collect(),
    await ctx.db.query('telegramAuthSessions').collect(),
  ])) {
    expect(sessions[0]?.status).toBe('pending')
    expect(sessions[0]?.exchangeAttemptId).toBeUndefined()
  }
})

test('callback claim is exclusive and losing callbacks cannot cancel or overwrite it', async () => {
  const t = convexTest(schema, modules)
  const sessionId = await t.mutation(internal.beennectors.createSession, { ...base, provider: 'github' })
  const claims = await Promise.all(['one', 'two'].map(attemptId => t.mutation(internal.beennectors.claimSessionByStateHash, { stateHash, userId, attemptId })))
  expect(claims.filter(Boolean)).toHaveLength(1)
  const winner = claims[0] ? 'one' : 'two'
  const loser = winner === 'one' ? 'two' : 'one'
  await t.mutation(internal.beennectors.failSession, { stateHash, attemptId: loser, errorCode: 'lost' })
  expect((await t.run(ctx => ctx.db.get(sessionId)))?.status).toBe('pending')
  const completion = { sessionId, encryptedAccess: encrypted, scopes: [], externalAccountId: 'external-owner' }
  expect(await t.mutation(internal.beennectors.completeAuthorization, { ...completion, attemptId: loser })).toBe(false)
  expect(await t.mutation(internal.beennectors.completeAuthorization, { ...completion, attemptId: winner })).toBe(true)
  expect(await t.mutation(internal.beennectors.completeAuthorization, { ...completion, attemptId: winner })).toBe(false)
})

test('cancelling an old consent session preserves a later successful connection', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: userId, tokenIdentifier: `issuer|${userId}` })
  const first = await t.mutation(internal.beennectors.createSession, { ...base, provider: 'github' })
  const second = await t.mutation(internal.beennectors.createSession, { ...base, stateHash: 'new-state', provider: 'github' })
  await t.mutation(internal.beennectors.claimSessionByStateHash, { userId, stateHash: 'new-state', attemptId: 'new' })
  await t.mutation(internal.beennectors.completeAuthorization, { sessionId: second, attemptId: 'new', encryptedAccess: encrypted, scopes: [], externalAccountId: 'new-owner' })
  await owner.mutation(api.beennectors.cancelAuthorization, { sessionId: first })
  expect(await t.run(ctx => ctx.db.query('beennectorCredentials').first())).toMatchObject({ status: 'connected', externalAccountId: 'new-owner' })
})

test('authenticated consent exchanges once even when a duplicate callback arrives during provider delay', async () => {
  vi.stubEnv('BEENNECTOR_CREDENTIALS_KEY', Buffer.alloc(32, 7).toString('base64'))
  vi.stubEnv('GITHUB_BEENNECTOR_CLIENT_ID', 'fixture-client')
  vi.stubEnv('GITHUB_BEENNECTOR_CLIENT_SECRET', 'fixture-secret')
  vi.stubEnv('BEENNECTOR_OAUTH_REDIRECT_URI', 'https://backend.example/beennectors/oauth/callback')
  const { encryptBeennectorSecret } = await import('./beennectorCrypto')
  const t = convexTest(schema, modules)
  await t.mutation(internal.beennectors.createSession, {
    ...base, provider: 'github', client: 'browser',
    encryptedCodeVerifier: encryptBeennectorSecret('verifier', `beennector-session:${userId}:github:${stateHash}:verifier`),
  })
  const owner = t.withIdentity({ subject: userId, tokenIdentifier: `issuer|${userId}` })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let reached!: () => void
  const started = new Promise<void>(resolve => { reached = resolve })
  let exchanges = 0
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    if (String(input).includes('/login/oauth/access_token')) {
      exchanges++
      reached()
      await gate
      return Response.json({ access_token: 'fixture-access', scope: 'repo' })
    }
    if (String(input) === 'https://api.github.com/user') return Response.json({ id: 42, login: 'owned-account' })
    throw new Error('Unexpected provider endpoint')
  })
  const winning = owner.action(api.beennectorAuthActions.completeAuthorization, { state, code: 'valid-code' })
  await started
  expect(await owner.action(api.beennectorAuthActions.completeAuthorization, { state, code: 'valid-code' })).toMatchObject({ ok: false })
  release()
  expect(await winning).toEqual({ ok: true, provider: 'github', client: 'browser' })
  expect(exchanges).toBe(1)
  expect(await t.run(ctx => ctx.db.query('beennectorCredentials').first())).toMatchObject({ userId, externalAccountId: '42', status: 'connected' })
})
