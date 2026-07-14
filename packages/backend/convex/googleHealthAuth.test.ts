import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const encryptedFixture = {
  version: 1 as const,
  iv: 'fixture-iv',
  ciphertext: 'fixture-ciphertext',
  tag: 'fixture-tag',
}

test('an active or failed OAuth session takes precedence over stale reauth state', async () => {
  const t = convexTest(schema, modules)
  const userId = 'user_health_reauth'
  const owner = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer.example.test|${userId}`,
  })
  const stateHash = 'state-hash-fixture'

  await t.run(async (ctx) => {
    await ctx.db.insert('googleHealthCredentials', {
      userId,
      status: 'needs_reauth',
      scopes: [],
      updatedAt: Date.now(),
    })
  })
  expect(await owner.query(api.googleHealthAuth.status, {})).toMatchObject({
    state: 'needs_reauth',
  })

  await t.mutation(internal.googleHealthAuth.createSession, {
    userId,
    stateHash,
    encryptedCodeVerifier: encryptedFixture,
    expiresAt: Date.now() + 60_000,
  })
  expect(await owner.query(api.googleHealthAuth.status, {})).toEqual({
    state: 'pending',
  })

  await t.mutation(internal.googleHealthAuth.failSession, {
    stateHash,
    errorCode: 'access_denied',
  })
  expect(await owner.query(api.googleHealthAuth.status, {})).toEqual({
    state: 'failed',
    message: 'Google Health could not be connected. Try again.',
  })
})
