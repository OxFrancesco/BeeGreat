import type { Address } from 'viem'
import { abis } from './abis'
import { addressKey, chunk, tokenContractAddress } from './helpers'
import type { SugarContext } from './internal/context'
import { preparePrices } from './models'
import type { Price, Token } from './types'

export function getPriceRequestTokens(tokens: Token[]): Token[] {
  return [...new Map(tokens.filter((token) => token.wrappedTokenAddress || token.listed || token.emerging).map((token) => [token.tokenAddress, token])).values()]
}

export function getPriceConnectors(ctx: SugarContext): Address[] {
  return [...new Set([...ctx.settings.connectorTokenAddresses, ctx.settings.stableTokenAddress])]
}

export async function getPrices(ctx: SugarContext, tokens: Token[]): Promise<Price[]> {
  const requestTokens = ctx.client.getPriceRequestTokens(tokens)
  const rateMap = new Map<string, bigint>()
  const now = Date.now()
  const staleTokens = requestTokens.filter((token) => {
    const cached = ctx.caches.priceRateCache.get(addressKey(token.tokenAddress))
    if (cached && cached.expiresAt > now) {
      rateMap.set(token.tokenAddress, cached.rate)
      return false
    }
    return true
  })
  if (staleTokens.length > 0) {
    const batches = chunk(staleTokens, ctx.settings.priceBatchSize)
    const connectors = ctx.client.getPriceConnectors()
    const results = await ctx.rpc.forEachRead(
      'getManyRatesToEthWithCustomConnectors',
      batches,
      (batch) => ctx.publicClient.readContract({
        address: ctx.settings.priceOracleContractAddress,
        abi: abis.priceOracle,
        functionName: 'getManyRatesToEthWithCustomConnectors',
        args: [batch.map(tokenContractAddress), false, connectors, ctx.settings.priceThresholdFilter],
      } as never) as Promise<bigint[]>,
      ctx.settings.requestConcurrency,
    )
    const expiresAt = Date.now() + ctx.settings.pricingCacheTimeoutSeconds * 1_000
    batches.forEach((batch, index) => batch.forEach((token, tokenIndex) => {
      const rate = results[index][tokenIndex]
      rateMap.set(token.tokenAddress, rate)
      ctx.caches.priceRateCache.set(addressKey(token.tokenAddress), { expiresAt, rate })
    }))
  }
  return preparePrices(tokens, tokens.map((token) => rateMap.get(token.tokenAddress) ?? 0n), ctx.settings)
}
