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
import {
  makeRpcReadExecutor,
  type RpcDeadline,
  type RpcReadExecutor,
  type RpcReadTask,
} from './internal/rpc-executor'
import {
  addressKey,
  applySlippage,
  chunk,
  findAllPaths,
  futureTimestamp,
  nearestTick,
  normalizeAddress,
  packPath,
  priceToTick,
  sqrtRatioX96FromPrice,
  tokenContractAddress,
  tupleValues,
} from './helpers'
import {
  bridgeToken,
  createPoolSpec,
  epochFromTuple,
  findToken,
  poolForSwapFromTuple,
  positionFromTuple,
  preparePools,
  preparePrices,
  prepareTokens,
  validateDepositQuote,
} from './models'
import { setupPlanner } from './planner'
import {
  ADDRESS_ZERO,
  MAX_UINT128,
  XCHAIN_GAS_LIMIT_UPPERBOUND,
  type ChainId,
  type ChainSettings,
  type DepositQuote,
  type LiquidityPool,
  type LiquidityPoolEpoch,
  type LiquidityPoolForSwap,
  type PathHop,
  type Position,
  type Price,
  type Quote,
  type SugarRpcEvent,
  type SugarRpcObserver,
  type SugarClientCaches,
  type SugarClientOptions,
  type Token,
  type UnsignedTransaction,
  type Withdrawal,
} from './types'

type ReadArgs = readonly unknown[] | undefined
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address
const MAX_PAGINATION_REQUESTS = 10_000
const MAX_UINT160 = (1n << 160n) - 1n
const PERMIT2_APPROVAL_MINUTES = 30
const PERMIT2_VALIDITY_BUFFER_MINUTES = 10

export class SugarClient {
  readonly settings: ChainSettings
  readonly account?: Address
  readonly publicClient: PublicClient
  private readonly rpc: RpcReadExecutor
  private readonly caches: SugarClientCaches
  private readonly onRpcEvent?: SugarRpcObserver

  constructor(chainId: ChainId | number, options: SugarClientOptions = {}) {
    this.settings = getChainSettings(chainId, { env: options.env, overrides: { ...options.settings, rpcUrl: options.rpcUrl ?? options.settings?.rpcUrl } })
    this.account = options.account ? normalizeAddress(options.account) : undefined
    this.onRpcEvent = options.onRpcEvent
    this.rpc = makeRpcReadExecutor(options.rpcPolicy, this.onRpcEvent)
    this.caches = options.cacheStore?.cachesFor(this.settings.chainId, this.settings.rpcUrl)
      ?? { rawPoolCache: new Map(), poolCache: new Map(), priceRateCache: new Map() }
    this.publicClient = options.publicClient ?? createPublicClient({
      // Several upstream public RPCs (notably Lisk dRPC) reject JSON-RPC batch
      // bodies with HTTP 500. Contract-level Multicall3 is used where batching
      // matters, while the base transport stays universally compatible.
      transport: options.transport ?? http(this.settings.rpcUrl, {
        retryCount: 0,
        timeout: Math.min(30_000, this.rpc.policy.deadlineMs),
      }),
      batch: { multicall: true },
    })
  }

  private readTask<T>(address: Address, abi: Abi, functionName: string, args?: ReadArgs): RpcReadTask<T> {
    return () => this.publicClient.readContract({ address, abi, functionName, args } as never) as Promise<T>
  }

  private async read<T>(
    address: Address,
    abi: Abi,
    functionName: string,
    args?: ReadArgs,
    deadline?: RpcDeadline,
  ): Promise<T> {
    return this.rpc.read(functionName, this.readTask(address, abi, functionName, args), deadline)
  }

  private signer(): Address {
    if (!this.account) throw new Error('This operation requires an account address')
    return this.account
  }

  private tx(to: Address, data: Hex, value = 0n): UnsignedTransaction {
    return this.buildTransaction(to, data, value)
  }

  buildTransaction(to: Address, data: Hex, value = 0n): UnsignedTransaction {
    return { from: this.signer(), to, data, value }
  }

  private encode(abi: Abi, functionName: string, args: readonly unknown[] = []): Hex {
    return encodeFunctionData({ abi, functionName, args } as never)
  }

  private pageSize(poolCount: number): number {
    if (!Number.isSafeInteger(poolCount) || poolCount < 0) {
      throw new RangeError('Sugar pool count must be a safe non-negative integer')
    }
    const minimum = this.settings.poolPaginationMinSize
    const maximum = this.settings.poolPaginationMaxSize
    const targetCalls = this.settings.poolPaginationTargetCalls
    if (![minimum, maximum, targetCalls].every((value) => Number.isSafeInteger(value) && value > 0)) {
      throw new RangeError('Sugar pagination settings must be positive safe integers')
    }
    if (minimum > maximum) {
      throw new RangeError('Sugar pagination minimum cannot exceed maximum')
    }
    return Math.max(minimum, Math.min(Math.floor(poolCount / targetCalls), maximum))
  }

