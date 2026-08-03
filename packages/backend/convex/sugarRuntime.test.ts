import { describe, expect, test } from 'vitest'

import {
  normalizeSugarAgentParameters,
  sugarRuntimeEnvironment,
} from './sugarRuntime'

describe('Sugar runtime environment', () => {
  test('forwards the configured Base RPC without leaking unrelated secrets', () => {
    expect(
      sugarRuntimeEnvironment({
        SUGAR_RPC_URI_8453: ' https://base-rpc.example.test ',
        CROSSMINT_API_KEY: 'must-not-leak',
      }),
    ).toEqual({
      SUGAR_RPC_URI_8453: 'https://base-rpc.example.test',
    })
  })

  test('omits an empty Base RPC override', () => {
    expect(sugarRuntimeEnvironment({ SUGAR_RPC_URI_8453: '   ' })).toEqual({})
  })
})

describe('Sugar agent parameters', () => {
  test('normalizes exact boolean strings without changing other values', () => {
    const source = {
      use_decimals: 'true',
      collect: 'false',
      amount: '1.195095',
    }

    expect(normalizeSugarAgentParameters(source)).toEqual({
      use_decimals: true,
      collect: false,
      amount: '1.195095',
    })
    expect(source.use_decimals).toBe('true')
  })

  test('rejects ambiguous boolean strings', () => {
    expect(() =>
      normalizeSugarAgentParameters({ use_decimals: 'yes' }),
    ).toThrow('use_decimals must be a boolean')
  })

  test('coerces numeric strings for number parameters only', () => {
    expect(
      normalizeSugarAgentParameters({
        slippage: '0.5',
        deadline_minutes: ' 30 ',
        amount: '1.195095',
      }),
    ).toEqual({
      slippage: 0.5,
      deadline_minutes: 30,
      amount: '1.195095',
    })
  })

  test('rejects non-numeric strings for number parameters', () => {
    expect(() => normalizeSugarAgentParameters({ slippage: 'low' })).toThrow(
      'slippage must be a finite number',
    )
    expect(() => normalizeSugarAgentParameters({ slippage: '' })).toThrow(
      'slippage must be a finite number',
    )
  })
})
