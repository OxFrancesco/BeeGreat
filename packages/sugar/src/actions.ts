import type { Address } from 'viem'
import { SugarClient } from './client'
import type { SugarAction, SugarParameters } from './contracts'
import { applySlippage, parseTokenUnits, poolTypeLabel, toSugarJson, tokenToNumber } from './helpers'
import { withdrawalFromPosition } from './models'
import { validateSugarRequest } from './index'
import { ADDRESS_ZERO, type Amount, type LiquidityPool, type LiquidityPoolEpoch, type Position, type Quote, type SugarClientOptions, type SugarJson, type Token } from './types'

export type SugarExecutionOptions = SugarClientOptions & {
  clientFactory?: (chainId: number, options: SugarClientOptions) => SugarClient
}

const stringValue = (parameters: SugarParameters, name: string): string | undefined => parameters[name] === undefined ? undefined : String(parameters[name])
const numberValue = (parameters: SugarParameters, name: string): number | undefined => parameters[name] === undefined ? undefined : Number(parameters[name])
const booleanValue = (parameters: SugarParameters, name: string, fallback = false): boolean => parameters[name] === undefined ? fallback : Boolean(parameters[name])
const bigintValue = (parameters: SugarParameters, name: string): bigint | undefined => parameters[name] === undefined ? undefined : BigInt(String(parameters[name]))

function poolTypeMatches(type: number, requested?: string): boolean {
  return !requested || requested === 'cl' ? !requested || type > 0 : requested === 'stable' ? type === 0 : type === -1
}

function amountJson(amount?: Amount) {
  return amount ? { token: amount.token.symbol, address: amount.token.tokenAddress, amount: amount.decimal, amount_in_stable: amount.amountInStable } : null
}

function epochJson(epoch: LiquidityPoolEpoch) {
  return {
    ts: epoch.ts,
    epoch_date: epoch.epochDate,
    lp: epoch.lp,
    pool: epoch.pool ? {
      symbol: epoch.pool.symbol, type: epoch.pool.type, type_label: poolTypeLabel(epoch.pool.type),
      is_cl: epoch.pool.isCl, is_stable: epoch.pool.isStable, gauge: epoch.pool.gauge, gauge_alive: epoch.pool.gaugeAlive,
    } : null,
    votes: epoch.votes,
    emissions: epoch.emissions,
    total_fees: epoch.totalFees,
    total_incentives: epoch.totalIncentives,
    fees: epoch.fees.map(amountJson),
    incentives: epoch.incentives.map(amountJson),
  }
}

function positionJson(position: Position) {
  return {
    chain_id: position.chainId,
    chain_name: position.chainName,
    id: position.id,
    pool: {
      symbol: position.pool.symbol,
      lp: position.pool.lp,
      is_cl: position.pool.isCl,
      token0: { symbol: position.pool.token0.symbol, decimals: position.pool.token0.decimals },
      token1: { symbol: position.pool.token1.symbol, decimals: position.pool.token1.decimals },
    },
    liquidity: position.liquidity,
    staked: position.staked,
    amount_token0: position.amountToken0,
    amount_token1: position.amountToken1,
    staked_token0: position.stakedToken0,
    staked_token1: position.stakedToken1,
    unstaked_earned0: position.unstakedEarned0,
    unstaked_earned1: position.unstakedEarned1,
    emissions_earned: position.emissionsEarned,
    tick_lower: position.tickLower,
    tick_upper: position.tickUpper,
    sqrt_ratio_lower: position.sqrtRatioLower,
    sqrt_ratio_upper: position.sqrtRatioUpper,
    alm: position.alm,
  }
}

/** Compact pool context attached to transaction-building action outputs. */
function positionPoolJson(pool: LiquidityPool) {
  return {
    symbol: pool.symbol,
    lp: pool.lp,
    is_cl: pool.isCl,
    type_label: poolTypeLabel(pool.type),
    token0: pool.token0.symbol,
    token1: pool.token1.symbol,
  }
}

