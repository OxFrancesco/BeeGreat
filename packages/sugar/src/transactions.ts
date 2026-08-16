import { pad, type Address, type Hex } from 'viem'
import { abis } from './abis'
import {
  addressKey,
  applySlippage,
  futureTimestamp,
  nearestTick,
  normalizeAddress,
  priceToTick,
  sqrtRatioX96FromPrice,
  tokenContractAddress,
  tupleValues,
} from './helpers'
import type { SugarContext } from './internal/context'
import { createPoolSpec, validateDepositQuote } from './models'
import { setupPlanner } from './planner'
import {
  ADDRESS_ZERO,
  MAX_UINT128,
  type DepositQuote,
  type LiquidityPool,
  type Position,
  type Quote,
  type Token,
  type UnsignedTransaction,
  type Withdrawal,
} from './types'

const MAX_UINT160 = (1n << 160n) - 1n
const PERMIT2_APPROVAL_MINUTES = 30
const PERMIT2_VALIDITY_BUFFER_MINUTES = 10

export async function getBridgeFee(ctx: SugarContext, domain: number): Promise<bigint> {
  return ctx.read(ctx.settings.bridgeContractAddress, abis.bridgeGetFee, 'quoteGasPayment', [domain])
}

export async function checkTokenAllowance(ctx: SugarContext, token: Token, spender: Address): Promise<bigint> {
  return ctx.read(tokenContractAddress(token), abis.erc20, 'allowance', [ctx.signer(), spender])
}

export async function setTokenAllowance(ctx: SugarContext, token: Token, spender: Address, amount: bigint): Promise<UnsignedTransaction | undefined> {
  return approveAddressIfNeeded(ctx, tokenContractAddress(token), spender, amount)
}

export async function revokeTokenAllowance(
  ctx: SugarContext,
  token: Token,
  spender: Address,
): Promise<UnsignedTransaction[]> {
  const tokenAddress = tokenContractAddress(token)
  const allowance = await ctx.read<bigint>(
    tokenAddress,
    abis.erc20,
    'allowance',
    [ctx.signer(), spender],
  )
  return allowance === 0n
    ? []
    : [ctx.tx(tokenAddress, ctx.encode(abis.erc20, 'approve', [spender, 0n]))]
}

export async function revokePermit2Allowance(ctx: SugarContext, token: Token): Promise<UnsignedTransaction[]> {
  if (token.wrappedTokenAddress) return []
  const tokenAddress = tokenContractAddress(token)
  const permit2 = await getPermit2Address(ctx)
  const [tokenAllowance, permit2Allowance] = await Promise.all([
    ctx.read<bigint>(tokenAddress, abis.erc20, 'allowance', [ctx.signer(), permit2]),
    ctx.read<readonly [bigint, bigint, bigint]>(permit2, abis.permit2, 'allowance', [
      ctx.signer(), tokenAddress, ctx.settings.swapperContractAddress,
    ]),
  ])
  const transactions: UnsignedTransaction[] = []
  if (tokenAllowance > 0n) {
    transactions.push(
      ctx.tx(tokenAddress, ctx.encode(abis.erc20, 'approve', [permit2, 0n])),
    )
  }
  // Permit2 stores an expiration even after amount is cleared (an input of
  // zero may be normalized to the current block timestamp). Only a non-zero
  // spendable amount needs another revocation transaction.
  if (permit2Allowance[0] > 0n) {
    transactions.push(
      ctx.tx(permit2, ctx.encode(abis.permit2, 'approve', [
        tokenAddress,
        ctx.settings.swapperContractAddress,
        0n,
        0,
      ])),
    )
  }
  return transactions
}

export async function bridge(ctx: SugarContext, fromToken: Token, amount: bigint, domain: number): Promise<UnsignedTransaction[]> {
  const approval = await ctx.client.setTokenAllowance(fromToken, ctx.settings.bridgeContractAddress, amount)
  const transfer = ctx.tx(ctx.settings.bridgeContractAddress, ctx.encode(abis.bridgeTransferRemote, 'transferRemote', [
    domain, pad(ctx.signer(), { size: 32 }), amount,
  ]), await ctx.client.getBridgeFee(domain))
  return [approval, transfer].filter((tx): tx is UnsignedTransaction => tx !== undefined)
}

export async function swap(ctx: SugarContext, fromToken: Token, toToken: Token, amount: bigint, slippage?: number): Promise<UnsignedTransaction[]> {
  const quote = await ctx.client.getQuote(fromToken, toToken, amount)
  if (!quote) throw new Error('No quotes found')
  return ctx.client.swapFromQuote(quote, slippage)
}

