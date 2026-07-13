import {
  concatHex,
  encodeAbiParameters,
  encodePacked,
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  pad,
  parseUnits,
  stringToHex,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import {
  ADDRESS_ZERO,
  MAX_ABS_TICK,
  NEW_SLIPSTREAM_FACTORY_BITMASK,
  OLD_SLIPSTREAM_FACTORY_BITMASK,
  QUOTER_STABLE_POOL_FILLER,
  QUOTER_VOLATILE_POOL_FILLER,
  type Amount,
  type IcaCall,
  type LiquidityPoolForSwap,
  type PathHop,
  type PreparedRoute,
  type Price,
  type SugarJson,
  type Token,
} from './types'

export function normalizeAddress(value: string): Address {
  if (!isAddress(value.toLowerCase())) throw new Error(`Invalid address: ${value}`)
  return getAddress(value.toLowerCase())
}

export function addressKey(value: string): string {
  return value.toLowerCase()
}

export function tokenContractAddress(token: Token): Address {
  return normalizeAddress(token.wrappedTokenAddress ?? token.tokenAddress)
}

export function tokenEquals(left: Token, right: Token): boolean {
  return left.chainId === right.chainId && addressKey(tokenContractAddress(left)) === addressKey(tokenContractAddress(right))
}

export function normalizeDecimal(value: string | number): string {
  const text = String(value).trim().toLowerCase()
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/.exec(text)
  if (!match) throw new Error(`Invalid decimal value: ${value}`)
  const sign = match[1]
  const integer = match[2] ?? '0'
  const fraction = match[3] ?? match[4] ?? ''
  const exponent = Number(match[5] ?? 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) throw new Error('decimal exponent is too large')
  const digits = `${integer}${fraction}`
  const point = integer.length + exponent
  let expanded: string
  if (point <= 0) expanded = `0.${'0'.repeat(-point)}${digits}`
  else if (point >= digits.length) expanded = `${digits}${'0'.repeat(point - digits.length)}`
  else expanded = `${digits.slice(0, point)}.${digits.slice(point)}`
  return `${sign}${expanded}`
}

export function parseTokenUnits(token: Token, value: string | number): bigint {
  return parseUnits(normalizeDecimal(value), token.decimals)
}

export function parseEther(value: string | number): bigint {
  return parseUnits(normalizeDecimal(value), 18)
}

export function floatToUint256(value: string | number, decimals = 18): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('decimals must be a non-negative integer')
  return parseUnits(normalizeDecimal(value), decimals)
}

export function getUniqueString(length: number): string {
  if (!Number.isInteger(length) || length < 1) throw new Error('length must be a positive integer')
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (value) => String(value % 10)).join('')
}

export function tokenToNumber(token: Token, value: bigint): number {
  return Number(formatUnits(value, token.decimals))
}

export function createAmount(
  address: string,
  amount: bigint,
  tokens: Map<string, Token>,
  prices: Map<string, Price>,
): Amount | undefined {
  const key = addressKey(address)
  const token = tokens.get(key)
  const price = prices.get(key)
  if (!token || !price) return undefined
  const decimal = tokenToNumber(token, amount)
  return { token, amount, price, decimal, amountInStable: decimal * price.price }
}

export function applySlippage(amount: bigint, slippage: number): bigint {
  if (!Number.isFinite(slippage) || slippage < 0 || slippage > 1) throw new Error('slippage must be between 0 and 1')
  const millionths = BigInt(Math.round((1 - slippage) * 1_000_000_000))
  const product = amount * millionths
  return (product + 999_999_999n) / 1_000_000_000n
}

export function futureTimestamp(minutes = 30): bigint {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('deadline minutes must be positive')
  return BigInt(Math.floor(Date.now() / 1000 + minutes * 60))
}

export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  if (!Number.isFinite(price) || price <= 0) throw new Error('price must be positive')
  return Math.floor(Math.log(price * 10 ** (decimals1 - decimals0)) / Math.log(1.0001))
}