  calculateOptimalBatchSize(poolCount: number): number {
    return this.pageSize(poolCount)
  }

  getPoolPaginator(poolCount: number): Array<{ offset: number; limit: number }> {
    return [...this.poolPageRequests(poolCount)]
  }

  private *poolPageRequests(poolCount: number): Generator<{ offset: number; limit: number }> {
    const limit = this.pageSize(poolCount)
    const pageCount = Math.ceil((poolCount + 10) / limit)
    if (!Number.isSafeInteger(pageCount) || pageCount > MAX_PAGINATION_REQUESTS) {
      throw new RangeError(`Sugar pagination allows at most ${MAX_PAGINATION_REQUESTS} requests`)
    }
    for (let page = 0; page < pageCount; page++) yield { offset: page * limit, limit }
  }

  private async paginate<T>(
    operation: string,
    reader: (limit: number, offset: number) => RpcReadTask<T[]>,
    deadline = this.rpc.deadline(operation),
  ): Promise<T[]> {
    const startedAt = Date.now()
    let pageCount = 0
    try {
      const count = await this.getPoolCountWithin(deadline)
      const requests = this.getPoolPaginator(count)
      pageCount = requests.length
      const pages = await this.rpc.forEachRead(
        operation,
        requests,
        ({ limit, offset }, _index, signal) => reader(limit, offset)(signal),
        this.settings.requestConcurrency,
        deadline,
      )
      const results = pages.flat()
      this.emitRpcEvent({
        attemptCount: deadline.attempts,
        durationMs: Date.now() - startedAt,
        itemCount: results.length,
        operation,
        pageCount,
        phase: 'pagination',
        status: 'success',
      })
      return results
    } catch (error) {
      this.emitRpcEvent({
        attemptCount: deadline.attempts,
        durationMs: Date.now() - startedAt,
        itemCount: 0,
        operation,
        pageCount,
        phase: 'pagination',
        status: 'error',
      })
      throw error
    }
  }

  private emitRpcEvent(event: SugarRpcEvent): void {
    try {
      this.onRpcEvent?.(event)
    } catch {
      // Observability must never alter an SDK result.
    }
  }

  private getPoolCountWithin(deadline: RpcDeadline): Promise<number> {
    if (!this.caches.poolCountCache) {
      const promise = this.read<bigint>(
        this.settings.sugarContractAddress,
        abis.sugar,
        'count',
        undefined,
        deadline,
      ).then((rawCount) => {
        const count = Number(rawCount)
        if (rawCount < 0n || !Number.isSafeInteger(count)) {
          throw new RangeError('Sugar pool count must be a safe non-negative integer')
        }
        return count
      })
      this.caches.poolCountCache = promise
      void promise.catch(() => {
        if (this.caches.poolCountCache === promise) this.caches.poolCountCache = undefined
      })
    }
    return this.caches.poolCountCache
  }

  getPoolCount(): Promise<number> {
    return this.getPoolCountWithin(this.rpc.deadline('count'))
  }

  async getBridgeFee(domain: number): Promise<bigint> {
    return this.read(this.settings.bridgeContractAddress, abis.bridgeGetFee, 'quoteGasPayment', [domain])
  }

