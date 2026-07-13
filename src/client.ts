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
  addressKey,
  applySlippage,
  chunk,
  findAllPaths,
  futureTimestamp,
  mapConcurrent,
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
  type Position,
  type Price,
  type Quote,
  type SugarClientOptions,
  type Token,
  type UnsignedTransaction,
  type Withdrawal,
} from './types'

type ReadArgs = readonly unknown[] | undefined
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

export class SugarClient {
  readonly settings: ChainSettings
  readonly account?: Address
  readonly publicClient: PublicClient
  private tokenCache?: Promise<Token[]>
  private poolCountCache?: Promise<number>
  private rawPoolCache = new Map<boolean, Promise<unknown[]>>()
  private poolCache = new Map<boolean, Promise<LiquidityPool[] | LiquidityPoolForSwap[]>>()

  constructor(chainId: ChainId | number, options: SugarClientOptions = {}) {
    this.settings = getChainSettings(chainId, { env: options.env, overrides: { ...options.settings, rpcUrl: options.rpcUrl ?? options.settings?.rpcUrl } })
    this.account = options.account ? normalizeAddress(options.account) : undefined
    this.publicClient = options.publicClient ?? createPublicClient({
      // Several upstream public RPCs (notably Lisk dRPC) reject JSON-RPC batch
      // bodies with HTTP 500. Contract-level Multicall3 is used where batching
      // matters, while the base transport stays universally compatible.
      transport: options.transport ?? http(this.settings.rpcUrl, { timeout: 120_000 }),
      batch: { multicall: true },
    })
  }

  private async read<T>(address: Address, abi: Abi, functionName: string, args?: ReadArgs): Promise<T> {
    return await this.publicClient.readContract({ address, abi, functionName, args } as never) as T
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
    return Math.max(this.settings.poolPaginationMinSize, Math.min(Math.floor(poolCount / this.settings.poolPaginationTargetCalls), this.settings.poolPaginationMaxSize))
  }

  calculateOptimalBatchSize(poolCount: number): number {
    return this.pageSize(poolCount)
  }

  getPoolPaginator(poolCount: number): Array<{ offset: number; limit: number }> {
    const limit = this.pageSize(poolCount)
    const pages: Array<{ offset: number; limit: number }> = []
    for (let offset = 0; offset < poolCount + 10; offset += limit) pages.push({ offset, limit })
    return pages
  }

  private async paginate<T>(reader: (limit: number, offset: number) => Promise<T[]>): Promise<T[]> {
    const count = await this.getPoolCount()
    const requests = this.getPoolPaginator(count)
    const pages = await mapConcurrent(requests, this.settings.requestConcurrency, ({ limit, offset }) => reader(limit, offset))
    return pages.flat()
  }

  getPoolCount(): Promise<number> {
    this.poolCountCache ??= this.read<bigint>(this.settings.sugarContractAddress, abis.sugar, 'count').then(Number)
    return this.poolCountCache
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
      ? this.publicClient.getBalance({ address: ownerAddress })
      : this.balanceOf(normalizeAddress(token.tokenAddress), ownerAddress)
  }

  async getUserIcaBalance(userIca: Address): Promise<bigint> {
    return this.balanceOf(this.settings.bridgeTokenAddress, userIca)
  }