export async function swapFromQuote(ctx: SugarContext, quote: Quote, slippage = ctx.settings.swapSlippage): Promise<UnsignedTransaction[]> {
  const plan = setupPlanner(quote, slippage, ctx.signer(), ctx.settings.swapperContractAddress, {
    newFactory: ctx.settings.slipstreamFactoryAddress,
    oldFactory: ctx.settings.oldSlipstreamFactoryAddress,
  })
  const main = ctx.tx(ctx.settings.swapperContractAddress, ctx.encode(abis.swapper, 'execute', [plan.commands, plan.inputs]), quote.input.fromToken.wrappedTokenAddress ? quote.input.amountIn : 0n)
  if (quote.input.fromToken.wrappedTokenAddress) return [main]
  const approvals = await permit2Approvals(ctx, quote.input.fromToken, quote.input.amountIn)
  return [...approvals, main]
}

function getPermit2Address(ctx: SugarContext): Promise<Address> {
  if (!ctx.caches.permit2AddressCache) {
    const promise = ctx.read<Address>(ctx.settings.swapperContractAddress, abis.swapper, 'PERMIT2')
    ctx.caches.permit2AddressCache = promise
    void promise.catch(() => {
      if (ctx.caches.permit2AddressCache === promise) ctx.caches.permit2AddressCache = undefined
    })
  }
  return ctx.caches.permit2AddressCache
}

async function permit2Approvals(ctx: SugarContext, token: Token, amount: bigint): Promise<UnsignedTransaction[]> {
  if (amount > MAX_UINT160) throw new RangeError('Permit2 swap amount exceeds uint160')
  const tokenAddress = tokenContractAddress(token)
  const spender = ctx.settings.swapperContractAddress
  const permit2 = await getPermit2Address(ctx)
  const [tokenAllowance, permit2Allowance] = await Promise.all([
    ctx.read<bigint>(tokenAddress, abis.erc20, 'allowance', [ctx.signer(), permit2]),
    ctx.read<readonly [bigint, bigint, bigint]>(permit2, abis.permit2, 'allowance', [
      ctx.signer(), tokenAddress, spender,
    ]),
  ])
  const tokenApproval = tokenAllowance >= amount
    ? undefined
    : ctx.tx(tokenAddress, ctx.encode(abis.erc20, 'approve', [permit2, amount]))
  const [permit2Amount, permit2Expiration] = permit2Allowance
  const permit2Approval = permit2Amount >= amount &&
    permit2Expiration > futureTimestamp(PERMIT2_VALIDITY_BUFFER_MINUTES)
    ? undefined
    : ctx.tx(permit2, ctx.encode(abis.permit2, 'approve', [
      tokenAddress, spender, amount, futureTimestamp(PERMIT2_APPROVAL_MINUTES),
    ]))
  return [tokenApproval, permit2Approval].filter(
    (transaction): transaction is UnsignedTransaction => transaction !== undefined,
  )
}

export async function poolSpec(ctx: SugarContext, token0: Token, token1: Token, options: { tickSpacing?: number; stable?: boolean }): Promise<LiquidityPool> {
  const basicFactoryAddress = options.stable === undefined ? undefined : await ctx.read<Address>(ctx.settings.routerContractAddress, abis.router, 'defaultFactory')
  return createPoolSpec(ctx.settings, token0, token1, { ...options, basicFactoryAddress })
}

export async function quoteBasicDeposit(ctx: SugarContext, pool: LiquidityPool, amounts: { amountToken0?: bigint; amountToken1?: bigint }): Promise<DepositQuote> {
  if (pool.isCl) throw new Error('quoteBasicDeposit requires a basic pool')
  if (pool.lp === ADDRESS_ZERO) {
    if (amounts.amountToken0 === undefined || amounts.amountToken1 === undefined) throw new Error('new basic pool requires both amounts')
    return validateDepositQuote({ pool, amountToken0: amounts.amountToken0, amountToken1: amounts.amountToken1, sqrtPriceX96: 0n })
  }
  if ((amounts.amountToken0 === undefined) === (amounts.amountToken1 === undefined)) throw new Error('supply exactly one amount')
  const result = await ctx.read<unknown>(ctx.settings.routerContractAddress, abis.router, 'quoteAddLiquidity', [
    normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable, pool.factory,
    amounts.amountToken0 ?? MAX_UINT128, amounts.amountToken1 ?? MAX_UINT128,
  ])
  const [amountToken0, amountToken1] = tupleValues(result)
  return validateDepositQuote({ pool, amountToken0: BigInt(amountToken0 as bigint), amountToken1: BigInt(amountToken1 as bigint), sqrtPriceX96: 0n })
}

