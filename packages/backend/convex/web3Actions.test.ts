import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import { api, internal } from './_generated/api'
import { ACTION_TTL_MS, MAX_WEB3_CONTINUATION_LENGTH } from './web3Actions'
import schema from './schema'
import { modules } from './test.setup'

const owner = 'user_web3_owner'
const stranger = 'user_web3_stranger'
const firstEoa = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const secondEoa = privateKeyToAccount(`0x${'22'.repeat(32)}`)

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
    await ctx.db.insert('powerups', {
      userId,
      powerupId: 'web3',
      enabled: true,
    })
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
  test('preparation durably binds a continuation to its originating conversation', async () => {
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
      conversationId: `${owner}~42`,
      continuation:
        'After the withdrawal settles, swap the received USDC to ETH.',
      summary: 'Withdraw the full Aerodrome position',
      payload: sendPayload,
    })

    const action = await t.query(internal.web3Actions.get, {
      actionId: created.id,
    })
    expect(action).toMatchObject({
      conversationId: `${owner}~42`,
      continuation:
        'After the withdrawal settles, swap the received USDC to ETH.',
    })

    const publicStatus = await t
      .withIdentity(identity(owner))
      .query(api.web3Actions.status, { actionId: created.id })
    expect(publicStatus).not.toHaveProperty('conversationId')
    expect(publicStatus).not.toHaveProperty('continuation')
  })

  test('preparation rejects a conversation that does not belong to the user', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(internal.web3Actions.create, {
        userId: owner,
        conversationId: `${stranger}~42`,
        continuation: 'Continue moving funds.',
        summary: 'Send funds',
        payload: sendPayload,
      }),
    ).rejects.toThrow('originating conversation')
  })

  test('preparation requires an origin and bounds the private continuation', async () => {
    const t = convexTest(schema, modules)
    const base = {
      userId: owner,
      summary: 'Send funds',
      payload: sendPayload,
    }

    await expect(
      t.mutation(internal.web3Actions.create, {
        ...base,
        continuation: 'Continue moving funds.',
      }),
    ).rejects.toThrow('originating conversation')
    await expect(
      t.mutation(internal.web3Actions.create, {
        ...base,
        conversationId: owner,
        continuation: 'x'.repeat(MAX_WEB3_CONTINUATION_LENGTH + 1),
      }),
    ).rejects.toThrow('too long')
  })

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
      result: [
        { hash: '0xabc', explorerLink: 'https://basescan.org/tx/0xabc' },
      ],
    })
    let action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('pending')

    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.confirm, { actionId: created.id })
    await t.mutation(internal.web3Actions.recordResult, {
      actionId: created.id,
      result: [
        { hash: '0xabc', explorerLink: 'https://basescan.org/tx/0xabc' },
      ],
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

  test('durably records Crossmint ids before approval and advances one fresh step at a time', async () => {
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
      summary: 'Stake an Aerodrome LP',
      payload: {
        kind: 'execute_plan',
        chainId: 8453,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000aa',
            data: '0x1234',
            value: '0',
          },
        ],
        intent: {
          sugarAction: 'stake',
          parameters: {
            chain: 8453,
            wallet: '0x00000000000000000000000000000000000000bb',
            pool: '0x00000000000000000000000000000000000000cc',
          },
          bounds: {},
        },
      },
    })
    await t.withIdentity(identity(owner)).mutation(api.web3Actions.confirm, {
      actionId: created.id,
    })

    await t.mutation(internal.web3Actions.recordCrossmintPrepared, {
      actionId: created.id,
      role: 'approval',
      transactionId: 'crossmint-approval-1',
    })
    let action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action).toMatchObject({
      status: 'in_progress',
      crossmintExecution: [
        {
          role: 'approval',
          transactionId: 'crossmint-approval-1',
          status: 'prepared',
        },
      ],
    })

    const hash = `0x${'ab'.repeat(32)}`
    await t.mutation(internal.web3Actions.recordCrossmintSuccess, {
      actionId: created.id,
      transactionId: 'crossmint-approval-1',
      hash,
      explorerLink: `https://basescan.org/tx/${hash}`,
    })
    action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('confirmed')
    expect(action?.crossmintExecution?.[0]).toMatchObject({
      status: 'success',
      hash,
    })
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

    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: stranger,
        powerupId: 'web3',
        enabled: true,
      })
    })
    expect(
      await t.query(internal.web3Actions.getForUser, {
        userId: stranger,
        actionId: created.id,
      }),
    ).toBeNull()
  })

  test('the agent-facing status view requires the enabled power-up', async () => {
    const t = convexTest(schema, modules)
    const created = await prepare(t)

    await expect(
      t.query(internal.web3Actions.getForUser, {
        userId: stranger,
        actionId: created.id,
      }),
    ).rejects.toThrow('not enabled')
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

  test('Socket persists one atomic approval plus route operation before settlement', async () => {
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

    await t.mutation(internal.web3Actions.recordSocketPrepared, {
      actionId: created.id,
      transactionId: 'crossmint-socket-batch-1',
    })
    let row = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(row).toMatchObject({
      status: 'in_progress',
      crossmintExecution: [
        {
          role: 'action',
          transactionId: 'crossmint-socket-batch-1',
          status: 'prepared',
        },
      ],
    })

    const sourceTxHash = `0x${'ef'.repeat(32)}`
    await t.mutation(internal.web3Actions.recordSocketOriginSuccess, {
      actionId: created.id,
      transactionId: 'crossmint-socket-batch-1',
      hash: sourceTxHash,
      explorerLink: `https://basescan.org/tx/${sourceTxHash}`,
    })
    row = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(row).toMatchObject({
      status: 'in_progress',
      crossmintExecution: [{ status: 'success', hash: sourceTxHash }],
      socketProgress: { status: 'PENDING', originTxHash: sourceTxHash },
    })
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

describe('YOLO mode', () => {
  test('setYolo requires the signed-in owner and the enabled power-up', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.mutation(api.web3Prefs.setYolo, { enabled: true }),
    ).rejects.toThrow('Not signed in')

    const app = t.withIdentity(identity(owner))
    await expect(
      app.mutation(api.web3Prefs.setYolo, { enabled: true }),
    ).rejects.toThrow('not enabled')

    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: true,
    })
    await app.mutation(api.web3Prefs.setYolo, { enabled: true })
    expect(await app.query(api.web3Prefs.get, {})).toEqual({
      yoloEnabled: true,
    })
  })

  test('create auto-confirms while YOLO is on and marks the action', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: true,
    })
    await app.mutation(api.web3Prefs.setYolo, { enabled: true })

    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Send 1.5 USDC to 0x…00aa',
      payload: sendPayload,
    })
    expect(created.autoConfirmed).toBe(true)

    const action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('confirmed')
    expect(action?.autoConfirmed).toBe(true)
    expect(action?.confirmedAt).toBe(Date.now())

    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.autoConfirmed).toBe(true)
    expect(status?.status).toBe('confirmed')
  })

  test('create stays pending when YOLO is off or the power-up is disabled', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: true,
    })

    // YOLO off: pending.
    let created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Send 1.5 USDC to 0x…00aa',
      payload: sendPayload,
    })
    expect(created.autoConfirmed).toBe(false)
    let action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('pending')
    expect(action?.autoConfirmed).toBeUndefined()

    // YOLO on but power-up later disabled: pending again.
    await app.mutation(api.web3Prefs.setYolo, { enabled: true })
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: false,
    })
    created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Send 1.5 USDC to 0x…00aa',
      payload: sendPayload,
    })
    expect(created.autoConfirmed).toBe(false)
    action = await t.run(async (ctx) => await ctx.db.get(created.id))
    expect(action?.status).toBe('pending')
  })

  test('status exposes task timing for socket swaps', async () => {
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
    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.timing).toEqual({
      estimatedTimeSeconds: socketPayload.estimatedTimeSeconds,
      monitoringDeadlineAt: socketPayload.monitoringDeadlineAt,
      statusIntervalSeconds: socketPayload.statusIntervalSeconds,
    })

    const send = await prepare(t)
    const sendStatus = await app.query(api.web3Actions.status, {
      actionId: send.id,
    })
    expect(sendStatus?.timing).toBeNull()
  })

  test('linked-wallet plans bypass YOLO and record wallet submissions in order', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner,
        powerupId: 'web3',
        enabled: true,
      })
      await ctx.db.insert('web3Prefs', {
        userId: owner,
        yoloEnabled: true,
        updatedAt: Date.now(),
      })
      await ctx.db.insert('wallets', {
        userId: owner,
        chain: 'evm',
        address: firstEoa.address,
        kind: 'eoa',
        linkedAt: Date.now(),
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Aerodrome swap on Base from your linked wallet',
      payload: {
        kind: 'execute_eoa_plan',
        chainId: 8453,
        walletAddress: firstEoa.address,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000aa',
            data: '0x1234',
            value: '0',
          },
          {
            to: '0x00000000000000000000000000000000000000bb',
            data: '0xabcd',
            value: '1',
          },
        ],
      },
    })
    expect(created.autoConfirmed).toBe(false)

    const app = t.withIdentity(identity(owner))
    await expect(
      app.mutation(api.web3Actions.confirm, { actionId: created.id }),
    ).rejects.toThrow('linked wallet')
    const plan = await app.mutation(api.web3Actions.beginEoaExecution, {
      actionId: created.id,
    })
    expect(plan.walletAddress).toBe(firstEoa.address)
    expect(plan.transactions).toHaveLength(2)

    await expect(
      app.mutation(api.web3Actions.recordEoaSubmission, {
        actionId: created.id,
        index: 1,
        hash: `0x${'bb'.repeat(32)}`,
      }),
    ).rejects.toThrow('plan order')
    expect(
      await app.mutation(api.web3Actions.recordEoaSubmission, {
        actionId: created.id,
        index: 0,
        hash: `0x${'aa'.repeat(32)}`,
        role: 'approval',
      }),
    ).toEqual({ done: false })
    expect(
      await app.mutation(api.web3Actions.recordEoaReceipt, {
        actionId: created.id,
        index: 0,
        hash: `0x${'aa'.repeat(32)}`,
      }),
    ).toEqual({ done: false })
    expect(
      await app.mutation(api.web3Actions.recordEoaSubmission, {
        actionId: created.id,
        index: 1,
        hash: `0x${'bb'.repeat(32)}`,
        role: 'action',
      }),
    ).toEqual({ done: false })

    const submittedStatus = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(submittedStatus?.status).toBe('in_progress')

    expect(
      await app.mutation(api.web3Actions.recordEoaReceipt, {
        actionId: created.id,
        index: 1,
        hash: `0x${'bb'.repeat(32)}`,
      }),
    ).toEqual({ done: true })

    const status = await app.query(api.web3Actions.status, {
      actionId: created.id,
    })
    expect(status?.status).toBe('executed')
    expect(status?.result?.[1]?.explorerLink).toBe(
      `https://basescan.org/tx/0x${'bb'.repeat(32)}`,
    )
  })

  test('a submitted final linked-wallet step can still fail before its receipt', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner,
        powerupId: 'web3',
        enabled: true,
      })
      await ctx.db.insert('wallets', {
        userId: owner,
        chain: 'evm',
        address: firstEoa.address,
        kind: 'eoa',
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Aerodrome action from your linked wallet',
      payload: {
        kind: 'execute_eoa_plan',
        chainId: 8453,
        walletAddress: firstEoa.address,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000aa',
            data: '0x1234',
            value: '0',
          },
        ],
      },
    })
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.beginEoaExecution, {
      actionId: created.id,
    })
    await app.mutation(api.web3Actions.recordEoaSubmission, {
      actionId: created.id,
      index: 0,
      hash: `0x${'aa'.repeat(32)}`,
      role: 'action',
    })
    expect(
      (await app.query(api.web3Actions.status, { actionId: created.id }))
        ?.status,
    ).toBe('in_progress')

    await app.mutation(api.web3Actions.reportEoaFailure, {
      actionId: created.id,
      reason: 'wallet_error',
    })
    expect(
      (await app.query(api.web3Actions.status, { actionId: created.id }))
        ?.status,
    ).toBe('failed')
  })

  test('a rejected first linked-wallet request is cancelled without a hash', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('powerups', {
        userId: owner,
        powerupId: 'web3',
        enabled: true,
      })
      await ctx.db.insert('wallets', {
        userId: owner,
        chain: 'evm',
        address: firstEoa.address,
        kind: 'eoa',
      })
    })
    const created = await t.mutation(internal.web3Actions.create, {
      userId: owner,
      summary: 'Aerodrome claim fees on Base from your linked wallet',
      payload: {
        kind: 'execute_eoa_plan',
        chainId: 8453,
        walletAddress: firstEoa.address,
        transactions: [
          {
            to: '0x00000000000000000000000000000000000000aa',
            data: '0x1234',
            value: '0',
          },
        ],
      },
    })
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.web3Actions.beginEoaExecution, {
      actionId: created.id,
    })
    await app.mutation(api.web3Actions.reportEoaFailure, {
      actionId: created.id,
      reason: 'user_rejected',
    })
    expect(
      (await app.query(api.web3Actions.status, { actionId: created.id }))
        ?.status,
    ).toBe('cancelled')
  })
})

