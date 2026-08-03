import { isSupportedChainId } from './config'
import {
  SUGAR_ACTIONS,
  type SugarAction,
  type SugarParameter,
  type SugarParameters,
} from './contracts'

export {
  isSugarAction,
  SUGAR_ACTIONS,
  type SugarAction,
  type SugarParameter,
  type SugarParameters,
} from './contracts'

type ParameterKind =
  'address' | 'boolean' | 'decimal_string' | 'integer_string' | 'number' | 'string'
type ActionSpec = {
  allowed: Readonly<Record<string, ParameterKind>>
  required: readonly string[]
}

const COMMON_POSITION = {
  chain: 'number',
  wallet: 'address',
  pool: 'address',
  position: 'integer_string',
} as const

const ACTION_SPECS: Record<SugarAction, ActionSpec> = {
  deposit: {
    required: ['chain', 'wallet'],
    allowed: {
      chain: 'number',
      wallet: 'address',
      pool: 'address',
      token0: 'string',
      token1: 'string',
      pool_type: 'string',
      tick_spacing: 'number',
      amount0: 'string',
      amount1: 'string',
      price_lower: 'number',
      price_upper: 'number',
      tick_lower: 'number',
      tick_upper: 'number',
      initial_price: 'number',
      slippage: 'number',
      deadline_minutes: 'number',
      use_decimals: 'boolean',
    },
  },
  positions: {
    required: ['chain'],
    allowed: { chain: 'number', wallet: 'address', owner: 'address' },
  },
  pools: {
    required: ['chain'],
    allowed: {
      chain: 'number',
      token0: 'string',
      token1: 'string',
      pool_type: 'string',
      full: 'boolean',
      limit: 'number',
    },
  },
  epochs_latest: {
    required: ['chain'],
    allowed: { chain: 'number', pool_type: 'string' },
  },
  epochs: {
    required: ['chain', 'lp'],
    allowed: {
      chain: 'number',
      lp: 'address',
      pool_type: 'string',
      limit: 'number',
      offset: 'number',
    },
  },
  withdraw: {
    required: ['chain', 'wallet'],
    allowed: {
      ...COMMON_POSITION,
      fraction: 'decimal_string',
      burn: 'boolean',
      collect: 'boolean',
      unwrap_native: 'boolean',
      slippage: 'number',
      deadline_minutes: 'number',
    },
  },
  stake: { required: ['chain', 'wallet'], allowed: COMMON_POSITION },
  unstake: {
    required: ['chain', 'wallet'],
    allowed: { ...COMMON_POSITION, amount: 'string' },
  },
  claim_emissions: { required: ['chain', 'wallet'], allowed: COMMON_POSITION },
  claim_fees: {
    required: ['chain', 'wallet'],
    allowed: {
      ...COMMON_POSITION,
      burn: 'boolean',
      unwrap_native: 'boolean',
    },
  },
  quote: {
    required: ['chain', 'from_token', 'to_token', 'amount'],
    allowed: {
      chain: 'number',
      from_token: 'string',
      to_token: 'string',
      amount: 'string',
      use_decimals: 'boolean',
    },
  },
  swap: {
    required: ['chain', 'wallet', 'from_token', 'to_token', 'amount'],
    allowed: {
      chain: 'number',
      wallet: 'address',
      from_token: 'string',
      to_token: 'string',
      amount: 'string',
      slippage: 'number',
      use_decimals: 'boolean',
    },
  },
}

const POOL_TYPES = new Set(['cl', 'stable', 'volatile'])
const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const PRIVATE_KEY_SHAPED = /^0x[0-9a-fA-F]{64}$/
const INTEGER_PARAMETERS = new Set([
  'chain',
  'limit',
  'offset',
  'tick_lower',
  'tick_spacing',
  'tick_upper',
])
const POSITION_ACTIONS = new Set<SugarAction>([
  'withdraw',
  'stake',
  'unstake',
  'claim_emissions',
  'claim_fees',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateParameter(
  name: string,
  kind: ParameterKind,
  value: unknown,
): SugarParameter {
  if (kind === 'address') {
    if (typeof value !== 'string' || !ADDRESS.test(value)) {
      throw new Error(`${name} must be a 20-byte 0x address`)
    }
    return value
  }
  if (kind === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`)
    return value
  }
  if (kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${name} must be a finite number`)
    }
    return value
  }
  if (kind === 'decimal_string') {
    const text = typeof value === 'number' ? String(value) : value
    if (typeof text !== 'string' || text.length > 1_024 || !/^\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(text)) {
      throw new Error(`${name} must be a decimal number`)
    }
    const number = Number(text)
    if (!Number.isFinite(number)) throw new Error(`${name} must be a finite decimal number`)
    return text
  }
  if (kind === 'integer_string') {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new Error(`${name} must be a non-negative decimal integer string`)
    }
    return value
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
    throw new Error(
      `${name} must be a non-empty string of at most 256 characters`,
    )
  }
  if (PRIVATE_KEY_SHAPED.test(value)) {
    throw new Error('Sugar accepts public addresses only, never private keys')
  }
  return value
}

