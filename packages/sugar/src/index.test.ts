import { describe, expect, test } from 'bun:test'
import { buildSugarArgv, validateSugarRequest } from './index'

describe('Sugar command boundary', () => {
  test('accepts every chain implemented by the pinned Sugar SDK', () => {
    for (const chain of [
      10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220, 57073,
    ]) {
      expect(validateSugarRequest('pools', { chain })).toEqual({ chain })
    }
  })

  test('creates shell-free CLI arguments', () => {
    const parameters = validateSugarRequest('quote', {
      chain: 8453,
      from_token: 'ETH',
      to_token: 'USDC',
      amount: '0.5',
      use_decimals: true,
    })

    expect(buildSugarArgv('sugar', 'quote', parameters)).toEqual([
      'sugar',
      'quote',
      '--chain=8453',
      '--from-token=ETH',
      '--to-token=USDC',
      '--amount=0.5',
      '--use-decimals=true',
    ])
  })

  test('rejects unknown flags before invoking the CLI', () => {
    expect(() =>
      validateSugarRequest('swap', {
        chain: 10,
        wallet: '0x1111111111111111111111111111111111111111',
        from_token: 'ETH',
        to_token: 'USDC',
        amount: '1',
        private_key: 'never',
      }),
    ).toThrow('Unsupported parameter for swap: private_key')
  })

  test('requires a valid owner for position reads', () => {
    expect(() => validateSugarRequest('positions', { chain: 1135 })).toThrow(
      'positions requires wallet or owner',
    )
    expect(() =>
      validateSugarRequest('positions', {
        chain: 1135,
        owner: 'not-an-address',
      }),
    ).toThrow('owner must be a 20-byte 0x address')
  })

  test('enforces bounded reads and rejects private-key-shaped string values', () => {
    expect(() =>
      validateSugarRequest('pools', { chain: 8453, limit: 101 }),
    ).toThrow('limit must be between 1 and 100')
    expect(() =>
      validateSugarRequest('quote', {
        chain: 8453,
        from_token: `0x${'a'.repeat(64)}`,
        to_token: 'USDC',
        amount: '1',
      }),
    ).toThrow('never private keys')
  })

  test('requires a position selector for position transactions', () => {
    expect(() =>
      validateSugarRequest('stake', {
        chain: 10,
        wallet: '0x1111111111111111111111111111111111111111',
      }),
    ).toThrow('stake requires pool or position')
  })

  test('preserves NFT position ids above JavaScript safe integer range', () => {
    const parameters = validateSugarRequest('claim_fees', {
      chain: 8453,
      wallet: '0x1111111111111111111111111111111111111111',
      position: '900719925474099312345',
    })

    expect(buildSugarArgv('sugar', 'claim_fees', parameters)).toContain(
      '--position=900719925474099312345',
    )
  })
})