describe('wallets DB surface', () => {
  test('linkEoa verifies ownership, upserts, and myWallets returns both kinds', async () => {
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
      app.mutation(api.wallets.beginEoaLink, { address: 'not-an-address' }),
    ).rejects.toThrow('valid EVM wallet')

    const firstChallenge = await app.mutation(api.wallets.beginEoaLink, {
      address: firstEoa.address,
    })
    const firstSignature = await firstEoa.signMessage({
      message: firstChallenge.message,
    })
    await app.mutation(api.wallets.linkEoa, {
      challengeId: firstChallenge.challengeId,
      signature: firstSignature,
    })
    let wallets = await app.query(api.wallets.myWallets, {})
    expect(wallets.smartWallet?.address).toBe(
      '0x00000000000000000000000000000000000000bb',
    )
    expect(wallets.smartWallet?.chain).toBe('base')
    expect(wallets.smartWallet?.supportedChains).toEqual(['base', 'arbitrum'])
    expect(wallets.eoa?.address).toBe(firstEoa.address)
    expect(wallets.eoa?.linkedAt).toBe(Date.now())

    // Re-linking replaces the address instead of duplicating the row.
    const secondChallenge = await app.mutation(api.wallets.beginEoaLink, {
      address: secondEoa.address,
    })
    const secondSignature = await secondEoa.signMessage({
      message: secondChallenge.message,
    })
    await app.mutation(api.wallets.linkEoa, {
      challengeId: secondChallenge.challengeId,
      signature: secondSignature,
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

  test('linkEoa rejects a signature from a different wallet', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(owner))
    await app.mutation(api.powerups.setEnabled, {
      powerupId: 'web3',
      enabled: true,
    })
    const challenge = await app.mutation(api.wallets.beginEoaLink, {
      address: firstEoa.address,
    })
    const wrongSignature = await secondEoa.signMessage({
      message: challenge.message,
    })

    await expect(
      app.mutation(api.wallets.linkEoa, {
        challengeId: challenge.challengeId,
        signature: wrongSignature,
      }),
    ).rejects.toThrow('does not match')
  })

  test('linkEoa requires the web3 power-up', async () => {
    const t = convexTest(schema, modules)
    const app = t.withIdentity(identity(stranger))
    await expect(
      app.mutation(api.wallets.beginEoaLink, {
        address: firstEoa.address,
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