export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return 1.0001 ** tick / 10 ** (decimals1 - decimals0)
}

export function nearestTick(tick: number, spacing: number): number {
  if (!Number.isInteger(spacing) || spacing <= 0) throw new Error('tick spacing must be positive')
  const scaled = tick / spacing
  const floor = Math.floor(scaled)
  const fraction = scaled - floor
  const nearest = fraction === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled)
  const rounded = nearest * spacing
  if (rounded < -MAX_ABS_TICK) return rounded + spacing
  if (rounded > MAX_ABS_TICK) return rounded - spacing
  return rounded
}

export function sqrtRatioX96FromPrice(price: number, decimals0: number, decimals1: number): bigint {
  const adjusted = price * 10 ** (decimals1 - decimals0)
  if (!Number.isFinite(adjusted) || adjusted <= 0) throw new Error('price is outside the supported numeric range')
  return BigInt(Math.floor(Math.sqrt(adjusted) * 2 ** 96))
}

export function poolTypeLabel(type: number): string {
  if (type > 0) return `cl-${type}`
  return type === 0 ? 'stable' : 'volatile'
}

export function poolSymbol(token0: Token, token1: Token, type: number): string {
  return type > 0 ? `CL${type}-${token0.symbol}/${token1.symbol}` : `${type === 0 ? 's' : 'v'}AMM-${token0.symbol}/${token1.symbol}`
}

export function packPath(
  path: PathHop[],
  options: { forSwap?: boolean; newFactory?: Address; oldFactory?: Address } = {},
): PreparedRoute {
  if (path.length === 0) throw new Error('route path cannot be empty')
  const types: string[] = []
  const values: Array<Address | number | boolean> = []
  const isV2Swap = options.forSwap === true && path.some(({ pool }) => pool.isBasic)
  for (let index = 0; index < path.length; index++) {
    const { pool, reversed } = path[index]
    const from = reversed ? pool.token1Address : pool.token0Address
    const to = reversed ? pool.token0Address : pool.token1Address
    let filler = pool.type === 0 ? QUOTER_STABLE_POOL_FILLER : pool.type === -1 ? QUOTER_VOLATILE_POOL_FILLER : pool.type
    if (pool.type > 0 && pool.factory && options.newFactory && addressKey(pool.factory) === addressKey(options.newFactory)) {
      filler |= NEW_SLIPSTREAM_FACTORY_BITMASK
    } else if (pool.type > 0 && pool.factory && options.oldFactory && addressKey(pool.factory) === addressKey(options.oldFactory)) {
      filler |= OLD_SLIPSTREAM_FACTORY_BITMASK
    }
    if (index === 0) {
      types.push('address')
      values.push(from)
    }
    types.push(isV2Swap ? 'bool' : 'int24', 'address')
    values.push(isV2Swap ? filler === QUOTER_STABLE_POOL_FILLER : filler, to)
  }
  const encoded = encodePacked(types as Array<'address' | 'int24' | 'bool'>, values)
  return { types, values, encoded }
}

type Pair = { token0: Address; token1: Address; pool: LiquidityPoolForSwap }

export function findAllPaths(
  pools: LiquidityPoolForSwap[],
  startToken: Address,
  endToken: Address,
  cutoff = 3,
): PathHop[][] {
  const pairs: Pair[] = pools.map((pool) => ({ token0: pool.token0Address, token1: pool.token1Address, pool }))
  const adjacency = new Map<string, Pair[]>()
  for (const pair of pairs) {
    for (const token of [pair.token0, pair.token1]) {
      const key = addressKey(token)
      const list = adjacency.get(key) ?? []
      list.push(pair)
      adjacency.set(key, list)
    }
  }
  const target = addressKey(endToken)
  const results: PathHop[][] = []
  const visit = (current: Address, path: PathHop[], visitedTokens: Set<string>) => {
    if (path.length >= cutoff) return
    for (const pair of adjacency.get(addressKey(current)) ?? []) {
      const currentKey = addressKey(current)
      const isForward = addressKey(pair.token0) === currentKey
      const isReverse = addressKey(pair.token1) === currentKey
      if (!isForward && !isReverse) continue
      const next = isForward ? pair.token1 : pair.token0
      const nextKey = addressKey(next)
      if (visitedTokens.has(nextKey)) continue
      const nextPath = [...path, { pool: pair.pool, reversed: isReverse }]
      if (nextKey === target) results.push(nextPath)
      else visit(next, nextPath, new Set([...visitedTokens, nextKey]))
    }
  }
  visit(startToken, [], new Set([addressKey(startToken)]))
  return results
}

