import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { internal } from './_generated/api'
import type { Web3ExecutionServices } from './web3lib/executionServices'
import type { Doc } from './_generated/dataModel'
import schema from './schema'
import { modules } from './test.setup'

const mocks = { transaction: vi.fn(), approve: vi.fn(), createTransaction: vi.fn(), socketStatus: vi.fn(), buildPlan: vi.fn() }
const unexpected = async (): Promise<never> => { throw new Error('Unexpected legacy wallet send') }
const services: Web3ExecutionServices = {
  wallet: async () => ({ address: '0x1111111111111111111111111111111111111111', chain: 'base', signer: { locator: () => 'test' }, apiClient: { createTransaction: mocks.createTransaction }, approve: mocks.approve, transaction: mocks.transaction, send: unexpected, sendTransaction: unexpected }),
  buildPlan: mocks.buildPlan,
  socketStatus: mocks.socketStatus,
}
import { executeConfirmedActionForId } from './web3lib/executeConfirmed'
import { reconcileCrossmintActionForId } from './web3lib/sugarExecution'
import { pollSocketSwapStatusForId, reconcileSocketCrossmintActionForId } from './web3lib/socketOrchestration'

const hash = `0x${'a'.repeat(64)}`
const transaction = { to: '0x2222222222222222222222222222222222222222', data: '0x12', value: '0' }
const socket: Extract<Doc<'web3Actions'>['payload'], { kind: 'socket_swap' }> = { kind: 'socket_swap', quoteId: 'quote-existing', originChainId: 8453, destinationChainId: 42161, originChain: 'base', destinationChain: 'arbitrum', inputToken: 'usdc', outputToken: 'eth', inputAmount: '10', outputAmount: '0.1', minimumOutputAmount: '0.09', provider: 'Across', estimatedTimeSeconds: 45, quoteExpiresAt: Date.now() + 60_000, monitoringDeadlineAt: 1, statusIntervalSeconds: 5, transaction }
const sugar: Doc<'web3Actions'>['payload'] = { kind: 'execute_plan', chainId: 8453, transactions: [transaction], intent: { sugarAction: 'swap', parameters: {}, bounds: {} } }
async function seed(t: ReturnType<typeof convexTest>, payload = sugar, patch: Partial<Doc<'web3Actions'>> = {}) {
  return t.run(async (ctx) => {
    await ctx.db.insert('powerups', { userId: 'user_settlement', powerupId: 'web3', enabled: true })
    return ctx.db.insert('web3Actions', { userId: 'user_settlement', summary: 'Saved action', payload, status: 'in_progress', createdAt: 1, confirmedAt: 1, executionStartedAt: 1, submittedAt: 1, expiresAt: Date.now() + 600_000, crossmintExecution: [{ role: 'action', transactionId: 'persisted-id', status: 'prepared' }], ...patch })
  })
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08T20:00:00Z')); vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers() })

test('late Sugar success settles the saved ID and clears old errors', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, sugar, { error: 'old transport failure', settledAt: 2 })
  mocks.transaction.mockResolvedValue({ id: 'persisted-id', status: 'success', onChain: { txId: hash } })
  await t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))
  const row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('executed'); expect(row?.error).toBeUndefined(); expect(row?.result?.[0].hash).toBe(hash)
  expect(mocks.approve).not.toHaveBeenCalled(); expect(mocks.createTransaction).not.toHaveBeenCalled()
})

test('late origin and destination success survive both expired monitoring windows', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, socket)
  mocks.transaction.mockResolvedValue({ id: 'persisted-id', status: 'success', onChain: { txId: hash } })
  await t.action(ctx => reconcileSocketCrossmintActionForId(ctx, id, services))
  expect((await t.query(internal.web3Actions.get, { actionId: id }))?.socketProgress?.originTxHash).toBe(hash)
  vi.setSystemTime(Date.now() + 300_001)
  mocks.socketStatus.mockResolvedValue({ status: 'COMPLETED', originTxHash: hash, destinationTxHash: `0x${'b'.repeat(64)}` })
  await t.action(ctx => pollSocketSwapStatusForId(ctx, id, services))
  expect((await t.query(internal.web3Actions.get, { actionId: id }))?.status).toBe('executed')
  expect(mocks.approve).not.toHaveBeenCalled()
})

test('transport outages remain pending, back off and admit only one observer', async () => {
  const t = convexTest(schema, modules); const id = await seed(t)
  mocks.transaction.mockRejectedValue(new Error('network down'))
  await Promise.all([t.action(ctx => reconcileCrossmintActionForId(ctx, id, services)), t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))])
  const row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('in_progress'); expect(row?.error).toBeUndefined()
  expect(row?.reconcileAt).toBe(Date.now() + 300_000); expect(mocks.transaction).toHaveBeenCalledOnce()
  expect(mocks.approve).not.toHaveBeenCalled()
})

test('failed settlement persistence cannot turn an approved batch into failure', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, sugar, { status: 'confirmed', crossmintExecution: undefined })
  mocks.buildPlan.mockResolvedValue({ transaction_steps: [{ role: 'action', transaction }] })
  mocks.createTransaction.mockResolvedValue({ id: 'created-id' })
  mocks.approve.mockResolvedValue({ transactionId: 'created-id', hash, explorerLink: '' })
  await t.action(async ctx => {
  const original = ctx.runMutation
  ctx.runMutation = async (reference, args) => {
    if (getFunctionName(reference) === 'web3Actions:recordCrossmintSuccess') throw new Error('database response lost')
    return original(reference, args)
  }
  await executeConfirmedActionForId(ctx, id, services)
  })
  let row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('in_progress'); expect(row?.crossmintExecution?.[0].transactionId).toBe('created-id'); expect(row?.error).toBeUndefined()
  vi.setSystemTime(Date.now() + 300_001)
  mocks.transaction.mockResolvedValue({ id: 'created-id', status: 'success', onChain: { txId: hash } })
  await t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))
  row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('executed'); expect(mocks.createTransaction).toHaveBeenCalledOnce(); expect(mocks.approve).toHaveBeenCalledOnce()
})