export async function quoteConcentratedDeposit(ctx: SugarContext, pool: LiquidityPool, options: {
  priceLower?: number; priceUpper?: number; tickLower?: number; tickUpper?: number
  amountToken0?: bigint; amountToken1?: bigint; initialPrice?: number
}): Promise<DepositQuote> {
  if (!pool.isCl) throw new Error('quoteConcentratedDeposit requires a CL pool')
  if ((options.amountToken0 === undefined) === (options.amountToken1 === undefined)) throw new Error('supply exactly one amount')
  const hasPrice = options.priceLower !== undefined || options.priceUpper !== undefined
  const hasTick = options.tickLower !== undefined || options.tickUpper !== undefined
  if (hasPrice === hasTick) throw new Error('supply price range XOR tick range')
  let tickLower: number
  let tickUpper: number
  if (hasTick) {
    if (options.tickLower === undefined || options.tickUpper === undefined) throw new Error('supply both tick bounds')
    ;({ tickLower, tickUpper } = options as { tickLower: number; tickUpper: number })
  } else {
    if (options.priceLower === undefined || options.priceUpper === undefined) throw new Error('supply both price bounds')
    tickLower = nearestTick(priceToTick(options.priceLower, pool.token0.decimals, pool.token1.decimals), pool.type)
    tickUpper = nearestTick(priceToTick(options.priceUpper, pool.token0.decimals, pool.token1.decimals), pool.type)
  }
  let sqrtRatio = pool.sqrtRatio
  let sqrtPriceX96 = 0n
  if (sqrtRatio === 0n) {
    if (options.initialPrice === undefined) throw new Error('uninitialized pool requires initialPrice')
    sqrtRatio = sqrtRatioX96FromPrice(options.initialPrice, pool.token0.decimals, pool.token1.decimals)
    sqrtPriceX96 = sqrtRatio
  } else if (options.initialPrice !== undefined) throw new Error('initialPrice only applies to uninitialized pools')
  if (options.amountToken0 !== undefined) {
    const amountToken1 = await ctx.read<bigint>(ctx.settings.slipstreamContractAddress, abis.slipstream, 'estimateAmount1', [options.amountToken0, pool.lp, sqrtRatio, tickLower, tickUpper])
    return validateDepositQuote({ pool, amountToken0: options.amountToken0, amountToken1, tickLower, tickUpper, sqrtPriceX96 })
  }
  const amountToken0 = await ctx.read<bigint>(ctx.settings.slipstreamContractAddress, abis.slipstream, 'estimateAmount0', [options.amountToken1!, pool.lp, sqrtRatio, tickLower, tickUpper])
  return validateDepositQuote({ pool, amountToken0, amountToken1: options.amountToken1!, tickLower, tickUpper, sqrtPriceX96 })
}

/** A pool leg is native when it is the native token itself (pool specs) or its wrapped form (indexed pools). */
function isNativeLeg(ctx: SugarContext, token: Token): boolean {
  return token.wrappedTokenAddress !== undefined || addressKey(token.tokenAddress) === addressKey(ctx.settings.wrappedNativeTokenAddress)
}

async function collectApprovals(ctx: SugarContext, pool: LiquidityPool, target: Address, amount0: bigint, amount1: bigint) {
  const native0 = isNativeLeg(ctx, pool.token0)
  const native1 = isNativeLeg(ctx, pool.token1)
  const approvals: UnsignedTransaction[] = []
  if (!native0) { const tx = await ctx.client.setTokenAllowance(pool.token0, target, amount0); if (tx) approvals.push(tx) }
  if (!native1) { const tx = await ctx.client.setTokenAllowance(pool.token1, target, amount1); if (tx) approvals.push(tx) }
  return { approvals, native0, native1 }
}

