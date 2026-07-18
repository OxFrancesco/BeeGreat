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

test('Beennector connection state is separate and reconnect sessions take precedence', async () => {
  const t = convexTest(schema, modules)
  const userId = 'user_beennectors'
  const owner = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer.example.test|${userId}`,
  })
  await t.run(async (ctx) => {
    await ctx.db.insert('beennectorCredentials', {
      userId,
      provider: 'linear',
      status: 'needs_reauth',
      scopes: ['read'],
      externalAccountId: 'linear-user',
      workspaceId: 'linear-workspace',
      workspaceName: 'Product Hive',
      updatedAt: Date.now(),
    })
  })
  const initial = await owner.query(api.beennectors.list, {})
  expect(initial.find((item) => item.provider === 'linear')).toMatchObject({
    state: 'needs_reauth',
    workspaceName: 'Product Hive',
  })

  await t.mutation(internal.beennectors.createSession, {
    userId,
    provider: 'linear',
    stateHash: 'state-hash',
    encryptedCodeVerifier: encryptedFixture,
    expiresAt: Date.now() + 60_000,
  })
  const reconnecting = await owner.query(api.beennectors.list, {})
  expect(reconnecting.find((item) => item.provider === 'linear')).toMatchObject({
    state: 'pending',
  })
})

test('verified delivery claims map conservatively and deduplicate provider ids', async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    await ctx.db.insert('beennectorCredentials', {
      userId: 'user_github',
      provider: 'github',
      status: 'connected',
      encryptedAccess: encryptedFixture,
      scopes: ['repo'],
      externalAccountId: '4242',
      externalAccountName: 'honey-dev',
      updatedAt: Date.now(),
    })
  })
  const first = await t.mutation(internal.beennectors.claimDelivery, {
    provider: 'github',
    deliveryId: 'delivery-1',
    actorId: '4242',
  })
  expect(first).toEqual({ status: 'accepted', userId: 'user_github' })
  expect(
    await t.mutation(internal.beennectors.claimDelivery, {
      provider: 'github',
      deliveryId: 'delivery-1',
      actorId: '4242',
    }),
  ).toEqual({ status: 'duplicate' })
  expect(
    await t.mutation(internal.beennectors.claimDelivery, {
      provider: 'github',
      deliveryId: 'delivery-2',
      actorId: '9999',
    }),
  ).toEqual({ status: 'unmapped' })
})

