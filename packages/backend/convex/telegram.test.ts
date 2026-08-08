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

test('Telegram connection state is private to the signed-in BeeGreat user', async () => {
  const t = convexTest(schema, modules)
  const userId = 'user_telegram_owner'
  const owner = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer.example.test|${userId}`,
  })
  const other = t.withIdentity({
    subject: 'user_telegram_other',
    tokenIdentifier: 'https://issuer.example.test|user_telegram_other',
  })

  const sessionId = await t.mutation(internal.telegram.createSession, {
    userId,
    client: 'mobile',
    stateHash: 'telegram-state-hash',
    encryptedCodeVerifier: encryptedFixture,
    encryptedNonce: encryptedFixture,
    expiresAt: Date.now() + 60_000,
  })
  expect(await owner.query(api.telegram.status, {})).toEqual({
    state: 'pending',
  })
  expect(await other.query(api.telegram.status, {})).toEqual({
    state: 'disconnected',
  })

  await t.mutation(internal.telegram.completeAuthorization, {
    sessionId,
    telegramUserId: '123456789',
    displayName: 'Francesco',
    username: 'francesco',
  })
  expect(await owner.query(api.telegram.status, {})).toEqual({
    state: 'connected',
    displayName: 'Francesco',
    username: 'francesco',
  })

  await owner.mutation(api.telegram.disconnect, {})
  expect(await owner.query(api.telegram.status, {})).toEqual({
    state: 'disconnected',
  })
})