function poolJson(pool: LiquidityPool, full: true): unknown
function poolJson(pool: Awaited<ReturnType<SugarClient['getPoolsForSwaps']>>[number], full: false): unknown
function poolJson(pool: LiquidityPool | Awaited<ReturnType<SugarClient['getPoolsForSwaps']>>[number], full: boolean) {
  if (!full) {
    const item = pool as Awaited<ReturnType<SugarClient['getPoolsForSwaps']>>[number]
    return {
      chain_id: item.chainId, chain_name: item.chainName, lp: item.lp, type: item.type,
      token0_address: item.token0Address, token1_address: item.token1Address,
      factory: item.factory ?? null,
      is_cl: item.isCl, is_stable: item.isStable, type_label: poolTypeLabel(item.type),
    }
  }
  const item = pool as LiquidityPool
  return {
    chain_id: item.chainId, chain_name: item.chainName, lp: item.lp, symbol: item.symbol,
    type: item.type, type_label: poolTypeLabel(item.type), is_cl: item.isCl, is_stable: item.isStable,
    pool_fee: item.poolFee, tvl: item.tvl,
    token0: { symbol: item.token0.symbol, address: item.token0.tokenAddress, decimals: item.token0.decimals },
    token1: { symbol: item.token1.symbol, address: item.token1.tokenAddress, decimals: item.token1.decimals },
    reserve0: item.reserve0?.decimal ?? null, reserve1: item.reserve1?.decimal ?? null,
    gauge: item.gauge, gauge_alive: item.gaugeAlive, weekly_emissions: item.weeklyEmissions?.decimal ?? null,
  }
}

async function requireToken(client: SugarClient, reference: string | undefined, label: string): Promise<Token> {
  if (!reference) throw new Error(`${label} is required`)
  const token = await client.getToken(reference)
  if (!token) throw new Error(`${label} not found: ${reference}`)
  return token
}

async function findPosition(client: SugarClient, parameters: SugarParameters): Promise<Position> {
  const pool = stringValue(parameters, 'pool')?.toLowerCase()
  const position = stringValue(parameters, 'position')
  if (!pool && position === undefined) throw new Error('requires pool or position')
  const id = position === undefined ? 0n : BigInt(position)
  if (id === 0n && !pool) throw new Error('position=0 is ambiguous; pass pool too')
  const match = (await client.getPositions()).find((candidate) => candidate.id === id && (!pool || candidate.pool.lp.toLowerCase() === pool))
  if (!match) throw new Error('position not found')
  return match
}

function parseAmount(token: Token, value: string | undefined, useDecimals: boolean): bigint | undefined {
  if (value === undefined) return undefined
  return useDecimals ? parseTokenUnits(token, value) : BigInt(value)
}

async function quoteJson(client: SugarClient, quote: Quote) {
  let fromPrice: number | undefined
  let toPrice: number | undefined
  try {
    const [native, stable] = await Promise.all([client.getToken(client.settings.nativeTokenSymbol), client.getToken(client.settings.stableTokenAddress)])
    const tokens = [...new Map([quote.input.fromToken, quote.input.toToken, native, stable].filter((token): token is Token => token !== undefined).map((token) => [token.tokenAddress, token])).values()]
    const prices = new Map((await client.getPrices(tokens)).map((price) => [price.token.tokenAddress, price.price]))
    fromPrice = prices.get(quote.input.fromToken.tokenAddress)
    toPrice = prices.get(quote.input.toToken.tokenAddress)
  } catch { /* Price impact is optional. */ }
  const route = await Promise.all(quote.input.path.slice(0, -1).map(async ({ pool, reversed }) => {
    const address = reversed ? pool.token0Address : pool.token1Address
    const token = await client.getToken(address)
    return { symbol: token?.symbol ?? null, address, lp: pool.lp, type_label: poolTypeLabel(pool.type) }
  }))
  const amountInDecimal = tokenToNumber(quote.input.fromToken, quote.input.amountIn)
  const amountOutDecimal = tokenToNumber(quote.input.toToken, quote.amountOut)
  const expected = fromPrice && toPrice ? amountInDecimal * fromPrice / toPrice : undefined
  const impact = expected ? (expected - amountOutDecimal) / expected : undefined
  return {
    from_token: { symbol: quote.input.fromToken.symbol, address: quote.input.fromToken.tokenAddress, decimals: quote.input.fromToken.decimals },
    to_token: { symbol: quote.input.toToken.symbol, address: quote.input.toToken.tokenAddress, decimals: quote.input.toToken.decimals },
    amount_in: quote.input.amountIn, amount_out: quote.amountOut,
    amount_in_decimal: amountInDecimal, amount_out_decimal: amountOutDecimal,
    price: amountInDecimal ? amountOutDecimal / amountInDecimal : 0,
    from_price_usd: fromPrice ?? null, to_price_usd: toPrice ?? null,
    price_impact: impact ?? null, price_impact_pct: impact === undefined ? null : impact * 100,
    route,
  }
}

/**
 * Guard candidate routes against outputs more than double the on-chain
 * oracle's expectation. A simulated quote that far above fair value is a
 * honeypot signal (the pool quotes well but the transfer rugs at execution),
 * mirroring the official sdk.js impactTooHigh rejection. Skipped for
 * unlisted tokens, where the oracle has no reliable rate.
 */