export async function deposit(ctx: SugarContext, quote: DepositQuote, deadlineMinutes = 30, slippage = 0.01): Promise<UnsignedTransaction[]> {
  validateDepositQuote(quote)
  const { pool, amountToken0: amount0, amountToken1: amount1 } = quote
  const target = pool.isCl ? pool.nfpm : ctx.settings.routerContractAddress
  if (!target || target === ADDRESS_ZERO) throw new Error(`pool ${pool.symbol} has no transaction target`)
  const { approvals, native0, native1 } = await collectApprovals(ctx, pool, target, amount0, amount1)
  const deadline = futureTimestamp(deadlineMinutes)
  if (!pool.isCl) {
    const data = native0 || native1
      ? ctx.encode(abis.router, 'addLiquidityETH', [
          native0 ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress),
          pool.isStable,
          native0 ? amount1 : amount0,
          applySlippage(native0 ? amount1 : amount0, slippage),
          applySlippage(native0 ? amount0 : amount1, slippage),
          ctx.signer(), deadline,
        ])
      : ctx.encode(abis.router, 'addLiquidity', [
          normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable,
          amount0, amount1, applySlippage(amount0, slippage), applySlippage(amount1, slippage), ctx.signer(), deadline,
        ])
    return [...approvals, ctx.tx(target, data, native0 ? amount0 : native1 ? amount1 : 0n)]
  }
  const mintArgs = [tokenContractAddress(pool.token0), tokenContractAddress(pool.token1), pool.type, quote.tickLower!, quote.tickUpper!, amount0, amount1, applySlippage(amount0, slippage), applySlippage(amount1, slippage), ctx.signer(), deadline, quote.sqrtPriceX96] as const
  const data = native0 || native1
    ? ctx.encode(abis.nfpm, 'multicall', [[ctx.encode(abis.nfpm, 'mint', [mintArgs]), ctx.encode(abis.nfpm, 'refundETH')]])
    : ctx.encode(abis.nfpm, 'mint', [mintArgs])
  return [...approvals, ctx.tx(target, data, native0 ? amount0 : native1 ? amount1 : 0n)]
}

function cleanupCalls(ctx: SugarContext, pool: LiquidityPool, positionId: bigint, unwrapNative: boolean, burn: boolean): Hex[] {
  if (unwrapNative && addressKey(pool.token0.tokenAddress) !== addressKey(ctx.settings.wrappedNativeTokenAddress) && addressKey(pool.token1.tokenAddress) !== addressKey(ctx.settings.wrappedNativeTokenAddress)) throw new Error('unwrapNative: pool has no native leg')
  const recipient = unwrapNative ? ADDRESS_ZERO : ctx.signer()
  const calls = [ctx.encode(abis.nfpm, 'collect', [[positionId, recipient, MAX_UINT128, MAX_UINT128]])]
  if (unwrapNative) {
    const other = addressKey(pool.token0.tokenAddress) === addressKey(ctx.settings.wrappedNativeTokenAddress) ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress)
    calls.push(ctx.encode(abis.nfpm, 'unwrapWETH9', [0n, ctx.signer()]), ctx.encode(abis.nfpm, 'sweepToken', [other, 0n, ctx.signer()]))
  }
  if (burn) calls.push(ctx.encode(abis.nfpm, 'burn', [positionId]))
  return calls
}

export async function withdraw(ctx: SugarContext, withdrawal: Withdrawal, deadlineMinutes = 30, slippage = 0.01, collect = true, unwrapNative = false): Promise<UnsignedTransaction[]> {
  const { pool } = withdrawal
  if (withdrawal.liquidity <= 0n) throw new Error('liquidity must be positive')
  const amount0Min = applySlippage(withdrawal.amountToken0, slippage)
  const amount1Min = applySlippage(withdrawal.amountToken1, slippage)
  const deadline = futureTimestamp(deadlineMinutes)
  if (!pool.isCl) {
    const approval = await approveAddressIfNeeded(ctx, pool.lp, ctx.settings.routerContractAddress, withdrawal.liquidity)
    const native0 = addressKey(pool.token0.tokenAddress) === addressKey(ctx.settings.wrappedNativeTokenAddress)
    const native1 = addressKey(pool.token1.tokenAddress) === addressKey(ctx.settings.wrappedNativeTokenAddress)
    const data = native0 || native1
      ? ctx.encode(abis.router, 'removeLiquidityETH', [
          native0 ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress), pool.isStable, withdrawal.liquidity,
          native0 ? amount1Min : amount0Min, native0 ? amount0Min : amount1Min, ctx.signer(), deadline,
        ])
      : ctx.encode(abis.router, 'removeLiquidity', [normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable, withdrawal.liquidity, amount0Min, amount1Min, ctx.signer(), deadline])
    const main = ctx.tx(ctx.settings.routerContractAddress, data)
    return [approval, main].filter((tx): tx is UnsignedTransaction => tx !== undefined)
  }
  if (withdrawal.positionId === undefined) throw new Error('CL Withdrawal requires positionId')
  if ((withdrawal.burn || unwrapNative) && !collect) throw new Error('burn / unwrapNative require collect=true')
  const decrease = ctx.encode(abis.nfpm, 'decreaseLiquidity', [[withdrawal.positionId, withdrawal.liquidity, amount0Min, amount1Min, deadline]])
  const data = collect
    ? ctx.encode(abis.nfpm, 'multicall', [[decrease, ...cleanupCalls(ctx, pool, withdrawal.positionId, unwrapNative, withdrawal.burn)]])
    : decrease
  return [ctx.tx(pool.nfpm, data)]
}

