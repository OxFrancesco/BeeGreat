import { describe, expect, test } from 'bun:test'

import {
  chainIdHex,
  sendFreshEoaTransactions,
  sendEoaTransactions,
  signWalletLink,
  weiHex,
  type Eip1193Provider,
  type Eip1193Request,
} from './index'

const address = '0x1111111111111111111111111111111111111111'

/** The concrete JSON-RPC results the wallet-connect client reads back. */
type WalletRpcResult = string | readonly string[] | { status?: string } | null

/**
 * Builds a faithful EIP-1193 fake. `Eip1193Provider.request<T>` lets each call
 * site pick its expected result type (EIP-1193 results depend on the JSON-RPC
 * method), so no concrete handler can satisfy the generic without one
 * assertion; it lives here so every test stays assertion-free.
 */
function providerOf(
  handle: (request: Eip1193Request) => WalletRpcResult,
): Eip1193Provider {
  // SAFETY: every request<T> call in ./index expects exactly the result its
  // JSON-RPC method defines — string signature/hash, string[] accounts,
  // receipt object, or null — and `handle` returns those per-method types,
  // so the caller-chosen T always matches the delivered value.
  return { request: async (request) => handle(request) } as Eip1193Provider
}

/** Reads the transaction hash the client sends as the only receipt-poll param. */
function requestedReceiptHash(request: Eip1193Request): string {
  const [hash] = Array.isArray(request.params) ? request.params : []
  return String(hash)
}

/** Reads the calldata the client sends inside the single transaction param. */
function sentTransactionData(request: Eip1193Request): string {
  // SAFETY: sendEoaTransactions and sendFreshEoaTransactions always send
  // eth_sendTransaction params as one { from, to, data, value } record built
  // in ./index, so the first param always carries the string calldata.
  const [transaction] = request.params as readonly [{ data: string }]
  return transaction.data
}

