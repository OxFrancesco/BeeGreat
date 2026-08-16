import type { Address } from 'viem'
import { abis } from './abis'
import { normalizeAddress } from './helpers'
import { paginate } from './internal/pagination'
import type { SugarContext } from './internal/context'
import { bridgeToken, findToken, prepareTokens } from './models'
import { ADDRESS_ZERO, type Token } from './types'

export async function balanceOf(ctx: SugarContext, tokenAddress: Address, ownerAddress: Address): Promise<bigint> {
  return ctx.read(tokenAddress, abis.erc20, 'balanceOf', [ownerAddress])
}

export async function getTokenBalance(ctx: SugarContext, token: Token, ownerAddress?: Address): Promise<bigint> {
  if (!ownerAddress) throw new Error('Owner address is required to get token balance')
  return token.wrappedTokenAddress
    ? ctx.rpc.read('getBalance', () => ctx.publicClient.getBalance({ address: ownerAddress }))
    : ctx.client.balanceOf(normalizeAddress(token.tokenAddress), ownerAddress)
}

export async function getUserIcaBalance(ctx: SugarContext, userIca: Address): Promise<bigint> {
  return ctx.client.balanceOf(ctx.settings.bridgeTokenAddress, userIca)
}

export function getAllTokens(ctx: SugarContext, listedOnly = false): Promise<Token[]> {
  if (!ctx.caches.tokenCache) {
    const promise = paginate(ctx, 'tokens', (limit, offset) => ctx.readTask<unknown[]>(
      ctx.settings.sugarContractAddress,
      abis.sugar,
      'tokens',
      [limit, offset, ADDRESS_ZERO, []],
    )).then((raw) => prepareTokens(raw, ctx.settings))
    ctx.caches.tokenCache = promise
    void promise.catch(() => {
      if (ctx.caches.tokenCache === promise) ctx.caches.tokenCache = undefined
    })
  }
  return ctx.caches.tokenCache.then((tokens) => listedOnly ? tokens.filter((token, index) => index === 0 || token.listed) : tokens)
}

export async function getToken(ctx: SugarContext, reference: string | bigint | number): Promise<Token | undefined> {
  return findToken(await ctx.client.getAllTokens(), reference)
}

export async function getBridgeToken(ctx: SugarContext): Promise<Token> {
  return bridgeToken(await ctx.client.getAllTokens(), ctx.settings)
}