  getAllTokens(listedOnly = false): Promise<Token[]> {
    this.tokenCache ??= this.paginate((limit, offset) => this.read<unknown[]>(
      this.settings.sugarContractAddress,
      abis.sugar,
      'tokens',
      [limit, offset, ADDRESS_ZERO, []],
    )).then((raw) => prepareTokens(raw, this.settings))
    return this.tokenCache.then((tokens) => listedOnly ? tokens.filter((token, index) => index === 0 || token.listed) : tokens)
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
    const batches = chunk(requestTokens, this.settings.priceBatchSize)
    const connectors = this.getPriceConnectors()
    const results = await mapConcurrent(batches, this.settings.requestConcurrency, async (batch) => {
      let error: unknown
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          return await this.read<bigint[]>(this.settings.priceOracleContractAddress, abis.priceOracle, 'getManyRatesToEthWithCustomConnectors', [
            batch.map(tokenContractAddress), false, connectors, this.settings.priceThresholdFilter,
          ])
        } catch (caught) { error = caught }
      }
      throw new Error('price oracle batch failed after 3 retries', { cause: error })
    })
    const rateMap = new Map<string, bigint>()
    batches.forEach((batch, index) => batch.forEach((token, tokenIndex) => rateMap.set(token.tokenAddress, results[index][tokenIndex])))
    return preparePrices(tokens, tokens.map((token) => rateMap.get(token.tokenAddress) ?? 0n), this.settings)
  }

  getRawPools(forSwaps = false): Promise<unknown[]> {
    let promise = this.rawPoolCache.get(forSwaps)
    if (!promise) {
      promise = this.paginate((limit, offset) => this.read<unknown[]>(
        this.settings.sugarContractAddress,
        abis.sugar,
        forSwaps ? 'forSwaps' : 'all',
        forSwaps ? [limit, offset] : [limit, offset, 0],
      ))
      this.rawPoolCache.set(forSwaps, promise)
    }
    return promise
  }

  async getPools(): Promise<LiquidityPool[]>
  async getPools(forSwaps: false): Promise<LiquidityPool[]>
  async getPools(forSwaps: true): Promise<LiquidityPoolForSwap[]>
  async getPools(forSwaps = false): Promise<LiquidityPool[] | LiquidityPoolForSwap[]> {
    let promise = this.poolCache.get(forSwaps)
    if (!promise) {
      promise = (async () => {
        const raw = await this.getRawPools(forSwaps)
        if (forSwaps) return raw.map((pool) => poolForSwapFromTuple(pool, this.settings))
        const tokens = await this.getAllTokens()
        return preparePools(raw, tokens, await this.getPrices(tokens), this.settings)
      })()
      this.poolCache.set(forSwaps, promise)
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
    const rawEpochs = await this.paginate((limit, offset) => this.read<unknown[]>(this.settings.sugarRewardsContractAddress, abis.sugarRewards, 'epochsLatest', [limit, offset]))
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
    const [raw, pools] = await Promise.all([
      this.paginate((limit, offset) => this.read<unknown[]>(this.settings.sugarContractAddress, abis.sugar, 'positions', [limit, offset, owner])),
      this.getPools(),
    ])
    const poolMap = new Map(pools.map((pool) => [addressKey(pool.lp), pool]))
    return raw.map((position) => positionFromTuple(position, poolMap, this.settings)).filter((position): position is Position => position !== undefined)
  }

  filterPoolsForSwap(pools: LiquidityPoolForSwap[], fromToken: Token, toToken: Token): LiquidityPoolForSwap[] {
    const matches = new Set([...this.settings.connectorTokenAddresses, tokenContractAddress(fromToken), tokenContractAddress(toToken)].map(addressKey))
    return pools.filter((pool) => matches.has(addressKey(pool.token0Address)) || matches.has(addressKey(pool.token1Address)))
  }

  getPathsForQuote(fromToken: Token, toToken: Token, pools: LiquidityPoolForSwap[], excludedAddresses = this.settings.excludedTokenAddresses) {
    const excluded = new Set(excludedAddresses.map(addressKey))
    excluded.delete(addressKey(tokenContractAddress(fromToken)))
    excluded.delete(addressKey(tokenContractAddress(toToken)))
    return findAllPaths(pools, tokenContractAddress(fromToken), tokenContractAddress(toToken), 3).filter((path) =>
      !path.some((hop, index) => index > 0 && excluded.has(addressKey(hop.reversed ? hop.pool.token1Address : hop.pool.token0Address))),
    )
  }

  async getQuote(fromToken: Token, toToken: Token, amount: bigint, filter?: (quote: Quote) => boolean): Promise<Quote | undefined> {
    const pools = this.filterPoolsForSwap(await this.getPoolsForSwaps(), fromToken, toToken)
    const paths = this.getPathsForQuote(fromToken, toToken, pools)
    const inputs = paths.map((path) => ({
      path,
      encoded: packPath(path, { newFactory: this.settings.slipstreamFactoryAddress, oldFactory: this.settings.oldSlipstreamFactoryAddress }).encoded,
    }))
    const batches = chunk(inputs, 250)
    const quoteBatches = await mapConcurrent(batches, Math.min(4, batches.length), async (batch) => {
      try {
        const results = await this.publicClient.multicall({
          allowFailure: true,
          multicallAddress: MULTICALL3,
          contracts: batch.map(({ encoded }) => ({
            address: this.settings.quoterContractAddress,
            abi: abis.quoter,
            functionName: 'quoteExactInput',
            args: [encoded, amount],
          })),
        } as never) as Array<{ status: 'success'; result: unknown } | { status: 'failure' }>
        return batch.map(({ path }, index): Quote | undefined => {
          const response = results[index]
          if (!response || response.status !== 'success') return undefined
          const result = response.result
          const amountOut = Array.isArray(result) || (result && typeof result === 'object') ? BigInt(tupleValues(result)[0] as bigint) : BigInt(result as bigint)
          return { input: { fromToken, toToken, path, amountIn: amount, slipstreamFactoryAddress: this.settings.slipstreamFactoryAddress, oldSlipstreamFactoryAddress: this.settings.oldSlipstreamFactoryAddress }, amountOut }
        })
      } catch {
        // Some private/test networks do not deploy Multicall3. Preserve the
        // SDK surface with a bounded direct-call fallback.
        return mapConcurrent(batch, this.settings.requestConcurrency, async ({ path, encoded }): Promise<Quote | undefined> => {
          try {
            const result = await this.read<unknown>(this.settings.quoterContractAddress, abis.quoter, 'quoteExactInput', [encoded, amount])
            const amountOut = Array.isArray(result) || (result && typeof result === 'object') ? BigInt(tupleValues(result)[0] as bigint) : BigInt(result as bigint)
            return { input: { fromToken, toToken, path, amountIn: amount, slipstreamFactoryAddress: this.settings.slipstreamFactoryAddress, oldSlipstreamFactoryAddress: this.settings.oldSlipstreamFactoryAddress }, amountOut }
          } catch { return undefined }
        })
      }
    })
    const quotes = quoteBatches.flat()
    const valid = quotes.filter((quote): quote is Quote => quote !== undefined && (!filter || filter(quote)))
    return valid.reduce<Quote | undefined>((best, quote) => !best || quote.amountOut > best.amountOut ? quote : best, undefined)
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
    const approval = await this.setTokenAllowance(quote.input.fromToken, this.settings.swapperContractAddress, quote.input.amountIn)
    return [approval, main].filter((tx): tx is UnsignedTransaction => tx !== undefined)
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

  private async collectApprovals(pool: LiquidityPool, target: Address, amount0: bigint, amount1: bigint) {
    const native0 = addressKey(pool.token0.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress)
    const native1 = addressKey(pool.token1.tokenAddress) === addressKey(this.settings.wrappedNativeTokenAddress)
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
    const mintArgs = [normalizeAddress(pool.token0.tokenAddress), normalizeAddress(pool.token1.tokenAddress), pool.type, quote.tickLower!, quote.tickUpper!, amount0, amount1, applySlippage(amount0, slippage), applySlippage(amount1, slippage), this.signer(), deadline, quote.sqrtPriceX96] as const
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