  async getXchainFee(destinationDomain: number): Promise<bigint> {
    return this.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'quoteGasForCommitReveal', [destinationDomain, XCHAIN_GAS_LIMIT_UPPERBOUND])
  }

  async getRemoteInterchainAccount(destinationDomain: number): Promise<Address> {
    return this.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'getRemoteInterchainAccount', [
      destinationDomain,
      this.settings.swapperContractAddress,
      pad(this.signer(), { size: 32 }),
    ])
  }

  async getIcaHook(): Promise<Address> {
    return this.read(this.settings.interchainRouterContractAddress, abis.interchainRouter, 'hook')
  }

  async balanceOf(tokenAddress: Address, ownerAddress: Address): Promise<bigint> {
    return this.read(tokenAddress, abis.erc20, 'balanceOf', [ownerAddress])
  }

  async getTokenBalance(token: Token, ownerAddress = this.account): Promise<bigint> {
    if (!ownerAddress) throw new Error('Owner address is required to get token balance')
    return token.wrappedTokenAddress
      ? this.rpc.read('getBalance', () => this.publicClient.getBalance({ address: ownerAddress }))
      : this.balanceOf(normalizeAddress(token.tokenAddress), ownerAddress)
  }

  async getUserIcaBalance(userIca: Address): Promise<bigint> {
    return this.balanceOf(this.settings.bridgeTokenAddress, userIca)
  }

  getAllTokens(listedOnly = false): Promise<Token[]> {
    if (!this.caches.tokenCache) {
      const promise = this.paginate('tokens', (limit, offset) => this.readTask<unknown[]>(
        this.settings.sugarContractAddress,
        abis.sugar,
        'tokens',
        [limit, offset, ADDRESS_ZERO, []],
      )).then((raw) => prepareTokens(raw, this.settings))
      this.caches.tokenCache = promise
      void promise.catch(() => {
        if (this.caches.tokenCache === promise) this.caches.tokenCache = undefined
      })
    }
    return this.caches.tokenCache.then((tokens) => listedOnly ? tokens.filter((token, index) => index === 0 || token.listed) : tokens)
  }

  async getToken(reference: string | bigint | number): Promise<Token | undefined> {
    return findToken(await this.getAllTokens(), reference)
  }

  async getBridgeToken(): Promise<Token> {
    return bridgeToken(await this.getAllTokens(), this.settings)
  }

  getPriceRequestTokens(tokens: Token[]): Token[] {
    return [...new Map(tokens.filter((token) => token.wrappedTokenAddress || token.listed || token.emerging).map((token) => [token.tokenAddress, token])).values()]
  }

  getPriceConnectors(): Address[] {
    return [...new Set([...this.settings.connectorTokenAddresses, this.settings.stableTokenAddress])]
  }

  async getPrices(tokens: Token[]): Promise<Price[]> {
    const requestTokens = this.getPriceRequestTokens(tokens)
    const rateMap = new Map<string, bigint>()
    const now = Date.now()
    const staleTokens = requestTokens.filter((token) => {
      const cached = this.caches.priceRateCache.get(addressKey(token.tokenAddress))
      if (cached && cached.expiresAt > now) {
        rateMap.set(token.tokenAddress, cached.rate)
        return false
      }
      return true
    })
    if (staleTokens.length > 0) {
      const batches = chunk(staleTokens, this.settings.priceBatchSize)
      const connectors = this.getPriceConnectors()
      const results = await this.rpc.forEachRead(
        'getManyRatesToEthWithCustomConnectors',
        batches,
        (batch) => this.publicClient.readContract({
          address: this.settings.priceOracleContractAddress,
          abi: abis.priceOracle,
          functionName: 'getManyRatesToEthWithCustomConnectors',
          args: [batch.map(tokenContractAddress), false, connectors, this.settings.priceThresholdFilter],
        } as never) as Promise<bigint[]>,
        this.settings.requestConcurrency,
      )
      const expiresAt = Date.now() + this.settings.pricingCacheTimeoutSeconds * 1_000
      batches.forEach((batch, index) => batch.forEach((token, tokenIndex) => {
        const rate = results[index][tokenIndex]
        rateMap.set(token.tokenAddress, rate)
        this.caches.priceRateCache.set(addressKey(token.tokenAddress), { expiresAt, rate })
      }))
    }
    return preparePrices(tokens, tokens.map((token) => rateMap.get(token.tokenAddress) ?? 0n), this.settings)
  }

  getRawPools(forSwaps = false): Promise<unknown[]> {
    let promise = this.caches.rawPoolCache.get(forSwaps)
    if (!promise) {
      const operation = forSwaps ? 'forSwaps' : 'all'
      promise = this.paginate(operation, (limit, offset) => this.readTask<unknown[]>(
        this.settings.sugarContractAddress,
        abis.sugar,
        forSwaps ? 'forSwaps' : 'all',
        forSwaps ? [limit, offset] : [limit, offset, 0],
      ))
      this.caches.rawPoolCache.set(forSwaps, promise)
      void promise.catch(() => {
        if (this.caches.rawPoolCache.get(forSwaps) === promise) this.caches.rawPoolCache.delete(forSwaps)
      })
    }
    return promise
  }

  async getPools(): Promise<LiquidityPool[]>
  async getPools(forSwaps: false): Promise<LiquidityPool[]>
  async getPools(forSwaps: true): Promise<LiquidityPoolForSwap[]>
  async getPools(forSwaps = false): Promise<LiquidityPool[] | LiquidityPoolForSwap[]> {
    let promise = this.caches.poolCache.get(forSwaps)
    if (!promise) {
      promise = (async () => {
        const raw = await this.getRawPools(forSwaps)
        if (forSwaps) return raw.map((pool) => poolForSwapFromTuple(pool, this.settings))
        const tokens = await this.getAllTokens()
        return preparePools(raw, tokens, await this.getPrices(tokens), this.settings)
      })()
      this.caches.poolCache.set(forSwaps, promise)
      void promise.catch(() => {
        if (this.caches.poolCache.get(forSwaps) === promise) this.caches.poolCache.delete(forSwaps)
      })
    }
    return promise
  }

  getPoolsForSwaps(): Promise<LiquidityPoolForSwap[]> {
    return this.getPools(true)
  }

  async getPoolByAddress(address: Address | string): Promise<LiquidityPool | undefined> {
    return (await this.getPools()).find((pool) => addressKey(pool.lp) === addressKey(address))
  }

  private epochMaps(pools: LiquidityPool[], tokens: Token[], prices: Price[]) {
    return {
      pools: new Map(pools.map((pool) => [addressKey(pool.lp), pool])),
      tokens: new Map(tokens.map((token) => [addressKey(token.tokenAddress), token])),
      prices: new Map(prices.map((price) => [addressKey(price.token.tokenAddress), price])),
    }
  }

  async getPoolEpochs(lp: Address | string, offset = 0, limit = 10): Promise<LiquidityPoolEpoch[]> {
    const [tokens, pools, raw] = await Promise.all([
      this.getAllTokens(),
      this.getPools(),
      this.read<unknown[]>(this.settings.sugarRewardsContractAddress, abis.sugarRewards, 'epochsByAddress', [limit, offset, normalizeAddress(lp)]),
    ])
    const maps = this.epochMaps(pools, tokens, await this.getPrices(tokens))
    return raw.map((epoch) => epochFromTuple(epoch, maps.pools, maps.tokens, maps.prices))
  }

  async getLatestPoolEpochs(): Promise<LiquidityPoolEpoch[]> {
    const rawEpochs = await this.paginate('epochsLatest', (limit, offset) => this.readTask<unknown[]>(this.settings.sugarRewardsContractAddress, abis.sugarRewards, 'epochsLatest', [limit, offset]))
    if (rawEpochs.length === 0) return []
    const tokens = await this.getAllTokens()
    const poolAddresses = new Set(rawEpochs.map((epoch) => addressKey(String(tupleValues(epoch)[1]))))
    const rawPools = (await this.getRawPools(false)).filter((pool) => poolAddresses.has(addressKey(String(tupleValues(pool)[0]))))
    const needed = new Set<string>([addressKey(this.settings.stableTokenAddress), this.settings.nativeTokenSymbol])
    rawPools.forEach((pool) => {
      const p = tupleValues(pool)
      ;[p[7], p[10], p[20]].forEach((address) => needed.add(addressKey(String(address))))
    })
    rawEpochs.forEach((epoch) => {
      const e = tupleValues(epoch)
      ;[...(e[4] as unknown[]), ...(e[5] as unknown[])].forEach((reward) => needed.add(addressKey(String(tupleValues(reward)[0]))))
    })
    const priceTokens = tokens.filter((token) => needed.has(addressKey(token.tokenAddress)) && (token.wrappedTokenAddress || token.listed || token.emerging))
    const prices = await this.getPrices(priceTokens)
    const pools = preparePools(rawPools, tokens, prices, this.settings)
    const maps = this.epochMaps(pools, tokens, prices)
    return rawEpochs.map((epoch) => epochFromTuple(epoch, maps.pools, maps.tokens, maps.prices))
  }

  async getPositions(owner = this.account): Promise<Position[]> {
    if (!owner) throw new Error('Owner address is required to list positions')
    const [raw, rawPools, tokens] = await Promise.all([
      this.paginate('positions', (limit, offset) => this.readTask<unknown[]>(this.settings.sugarContractAddress, abis.sugar, 'positions', [limit, offset, owner])),
      this.getRawPools(false),
      this.getAllTokens(),
    ])
    const poolAddresses = new Set(raw.map((position) => addressKey(String(tupleValues(position)[1]))))
    const positionPools = rawPools.filter((pool) => poolAddresses.has(addressKey(String(tupleValues(pool)[0]))))
    const neededTokens = new Set<string>([
      addressKey(this.settings.stableTokenAddress),
      addressKey(this.settings.nativeTokenSymbol),
    ])
    positionPools.forEach((pool) => {
      const values = tupleValues(pool)
      ;[values[7], values[10], values[20]].forEach((address) => neededTokens.add(addressKey(String(address))))
    })
    const prices = await this.getPrices(tokens.filter((token) => neededTokens.has(addressKey(token.tokenAddress))))
    const pools = preparePools(positionPools, tokens, prices, this.settings)
    const poolMap = new Map(pools.map((pool) => [addressKey(pool.lp), pool]))
    return raw.map((position) => positionFromTuple(position, poolMap, this.settings)).filter((position): position is Position => position !== undefined)
  }

  filterPoolsForSwap(pools: LiquidityPoolForSwap[], fromToken: Token, toToken: Token): LiquidityPoolForSwap[] {
    // Every hop of a valid route connects two tokens from this set (route ends
    // are the swap tokens and intermediates must be vetted connectors), so a
    // pool with a long-tail token on either side can never appear in a path.
    // Dropping them up front keeps the path search off the majority of pools.
    const matches = new Set([...this.settings.connectorTokenAddresses, tokenContractAddress(fromToken), tokenContractAddress(toToken)].map(addressKey))
    return pools.filter((pool) => matches.has(addressKey(pool.token0Address)) && matches.has(addressKey(pool.token1Address)))
  }

  getPathsForQuote(fromToken: Token, toToken: Token, pools: LiquidityPoolForSwap[], excludedAddresses = this.settings.excludedTokenAddresses) {
    const excluded = new Set(excludedAddresses.map(addressKey))
    excluded.delete(addressKey(tokenContractAddress(fromToken)))
    excluded.delete(addressKey(tokenContractAddress(toToken)))
    // Multi-hop routes may only pass through vetted connector tokens: an
    // arbitrary intermediate can quote well but revert on transfer (honeypot),
    // failing the whole swap at execution time.
    const allowedIntermediates = new Set(
      [...this.settings.connectorTokenAddresses, tokenContractAddress(fromToken), tokenContractAddress(toToken)].map(addressKey),
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
  private prioritizeQuotePaths(paths: PathHop[][]): PathHop[][] {
    const limit = this.settings.quoteMaxPaths
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new RangeError('quoteMaxPaths must be a positive safe integer')
    }
    if (paths.length <= limit) return paths
    return [...paths].sort((a, b) => a.length - b.length).slice(0, limit)
  }

  async getQuote(fromToken: Token, toToken: Token, amount: bigint, filter?: (quote: Quote) => boolean): Promise<Quote | undefined> {
    const pools = this.filterPoolsForSwap(await this.getPoolsForSwaps(), fromToken, toToken)
    const paths = this.prioritizeQuotePaths(this.getPathsForQuote(fromToken, toToken, pools))
    const inputs = paths.map((path) => ({
      path,
      encoded: packPath(path, { newFactory: this.settings.slipstreamFactoryAddress, oldFactory: this.settings.oldSlipstreamFactoryAddress }).encoded,
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
          slipstreamFactoryAddress: this.settings.slipstreamFactoryAddress,
          oldSlipstreamFactoryAddress: this.settings.oldSlipstreamFactoryAddress,
        },
        amountOut,
      }
    }
    const batches = chunk(inputs, Math.max(1, this.settings.quoteBatchSize))
    const deadline = this.rpc.deadline('quoteExactInput')
    const multicallBatches = await this.rpc.forEachReadResult(
      'quoteExactInput.multicall',
      batches,
      (batch) => this.publicClient.multicall({
        allowFailure: true,
        multicallAddress: MULTICALL3,
        contracts: batch.map(({ encoded }) => ({
          address: this.settings.quoterContractAddress,
          abi: abis.quoter,
          functionName: 'quoteExactInput',
          args: [encoded, amount],
        })),
      } as never) as Promise<Array<{ status: 'success'; result: unknown } | { status: 'failure' }>>,
      Math.max(1, Math.min(this.settings.requestConcurrency, batches.length)),
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
      const directResults = await this.rpc.forEachReadResult(
        'quoteExactInput.direct',
        fallbackInputs,
        ({ encoded }) => this.publicClient.readContract({
          address: this.settings.quoterContractAddress,
          abi: abis.quoter,
          functionName: 'quoteExactInput',
          args: [encoded, amount],
        } as never) as Promise<unknown>,
        this.settings.requestConcurrency,
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
    const minimumCompetitiveOutput = applySlippage(best.amountOut, this.settings.swapSlippage)
    return valid.reduce<Quote | undefined>((safest, quote) => {
      if (quote.amountOut < minimumCompetitiveOutput) return safest
      if (!safest || quote.input.path.length < safest.input.path.length) return quote
      if (quote.input.path.length === safest.input.path.length && quote.amountOut > safest.amountOut) return quote
      return safest
    }, undefined)
  }

  async checkTokenAllowance(token: Token, spender: Address): Promise<bigint> {
    return this.read(tokenContractAddress(token), abis.erc20, 'allowance', [this.signer(), spender])
  }

  async setTokenAllowance(token: Token, spender: Address, amount: bigint): Promise<UnsignedTransaction | undefined> {
    return this.approveAddressIfNeeded(tokenContractAddress(token), spender, amount)
  }

  async bridge(fromToken: Token, amount: bigint, domain: number): Promise<UnsignedTransaction[]> {
    const approval = await this.setTokenAllowance(fromToken, this.settings.bridgeContractAddress, amount)
    const transfer = this.tx(this.settings.bridgeContractAddress, this.encode(abis.bridgeTransferRemote, 'transferRemote', [
      domain, pad(this.signer(), { size: 32 }), amount,
    ]), await this.getBridgeFee(domain))
    return [approval, transfer].filter((tx): tx is UnsignedTransaction => tx !== undefined)
  }

  async swap(fromToken: Token, toToken: Token, amount: bigint, slippage?: number): Promise<UnsignedTransaction[]> {
    const quote = await this.getQuote(fromToken, toToken, amount)
    if (!quote) throw new Error('No quotes found')
    return this.swapFromQuote(quote, slippage)
  }

  async swapFromQuote(quote: Quote, slippage = this.settings.swapSlippage): Promise<UnsignedTransaction[]> {
    const plan = setupPlanner(quote, slippage, this.signer(), this.settings.swapperContractAddress, {
      newFactory: this.settings.slipstreamFactoryAddress,
      oldFactory: this.settings.oldSlipstreamFactoryAddress,
    })
    const main = this.tx(this.settings.swapperContractAddress, this.encode(abis.swapper, 'execute', [plan.commands, plan.inputs]), quote.input.fromToken.wrappedTokenAddress ? quote.input.amountIn : 0n)
    if (quote.input.fromToken.wrappedTokenAddress) return [main]
    const approvals = await this.permit2Approvals(quote.input.fromToken, quote.input.amountIn)
    return [...approvals, main]
  }

  private getPermit2Address(): Promise<Address> {
    if (!this.caches.permit2AddressCache) {
      const promise = this.read<Address>(this.settings.swapperContractAddress, abis.swapper, 'PERMIT2')
      this.caches.permit2AddressCache = promise
      void promise.catch(() => {
        if (this.caches.permit2AddressCache === promise) this.caches.permit2AddressCache = undefined
      })
    }
    return this.caches.permit2AddressCache
  }

  private async permit2Approvals(token: Token, amount: bigint): Promise<UnsignedTransaction[]> {
    if (amount > MAX_UINT160) throw new RangeError('Permit2 swap amount exceeds uint160')
    const tokenAddress = tokenContractAddress(token)
    const spender = this.settings.swapperContractAddress
    const permit2 = await this.getPermit2Address()
    const [tokenAllowance, permit2Allowance] = await Promise.all([
      this.read<bigint>(tokenAddress, abis.erc20, 'allowance', [this.signer(), permit2]),
      this.read<readonly [bigint, bigint, bigint]>(permit2, abis.permit2, 'allowance', [
        this.signer(), tokenAddress, spender,
      ]),
    ])
    const tokenApproval = tokenAllowance >= amount
      ? undefined
      : this.tx(tokenAddress, this.encode(abis.erc20, 'approve', [permit2, amount]))
    const [permit2Amount, permit2Expiration] = permit2Allowance
    const permit2Approval = permit2Amount >= amount &&
      permit2Expiration > futureTimestamp(PERMIT2_VALIDITY_BUFFER_MINUTES)
      ? undefined
      : this.tx(permit2, this.encode(abis.permit2, 'approve', [
        tokenAddress, spender, amount, futureTimestamp(PERMIT2_APPROVAL_MINUTES),
      ]))
    return [tokenApproval, permit2Approval].filter(
      (transaction): transaction is UnsignedTransaction => transaction !== undefined,
    )
  }

  async poolSpec(token0: Token, token1: Token, options: { tickSpacing?: number; stable?: boolean }): Promise<LiquidityPool> {
    const basicFactoryAddress = options.stable === undefined ? undefined : await this.read<Address>(this.settings.routerContractAddress, abis.router, 'defaultFactory')
    return createPoolSpec(this.settings, token0, token1, { ...options, basicFactoryAddress })
  }

  async quoteBasicDeposit(pool: LiquidityPool, amounts: { amountToken0?: bigint; amountToken1?: bigint }): Promise<DepositQuote> {
    if (pool.isCl) throw new Error('quoteBasicDeposit requires a basic pool')
    if (pool.lp === ADDRESS_ZERO) {
      if (amounts.amountToken0 === undefined || amounts.amountToken1 === undefined) throw new Error('new basic pool requires both amounts')
      return validateDepositQuote({ pool, amountToken0: amounts.amountToken0, amountToken1: amounts.amountToken1, sqrtPriceX96: 0n })
    }
    if ((amounts.amountToken0 === undefined) === (amounts.amountToken1 === undefined)) throw new Error('supply exactly one amount')
    const result = await this.read<unknown>(this.settings.routerContractAddress, abis.router, 'quoteAddLiquidity', [
      normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable, pool.factory,
      amounts.amountToken0 ?? MAX_UINT128, amounts.amountToken1 ?? MAX_UINT128,
    ])
    const [amountToken0, amountToken1] = tupleValues(result)
    return validateDepositQuote({ pool, amountToken0: BigInt(amountToken0 as bigint), amountToken1: BigInt(amountToken1 as bigint), sqrtPriceX96: 0n })
  }

  async quoteConcentratedDeposit(pool: LiquidityPool, options: {
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
      const amountToken1 = await this.read<bigint>(this.settings.slipstreamContractAddress, abis.slipstream, 'estimateAmount1', [options.amountToken0, pool.lp, sqrtRatio, tickLower, tickUpper])
      return validateDepositQuote({ pool, amountToken0: options.amountToken0, amountToken1, tickLower, tickUpper, sqrtPriceX96 })
    }
    const amountToken0 = await this.read<bigint>(this.settings.slipstreamContractAddress, abis.slipstream, 'estimateAmount0', [options.amountToken1!, pool.lp, sqrtRatio, tickLower, tickUpper])
    return validateDepositQuote({ pool, amountToken0, amountToken1: options.amountToken1!, tickLower, tickUpper, sqrtPriceX96 })
  }

  /** A pool leg is native when it is the native token itself (pool specs) or its wrapped form (indexed pools). */
  private isNativeLeg(token: Token): boolean {
    return token.wrappedTokenAddress !== undefined || addressKey(token.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress)
  }

  private async collectApprovals(pool: LiquidityPool, target: Address, amount0: bigint, amount1: bigint) {
    const native0 = this.isNativeLeg(pool.token0)
    const native1 = this.isNativeLeg(pool.token1)
    const approvals: UnsignedTransaction[] = []
    if (!native0) { const tx = await this.setTokenAllowance(pool.token0, target, amount0); if (tx) approvals.push(tx) }
    if (!native1) { const tx = await this.setTokenAllowance(pool.token1, target, amount1); if (tx) approvals.push(tx) }
    return { approvals, native0, native1 }
  }

  async deposit(quote: DepositQuote, deadlineMinutes = 30, slippage = 0.01): Promise<UnsignedTransaction[]> {
    validateDepositQuote(quote)
    const { pool, amountToken0: amount0, amountToken1: amount1 } = quote
    const target = pool.isCl ? pool.nfpm : this.settings.routerContractAddress
    if (!target || target === ADDRESS_ZERO) throw new Error(`pool ${pool.symbol} has no transaction target`)
    const { approvals, native0, native1 } = await this.collectApprovals(pool, target, amount0, amount1)
    const deadline = futureTimestamp(deadlineMinutes)
    if (!pool.isCl) {
      const data = native0 || native1
        ? this.encode(abis.router, 'addLiquidityETH', [
            native0 ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress),
            pool.isStable,
            native0 ? amount1 : amount0,
            applySlippage(native0 ? amount1 : amount0, slippage),
            applySlippage(native0 ? amount0 : amount1, slippage),
            this.signer(), deadline,
          ])
        : this.encode(abis.router, 'addLiquidity', [
            normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable,
            amount0, amount1, applySlippage(amount0, slippage), applySlippage(amount1, slippage), this.signer(), deadline,
          ])
      return [...approvals, this.tx(target, data, native0 ? amount0 : native1 ? amount1 : 0n)]
    }
    const mintArgs = [tokenContractAddress(pool.token0), tokenContractAddress(pool.token1), pool.type, quote.tickLower!, quote.tickUpper!, amount0, amount1, applySlippage(amount0, slippage), applySlippage(amount1, slippage), this.signer(), deadline, quote.sqrtPriceX96] as const
    const data = native0 || native1
      ? this.encode(abis.nfpm, 'multicall', [[this.encode(abis.nfpm, 'mint', [mintArgs]), this.encode(abis.nfpm, 'refundETH')]])
      : this.encode(abis.nfpm, 'mint', [mintArgs])
    return [...approvals, this.tx(target, data, native0 ? amount0 : native1 ? amount1 : 0n)]
  }

  private cleanupCalls(pool: LiquidityPool, positionId: bigint, unwrapNative: boolean, burn: boolean): Hex[] {
    if (unwrapNative && addressKey(pool.token0.tokenAddress) !== addressKey(this.settings.wrappedNativeTokenAddress) && addressKey(pool.token1.tokenAddress) !== addressKey(this.settings.wrappedNativeTokenAddress)) throw new Error('unwrapNative: pool has no native leg')
    const recipient = unwrapNative ? ADDRESS_ZERO : this.signer()
    const calls = [this.encode(abis.nfpm, 'collect', [[positionId, recipient, MAX_UINT128, MAX_UINT128]])]
    if (unwrapNative) {
      const other = addressKey(pool.token0.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress) ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress)
      calls.push(this.encode(abis.nfpm, 'unwrapWETH9', [0n, this.signer()]), this.encode(abis.nfpm, 'sweepToken', [other, 0n, this.signer()]))
    }
    if (burn) calls.push(this.encode(abis.nfpm, 'burn', [positionId]))
    return calls
  }

  async withdraw(withdrawal: Withdrawal, deadlineMinutes = 30, slippage = 0.01, collect = true, unwrapNative = false): Promise<UnsignedTransaction[]> {
    const { pool } = withdrawal
    if (withdrawal.liquidity <= 0n) throw new Error('liquidity must be positive')
    const amount0Min = applySlippage(withdrawal.amountToken0, slippage)
    const amount1Min = applySlippage(withdrawal.amountToken1, slippage)
    const deadline = futureTimestamp(deadlineMinutes)
    if (!pool.isCl) {
      const approval = await this.approveAddressIfNeeded(pool.lp, this.settings.routerContractAddress, withdrawal.liquidity)
      const native0 = addressKey(pool.token0.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress)
      const native1 = addressKey(pool.token1.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress)
      const data = native0 || native1
        ? this.encode(abis.router, 'removeLiquidityETH', [
            native0 ? normalizeAddress(pool.token1.tokenAddress) : normalizeAddress(pool.token0.tokenAddress), pool.isStable, withdrawal.liquidity,
            native0 ? amount1Min : amount0Min, native0 ? amount0Min : amount1Min, this.signer(), deadline,
          ])
        : this.encode(abis.router, 'removeLiquidity', [normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.isStable, withdrawal.liquidity, amount0Min, amount1Min, this.signer(), deadline])
      const main = this.tx(this.settings.routerContractAddress, data)
      return [approval, main].filter((tx): tx is UnsignedTransaction => tx !== undefined)
    }
    if (withdrawal.positionId === undefined) throw new Error('CL Withdrawal requires positionId')
    if ((withdrawal.burn || unwrapNative) && !collect) throw new Error('burn / unwrapNative require collect=true')
    const decrease = this.encode(abis.nfpm, 'decreaseLiquidity', [[withdrawal.positionId, withdrawal.liquidity, amount0Min, amount1Min, deadline]])
    const data = collect
      ? this.encode(abis.nfpm, 'multicall', [[decrease, ...this.cleanupCalls(pool, withdrawal.positionId, unwrapNative, withdrawal.burn)]])
      : decrease
    return [this.tx(pool.nfpm, data)]
  }

  private async approveAddressIfNeeded(token: Address, spender: Address, amount: bigint): Promise<UnsignedTransaction | undefined> {
    const allowance = await this.read<bigint>(token, abis.erc20, 'allowance', [this.signer(), spender])
    return allowance >= amount ? undefined : this.tx(token, this.encode(abis.erc20, 'approve', [spender, amount]))
  }

  private assertPosition(position: Position): void {
    if (position.isAlm) throw new Error('ALM-managed position; not supported')
    if (!position.pool.gauge || position.pool.gauge === ADDRESS_ZERO) throw new Error(`pool ${position.pool.symbol} has no gauge`)
  }

  async stake(position: Position): Promise<UnsignedTransaction[]> {
    this.assertPosition(position)
    const pool = position.pool
    if (!pool.gaugeAlive) throw new Error(`gauge for ${pool.symbol} is not active`)
    const gaugeAbi = pool.isCl ? abis.gaugeCl : abis.gaugeBasic
    if (pool.isCl) {
      if (position.staked > 0n) throw new Error(`CL position #${position.id} is already staked`)
      if (position.liquidity === 0n) throw new Error(`CL position #${position.id} has no liquidity to stake`)
      return [this.tx(pool.nfpm, this.encode(abis.nfpm, 'approve', [pool.gauge, position.id])), this.tx(pool.gauge, this.encode(gaugeAbi, 'deposit', [position.id]))]
    }
    if (position.liquidity === 0n) throw new Error(`no LP to stake for ${pool.symbol}`)
    const approval = await this.approveAddressIfNeeded(pool.lp, pool.gauge, position.liquidity)
    const main = this.tx(pool.gauge, this.encode(gaugeAbi, 'deposit', [position.liquidity]))
    return [approval, main].filter((tx): tx is UnsignedTransaction => tx !== undefined)
  }

  async unstake(position: Position, amount?: bigint): Promise<UnsignedTransaction[]> {
    this.assertPosition(position)
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
    return [this.tx(pool.gauge, this.encode(gaugeAbi, 'withdraw', [value]))]
  }

  async claimEmissions(position: Position): Promise<UnsignedTransaction[]> {
    this.assertPosition(position)
    const pool = position.pool
    return [this.tx(pool.gauge, this.encode(pool.isCl ? abis.gaugeCl : abis.gaugeBasic, 'getReward', [pool.isCl ? position.id : this.signer()]))]
  }

  async claimFees(position: Position, burn = false, unwrapNative = false): Promise<UnsignedTransaction[]> {
    this.assertPosition(position)
    if (position.staked > 0n) throw new Error('position is staked; unstake first to claim fees')
    const pool = position.pool
    if (!pool.isCl) return [this.tx(pool.lp, this.encode(abis.poolBasic, 'claimFees'))]
    if (burn && position.liquidity > 0n) throw new Error('burn requires liquidity == 0; drain via withdraw first')
    return [this.tx(pool.nfpm, this.encode(abis.nfpm, 'multicall', [this.cleanupCalls(pool, position.id, unwrapNative, burn)]))]
  }
}

export function createSugarClient(chainId: ChainId | number, options: SugarClientOptions = {}): SugarClient {
  return new SugarClient(chainId, options)
}
