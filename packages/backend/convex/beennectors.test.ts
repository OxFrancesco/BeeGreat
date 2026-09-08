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

test('Google Workspace is available as a connection and keeps its account identity', async () => {
  const t = convexTest(schema, modules)
  const userId = 'user_google_workspace'
  const owner = t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://issuer.example.test|${userId}`,
  })
  await t.run(async (ctx) => {
    await ctx.db.insert('beennectorCredentials', {
      userId,
      provider: 'google',
      status: 'connected',
      encryptedAccess: encryptedFixture,
      encryptedRefresh: encryptedFixture,
      expiresAt: Date.now() + 60_000,
      scopes: ['https://www.googleapis.com/auth/drive'],
      googleServices: ['drive'],
      externalAccountId: 'google-subject',
      externalAccountName: 'bee@example.com',
      updatedAt: Date.now(),
    })
  })

  expect(
    (await owner.query(api.beennectors.list, {})).find(
      (item) => item.provider === 'google',
    ),
  ).toMatchObject({
    name: 'Google Workspace',
    state: 'connected',
    accountName: 'bee@example.com',
  })

  expect(
    await t.query(internal.beennectors.listConnectedForAgent, { userId }),
  ).toContainEqual({
    provider: 'google',
    accountName: 'bee@example.com',
    googleServices: ['drive'],
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
    message: { kind: 'signal', type: 'provider.event', body: 'Saved webhook', attributes: {} },
    provider: 'github',
    deliveryId: 'delivery-1',
    actorId: '4242',
  })
  expect(first).toEqual({ status: 'accepted', userId: 'user_github' })
  expect(
    await t.mutation(internal.beennectors.claimDelivery, {
    message: { kind: 'signal', type: 'provider.event', body: 'Saved webhook', attributes: {} },
      provider: 'github',
      deliveryId: 'delivery-1',
      actorId: '4242',
    }),
  ).toEqual({ status: 'duplicate' })
  expect(
    await t.mutation(internal.beennectors.claimDelivery, {
    message: { kind: 'signal', type: 'provider.event', body: 'Saved webhook', attributes: {} },
      provider: 'github',
      deliveryId: 'delivery-2',
      actorId: '9999',
    }),
  ).toEqual({ status: 'unmapped' })
})

test('workspace ownership never authorizes an unmapped external actor', async () => {
  const t = convexTest(schema, modules)
  await t.run(ctx => ctx.db.insert('beennectorCredentials', {
    userId: 'user_workspace', provider: 'linear', status: 'connected',
    encryptedAccess: encryptedFixture, scopes: [], externalAccountId: 'owner',
    workspaceId: 'workspace', updatedAt: Date.now(),
  }))
  for (const actorId of [undefined, 'stranger']) {
    expect(await t.mutation(internal.beennectors.claimDelivery, {
    message: { kind: 'signal', type: 'provider.event', body: 'Saved webhook', attributes: {} },
      provider: 'linear', deliveryId: `event-${actorId}`, workspaceId: 'workspace', actorId,
    })).toEqual({ status: 'unmapped' })
  }
  expect(await t.mutation(internal.beennectors.claimDelivery, {
    message: { kind: 'signal', type: 'provider.event', body: 'Saved webhook', attributes: {} },
    provider: 'linear', deliveryId: 'owner-event', workspaceId: 'workspace', actorId: 'owner',
  })).toEqual({ status: 'accepted', userId: 'user_workspace' })
})

test('disconnect detaches old credentials and stale request failures cannot invalidate reconnect', async () => {
  const t = convexTest(schema, modules)
  const userId = 'user_disconnect_race'
  await t.run(ctx => ctx.db.insert('beennectorCredentials', {
    userId, provider: 'github', status: 'connected', encryptedAccess: encryptedFixture,
    scopes: [], externalAccountId: "fixture-account", updatedAt: 1,
  }))
  const detached = await t.mutation(internal.beennectors.removeConnection, { userId, provider: 'github' })
  expect(detached?.encryptedAccess).toEqual(encryptedFixture)
  const newer = { ...encryptedFixture, iv: 'new-generation' }
  const newId = await t.run(ctx => ctx.db.insert('beennectorCredentials', {
    userId, provider: 'github', status: 'connected', encryptedAccess: newer,
    scopes: [], externalAccountId: "fixture-account", updatedAt: 1,
  }))
  await t.mutation(internal.beennectors.markNeedsReauth, { userId, provider: 'github', expectedEncryptedAccess: encryptedFixture })
  expect((await t.run(ctx => ctx.db.get(newId)))?.status).toBe('connected')
  await t.mutation(internal.beennectors.markNeedsReauth, { userId, provider: 'github', expectedEncryptedAccess: newer })
  expect((await t.run(ctx => ctx.db.get(newId)))?.status).toBe('needs_reauth')
})