async function tooGoodToBeTrueFilter(
  client: SugarClient,
  fromToken: Token,
  toToken: Token,
  amount: bigint,
): Promise<((quote: Quote) => boolean) | undefined> {
  if (!fromToken.listed || !toToken.listed) return undefined
  let fromPrice: number | undefined
  let toPrice: number | undefined
  try {
    const prices = await client.getPrices([fromToken, toToken])
    fromPrice = prices.find((price) => price.token.tokenAddress === fromToken.tokenAddress)?.price
    toPrice = prices.find((price) => price.token.tokenAddress === toToken.tokenAddress)?.price
  } catch {
    return undefined
  }
  if (!fromPrice || !toPrice) return undefined
  const ceiling = 2 * tokenToNumber(fromToken, amount) * (fromPrice / toPrice)
  if (!Number.isFinite(ceiling) || ceiling <= 0) return undefined
  return (quote) => tokenToNumber(toToken, quote.amountOut) < ceiling
}

async function resolveSwapQuote(client: SugarClient, parameters: SugarParameters): Promise<Quote> {
  const fromToken = await requireToken(client, stringValue(parameters, 'from_token'), 'from-token')
  const toToken = await requireToken(client, stringValue(parameters, 'to_token'), 'to-token')
  const raw = stringValue(parameters, 'amount')!
  const amount = booleanValue(parameters, 'use_decimals') ? parseTokenUnits(fromToken, raw) : BigInt(raw)
  const filter = await tooGoodToBeTrueFilter(client, fromToken, toToken, amount)
  const quote = await client.getQuote(fromToken, toToken, amount, filter)
  if (!quote) throw new Error(`no quote found for ${fromToken.symbol} -> ${toToken.symbol}`)
  return quote
}