export function tupleValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>)
  throw new Error('Expected tuple value from contract')
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error('chunk size must be positive')
  const output: T[][] = []
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size))
  return output
}

export async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker))
  return results
}

export function serializeIcaCalls(calls: IcaCall[]): Array<{ to: Address; value: string; data: Hex }> {
  return calls.map((call) => ({ ...call, value: call.value.toString() }))
}

export function hashIcaCalls(calls: IcaCall[], salt: Hex): Hex {
  const encoded = encodeAbiParameters(
    [{ type: 'tuple[]', components: [{ name: 'to', type: 'bytes32' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }] }],
    [calls],
  )
  return keccak256(concatHex([salt, encoded]))
}

export function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes)
}

export function getSalt(): Hex {
  return `0x${getUniqueString(64)}`
}

export class Timer {
  readonly name: string
  readonly precision: number
  private startedAt?: number
  elapsed?: number

  constructor(name = 'Operation', precision = 4) {
    this.name = name
    this.precision = precision
  }

  start(): this {
    this.startedAt = performance.now()
    this.elapsed = undefined
    return this
  }

  stop(): string {
    if (this.startedAt === undefined) throw new Error('timer has not been started')
    this.elapsed = (performance.now() - this.startedAt) / 1_000
    return `${this.name} took ${this.elapsed.toFixed(this.precision)} seconds`
  }
}

export async function timeIt<T>(
  operation: () => T | Promise<T>,
  options: { name?: string; precision?: number; callback?: (elapsed: number, message: string) => void | Promise<void> } = {},
): Promise<T> {
  const timer = new Timer(options.name, options.precision).start()
  try {
    return await operation()
  } finally {
    const message = timer.stop()
    if (options.callback) await options.callback(timer.elapsed!, message)
  }
}

export const atimeIt = timeIt

export async function requireSupersim(rpcUrl = 'http://127.0.0.1:4444'): Promise<void> {
  let response: Response
  try {
    response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(2_000),
    })
  } catch (error) {
    throw new Error(`Supersim is not reachable at ${rpcUrl}`, { cause: error })
  }
  if (!response.ok) throw new Error(`Supersim returned HTTP ${response.status} at ${rpcUrl}`)
}

/** Interpret a hex value/address as a left-padded bytes32, matching Python `to_bytes32`. */
export function toBytes32(value: string | number | bigint): Hex {
  const hex = typeof value === 'string'
    ? (`0x${value.replace(/^0x/, '')}` as Hex)
    : toHex(BigInt(value))
  return pad(hex, { size: 32 })
}

export const toBytes32String = toBytes32

export function amountToKString(amount: number): string {
  return `${Math.round(amount / 10) / 100}K`
}

export function amountToMString(amount: number): string {
  return `${Math.round(amount / 10_000) / 100}M`
}

export function formatCurrency(value: number, symbol = '$', prefix = true): string {
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return prefix ? `${symbol}${formatted}` : `${formatted} ${symbol}`
}

export function formatPercentage(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

export function stringToBytes32(value: string): Hex {
  const hex = stringToHex(value)
  if ((hex.length - 2) / 2 > 32) throw new Error('value exceeds bytes32')
  return concatHex([hex, `0x${'00'.repeat(32 - (hex.length - 2) / 2)}` as Hex])
}

export function toSugarJson(value: unknown): SugarJson {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(toSugarJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toSugarJson(item)]))
  }
  return String(value)
}