describe('wallet connect client', () => {
  test('encodes chain ids and wei as EIP-1193 quantities', () => {
    expect(chainIdHex(8453)).toBe('0x2105')
    expect(weiHex('0')).toBe('0x0')
    expect(weiHex('1000000000000000')).toBe('0x38d7ea4c68000')
  })

  test('signs the exact wallet-link challenge', async () => {
    const requests: Eip1193Request[] = []
    const provider = providerOf((request) => {
      requests.push(request)
      return '0xsigned'
    })

    await expect(
      signWalletLink(provider, address, 'Link BeeGreat'),
    ).resolves.toBe('0xsigned')
    expect(requests).toEqual([
      {
        method: 'personal_sign',
        params: ['Link BeeGreat', address],
      },
    ])
  })

  test('switches chain, verifies the account, and submits plans in order', async () => {
    const requests: Array<{
      method: string
      params?: readonly unknown[] | object
    }> = []
    const hashes = [`0x${'aa'.repeat(32)}`, `0x${'bb'.repeat(32)}`]
    const receipts = new Map<string, number>()
    const provider = providerOf((request) => {
      requests.push(request)
      if (request.method === 'eth_accounts') return [address]
      if (request.method === 'eth_sendTransaction') {
        const hash = hashes.shift()!
        receipts.set(hash, 0)
        return hash
      }
      if (request.method === 'eth_getTransactionReceipt') {
        const hash = requestedReceiptHash(request)
        const attempts = receipts.get(hash) ?? 0
        receipts.set(hash, attempts + 1)
        return attempts === 0 ? null : { status: '0x1' }
      }
      return null
    })
    const submitted: Array<{ index: number; hash: string }> = []
    const confirmed: Array<{ index: number; hash: string }> = []

    const result = await sendEoaTransactions({
      provider,
      address,
      chainId: 8453,
      transactions: [
        {
          to: '0x2222222222222222222222222222222222222222',
          data: '0x1234',
          value: '0',
        },
        {
          to: '0x3333333333333333333333333333333333333333',
          data: '0x',
          value: '16',
        },
      ],
      onSubmitted: (transaction) => {
        submitted.push(transaction)
      },
      onConfirmed: (transaction) => {
        confirmed.push(transaction)
      },
      receiptPolling: { intervalMs: 0, timeoutMs: 1_000 },
    })

    expect(result).toEqual(submitted)
    expect(confirmed).toEqual(submitted)
    expect(requests).toEqual([
      {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      },
      { method: 'eth_accounts' },
      {
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: '0x2222222222222222222222222222222222222222',
            data: '0x1234',
            value: '0x0',
          },
        ],
      },
      { method: 'eth_getTransactionReceipt', params: [`0x${'aa'.repeat(32)}`] },
      { method: 'eth_getTransactionReceipt', params: [`0x${'aa'.repeat(32)}`] },
      {
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: '0x3333333333333333333333333333333333333333',
            data: '0x',
            value: '0x10',
          },
        ],
      },
      { method: 'eth_getTransactionReceipt', params: [`0x${'bb'.repeat(32)}`] },
      { method: 'eth_getTransactionReceipt', params: [`0x${'bb'.repeat(32)}`] },
    ])
  })

  test('stops the plan when a submitted transaction reverts', async () => {
    const submitted: Array<{ index: number; hash: string }> = []
    const confirmed: Array<{ index: number; hash: string }> = []
    const provider = providerOf((request) => {
      if (request.method === 'eth_accounts') return [address]
      if (request.method === 'eth_sendTransaction') return `0x${'aa'.repeat(32)}`
      if (request.method === 'eth_getTransactionReceipt') {
        return { status: '0x0' }
      }
      return null
    })

    await expect(
      sendEoaTransactions({
        provider,
        address,
        chainId: 8453,
        transactions: [
          {
            to: '0x2222222222222222222222222222222222222222',
            data: '0x',
            value: '0',
          },
        ],
        onSubmitted: (transaction) => {
          submitted.push(transaction)
        },
        onConfirmed: (transaction) => {
          confirmed.push(transaction)
        },
        receiptPolling: { intervalMs: 0, timeoutMs: 1_000 },
      }),
    ).rejects.toThrow('reverted')
    expect(submitted).toHaveLength(1)
    expect(confirmed).toHaveLength(0)
  })

  test('rebuilds an EOA plan after approval before signing the final action', async () => {
    let builds = 0
    const sentData: string[] = []
    const provider = providerOf((request) => {
      if (request.method === 'eth_accounts') return [address]
      if (request.method === 'eth_sendTransaction') {
        sentData.push(sentTransactionData(request))
        return `0x${String(sentData.length).padStart(64, '0')}`
      }
      if (request.method === 'eth_getTransactionReceipt') {
        return { status: '0x1' }
      }
      return null
    })

    const result = await sendFreshEoaTransactions({
      provider,
      address,
      chainId: 8453,
      buildPlan: async () => {
        builds += 1
        return builds === 1
          ? [
              {
                role: 'approval' as const,
                transaction: { to: address, data: '0x01', value: '0' },
              },
              {
                role: 'action' as const,
                transaction: { to: address, data: '0x02', value: '0' },
              },
            ]
          : [
              {
                role: 'action' as const,
                transaction: { to: address, data: '0x03', value: '0' },
              },
            ]
      },
      receiptPolling: { intervalMs: 0, timeoutMs: 1_000 },
    })

    expect(builds).toBe(2)
    expect(sentData).toEqual(['0x01', '0x03'])
    expect(result.map(({ role }) => role)).toEqual(['approval', 'action'])
  })

  test('stops before signing when a different account is active', async () => {
    const provider = providerOf((request) =>
      request.method === 'eth_accounts'
        ? ['0x9999999999999999999999999999999999999999']
        : null,
    )

    await expect(
      sendEoaTransactions({
        provider,
        address,
        chainId: 1,
        transactions: [
          {
            to: '0x2222222222222222222222222222222222222222',
            data: '0x',
            value: '0',
          },
        ],
      }),
    ).rejects.toThrow('Connect the wallet shown')
  })
})