async function execute(client: SugarClient, action: SugarAction, p: SugarParameters): Promise<unknown> {
  if (action === 'positions') return (await client.getPositions((stringValue(p, 'owner') ?? stringValue(p, 'wallet')) as Address)).map(positionJson)
  if (action === 'pools') {
    const full = booleanValue(p, 'full')
    const token0 = stringValue(p, 'token0') ? await requireToken(client, stringValue(p, 'token0'), 'token') : undefined
    const token1 = stringValue(p, 'token1') ? await requireToken(client, stringValue(p, 'token1'), 'token') : undefined
    const wanted = new Set([token0, token1].filter((token): token is Token => token !== undefined).map((token) => token.tokenAddress.toLowerCase()))
    const pools = full ? await client.getPools() : await client.getPoolsForSwaps()
    const filtered = pools.filter((pool) => {
      const addresses = 'token0' in pool ? [pool.token0.tokenAddress, pool.token1.tokenAddress] : [pool.token0Address, pool.token1Address]
      return [...wanted].every((address) => addresses.map((item) => item.toLowerCase()).includes(address)) && poolTypeMatches(pool.type, stringValue(p, 'pool_type'))
    })
    const limited = p.limit === undefined ? filtered : filtered.slice(0, Number(p.limit))
    return full ? (limited as LiquidityPool[]).map((pool) => poolJson(pool, true)) : (limited as Awaited<ReturnType<SugarClient['getPoolsForSwaps']>>).map((pool) => poolJson(pool, false))
  }
  if (action === 'epochs_latest') return (await client.getLatestPoolEpochs()).filter((epoch) => epoch.pool && poolTypeMatches(epoch.pool.type, stringValue(p, 'pool_type'))).map(epochJson)
  if (action === 'epochs') return (await client.getPoolEpochs(stringValue(p, 'lp')!, numberValue(p, 'offset') ?? 0, numberValue(p, 'limit') ?? 10)).filter((epoch) => !epoch.pool || poolTypeMatches(epoch.pool.type, stringValue(p, 'pool_type'))).map(epochJson)
  if (action === 'quote') return quoteJson(client, await resolveSwapQuote(client, p))
  if (action === 'swap') {
    const quote = await resolveSwapQuote(client, p)
    const slippage = numberValue(p, 'slippage') ?? client.settings.swapSlippage
    const transactions = await client.swapFromQuote(quote, slippage)
    const minAmountOut = applySlippage(quote.amountOut, slippage)
    return {
      transactions,
      quote: {
        ...(await quoteJson(client, quote)),
        slippage,
        min_amount_out: minAmountOut,
        min_amount_out_decimal: tokenToNumber(quote.input.toToken, minAmountOut),
      },
    }
  }

  if (action === 'deposit') {
    let pool: LiquidityPool
    const poolAddress = stringValue(p, 'pool')
    if (poolAddress) {
      pool = (await client.getPoolByAddress(poolAddress))!
      if (!pool) throw new Error(`pool ${poolAddress} not found`)
    } else {
      const token0 = await requireToken(client, stringValue(p, 'token0'), 'token0')
      const token1 = await requireToken(client, stringValue(p, 'token1'), 'token1')
      const poolType = stringValue(p, 'pool_type')
      pool = await client.poolSpec(token0, token1, poolType === 'cl' ? { tickSpacing: numberValue(p, 'tick_spacing') } : { stable: poolType === 'stable' })
    }
    const useDecimals = booleanValue(p, 'use_decimals')
    const amountToken0 = parseAmount(pool.token0, stringValue(p, 'amount0'), useDecimals)
    const amountToken1 = parseAmount(pool.token1, stringValue(p, 'amount1'), useDecimals)
    const clOnly = ['price_lower', 'price_upper', 'tick_lower', 'tick_upper', 'initial_price']
      .some((name) => p[name] !== undefined)
    if (!pool.isCl && clOnly) throw new Error('basic deposits do not accept CL flags')
    let quote
    if (pool.isCl) quote = await client.quoteConcentratedDeposit(pool, {
      amountToken0, amountToken1, priceLower: numberValue(p, 'price_lower'), priceUpper: numberValue(p, 'price_upper'),
      tickLower: numberValue(p, 'tick_lower'), tickUpper: numberValue(p, 'tick_upper'), initialPrice: numberValue(p, 'initial_price'),
    })
    else if (pool.lp === ADDRESS_ZERO) {
      if (amountToken0 === undefined || amountToken1 === undefined) throw new Error('new basic pool requires both amounts')
      quote = { pool, amountToken0, amountToken1, sqrtPriceX96: 0n }
    } else quote = await client.quoteBasicDeposit(pool, { amountToken0, amountToken1 })
    const transactions = await client.deposit(quote, numberValue(p, 'deadline_minutes') ?? 30, numberValue(p, 'slippage') ?? 0.01)
    return {
      transactions,
      deposit: {
        pool: positionPoolJson(pool),
        creates_pool: pool.lp === ADDRESS_ZERO,
        amount0: quote.amountToken0,
        amount0_decimal: tokenToNumber(pool.token0, quote.amountToken0),
        amount1: quote.amountToken1,
        amount1_decimal: tokenToNumber(pool.token1, quote.amountToken1),
        tick_lower: quote.tickLower ?? null,
        tick_upper: quote.tickUpper ?? null,
      },
    }
  }

  const position = await findPosition(client, p)
  if (action === 'withdraw') {
    const withdrawal = withdrawalFromPosition(position, { fraction: stringValue(p, 'fraction'), burn: booleanValue(p, 'burn') })
    const transactions = await client.withdraw(withdrawal, numberValue(p, 'deadline_minutes') ?? 30, numberValue(p, 'slippage') ?? 0.01, booleanValue(p, 'collect', true), booleanValue(p, 'unwrap_native'))
    return {
      transactions,
      withdrawal: {
        pool: positionPoolJson(position.pool),
        position: position.id,
        liquidity: withdrawal.liquidity,
        amount0: withdrawal.amountToken0,
        amount0_decimal: tokenToNumber(position.pool.token0, withdrawal.amountToken0),
        amount1: withdrawal.amountToken1,
        amount1_decimal: tokenToNumber(position.pool.token1, withdrawal.amountToken1),
        burn: withdrawal.burn,
      },
    }
  }
  const context = { position: { id: position.id, pool: positionPoolJson(position.pool) } }
  if (action === 'stake') return { transactions: await client.stake(position), ...context }
  if (action === 'unstake') return { transactions: await client.unstake(position, bigintValue(p, 'amount')), ...context }
  if (action === 'claim_emissions') return { transactions: await client.claimEmissions(position), ...context }
  return { transactions: await client.claimFees(position, booleanValue(p, 'burn'), booleanValue(p, 'unwrap_native')), ...context }
}

export async function executeSugarAction(action: SugarAction, rawParameters: unknown, options: SugarExecutionOptions = {}): Promise<SugarJson> {
  const parameters = validateSugarRequest(action, rawParameters)
  const { clientFactory = (chainId, clientOptions) => new SugarClient(chainId, clientOptions), ...clientOptions } = options
  const client = clientFactory(Number(parameters.chain), {
    ...clientOptions,
    account: (stringValue(parameters, 'wallet') as Address | undefined) ?? clientOptions.account,
  })
  return toSugarJson(await execute(client, action, parameters))
}

export async function executeSugarActionJson(action: SugarAction, parameters: unknown, options: SugarExecutionOptions = {}): Promise<string> {
  return JSON.stringify(await executeSugarAction(action, parameters, options), null, 2)
}
