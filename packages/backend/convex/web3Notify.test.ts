import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const owner = 'user_web3_notify_owner'

describe('web3Notify.activeConversation', () => {
  test('falls back to the bare userId when no preferences exist', async () => {
    const t = convexTest(schema, modules)
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(owner)
  })

  test('maps thread 0 to the bare userId and later threads to userId~N', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('chatPreferences', {
        ownerKey: `https://issuer.example.test|${owner}`,
        userId: owner,
        activeThreadId: 0,
        updatedAt: 10,
      })
    })
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(owner)

    // The newest preferences row wins when several identities exist.
    await t.run(async (ctx) => {
      await ctx.db.insert('chatPreferences', {
        ownerKey: `https://other-issuer.example.test|${owner}`,
        userId: owner,
        activeThreadId: 3,
        updatedAt: 20,
      })
    })
    expect(
      await t.query(internal.web3Notify.activeConversation, {
        userId: owner,
      }),
    ).toBe(`${owner}~3`)
  })
})