/** Validate the shared boundary before arguments can reach the Sugar CLI. */
export function validateSugarRequest(
  action: SugarAction,
  raw: unknown,
): SugarParameters {
  if (!SUGAR_ACTIONS.includes(action))
    throw new Error(`Unsupported Sugar action: ${action}`)
  if (!isRecord(raw)) throw new Error('Sugar parameters must be an object')

  const spec = ACTION_SPECS[action]
  const output: SugarParameters = {}
  for (const [name, value] of Object.entries(raw)) {
    const kind = spec.allowed[name]
    if (!kind) throw new Error(`Unsupported parameter for ${action}: ${name}`)
    if (value !== undefined && value !== null)
      output[name] = validateParameter(name, kind, value)
  }
  for (const name of spec.required) {
    if (!(name in output)) throw new Error(`${action} requires ${name}`)
  }

  if (!isSupportedChainId(output.chain as number)) {
    throw new Error(
      'chain must be one of 10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220, or 57073',
    )
  }
  for (const name of INTEGER_PARAMETERS) {
    const value = output[name]
    if (value !== undefined && !Number.isInteger(value)) {
      throw new Error(`${name} must be an integer`)
    }
  }
  if (
    typeof output.limit === 'number' &&
    (output.limit < 1 || output.limit > 100)
  ) {
    throw new Error('limit must be between 1 and 100')
  }
  if (typeof output.offset === 'number' && output.offset < 0) {
    throw new Error('offset must not be negative')
  }
  if (
    typeof output.slippage === 'number' &&
    (output.slippage < 0 || output.slippage > 1)
  ) {
    throw new Error('slippage must be between 0 and 1')
  }
  if (output.fraction !== undefined) {
    const fraction = Number(output.fraction)
    if (fraction <= 0 || fraction > 1) throw new Error('fraction must be greater than 0 and at most 1')
  }
  if (
    typeof output.deadline_minutes === 'number' &&
    output.deadline_minutes <= 0
  ) {
    throw new Error('deadline_minutes must be positive')
  }
  const poolType = output.pool_type
  if (poolType !== undefined && !POOL_TYPES.has(poolType as string)) {
    throw new Error('pool_type must be cl, stable, or volatile')
  }
  if (
    action === 'positions' &&
    output.wallet === undefined &&
    output.owner === undefined
  ) {
    throw new Error('positions requires wallet or owner')
  }
  if (
    POSITION_ACTIONS.has(action) &&
    output.pool === undefined &&
    output.position === undefined
  ) {
    throw new Error(`${action} requires pool or position`)
  }
  if (action === 'deposit') {
    const creationFields = ['token0', 'token1', 'pool_type', 'tick_spacing']
    if (output.pool !== undefined && creationFields.some((name) => output[name] !== undefined)) {
      throw new Error('deposit pool cannot be combined with token0, token1, pool_type, or tick_spacing')
    }
    if (output.pool === undefined) {
      if (output.token0 === undefined || output.token1 === undefined || output.pool_type === undefined) {
        throw new Error('new deposit pool requires token0, token1, and pool_type')
      }
      if (output.pool_type === 'cl' && output.tick_spacing === undefined) {
        throw new Error('CL deposit pool requires tick_spacing')
      }
      if (output.pool_type !== 'cl' && output.tick_spacing !== undefined) {
        throw new Error('tick_spacing is CL-only')
      }
    }
  }
  return output
}

/** @deprecated Compatibility helper for callers migrating from the former Python bridge. */
export function buildSugarArgv(
  executable: string,
  action: SugarAction,
  parameters: SugarParameters,
) {
  const command = action.replaceAll('_', '-')
  const flags = Object.entries(parameters).map(
    ([name, value]) => `--${name.replaceAll('_', '-')}=${String(value)}`,
  )
  return [executable, command, ...flags]
}

export { SugarClient, createSugarClient } from './client'
export { createSugarCacheStore, type SugarCacheStoreOptions } from './cache'
export { createSugarFailoverTransport, type SugarFailoverTransportOptions } from './transport'
export { SugarRpcError, type SugarRpcErrorCode } from './errors'
export { executeSugarAction, executeSugarActionJson, type SugarExecutionOptions } from './actions'
export { abis } from './abis'
export * from './config'
export * from './chains'
export * from './helpers'
export * from './models'
export * from './known-tokens'
export * from './planner'
export * from './superswap'
export * from './types'
