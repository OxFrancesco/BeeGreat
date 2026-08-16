import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, applySlippage, chunk, findAllPaths, packPath, tokenContractAddress, tupleValues } from './helpers'
import type { SugarContext } from './internal/context'
import type { LiquidityPoolForSwap, PathHop, Quote, Token } from './types'

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

export function filterPoolsForSwap(ctx: SugarContext, pools: LiquidityPoolForSwap[], fromToken: Token, toToken: Token): LiquidityPoolForSwap[] {
  // Every hop of a valid route connects two tokens from this set (route ends
  // are the swap tokens and intermediates must be vetted connectors), so a
  // pool with a long-tail token on either side can never appear in a path.
  // Dropping them up front keeps the path search off the majority of pools.
  const matches = new Set([...ctx.settings.connectorTokenAddresses, tokenContractAddress(fromToken), tokenContractAddress(toToken)].map(addressKey))
  return pools.filter((pool) => matches.has(addressKey(pool.token0Address)) && matches.has(addressKey(pool.token1Address)))
}

export function getPathsForQuote(
  ctx: SugarContext,
  fromToken: Token,
  toToken: Token,
  pools: LiquidityPoolForSwap[],
  excludedAddresses: Address[] = ctx.settings.excludedTokenAddresses,
): PathHop[][] {
  const excluded = new Set(excludedAddresses.map(addressKey))
  excluded.delete(addressKey(tokenContractAddress(fromToken)))
  excluded.delete(addressKey(tokenContractAddress(toToken)))
  // Multi-hop routes may only pass through vetted connector tokens: an
  // arbitrary intermediate can quote well but revert on transfer (honeypot),
  // failing the whole swap at execution time.
  const allowedIntermediates = new Set(
    [...ctx.settings.connectorTokenAddresses, tokenContractAddress(fromToken), tokenContractAddress(toToken)].map(addressKey),
  )
  return findAllPaths(pools, tokenContractAddress(fromToken), tokenContractAddress(toToken), 3).filter((path) =>
    !path.some((hop, index) => {
      if (index === 0) return false
      const hopInput = addressKey(hop.reversed ? hop.pool.token1Address : hop.pool.token0Address)
      return excluded.has(hopInput) || !allowedIntermediates.has(hopInput)
    }),
  )
}

/**
 * Dense chains produce tens of thousands of candidate paths, and quoter
 * simulations are gas-heavy eth_calls that throttle metered RPC plans.
 * Shorter routes carry nearly all real liquidity, so when the candidate
 * set exceeds the budget, keep the shortest paths.
 */
function prioritizeQuotePaths(ctx: SugarContext, paths: PathHop[][]): PathHop[][] {
  const limit = ctx.settings.quoteMaxPaths
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError('quoteMaxPaths must be a positive safe integer')
  }
  if (paths.length <= limit) return paths
  return [...paths].sort((a, b) => a.length - b.length).slice(0, limit)
}

export async function getQuote(ctx: SugarContext, fromToken: Token, toToken: Token, amount: bigint, filter?: (quote: Quote) => boolean): Promise<Quote | undefined> {
  const pools = ctx.client.filterPoolsForSwap(await ctx.client.getPoolsForSwaps(), fromToken, toToken)
  const paths = prioritizeQuotePaths(ctx, ctx.client.getPathsForQuote(fromToken, toToken, pools))
  const inputs = paths.map((path) => ({
    path,
    encoded: packPath(path, { newFactory: ctx.settings.slipstreamFactoryAddress, oldFactory: ctx.settings.oldSlipstreamFactoryAddress }).encoded,
  }))
  const quoteFromResult = ({ path }: (typeof inputs)[number], result: unknown): Quote => {
    const amountOut = Array.isArray(result) || (result && typeof result === 'object')
      ? BigInt(tupleValues(result)[0] as bigint)
      : BigInt(result as bigint)
    return {
      input: {
        fromToken,
        toToken,
        path,
        amountIn: amount,
        slipstreamFactoryAddress: ctx.settings.slipstreamFactoryAddress,
        oldSlipstreamFactoryAddress: ctx.settings.oldSlipstreamFactoryAddress,
      },
      amountOut,
    }
  }
  const batches = chunk(inputs, Math.max(1, ctx.settings.quoteBatchSize))
  const deadline = ctx.rpc.deadline('quoteExactInput')
  const multicallBatches = await ctx.rpc.forEachReadResult(
    'quoteExactInput.multicall',
    batches,
    (batch) => ctx.publicClient.multicall({
      allowFailure: true,
      multicallAddress: MULTICALL3,
      contracts: batch.map(({ encoded }) => ({
        address: ctx.settings.quoterContractAddress,
        abi: abis.quoter,
        functionName: 'quoteExactInput',
        args: [encoded, amount],
      })),
    } as never) as Promise<Array<{ status: 'success'; result: unknown } | { status: 'failure' }>>,
    Math.max(1, Math.min(ctx.settings.requestConcurrency, batches.length)),
    deadline,
  )
  const quotes: Quote[] = []
  const fallbackInputs: typeof inputs = []
  multicallBatches.forEach((batchResult, batchIndex) => {
    const batch = batches[batchIndex]
    if (!batchResult.ok) {
      fallbackInputs.push(...batch)
      return
    }
    batch.forEach((input, index) => {
      const response = batchResult.value[index]
      if (response?.status !== 'success') return
      try {
        quotes.push(quoteFromResult(input, response.result))
      } catch {
        fallbackInputs.push(input)
      }
    })
  })

  // Some private/test networks do not deploy Multicall3. Preserve the SDK
  // surface with one bounded, fail-fast direct-call fallback phase.
  if (fallbackInputs.length > 0) {
    const directResults = await ctx.rpc.forEachReadResult(
      'quoteExactInput.direct',
      fallbackInputs,
      ({ encoded }) => ctx.publicClient.readContract({
        address: ctx.settings.quoterContractAddress,
        abi: abis.quoter,
        functionName: 'quoteExactInput',
        args: [encoded, amount],
      } as never) as Promise<unknown>,
      ctx.settings.requestConcurrency,
      deadline,
    )
    directResults.forEach((result, index) => {
      if (!result.ok) return
      try {
        quotes.push(quoteFromResult(fallbackInputs[index], result.value))
      } catch {
        // A malformed per-path quote is unusable; other paths remain valid.
      }
    })
  }
  const valid = quotes.filter((quote) => !filter || filter(quote))
  const best = valid.reduce<Quote | undefined>(
    (current, quote) => !current || quote.amountOut > current.amountOut ? quote : current,
    undefined,
  )
  if (!best) return undefined
  const minimumCompetitiveOutput = applySlippage(best.amountOut, ctx.settings.swapSlippage)
  return valid.reduce<Quote | undefined>((safest, quote) => {
    if (quote.amountOut < minimumCompetitiveOutput) return safest
    if (!safest || quote.input.path.length < safest.input.path.length) return quote
    if (quote.input.path.length === safest.input.path.length && quote.amountOut > safest.amountOut) return quote
    return safest
  }, undefined)
}
