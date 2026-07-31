import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import { ACTION_TTL_MS } from './web3Actions'
import schema from './schema'
import { modules } from './test.setup'

const owner = 'user_web3_owner'
const stranger = 'user_web3_stranger'

const sendPayload = {
  kind: 'send_tokens' as const,
  recipient: '0x00000000000000000000000000000000000000aa',
  token: 'usdc',
  amount: '1.5',
}

function identity(subject: string) {
  return { subject, tokenIdentifier: `https://issuer.example.test|${subject}` }
}

async function prepare(t: ReturnType<typeof convexTest>, userId = owner) {
  // Each test gets a fresh convexTest instance, so a plain insert suffices.
  await t.run(async (ctx) => {
    await ctx.db.insert('powerups', { userId, powerupId: 'web3', enabled: true })
  })
  return await t.mutation(internal.web3Actions.create, {
    userId,
    summary: 'Send 1.5 USDC to 0x…00aa',
    payload: sendPayload,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-07-31T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('web3 action confirmation gate', () => {
  test('confirm requires the signed-in owner and schedules execution exactly once', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const app = t.withIdentity(identity(owner))

    await app.mutation(api.web3Actions.confirm, { actionId: created.id })

    const action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('confirmed')
    expect(action?.confirmedAt).toBe(Date.now())

    // A second confirm of the same action must not double-execute.
    await expect(
      app.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('already confirmed')
  })

  test('a different signed-in user can neither see nor confirm the action', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const other = t.withIdentity(identity(stranger))

    expect(
      await other.query(api.web3Actions.status, { actionId: created.id }),
    ).toBeNull()
    await expect(
      other.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('no longer available')

    const action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('pending')
  })

  test('unauthenticated confirm is rejected', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    await expect(
      t.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('Not signed in')
  })

  test('confirm refuses when the power-up was switched off after preparation', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: false,
    })

    await expect(
      app.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('not enabled')
  })

  test('expired actions cannot be confirmed and read as expired', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const app = t.withIdentity(identity(owner))

    vi.setSystemTime(Date.now() + ACTION_TTL_MS + 1)

    await expect(
      app.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('expired')
    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('expired')
  })

  test('cancel declines a pending action and confirm then refuses', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const app = t.withIdentity(identity(owner))

    await app.mutation(api.web3Actions.cancel, { actionId: created.id })
    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('cancelled')

    await expect(
      app.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('already cancelled')
  })

  test('recordResult finalizes only confirmed actions and stores the outcome', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)

    // Pending actions are not finalizable.
    await t.mutation(internal.web3Actions.recordResult, {
      actionId: created.id,
      result: [{ hash: '0xabc', explorerLink: 'https://basescan.org/tx/0xabc' }],
    })
    let action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('pending')

    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.confirm, { actionId: created.id })
    await t.mutation(internal.web3Actions.recordResult, {
      actionId: created.id,
      result: [{ hash: '0xabc', explorerLink: 'https://basescan.org/tx/0xabc' }],
    })
    action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('executed')
    expect(action?.result?.[0]?.hash).toBe('0xabc')
  })

  test('recordResult with an error marks the action failed', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.confirm, { actionId: created.id })

    await t.mutation(internal.web3Actions.recordResult, {
      actionId: created.id,
      error: 'insufficient funds',
    })
    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('failed')
    expect(status?.error).toBe('insufficient funds')
  })

  test('the agent-facing status view is scoped to the requesting user', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)

    const mine = await t.query(internal.web3Actions.getForUser, {
      userId: owner,
      actionId: created.id,
    })
    expect(mine?.status).toBe('pending')
    expect(mine?.summary).toContain('USDC')

    expect(
      await t.query(internal.web3Actions.getForUser, {
        userId: stranger,
        actionId: created.id,
      }),
    ).toBeNull()
  })
})

describe('wallets DB surface', () => {
  test('linkEoa validates, upserts, and myWallets returns both kinds', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: true,
    })
    await t.mutation(internal.wallets.cacheWallet, {
      userId: owner,
      chain: 'base',
      address: '0x00000000000000000000000000000000000000bb',
    })

    await expect(
      app.mutation(api.wallets.linkEoa, { address: 'not-an-address' }),
    ).rejects.toThrow('valid 0x wallet address')

    await app.mutation(api.wallets.linkEoa, {
      address: ' 0x00000000000000000000000000000000000000cc ',
    })
    let wallets = await app.query(api.wallets.myWallets, {})
    expect(wallets.smartWallet?.address).toBe(
      '0x00000000000000000000000000000000000000bb',
    )
    expect(wallets.smartWallet?.chain).toBe('base')
    expect(wallets.eoa?.address).toBe(
      '0x00000000000000000000000000000000000000cc',
    )

    // Re-linking replaces the address instead of duplicating the row.
    await app.mutation(api.wallets.linkEoa, {
      address: '0x00000000000000000000000000000000000000dd',
    })
    const rows = await t.run(
      async (ctx) =>
        await ctx.db
          .query('wallets')
          .withIndex('by_user', (q) => q.eq('userId', owner))
          .collect(),
    )
    expect(rows).toHaveLength(2)

    await app.mutation(api.wallets.unlinkEoa, {})
    wallets = await app.query(api.wallets.myWallets, {})
    expect(wallets.eoa).toBeNull()
    expect(wallets.smartWallet?.address).toBe(
      '0x00000000000000000000000000000000000000bb',
    )
  })

  test('linkEoa requires the web3 power-up', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(stranger))
    await expect(
      app.mutation(api.wallets.linkEoa, {
        address: '0x00000000000000000000000000000000000000cc',
      }),
    ).rejects.toThrow('not enabled')
  })

  test('rows without kind still count as the smart wallet cache', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(owner))
    await t.run(async (ctx) => {
      await ctx.db.insert('wallets', {
        userId: owner,
        chain: 'base-sepolia',
        address: '0x00000000000000000000000000000000000000ee',
      })
    })
    const wallets = await app.query(api.wallets.myWallets, {})
    expect(wallets.smartWallet?.address).toBe(
      '0x00000000000000000000000000000000000000ee',
    )
  })
})
