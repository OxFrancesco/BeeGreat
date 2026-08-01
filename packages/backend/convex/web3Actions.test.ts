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

const socketPayload = {
  kind: 'socket_swap' as const,
  quoteId: `0x${'12'.repeat(32)}`,
  originChainId: 8453,
  destinationChainId: 42161,
  originChain: 'base' as const,
  destinationChain: 'arbitrum' as const,
  inputToken: 'usdc' as const,
  outputToken: 'eth' as const,
  inputAmount: '10',
  outputAmount: '0.003',
  minimumOutputAmount: '0.00297',
  provider: 'Across',
  estimatedTimeSeconds: 45,
  quoteExpiresAt: Date.parse('2026-07-31T12:05:00Z'),
  monitoringDeadlineAt: Date.parse('2026-07-31T12:35:00Z'),
  statusIntervalSeconds: 5,
  approval: {
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    spenderAddress: '0x00000000000000000000000000000000000000bb',
    amount: '10000000',
  },
  transaction: {
    to: '0x00000000000000000000000000000000000000cc',
    data: '0x1234',
    value: '0',
  },
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

  test('Socket actions stay in progress until destination completion', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner,
        powerupId: 'web3',
        enabled: true,
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Swap Base USDC for Arbitrum ETH',
      payload: socketPayload,
    })
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.confirm, { actionId: created.id })

    const sourceTxHash = `0x${'ab'.repeat(32)}`
    await t.mutation(internal.web3Actions.recordSocketSubmitted, {
      actionId: created.id,
      originTxHash: sourceTxHash,
      result: [
        {
          hash: sourceTxHash,
          explorerLink: `https://basescan.org/tx/${sourceTxHash}`,
        },
      ],
    })
    let status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('in_progress')
    expect(status?.socketProgress?.status).toBe('PENDING')

    const destinationTxHash = `0x${'cd'.repeat(32)}`
    await t.mutation(internal.web3Actions.recordSocketProgress, {
      actionId: created.id,
      progress: {
        status: 'COMPLETED',
        detail: 'Funds arrived on Arbitrum.',
        originTxHash: sourceTxHash,
        destinationTxHash,
        destinationExplorerLink: `https://arbiscan.io/tx/${destinationTxHash}`,
        updatedAt: Date.now(),
      },
      result: [
        {
          hash: sourceTxHash,
          explorerLink: `https://basescan.org/tx/${sourceTxHash}`,
        },
        {
          hash: destinationTxHash,
          explorerLink: `https://arbiscan.io/tx/${destinationTxHash}`,
        },
      ],
    })
    status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('executed')
    expect(status?.socketProgress?.destinationTxHash).toBe(destinationTxHash)
  })

  test('a Socket confirmation gets the full action TTL even if its quote is shorter', async () => {
    const t = convexTest(schema, modules)
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Quoted cross-chain swap',
      payload: { ...socketPayload, quoteExpiresAt: Date.now() + 30_000 },
    })
    expect(created.expiresAt).toBe(Date.now() + ACTION_TTL_MS)
  })
})

describe('socket route refresh', () => {
  const refreshedRoute = {
    quoteId: `0x${'34'.repeat(32)}`,
    outputAmount: '0.0031',
    minimumOutputAmount: '0.003069',
    provider: 'CCTP',
    estimatedTimeSeconds: 60,
    quoteExpiresAt: Date.parse('2026-07-31T12:11:00Z'),
    monitoringDeadlineAt: Date.parse('2026-07-31T12:41:00Z'),
    statusIntervalSeconds: 10,
    approval: {
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      spenderAddress: '0x00000000000000000000000000000000000000dd',
      amount: '10000000',
    },
    transaction: {
      to: '0x00000000000000000000000000000000000000ee',
      data: '0x5678',
      value: '0',
    },
  }

  async function confirmedSocketAction(t: ReturnType<typeof convexTest>) {
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner,
        powerupId: 'web3',
        enabled: true,
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Swap Base USDC for Arbitrum ETH',
      payload: socketPayload,
    })
    await t
      .withIdentity(identity(owner))
      .mutation(api.web3Actions.confirm, { actionId: created.id })
    return created.id
  }

  test('refresh swaps in the fresh route but keeps the confirmed terms', async () => {
    const t = convexTest(schema, modules)
    const actionId = await confirmedSocketAction(t)

    await t.mutation(internal.web3Actions.refreshSocketRoute, {
      actionId,
      route: refreshedRoute,
    })

    const action = await t.run(async (ctx) => await ctx.db.get(actionId))
    if (action?.payload.kind !== 'socket_swap') throw new Error('wrong kind')
    expect(action.payload.quoteId).toBe(refreshedRoute.quoteId)
    expect(action.payload.transaction).toEqual(refreshedRoute.transaction)
    expect(action.payload.approval).toEqual(refreshedRoute.approval)
    expect(action.payload.quoteExpiresAt).toBe(refreshedRoute.quoteExpiresAt)
    expect(action.payload.minimumOutputAmount).toBe(
      refreshedRoute.minimumOutputAmount,
    )
    // The confirmed terms are untouched.
    expect(action.payload.inputAmount).toBe(socketPayload.inputAmount)
    expect(action.payload.originChain).toBe(socketPayload.originChain)
    expect(action.payload.destinationChain).toBe(socketPayload.destinationChain)
  })

  test('refresh rejects a route that guarantees less than the user confirmed', async () => {
    const t = convexTest(schema, modules)
    const actionId = await confirmedSocketAction(t)

    await expect(
      t.mutation(internal.web3Actions.refreshSocketRoute, {
        actionId,
        route: { ...refreshedRoute, minimumOutputAmount: '0.00296' },
      }),
    ).rejects.toThrow('less than')

    const action = await t.run(async (ctx) => await ctx.db.get(actionId))
    if (action?.payload.kind !== 'socket_swap') throw new Error('wrong kind')
    expect(action.payload.quoteId).toBe(socketPayload.quoteId)
  })

  test('refresh without an approval clears the stale approval', async () => {
    const t = convexTest(schema, modules)
    const actionId = await confirmedSocketAction(t)

    const { approval: _approval, ...withoutApproval } = refreshedRoute
    await t.mutation(internal.web3Actions.refreshSocketRoute, {
      actionId,
      route: withoutApproval,
    })

    const action = await t.run(async (ctx) => await ctx.db.get(actionId))
    if (action?.payload.kind !== 'socket_swap') throw new Error('wrong kind')
    expect(action.payload.approval).toBeUndefined()
  })

  test('refresh refuses actions that are not confirmed Socket swaps', async () => {
    const t = convexTest(schema, modules)
    const send = await prepare(t)
    const pending = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Swap Base USDC for Arbitrum ETH',
      payload: socketPayload,
    })
    await expect(
      t.mutation(internal.web3Actions.refreshSocketRoute, {
        actionId: pending.id,
        route: refreshedRoute,
      }),
    ).rejects.toThrow('confirmed')

    await t
      .withIdentity(identity(owner))
      .mutation(api.web3Actions.confirm, { actionId: send.id })
    await expect(
      t.mutation(internal.web3Actions.refreshSocketRoute, {
        actionId: send.id,
        route: refreshedRoute,
      }),
    ).rejects.toThrow('Socket')
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
    expect(wallets.smartWallet?.supportedChains).toEqual(['base', 'arbitrum'])
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
    expect(wallets.smartWallet?.supportedChains).toEqual(['base-sepolia'])
  })
})