test('watchdog recovers legacy false-failure cohorts and expired observer leases without approving', async () => {
  const t = convexTest(schema, modules)
  const first = await seed(t, sugar, { status: 'failed', error: 'lookup failed', settledAt: 1 })
  const second = await seed(t, sugar, { status: 'failed', error: 'timeout', crossmintExecution: [{ role: 'action', transactionId: 'old-timeout', status: 'failed' }] })
  const third = await seed(t, socket, { status: 'failed', crossmintExecution: [{ role: 'action', transactionId: 'origin-done', status: 'success', hash }], socketProgress: { status: 'EXPIRED', originTxHash: hash, detail: 'local timeout', updatedAt: 1 } })
  const fourth = await seed(t, sugar, { reconcileLeaseUntil: Date.now() - 1 })
  await t.mutation(internal.web3Reconciliation.watchdog, {})
  for (const id of [first, second, third, fourth]) {
    const row = await t.query(internal.web3Actions.get, { actionId: id })
    expect(row?.status).toBe('in_progress'); expect(row?.reconcileAt).toBe(Date.now()); expect(row?.error).toBeUndefined()
  }
  expect((await t.query(internal.web3Actions.get, { actionId: second }))?.crossmintExecution?.[0].status).toBe('prepared')
  expect((await t.query(internal.web3Actions.get, { actionId: third }))?.socketProgress?.status).toBe('IN_PROGRESS')
  expect(mocks.approve).not.toHaveBeenCalled()
})

test('historical approval recovery never executes its remaining action', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, sugar, { status: 'failed', crossmintExecution: [{ role: 'approval', transactionId: 'old-approval', status: 'prepared' }] })
  await t.mutation(internal.web3Reconciliation.watchdog, {})
  mocks.transaction.mockResolvedValue({ id: 'old-approval', status: 'success', onChain: { txId: hash } })
  await t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))
  const row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('failed'); expect(row?.error).toContain('did not submit the remaining action'); expect(row?.result?.[0].hash).toBe(hash)
  expect(mocks.approve).not.toHaveBeenCalled(); expect(mocks.createTransaction).not.toHaveBeenCalled()
})

test('lost preparation acknowledgment and provider lookup keep the persisted ID recoverable', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, sugar, { status: 'confirmed', crossmintExecution: undefined })
  mocks.buildPlan.mockResolvedValue({ transaction_steps: [{ role: 'action', transaction }] })
  mocks.createTransaction.mockResolvedValue({ id: 'ack-lost-id' })
  await t.action(async ctx => {
  const original = ctx.runMutation
  ctx.runMutation = async (reference, args) => {
    const result = await original(reference, args)
    if (getFunctionName(reference) === 'web3Actions:recordCrossmintPrepared') throw new Error('ack lost after commit')
    return result
  }
  await executeConfirmedActionForId(ctx, id, services)
  })
  expect(mocks.approve).not.toHaveBeenCalled()
  let row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('in_progress'); expect(row?.crossmintExecution?.[0].transactionId).toBe('ack-lost-id')
  vi.setSystemTime(Date.now() + 300_001)
  mocks.transaction.mockResolvedValue({ id: 'ack-lost-id', status: 'awaiting-approval' })
  await t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))
  row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('in_progress'); expect(row?.recoveryDetail).toContain('awaiting approval')
  expect(mocks.createTransaction).toHaveBeenCalledOnce(); expect(mocks.approve).not.toHaveBeenCalled()
})

test('authoritative provider failure ends observation and is not revived by the watchdog', async () => {
  const t = convexTest(schema, modules); const id = await seed(t)
  mocks.transaction.mockResolvedValue({ id: 'persisted-id', status: 'failed' })
  await t.action(ctx => reconcileCrossmintActionForId(ctx, id, services))
  await t.mutation(internal.web3Reconciliation.watchdog, {})
  const row = await t.query(internal.web3Actions.get, { actionId: id })
  expect(row?.status).toBe('failed'); expect(row?.settlementFailureSource).toBe('provider'); expect(row?.reconcileAt).toBeUndefined()
})

test('legacy hashless Socket submission is reconciled by its saved quote ID', async () => {
  const t = convexTest(schema, modules); const id = await seed(t, socket, { status: 'confirmed', crossmintExecution: undefined })
  await t.mutation(internal.web3Actions.recordSocketSubmitted, { actionId: id, result: [{ hash: null, explorerLink: null }] })
  expect((await t.query(internal.web3Actions.get, { actionId: id }))?.reconcileAt).toBeGreaterThan(Date.now())
  vi.setSystemTime(Date.now() + 300_001)
  mocks.socketStatus.mockResolvedValue({ status: 'COMPLETED' })
  await t.action(ctx => pollSocketSwapStatusForId(ctx, id, services))
  expect((await t.query(internal.web3Actions.get, { actionId: id }))?.status).toBe('executed')
})
