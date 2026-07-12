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

function authenticated(t: ReturnType<typeof convexTest>, subject: string) {
  return t.withIdentity({
    subject,
    tokenIdentifier: `https://issuer.example.test|${subject}`,
  })
}

test('ChatGPT auth requires a signed-in user and isolates sessions by owner', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_owner')
  const other = authenticated(t, 'user_other')

  await expect(t.query(api.chatgptAuth.status, {})).rejects.toThrow('Not signed in')

  const sessionId = await owner.mutation(api.chatgptAuth.start, {})
  expect(await owner.query(api.chatgptAuth.status, {})).toMatchObject({
    state: 'starting',
    sessionId,
  })
  expect(await other.query(api.chatgptAuth.status, {})).toEqual({
    state: 'disconnected',
  })
})

test('starting a connection is idempotent while its durable session is active', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_idempotent')

  const first = await owner.mutation(api.chatgptAuth.start, {})
  const second = await owner.mutation(api.chatgptAuth.start, {})

  expect(second).toBe(first)
})

test('device authorization becomes pending and then atomically stores a credential', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_complete')
  const sessionId = await owner.mutation(api.chatgptAuth.start, {})

  expect(
    await t.mutation(internal.chatgptAuth.markPendingAndSchedule, {
      sessionId,
      encryptedDeviceAuthId: encryptedFixture,
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://auth.openai.com/codex/device',
      intervalMs: 5_000,
      expiresAt: Date.now() + 60_000,
    }),
  ).toBe(true)
  expect(await owner.query(api.chatgptAuth.status, {})).toMatchObject({
    state: 'pending',
    sessionId,
    userCode: 'ABCD-EFGH',
  })

  expect(
    await t.mutation(internal.chatgptAuth.completeAuthorization, {
      sessionId,
      encryptedAccess: encryptedFixture,
      encryptedRefresh: encryptedFixture,
      expiresAt: Date.now() + 3_600_000,
      accountIdHash: 'fixture-account-hash',
    }),
  ).toBe(true)
  expect(await owner.query(api.chatgptAuth.status, {})).toEqual({
    state: 'connected',
  })
})

test('credential refresh claims are serialized with a lease', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_refresh')
  const sessionId = await owner.mutation(api.chatgptAuth.start, {})
  await t.mutation(internal.chatgptAuth.markPendingAndSchedule, {
    sessionId,
    encryptedDeviceAuthId: encryptedFixture,
    userCode: 'LEASE-CODE',
    verificationUri: 'https://auth.openai.com/codex/device',
    intervalMs: 5_000,
    expiresAt: Date.now() + 60_000,
  })
  await t.mutation(internal.chatgptAuth.completeAuthorization, {
    sessionId,
    encryptedAccess: encryptedFixture,
    encryptedRefresh: encryptedFixture,
    expiresAt: 1,
    accountIdHash: 'fixture-account-hash',
  })

  const first = await t.mutation(internal.chatgptAuth.claimCredential, {
    userId: 'user_refresh',
    now: 10_000,
    leaseId: 'lease-one',
    minValidityMs: 300_000,
  })
  const second = await t.mutation(internal.chatgptAuth.claimCredential, {
    userId: 'user_refresh',
    now: 10_001,
    leaseId: 'lease-two',
    minValidityMs: 300_000,
  })

  expect(first).toMatchObject({ status: 'refresh', leaseId: 'lease-one' })
  expect(second).toMatchObject({ status: 'busy' })
})

test('disconnect removes credentials and cancels an active device flow', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'user_disconnect')
  await owner.mutation(api.chatgptAuth.start, {})

  await owner.mutation(api.chatgptAuth.disconnect, {})

  expect(await owner.query(api.chatgptAuth.status, {})).toEqual({
    state: 'disconnected',
  })
})
