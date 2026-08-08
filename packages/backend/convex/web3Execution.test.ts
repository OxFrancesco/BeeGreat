import { describe, expect, test, vi } from 'vitest'

import {
  CrossmintTransactionPendingError,
  captureSugarBounds,
  executeFreshSugarPlan,
  executeSmartWalletIntent,
  prepareAndApproveCrossmintBatch,
  prepareAndApproveCrossmintStep,
  sugarTransactionSteps,
  type SugarTransactionStep,
} from './web3Execution'

const approval = {
  to: '0x1111111111111111111111111111111111111111',
  data: '0x01',
  value: '0',
}
const action = {
  to: '0x2222222222222222222222222222222222222222',
  data: '0x02',
  value: '0',
}

describe('fresh Sugar execution', () => {
  test('checks a fresh intent and executes approvals plus action as one batch', async () => {
    const executeBatch = vi.fn(async (steps: SugarTransactionStep[]) =>
      steps.map((step) => step.transaction.data))

    const result = await executeSmartWalletIntent({
      buildPlan: async () => ({
        quote: { min_amount_out: '100' },
        transaction_steps: [
          { role: 'approval', transaction: approval },
          { role: 'action', transaction: action },
        ],
      }),
      bounds: { minimumOutput: '100' },
      executeBatch,
    })

    expect(executeBatch).toHaveBeenCalledOnce()
    expect(result).toEqual(['0x01', '0x02'])
  })

  test('does not prepare a wallet transaction when refreshed bounds are unsafe', async () => {
    const executeBatch = vi.fn(async () => undefined)

    await expect(executeSmartWalletIntent({
      buildPlan: async () => ({
        quote: { min_amount_out: '99' },
        transaction_steps: [{ role: 'action', transaction: action }],
      }),
      bounds: { minimumOutput: '100' },
      executeBatch,
    })).rejects.toThrow('less than the amount you confirmed')

    expect(executeBatch).not.toHaveBeenCalled()
  })

  test('rebuilds after each prerequisite and executes the fresh final action', async () => {
    let builds = 0
    const executed: string[] = []

    await executeFreshSugarPlan({
      buildPlan: async () => {
        builds += 1
        return builds === 1
          ? { transaction_steps: [
              { role: 'approval', transaction: approval },
              { role: 'action', transaction: { ...action, data: '0xstale' } },
            ] }
          : { transaction_steps: [
              { role: 'action', transaction: { ...action, data: '0xfresh' } },
            ] }
      },
      executeStep: async (step) => executed.push(step.transaction.data),
    })

    expect(builds).toBe(2)
    expect(executed).toEqual(['0x01', '0xfresh'])
  })

  test('preserves the minimum output the user confirmed', async () => {
    const bounds = captureSugarBounds({ quote: { min_amount_out: '100' } })
    await expect(executeFreshSugarPlan({
      bounds,
      buildPlan: async () => ({
        quote: { min_amount_out: '99' },
        transaction_steps: [{ role: 'action', transaction: action }],
      }),
      executeStep: async () => undefined,
    })).rejects.toThrow('less than the amount you confirmed')
  })

  test('persists the Crossmint id before approval and reconciles timeout success', async () => {
    const calls: string[] = []
    const wallet = {
      sendTransaction: vi.fn(async () => ({ transactionId: 'tx-1' })),
      approve: vi.fn(async () => {
        calls.push('approve')
        throw new Error('timed out')
      }),
      transaction: vi.fn(async () => ({
        id: 'tx-1',
        status: 'success',
        onChain: { txId: `0x${'aa'.repeat(32)}`, explorerLink: 'https://example/tx' },
      })),
    }

    const result = await prepareAndApproveCrossmintStep({
      wallet,
      step: { role: 'action', transaction: action },
      onPrepared: async (transactionId) => {
        calls.push(`persist:${transactionId}`)
      },
    })

    expect(calls).toEqual(['persist:tx-1', 'approve'])
    expect(result.hash).toBe(`0x${'aa'.repeat(32)}`)
  })

  test('prepares one Crossmint transaction with ordered approval and action calls', async () => {
    const calls: string[] = []
    const createTransaction = vi.fn(async () => ({ id: 'tx-batch' }))
    const wallet = {
      address: '0x3333333333333333333333333333333333333333',
      chain: 'base',
      signer: { locator: () => 'api-key' },
      apiClient: { createTransaction },
      approve: vi.fn(async () => ({
        hash: `0x${'bb'.repeat(32)}`,
        explorerLink: 'https://example/batch',
        transactionId: 'tx-batch',
      })),
      transaction: vi.fn(async () => ({ id: 'tx-batch', status: 'pending' })),
    }

    const result = await prepareAndApproveCrossmintBatch({
      wallet,
      steps: [
        { role: 'approval', transaction: approval },
        { role: 'action', transaction: { ...action, value: '3' } },
      ],
      onPrepared: async (transactionId) => {
        calls.push(`persist:${transactionId}`)
      },
    })

    expect(createTransaction).toHaveBeenCalledOnce()
    expect(createTransaction).toHaveBeenCalledWith(wallet.address, {
      params: {
        signer: 'api-key',
        chain: 'base',
        calls: [
          { ...approval, data: '0x01' },
          { ...action, data: '0x02', value: '3' },
        ],
      },
    })
    expect(calls).toEqual(['persist:tx-batch'])
    expect(result.transactionId).toBe('tx-batch')
  })

  test('returns a durable pending signal instead of allowing a duplicate retry', async () => {
    const wallet = {
      sendTransaction: vi.fn(async () => ({ transactionId: 'tx-pending' })),
      approve: vi.fn(async () => { throw new Error('timed out') }),
      transaction: vi.fn(async () => ({ id: 'tx-pending', status: 'pending' })),
    }

    await expect(prepareAndApproveCrossmintStep({
      wallet,
      step: { role: 'approval', transaction: approval },
      onPrepared: async () => undefined,
    })).rejects.toBeInstanceOf(CrossmintTransactionPendingError)
  })

  test('requires explicit role metadata instead of array-position inference', () => {
    expect(() => sugarTransactionSteps({ transactions: [approval, action] }))
      .toThrow('transaction_steps')
  })
})