export async function approveAddressIfNeeded(ctx: SugarContext, token: Address, spender: Address, amount: bigint): Promise<UnsignedTransaction | undefined> {
  const allowance = await ctx.read<bigint>(token, abis.erc20, 'allowance', [ctx.signer(), spender])
  return allowance >= amount ? undefined : ctx.tx(token, ctx.encode(abis.erc20, 'approve', [spender, amount]))
}

function assertPosition(position: Position): void {
  if (position.isAlm) throw new Error('ALM-managed position; not supported')
  if (!position.pool.gauge || position.pool.gauge === ADDRESS_ZERO) throw new Error(`pool ${position.pool.symbol} has no gauge`)
}

export async function stake(ctx: SugarContext, position: Position): Promise<UnsignedTransaction[]> {
  assertPosition(position)
  const pool = position.pool
  if (!pool.gaugeAlive) throw new Error(`gauge for ${pool.symbol} is not active`)
  const gaugeAbi = pool.isCl ? abis.gaugeCl : abis.gaugeBasic
  if (pool.isCl) {
    if (position.staked > 0n) throw new Error(`CL position #${position.id} is already staked`)
    if (position.liquidity === 0n) throw new Error(`CL position #${position.id} has no liquidity to stake`)
    return [ctx.tx(pool.nfpm, ctx.encode(abis.nfpm, 'approve', [pool.gauge, position.id])), ctx.tx(pool.gauge, ctx.encode(gaugeAbi, 'deposit', [position.id]))]
  }
  if (position.liquidity === 0n) throw new Error(`no LP to stake for ${pool.symbol}`)
  const approval = await approveAddressIfNeeded(ctx, pool.lp, pool.gauge, position.liquidity)
  const main = ctx.tx(pool.gauge, ctx.encode(gaugeAbi, 'deposit', [position.liquidity]))
  return [approval, main].filter((tx): tx is UnsignedTransaction => tx !== undefined)
}

export async function unstake(ctx: SugarContext, position: Position, amount?: bigint): Promise<UnsignedTransaction[]> {
  assertPosition(position)
  const pool = position.pool
  const gaugeAbi = pool.isCl ? abis.gaugeCl : abis.gaugeBasic
  let value: bigint
  if (pool.isCl) {
    if (position.staked === 0n) throw new Error(`CL position #${position.id} is not staked`)
    value = position.id
  } else {
    value = amount ?? position.staked
    if (value <= 0n) throw new Error('no staked LP to withdraw')
    if (value > position.staked) throw new Error(`unstake amount ${value} > staked ${position.staked}`)
  }
  return [ctx.tx(pool.gauge, ctx.encode(gaugeAbi, 'withdraw', [value]))]
}

export async function claimEmissions(ctx: SugarContext, position: Position): Promise<UnsignedTransaction[]> {
  assertPosition(position)
  const pool = position.pool
  return [ctx.tx(pool.gauge, ctx.encode(pool.isCl ? abis.gaugeCl : abis.gaugeBasic, 'getReward', [pool.isCl ? position.id : ctx.signer()]))]
}

export async function claimFees(ctx: SugarContext, position: Position, burn = false, unwrapNative = false): Promise<UnsignedTransaction[]> {
  assertPosition(position)
  if (position.staked > 0n) throw new Error('position is staked; unstake first to claim fees')
  const pool = position.pool
  if (!pool.isCl) return [ctx.tx(pool.lp, ctx.encode(abis.poolBasic, 'claimFees'))]
  if (burn && position.liquidity > 0n) throw new Error('burn requires liquidity == 0; drain via withdraw first')
  return [ctx.tx(pool.nfpm, ctx.encode(abis.nfpm, 'multicall', [cleanupCalls(ctx, pool, position.id, unwrapNative, burn)]))]
}
