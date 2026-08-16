import {
  createPublicClient,
  encodeFunctionData,
  http,
  pad,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { abis } from './abis'
import { getChainSettings } from './config'
import { normalizeAddress } from './helpers'
import type { ReadArgs, SugarContext } from './internal/context'
import { getPoolCount, getPoolPaginator, pageSize } from './internal/pagination'
import {
  makeRpcReadExecutor,
  type RpcDeadline,
  type RpcReadExecutor,
  type RpcReadTask,
} from './internal/rpc-executor'
import * as poolsApi from './pools'
import * as positionsApi from './positions'
import * as pricesApi from './prices'
import * as quotesApi from './quotes'
import * as tokensApi from './tokens'
import * as transactionsApi from './transactions'
import * as venftsApi from './venfts'
import {
  XCHAIN_GAS_LIMIT_UPPERBOUND,
  type ChainId,
  type ChainSettings,
  type DepositQuote,
  type LiquidityPool,
  type LiquidityPoolEpoch,
  type LiquidityPoolForSwap,
  type PathHop,
  type PoolRewardContracts,
  type Position,
  type Price,
  type Quote,
  type SugarClientOptions,
  type Token,
  type UnsignedTransaction,
  type VeNft,
  type VeNftContracts,
  type VeNftReward,
  type VeNftVote,
  type Withdrawal,
} from './types'

/**
 * Thin facade over the per-domain modules (tokens, prices, pools, venfts,
 * positions, quotes, transactions). All state lives in one SugarContext built
 * by the constructor, so caching semantics are shared across domains exactly
 * as before the extraction.
 */
export class SugarClient {
  readonly settings: ChainSettings
  readonly account?: Address
  readonly publicClient: PublicClient
  // Shared with ctx.rpc; kept on the instance so tests and subclasses can
  // observe or patch the executor. (protected: private would trip the
  // stricter noUnusedLocals config some workspace consumers compile with.)
  protected readonly rpc: RpcReadExecutor
  private readonly ctx: SugarContext

  constructor(chainId: ChainId | number, options: SugarClientOptions = {}) {
    this.settings = getChainSettings(chainId, { env: options.env, overrides: { ...options.settings, rpcUrl: options.rpcUrl ?? options.settings?.rpcUrl } })
    this.account = options.account ? normalizeAddress(options.account) : undefined
    const onRpcEvent = options.onRpcEvent
    const rpc = makeRpcReadExecutor(options.rpcPolicy, onRpcEvent)
    this.rpc = rpc
    this.publicClient = options.publicClient ?? createPublicClient({
      // Several upstream public RPCs (notably Lisk dRPC) reject JSON-RPC batch
      // bodies with HTTP 500. Contract-level Multicall3 is used where batching
      // matters, while the base transport stays universally compatible.
      transport: options.transport ?? http(this.settings.rpcUrl, {
        retryCount: 0,
        timeout: Math.min(30_000, rpc.policy.deadlineMs),
      }),
      batch: { multicall: true },
    })

    const { settings, account, publicClient } = this
    const signer = (): Address => {
      if (!account) throw new Error('This operation requires an account address')
      return account
    }
    const readTask = <T>(address: Address, abi: Abi, functionName: string, args?: ReadArgs): RpcReadTask<T> =>
      () => publicClient.readContract({ address, abi, functionName, args } as never) as Promise<T>
    this.ctx = {
      client: this,
      settings,
      account,
      publicClient,
      rpc,
      caches: options.cacheStore?.cachesFor(this.settings.chainId, this.settings.rpcUrl)
        ?? { rawPoolCache: new Map(), poolCache: new Map(), priceRateCache: new Map() },
      poolLocatorStore: options.poolLocatorStore,
      resolvedPoolLocators: new Map(),
      veNftContractsCache: undefined,
      readTask,
      read: <T>(address: Address, abi: Abi, functionName: string, args?: ReadArgs, deadline?: RpcDeadline): Promise<T> =>
        rpc.read(functionName, readTask<T>(address, abi, functionName, args), deadline),
      signer,
      tx: (to: Address, data: Hex, value = 0n): UnsignedTransaction => ({ from: signer(), to, data, value }),
      encode: (abi: Abi, functionName: string, args: readonly unknown[] = []): Hex =>
        encodeFunctionData({ abi, functionName, args } as never),
      emitRpcEvent: (event) => {
        try {
          onRpcEvent?.(event)
        } catch {
          // Observability must never alter an SDK result.
        }
      },
    }
  }

  buildTransaction(to: Address, data: Hex, value = 0n): UnsignedTransaction {
    return this.ctx.tx(to, data, value)
  }

  calculateOptimalBatchSize(poolCount: number): number {
    return pageSize(this.ctx, poolCount)
  }

  getPoolPaginator(poolCount: number): Array<{ offset: number; limit: number }> {
    return getPoolPaginator(this.ctx, poolCount)
  }

  getPoolCount(): Promise<number> {
    return getPoolCount(this.ctx)
  }

  async getBridgeFee(domain: number): Promise<bigint> {
    return transactionsApi.getBridgeFee(this.ctx, domain)
  }

  async getXchainFee(destinationDomain: number): Promise<bigint> {
    return this.ctx.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'quoteGasForCommitReveal', [destinationDomain, XCHAIN_GAS_LIMIT_UPPERBOUND])
  }

  async getRemoteInterchainAccount(destinationDomain: number): Promise<Address> {
    return this.ctx.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'getRemoteInterchainAccount', [
      destinationDomain,
      this.settings.swapperContractAddress,
      pad(this.ctx.signer(), { size: 32 }),
    ])
  }

  async getIcaHook(): Promise<Address> {
    return this.ctx.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'hook')
  }

  // --- tokens ---

  async balanceOf(tokenAddress: Address, ownerAddress: Address): Promise<bigint> {
    return tokensApi.balanceOf(this.ctx, tokenAddress, ownerAddress)
  }

  async getTokenBalance(token: Token, ownerAddress = this.account): Promise<bigint> {
    return tokensApi.getTokenBalance(this.ctx, token, ownerAddress)
  }

  async getUserIcaBalance(userIca: Address): Promise<bigint> {
    return tokensApi.getUserIcaBalance(this.ctx, userIca)
  }

  getAllTokens(listedOnly = false): Promise<Token[]> {
    return tokensApi.getAllTokens(this.ctx, listedOnly)
  }

  async getToken(reference: string | bigint | number): Promise<Token | undefined> {
    return tokensApi.getToken(this.ctx, reference)
  }

  async getBridgeToken(): Promise<Token> {
    return tokensApi.getBridgeToken(this.ctx)
  }

  // --- prices ---

  getPriceRequestTokens(tokens: Token[]): Token[] {
    return pricesApi.getPriceRequestTokens(tokens)
  }

  getPriceConnectors(): Address[] {
    return pricesApi.getPriceConnectors(this.ctx)
  }

  async getPrices(tokens: Token[]): Promise<Price[]> {
    return pricesApi.getPrices(this.ctx, tokens)
  }

  // --- pools ---

  getRawPools(forSwaps = false): Promise<unknown[]> {
    return poolsApi.getRawPools(this.ctx, forSwaps)
  }

  async getPools(): Promise<LiquidityPool[]>
  async getPools(forSwaps: false): Promise<LiquidityPool[]>
  async getPools(forSwaps: true): Promise<LiquidityPoolForSwap[]>
  async getPools(forSwaps = false): Promise<LiquidityPool[] | LiquidityPoolForSwap[]> {
    return poolsApi.getPools(this.ctx, forSwaps)
  }

  getPoolsForSwaps(): Promise<LiquidityPoolForSwap[]> {
    return poolsApi.getPoolsForSwaps(this.ctx)
  }

  async getPoolByAddress(address: Address | string): Promise<LiquidityPool | undefined> {
    return poolsApi.getPoolByAddress(this.ctx, address)
  }

  async getPoolEpochs(lp: Address | string, offset = 0, limit = 10): Promise<LiquidityPoolEpoch[]> {
    return poolsApi.getPoolEpochs(this.ctx, lp, offset, limit)
  }

  async getLatestPoolEpochs(): Promise<LiquidityPoolEpoch[]> {
    return poolsApi.getLatestPoolEpochs(this.ctx)
  }

  // --- veNFTs & voting rewards ---

  supportsVeNfts(): boolean {
    return venftsApi.supportsVeNfts(this.ctx)
  }

  getVeNftContracts(): Promise<VeNftContracts> {
    return venftsApi.getVeNftContracts(this.ctx)
  }

  async getVeNfts(owner = this.account): Promise<VeNft[]> {
    return venftsApi.getVeNfts(this.ctx, owner)
  }

  async getVeNft(tokenId: bigint): Promise<VeNft | undefined> {
    return venftsApi.getVeNft(this.ctx, tokenId)
  }

  async getVeNftRewards(tokenId: bigint, pool?: Address): Promise<VeNftReward[]> {
    return venftsApi.getVeNftRewards(this.ctx, tokenId, pool)
  }

  async createVeNft(amount: bigint, lockDurationSeconds: number): Promise<UnsignedTransaction[]> {
    return venftsApi.createVeNft(this.ctx, amount, lockDurationSeconds)
  }

  async increaseVeNftAmount(tokenId: bigint, amount: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.increaseVeNftAmount(this.ctx, tokenId, amount)
  }

  async extendVeNftLock(tokenId: bigint, lockDurationSeconds: number): Promise<UnsignedTransaction[]> {
    return venftsApi.extendVeNftLock(this.ctx, tokenId, lockDurationSeconds)
  }

  async withdrawVeNft(tokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.withdrawVeNft(this.ctx, tokenId)
  }

  async mergeVeNfts(fromTokenId: bigint, intoTokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.mergeVeNfts(this.ctx, fromTokenId, intoTokenId)
  }

  async splitVeNft(tokenId: bigint, amount: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.splitVeNft(this.ctx, tokenId, amount)
  }

  async setVeNftPermanent(tokenId: bigint, permanent: boolean): Promise<UnsignedTransaction[]> {
    return venftsApi.setVeNftPermanent(this.ctx, tokenId, permanent)
  }

  async delegateVeNft(tokenId: bigint, delegateTokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.delegateVeNft(this.ctx, tokenId, delegateTokenId)
  }

  async voteVeNft(tokenId: bigint, votes: readonly VeNftVote[]): Promise<UnsignedTransaction[]> {
    return venftsApi.voteVeNft(this.ctx, tokenId, votes)
  }

  async resetVeNftVotes(tokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.resetVeNftVotes(this.ctx, tokenId)
  }

  async pokeVeNftVotes(tokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.pokeVeNftVotes(this.ctx, tokenId)
  }

  async depositVeNftIntoManaged(tokenId: bigint, managedTokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.depositVeNftIntoManaged(this.ctx, tokenId, managedTokenId)
  }

  async withdrawVeNftFromManaged(tokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.withdrawVeNftFromManaged(this.ctx, tokenId)
  }

  async claimVeNftRewards(tokenId: bigint, pool?: Address): Promise<UnsignedTransaction[]> {
    return venftsApi.claimVeNftRewards(this.ctx, tokenId, pool)
  }

  async getVeNftRebase(tokenId: bigint): Promise<bigint> {
    return venftsApi.getVeNftRebase(this.ctx, tokenId)
  }

  async claimVeNftRebase(tokenId: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.claimVeNftRebase(this.ctx, tokenId)
  }

  async claimVeNftRebases(tokenIds: readonly bigint[]): Promise<UnsignedTransaction[]> {
    return venftsApi.claimVeNftRebases(this.ctx, tokenIds)
  }

  async getPoolRewardContracts(pool: LiquidityPool): Promise<PoolRewardContracts> {
    return venftsApi.getPoolRewardContracts(this.ctx, pool)
  }

  async incentivizePool(pool: LiquidityPool, token: Token, amount: bigint): Promise<UnsignedTransaction[]> {
    return venftsApi.incentivizePool(this.ctx, pool, token, amount)
  }

  // --- positions ---

  async getPositions(owner = this.account): Promise<Position[]> {
    return positionsApi.getPositions(this.ctx, owner)
  }

  async getPositionByPool(poolAddress: Address, owner = this.account): Promise<Position | undefined> {
    return positionsApi.getPositionByPool(this.ctx, poolAddress, owner)
  }

  // --- quotes ---

  filterPoolsForSwap(pools: LiquidityPoolForSwap[], fromToken: Token, toToken: Token): LiquidityPoolForSwap[] {
    return quotesApi.filterPoolsForSwap(this.ctx, pools, fromToken, toToken)
  }

  getPathsForQuote(fromToken: Token, toToken: Token, pools: LiquidityPoolForSwap[], excludedAddresses = this.settings.excludedTokenAddresses): PathHop[][] {
    return quotesApi.getPathsForQuote(this.ctx, fromToken, toToken, pools, excludedAddresses)
  }

  async getQuote(fromToken: Token, toToken: Token, amount: bigint, filter?: (quote: Quote) => boolean): Promise<Quote | undefined> {
    return quotesApi.getQuote(this.ctx, fromToken, toToken, amount, filter)
  }

  // --- transactions ---

  async checkTokenAllowance(token: Token, spender: Address): Promise<bigint> {
    return transactionsApi.checkTokenAllowance(this.ctx, token, spender)
  }

  async setTokenAllowance(token: Token, spender: Address, amount: bigint): Promise<UnsignedTransaction | undefined> {
    return transactionsApi.setTokenAllowance(this.ctx, token, spender, amount)
  }

  async revokeTokenAllowance(token: Token, spender: Address): Promise<UnsignedTransaction[]> {
    return transactionsApi.revokeTokenAllowance(this.ctx, token, spender)
  }

  async revokePermit2Allowance(token: Token): Promise<UnsignedTransaction[]> {
    return transactionsApi.revokePermit2Allowance(this.ctx, token)
  }

  async bridge(fromToken: Token, amount: bigint, domain: number): Promise<UnsignedTransaction[]> {
    return transactionsApi.bridge(this.ctx, fromToken, amount, domain)
  }

  async swap(fromToken: Token, toToken: Token, amount: bigint, slippage?: number): Promise<UnsignedTransaction[]> {
    return transactionsApi.swap(this.ctx, fromToken, toToken, amount, slippage)
  }

  async swapFromQuote(quote: Quote, slippage = this.settings.swapSlippage): Promise<UnsignedTransaction[]> {
    return transactionsApi.swapFromQuote(this.ctx, quote, slippage)
  }

  async poolSpec(token0: Token, token1: Token, options: { tickSpacing?: number; stable?: boolean }): Promise<LiquidityPool> {
    return transactionsApi.poolSpec(this.ctx, token0, token1, options)
  }

  async quoteBasicDeposit(pool: LiquidityPool, amounts: { amountToken0?: bigint; amountToken1?: bigint }): Promise<DepositQuote> {
    return transactionsApi.quoteBasicDeposit(this.ctx, pool, amounts)
  }

  async quoteConcentratedDeposit(pool: LiquidityPool, options: {
    priceLower?: number; priceUpper?: number; tickLower?: number; tickUpper?: number
    amountToken0?: bigint; amountToken1?: bigint; initialPrice?: number
  }): Promise<DepositQuote> {
    return transactionsApi.quoteConcentratedDeposit(this.ctx, pool, options)
  }

  async deposit(quote: DepositQuote, deadlineMinutes = 30, slippage = 0.01): Promise<UnsignedTransaction[]> {
    return transactionsApi.deposit(this.ctx, quote, deadlineMinutes, slippage)
  }

  async withdraw(withdrawal: Withdrawal, deadlineMinutes = 30, slippage = 0.01, collect = true, unwrapNative = false): Promise<UnsignedTransaction[]> {
    return transactionsApi.withdraw(this.ctx, withdrawal, deadlineMinutes, slippage, collect, unwrapNative)
  }

  async stake(position: Position): Promise<UnsignedTransaction[]> {
    return transactionsApi.stake(this.ctx, position)
  }

  async unstake(position: Position, amount?: bigint): Promise<UnsignedTransaction[]> {
    return transactionsApi.unstake(this.ctx, position, amount)
  }

  async claimEmissions(position: Position): Promise<UnsignedTransaction[]> {
    return transactionsApi.claimEmissions(this.ctx, position)
  }

  async claimFees(position: Position, burn = false, unwrapNative = false): Promise<UnsignedTransaction[]> {
    return transactionsApi.claimFees(this.ctx, position, burn, unwrapNative)
  }
}

export function createSugarClient(chainId: ChainId | number, options: SugarClientOptions = {}): SugarClient {
  return new SugarClient(chainId, options)
}
