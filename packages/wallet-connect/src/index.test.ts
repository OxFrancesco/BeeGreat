import { describe, expect, test } from 'bun:test'

import {
  chainIdHex,
  sendFreshEoaTransactions,
  sendEoaTransactions,
  signWalletLink,
  weiHex,
  type Eip1193Provider,
} from './index'

const address = '0x1111111111111111111111111111111111111111'

describe('wallet connect client', () => {
  test('encodes chain ids and wei as EIP-1193 quantities', () => {
    expect(chainIdHex(8453)).toBe('0x2105')
    expect(weiHex('0')).toBe('0x0')
    expect(weiHex('1000000000000000')).toBe('0x38d7ea4c68000')
  })

  test('signs the exact wallet-link challenge', async () => {
    const requests: unknown[] = []
    const provider: Eip1193Provider = {
      async request(request) {
        requests.push(request)
        return '0xsigned' as never
      },
    }

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
    const provider: Eip1193Provider = {
      async request(request) {
        requests.push(request)
        if (request.method === 'eth_accounts') return [address] as never
        if (request.method === 'eth_sendTransaction') {
          const hash = hashes.shift()!
          receipts.set(hash, 0)
          return hash as never
        }
        if (request.method === 'eth_getTransactionReceipt') {
          const hash = (request.params as readonly string[])[0]
          const attempts = receipts.get(hash) ?? 0
          receipts.set(hash, attempts + 1)
          return (attempts === 0 ? null : { status: '0x1' }) as never
        }
        return null as never
      },
    }
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
    const provider: Eip1193Provider = {
      async request(request) {
        if (request.method === 'eth_accounts') return [address] as never
        if (request.method === 'eth_sendTransaction')
          return `0x${'aa'.repeat(32)}` as never
        if (request.method === 'eth_getTransactionReceipt')
          return { status: '0x0' } as never
        return null as never
      },
    }

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
    const provider: Eip1193Provider = {
      async request(request) {
        if (request.method === 'eth_accounts') return [address] as never
        if (request.method === 'eth_sendTransaction') {
          const data = (request.params as Array<{ data: string }>)[0].data
          sentData.push(data)
          return `0x${String(sentData.length).padStart(64, '0')}` as never
        }
        if (request.method === 'eth_getTransactionReceipt')
          return { status: '0x1' } as never
        return null as never
      },
    }

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
    const provider: Eip1193Provider = {
      async request(request) {
        if (request.method === 'eth_accounts') {
          return ['0x9999999999999999999999999999999999999999'] as never
        }
        return null as never
      },
    }

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
