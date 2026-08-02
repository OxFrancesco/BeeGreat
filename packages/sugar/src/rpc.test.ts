import { describe, expect, test } from 'bun:test'
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  HttpRequestError,
  type PublicClient,
} from 'viem'
import { abis } from './abis'
import { SugarClient } from './client'
import { SugarRpcError } from './errors'
import type { PathHop, Token } from './types'

function quoteFixture(): { fromToken: Token; rawPool: unknown[]; toToken: Token } {
  const fromToken: Token = {
    chainId: 10,
    chainName: 'OP',
    decimals: 18,
    emerging: false,
    listed: true,
    symbol: 'FROM',
    tokenAddress: '0x2000000000000000000000000000000000000001',
  }
  const toToken: Token = {
    ...fromToken,
    symbol: 'TO',
    tokenAddress: '0x2000000000000000000000000000000000000002',
  }
  return {
    fromToken,
    toToken,
    rawPool: [
      '0x2000000000000000000000000000000000000003',
      -1,
      fromToken.tokenAddress,
      toToken.tokenAddress,
      '0x2000000000000000000000000000000000000004',
    ],
  }
}

describe('Sugar RPC policy', () => {
  test('prefers the shortest route when its output is within configured slippage of the best quote', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const direct: PathHop[] = [{
      pool: {
        chainId: 10,
        chainName: 'OP',
        factory: rawPool[4] as `0x${string}`,
        isBasic: true,
        isCl: false,
        isStable: false,
        lp: rawPool[0] as `0x${string}`,
        token0Address: fromToken.tokenAddress as `0x${string}`,
        token1Address: toToken.tokenAddress as `0x${string}`,
        type: -1,
      },
      reversed: false,
    }]
    const threeHop: PathHop[] = [
      direct[0],
      { ...direct[0], pool: { ...direct[0].pool, lp: '0x2000000000000000000000000000000000000005' } },
      { ...direct[0], pool: { ...direct[0].pool, lp: '0x2000000000000000000000000000000000000006' } },
    ]
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => [
          { status: 'success', result: [1_000n] },
          { status: 'success', result: [995n] },
        ],
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      settings: { swapSlippage: 0.01 },
    })
    sugar.getPathsForQuote = () => [threeHop, direct]

    const quote = await sugar.getQuote(fromToken, toToken, 10n)

    expect(quote?.amountOut).toBe(995n)
    expect(quote?.input.path).toHaveLength(1)
  })

  test('disables Viem retries on the SDK-owned transport', () => {
    const sugar = new SugarClient(10, { env: {} })
    expect(sugar.publicClient.transport.retryCount).toBe(0)
  })

  test('retries transient reads and resolves through the Promise interface', async () => {
    let attempts = 0
    const unavailable = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          attempts += 1
          if (attempts < 3) throw unavailable
          return 123n
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 2 },
    })

    await expect(sugar.getBridgeFee(130)).resolves.toBe(123n)
    expect(attempts).toBe(3)
  })

  test('preserves the upstream error after transient retries are exhausted', async () => {
    let attempts = 0
    const unavailable = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          attempts += 1
          throw unavailable
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 2 },
    })

    const error = await sugar.getBridgeFee(130).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(attempts).toBe(3)
    expect(error).toMatchObject({
      attempts: 3,
      code: 'RPC_UNAVAILABLE',
      name: 'SugarRpcError',
      retryable: true,
    })
    expect((error as SugarRpcError).cause).toBe(unavailable)
  })

  test('does not retry a deterministic price-oracle revert', async () => {
    const token: Token = {
      chainId: 10,
      chainName: 'OP',
      decimals: 18,
      emerging: false,
      listed: true,
      symbol: 'TEST',
      tokenAddress: '0x2222222222222222222222222222222222222222',
    }
    const reverted = new ContractFunctionRevertedError({
      abi: abis.priceOracle,
      functionName: 'getManyRatesToEthWithCustomConnectors',
      message: 'execution reverted',
    })
    const upstream = new ContractFunctionExecutionError(reverted, {
      abi: abis.priceOracle,
      args: [[], false, [], 0],
      contractAddress: '0x3333333333333333333333333333333333333333',
      functionName: 'getManyRatesToEthWithCustomConnectors',
    })
    let attempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          attempts += 1
          throw upstream
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 3 },
    })

    const error = await sugar.getPrices([token]).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(attempts).toBe(1)
    expect(error).toBeInstanceOf(SugarRpcError)
    expect(error).toMatchObject({
      attempts: 1,
      code: 'RPC_READ_FAILED',
      operation: 'getManyRatesToEthWithCustomConnectors',
      retryable: false,
    })
    expect((error as SugarRpcError).cause).toBe(upstream)
  })

  test('stops scheduling queued price batches after one batch fails', async () => {
    const tokens: Token[] = [
      '0x1000000000000000000000000000000000000001',
      '0x1000000000000000000000000000000000000002',
      '0x1000000000000000000000000000000000000003',
    ].map((tokenAddress, index) => ({
      chainId: 10,
      chainName: 'OP',
      decimals: 18,
      emerging: false,
      listed: true,
      symbol: `T${index + 1}`,
      tokenAddress,
    }))
    const reverted = new ContractFunctionRevertedError({
      abi: abis.priceOracle,
      functionName: 'getManyRatesToEthWithCustomConnectors',
      message: 'execution reverted',
    })
    const upstream = new ContractFunctionExecutionError(reverted, {
      abi: abis.priceOracle,
      args: [[], false, [], 0],
      functionName: 'getManyRatesToEthWithCustomConnectors',
    })
    const started: string[] = []
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { args?: readonly unknown[] }) => {
          const address = String((request.args?.[0] as string[])[0])
          started.push(address)
          if (address === tokens[0].tokenAddress) throw upstream
          if (address === tokens[1].tokenAddress) await Bun.sleep(25)
          return [1n]
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
      settings: { priceBatchSize: 1, requestConcurrency: 2 },
    })

    await expect(sugar.getPrices(tokens)).rejects.toBeInstanceOf(SugarRpcError)
    await Bun.sleep(50)
    expect(started).toEqual([tokens[0].tokenAddress, tokens[1].tokenAddress])
  })

  test('stops scheduling queued pool pages after one page fails', async () => {
    const started: number[] = []
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 25n
          const offset = Number(request.args?.[1])
          started.push(offset)
          if (offset === 0) throw new Error('malformed first page')
          if (offset === 10) await Bun.sleep(25)
          return []
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
      settings: {
        poolPaginationMaxSize: 10,
        poolPaginationMinSize: 10,
        poolPaginationTargetCalls: 90,
        requestConcurrency: 2,
      },
    })

    await expect(sugar.getRawPools()).rejects.toBeInstanceOf(SugarRpcError)
    await Bun.sleep(50)
    expect(started).toEqual([0, 10])
  })

  test('applies the same retry policy to native balance reads', async () => {
    let attempts = 0
    const unavailable = new HttpRequestError({
      body: { method: 'eth_getBalance' },
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    const sugar = new SugarClient(10, {
      account: '0x1111111111111111111111111111111111111111',
      publicClient: {
        getBalance: async () => {
          attempts += 1
          if (attempts < 3) throw unavailable
          return 42n
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 2 },
    })
    const native: Token = {
      chainId: 10,
      chainName: 'OP',
      decimals: 18,
      emerging: false,
      listed: true,
      symbol: 'ETH',
      tokenAddress: sugar.settings.wrappedNativeTokenAddress,
      wrappedTokenAddress: sugar.settings.wrappedNativeTokenAddress,
    }

    await expect(sugar.getTokenBalance(native)).resolves.toBe(42n)
    expect(attempts).toBe(3)
  })

  test('returns a native timeout error instead of an Effect FiberFailure', async () => {
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          await Bun.sleep(50)
          return 123n
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 5, maxRetries: 0 },
    })

    const error = await sugar.getBridgeFee(130).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(error).toBeInstanceOf(SugarRpcError)
    expect(error).toMatchObject({
      attempts: 1,
      code: 'RPC_TIMEOUT',
      name: 'SugarRpcError',
      operation: 'quoteGasPayment',
      retryable: true,
    })
  })

  test('retries quote multicalls before using the direct-call fallback', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const unavailable = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    let multicallAttempts = 0
    let directAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => {
          multicallAttempts += 1
          if (multicallAttempts < 3) throw unavailable
          return [{ status: 'success', result: [999n] }]
        },
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') {
            directAttempts += 1
            return [111n]
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 2 },
      settings: { requestConcurrency: 2 },
    })

    await expect(sugar.getQuote(fromToken, toToken, 10n)).resolves.toMatchObject({ amountOut: 999n })
    expect(multicallAttempts).toBe(3)
    expect(directAttempts).toBe(0)
  })

  test('skips the direct fallback phase when every multicall succeeds', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => [{ status: 'success', result: [999n] }],
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })
    const rpc = (sugar as unknown as {
      rpc: {
        forEachReadResult: (...args: unknown[]) => Promise<unknown>
      }
    }).rpc
    const original = rpc.forEachReadResult.bind(rpc)
    const operations: string[] = []
    rpc.forEachReadResult = (...args) => {
      operations.push(String(args[0]))
      return original(...args)
    }

    await expect(sugar.getQuote(fromToken, toToken, 10n)).resolves.toMatchObject({ amountOut: 999n })
    expect(operations).toEqual(['quoteExactInput.multicall'])
  })

  test('falls back when a multicall returns a malformed success payload', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    let directAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => [{ status: 'success', result: undefined }],
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') {
            directAttempts += 1
            return [111n]
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(sugar.getQuote(fromToken, toToken, 10n)).resolves.toMatchObject({ amountOut: 111n })
    expect(directAttempts).toBe(1)
  })

  test('omits a malformed direct quote payload', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => { throw new Error('Multicall3 is not deployed') },
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') return undefined
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(sugar.getQuote(fromToken, toToken, 10n)).resolves.toBeUndefined()
  })

  test('does not amplify an exhausted quote rate limit through direct fallbacks', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const rateLimited = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 429,
      url: 'https://rpc.example.invalid',
    })
    let multicallAttempts = 0
    let directAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => {
          multicallAttempts += 1
          throw rateLimited
        },
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') {
            directAttempts += 1
            return [111n]
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 1 },
      settings: { requestConcurrency: 2 },
    })

    const error = await sugar.getQuote(fromToken, toToken, 10n).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(error).toMatchObject({
      attempts: 2,
      code: 'RPC_RATE_LIMITED',
      name: 'SugarRpcError',
      retryable: true,
    })
    expect(multicallAttempts).toBe(2)
    expect(directAttempts).toBe(0)
  })

  test('interrupts sibling quote retries when one batch exhausts', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    const rateLimited = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 429,
      url: 'https://rpc.example.invalid',
    })
    const slowUnavailable = new HttpRequestError({
      body: { method: 'eth_call' },
      headers: new Headers({ 'Retry-After': '0.05' }),
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    let fastAttempts = 0
    let slowAttempts = 0
    let directAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async (request: { contracts: readonly unknown[] }) => {
          if (request.contracts.length === 1) {
            fastAttempts += 1
            throw rateLimited
          }
          slowAttempts += 1
          throw slowUnavailable
        },
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') {
            directAttempts += 1
            return [111n]
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 2 },
      settings: { requestConcurrency: 2 },
    })
    const path: PathHop[] = [{
      pool: {
        chainId: 10,
        chainName: 'OP',
        factory: rawPool[4] as `0x${string}`,
        isBasic: true,
        isCl: false,
        isStable: false,
        lp: rawPool[0] as `0x${string}`,
        token0Address: fromToken.tokenAddress as `0x${string}`,
        token1Address: toToken.tokenAddress as `0x${string}`,
        type: -1,
      },
      reversed: false,
    }]
    sugar.getPathsForQuote = () => Array.from({ length: 501 }, () => path)

    await expect(sugar.getQuote(fromToken, toToken, 10n)).rejects.toMatchObject({
      code: 'RPC_RATE_LIMITED',
    })
    const slowAttemptsAtReturn = slowAttempts
    await Bun.sleep(150)
    expect(fastAttempts).toBe(3)
    expect(slowAttempts).toBe(slowAttemptsAtReturn)
    expect(directAttempts).toBe(0)
  })

  test('shares one deadline across quote multicall and direct fallback', async () => {
    const { fromToken, rawPool, toToken } = quoteFixture()
    let directAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        multicall: async () => {
          await Bun.sleep(60)
          throw new Error('Multicall3 is not deployed')
        },
        readContract: async (request: { args?: readonly unknown[]; functionName: string }) => {
          if (request.functionName === 'count') return 1n
          if (request.functionName === 'forSwaps') return Number(request.args?.[1]) === 0 ? [rawPool] : []
          if (request.functionName === 'quoteExactInput') {
            directAttempts += 1
            await Bun.sleep(100)
            return [111n]
          }
          throw new Error(`Unexpected read: ${request.functionName}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 80, maxRetries: 0 },
      settings: { requestConcurrency: 2 },
    })

    const startedAt = performance.now()
    const error = await sugar.getQuote(fromToken, toToken, 10n).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(performance.now() - startedAt).toBeLessThan(120)
    expect(error).toMatchObject({ code: 'RPC_TIMEOUT', name: 'SugarRpcError' })
    expect(directAttempts).toBe(1)
  })

  test('shares one deadline across pagination count and page reads', async () => {
    let pageAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { functionName: string }) => {
          if (request.functionName === 'count') {
            await Bun.sleep(60)
            return 1n
          }
          pageAttempts += 1
          await Bun.sleep(100)
          return []
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 80, maxRetries: 0 },
    })

    const startedAt = performance.now()
    const error = await sugar.getRawPools().then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(performance.now() - startedAt).toBeLessThan(120)
    expect(error).toMatchObject({ code: 'RPC_TIMEOUT', name: 'SugarRpcError' })
    expect(pageAttempts).toBeGreaterThan(0)
  })

  test('evicts rejected pool caches so a recovered RPC can be retried', async () => {
    let countAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { functionName: string }) => {
          if (request.functionName !== 'count') return []
          countAttempts += 1
          if (countAttempts === 1) throw new Error('malformed count response')
          return 1n
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(sugar.getPoolCount()).rejects.toBeInstanceOf(SugarRpcError)
    await expect(sugar.getPoolCount()).resolves.toBe(1)
    expect(countAttempts).toBe(2)
  })

  test('coalesces concurrent pool-count reads', async () => {
    let countAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          countAttempts += 1
          await Bun.sleep(20)
          return 1n
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(Promise.all([
      sugar.getPoolCount(),
      sugar.getPoolCount(),
      sugar.getPoolCount(),
    ])).resolves.toEqual([1, 1, 1])
    expect(countAttempts).toBe(1)
  })

  test('evicts rejected raw-pool promises so a recovered RPC can be retried', async () => {
    let pageAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { functionName: string }) => {
          if (request.functionName === 'count') return 0n
          pageAttempts += 1
          if (pageAttempts === 1) throw new Error('malformed pool page')
          return []
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(sugar.getRawPools()).rejects.toBeInstanceOf(SugarRpcError)
    await expect(sugar.getRawPools()).resolves.toEqual([])
    expect(pageAttempts).toBe(2)
  })

  test('rejects unsafe on-chain pool counts before pagination', async () => {
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    await expect(sugar.getPoolCount()).rejects.toThrow('safe non-negative integer')
  })

  test('caps the number of pagination requests', () => {
    const sugar = new SugarClient(10, { env: {} })
    expect(() => sugar.getPoolPaginator(4_000_000)).toThrow('at most 10000 requests')
  })

  test('rejects invalid pagination settings', () => {
    const negative = new SugarClient(10, {
      env: {},
      settings: { poolPaginationMaxSize: -1, poolPaginationMinSize: -1 },
    })
    const reversed = new SugarClient(10, {
      env: {},
      settings: { poolPaginationMaxSize: 10, poolPaginationMinSize: 20 },
    })

    expect(() => negative.getPoolPaginator(1)).toThrow('positive safe integers')
    expect(() => reversed.getPoolPaginator(1)).toThrow('minimum cannot exceed maximum')
  })

  test('returns a native pagination-bound error for a hostile RPC count', async () => {
    let pageAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { functionName: string }) => {
          if (request.functionName === 'count') return 4_000_000n
          pageAttempts += 1
          return []
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 1_000, maxRetries: 0 },
    })

    const error = await sugar.getRawPools().then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(error).toBeInstanceOf(RangeError)
    expect((error as Error).name).toBe('RangeError')
    expect(pageAttempts).toBe(0)
  })

  test('honors Retry-After without exceeding the total RPC deadline', async () => {
    let attempts = 0
    const rateLimited = new HttpRequestError({
      body: { method: 'eth_call' },
      headers: new Headers({ 'Retry-After': '60' }),
      status: 429,
      url: 'https://rpc.example.invalid',
    })
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async () => {
          attempts += 1
          throw rateLimited
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 10, maxRetries: 3 },
    })

    const error = await sugar.getBridgeFee(130).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(attempts).toBe(1)
    expect(error).toMatchObject({
      attempts: 1,
      code: 'RPC_TIMEOUT',
      name: 'SugarRpcError',
    })
    expect((error as SugarRpcError).cause).toBe(rateLimited)
  })

  test('does not attach a recovered sibling failure to a later timeout', async () => {
    const [recoveringToken, hangingToken] = [
      '0x3000000000000000000000000000000000000001',
      '0x3000000000000000000000000000000000000002',
    ].map((tokenAddress, index): Token => ({
      chainId: 10,
      chainName: 'OP',
      decimals: 18,
      emerging: false,
      listed: true,
      symbol: `T${index + 1}`,
      tokenAddress,
    }))
    const unavailable = new HttpRequestError({
      body: { method: 'eth_call' },
      status: 503,
      url: 'https://rpc.example.invalid',
    })
    let recoveringAttempts = 0
    const sugar = new SugarClient(10, {
      publicClient: {
        readContract: async (request: { args?: readonly unknown[] }) => {
          const address = String((request.args?.[0] as string[])[0])
          if (address === recoveringToken.tokenAddress) {
            recoveringAttempts += 1
            if (recoveringAttempts === 1) throw unavailable
            return [1n]
          }
          if (address === hangingToken.tokenAddress) {
            await Bun.sleep(100)
            return [1n]
          }
          throw new Error(`Unexpected token: ${address}`)
        },
      } as unknown as PublicClient,
      rpcPolicy: { baseDelayMs: 0, deadlineMs: 30, maxRetries: 1 },
      settings: { priceBatchSize: 1, requestConcurrency: 2 },
    })

    const error = await sugar.getPrices([recoveringToken, hangingToken]).then(
      () => undefined,
      (failure: unknown) => failure,
    )
    expect(error).toMatchObject({ code: 'RPC_TIMEOUT', name: 'SugarRpcError' })
    expect((error as SugarRpcError).cause).toBeUndefined()
    expect(recoveringAttempts).toBe(2)
  })
})
