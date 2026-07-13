export const SUGAR_ACTIONS = [
  'deposit',
  'positions',
  'pools',
  'epochs_latest',
  'epochs',
  'withdraw',
  'stake',
  'unstake',
  'claim_emissions',
  'claim_fees',
  'quote',
  'swap',
] as const

export type SugarAction = (typeof SUGAR_ACTIONS)[number]
export type SugarParameter = string | number | boolean
export type SugarParameters = Record<string, SugarParameter>

type ParameterKind =
  'address' | 'boolean' | 'integer_string' | 'number' | 'string'
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
      fraction: 'number',
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

const SUPPORTED_CHAINS = new Set([
  10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220, 57073,
])
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

  if (!SUPPORTED_CHAINS.has(output.chain as number)) {
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
  if (
    typeof output.fraction === 'number' &&
    (output.fraction <= 0 || output.fraction > 1)
  ) {
    throw new Error('fraction must be greater than 0 and at most 1')
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
  return output
}

/** Convert validated parameters to a shell-free argv array for Python Fire. */
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
