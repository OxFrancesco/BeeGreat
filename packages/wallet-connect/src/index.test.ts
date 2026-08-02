import { describe, expect, test } from 'bun:test'

import {
  chainIdHex,
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
    const provider: Eip1193Provider = {
      async request(request) {
        requests.push(request)
        if (request.method === 'eth_accounts') return [address] as never
        if (request.method === 'eth_sendTransaction') {
          return hashes.shift() as never
        }
        return null as never
      },
    }
    const submitted: Array<{ index: number; hash: string }> = []

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
    })

    expect(result).toEqual(submitted)
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
    ])
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
