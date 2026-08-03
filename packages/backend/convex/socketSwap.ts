import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'

export type SocketChain = 'base' | 'arbitrum'
export type SocketToken = 'eth' | 'usdc'

export const SOCKET_NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const SOCKET_CHAINS = {
  base: {
    chainId: 8453,
    crossmintChain: 'base' as const,
    displayName: 'Base',
    explorerUrl: 'https://basescan.org',
    tokens: {
      eth: { address: SOCKET_NATIVE_TOKEN, decimals: 18 },
      usdc: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
    },
  },
  arbitrum: {
    chainId: 42161,
    crossmintChain: 'arbitrum' as const,
    displayName: 'Arbitrum',
    explorerUrl: 'https://arbiscan.io',
    tokens: {
      eth: { address: SOCKET_NATIVE_TOKEN, decimals: 18 },
      usdc: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
      },
    },
  },
} as const

export type SocketApiConfig = {
  baseUrl: string
  headers: Record<string, string>
}

/**
 * Socket's public V3 endpoint is suitable for an uncredentialed fallback.
 * A configured key upgrades requests to the dedicated production endpoint.
 */
export function createSocketApiConfig(apiKey?: string): SocketApiConfig {
  const key = apiKey?.trim()
  if (!key) {
    return {
      baseUrl: 'https://public-backend.socket.tech',
      headers: {},
    }
  }
  return {
    baseUrl: 'https://dedicated-backend.socket.tech',
    headers: { 'x-api-key': key },
  }
}

const SOCKET_TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const SOCKET_RETRY_POLICY = {
  attemptTimeoutMs: 30_000,
  baseDelayMs: 250,
  maxRetries: 2,
} as const

class SocketTransientFailure extends Data.TaggedError('SocketTransientFailure')<{
  readonly cause?: unknown
  readonly response?: Response
  readonly retryAfterMs: number
}> {}

function headerRetryAfterMs(headers: Headers): number {
  const value = headers.get('Retry-After')
  if (typeof value !== 'string' || value.trim() === '') return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000)
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  return 0
}

/**
 * Socket quote/status reads are idempotent, so transient failures (network
 * errors, per-attempt timeouts, 408/429/5xx) retry with the Retry-After hint
 * plus exponential backoff. The last transient response still flows to the
 * caller's canonical body handling; deterministic statuses are never retried.
 */
async function socketFetch(
  url: string,
  config: SocketApiConfig,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const attempt = Effect.tryPromise({
    try: (signal) => fetchImpl(url, { headers: config.headers, signal }),
    catch: (cause) => new SocketTransientFailure({ cause, retryAfterMs: 0 }),
  }).pipe(
    Effect.timeoutFail({
      duration: SOCKET_RETRY_POLICY.attemptTimeoutMs,
      onTimeout: () =>
        new SocketTransientFailure({
          cause: new Error(
            `Socket request timed out after ${SOCKET_RETRY_POLICY.attemptTimeoutMs}ms`,
          ),
          retryAfterMs: 0,
        }),
    }),
    Effect.flatMap((response) =>
      SOCKET_TRANSIENT_STATUSES.has(response.status)
        ? Effect.fail(
            new SocketTransientFailure({
              response,
              retryAfterMs: headerRetryAfterMs(response.headers),
            }),
          )
        : Effect.succeed(response),
    ),
  )
  const program = Effect.retry(
    attempt,
    Schedule.identity<SocketTransientFailure>().pipe(
      Schedule.addDelay((failure) => failure.retryAfterMs),
      Schedule.intersect(Schedule.exponential(SOCKET_RETRY_POLICY.baseDelayMs)),
      Schedule.intersect(Schedule.recurs(SOCKET_RETRY_POLICY.maxRetries)),
    ),
  )
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Right') return result.right
  if (result.left.response) return result.left.response
  throw result.left.cause
}

export type SocketQuote = {
  quoteId: string
  originChain: SocketChain
  destinationChain: SocketChain
  originChainId: number
  destinationChainId: number
  inputToken: SocketToken
  outputToken: SocketToken
  inputAmount: string
  inputAmountUnits: string
  outputAmount: string
  outputAmountUnits: string
  minimumOutputAmount: string
  minimumOutputAmountUnits: string
  provider: string
  estimatedTimeSeconds: number
  expiresAt: number
  statusIntervalSeconds: number
  statusMaxDurationSeconds: number
  approval?: {
    tokenAddress: string
    spenderAddress: string
    amount: string
  }
  transaction: { to: string; data: string; value: string }
}

export type SocketRouteStatus =
  'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED'

export type SocketStatus = {
  status: SocketRouteStatus
  originTxHash?: string
  destinationTxHash?: string
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HEX_DATA = /^0x[0-9a-fA-F]*$/
const DECIMAL_INTEGER = /^\d+$/
const ROUTE_STATUSES = new Set<SocketRouteStatus>([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function requiredRecord(value: unknown, field: string) {
  const record = asRecord(value)
  if (!record) throw new Error(`Socket returned an invalid ${field}.`)
  return record
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Socket returned an invalid ${field}.`)
  }
  return value
}

function requiredInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Socket returned an invalid ${field}.`)
  }
  return value
}

export function parseTokenAmount(amount: string, decimals: number) {
  const trimmed = amount.trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) throw new Error('Amount must be a positive decimal string.')
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`)
  }
  const units =
    BigInt(match[1]) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, '0') || '0')
  if (units <= 0n) throw new Error('Amount must be greater than zero.')
  return units.toString()
}

export function formatTokenAmount(units: string, decimals: number) {
  if (!DECIMAL_INTEGER.test(units)) {
    throw new Error('Token amount must use integer base units.')
  }
  const padded = units.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals) || '0'
  const fraction =
    decimals === 0 ? '' : padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function routeScore(route: Record<string, unknown>) {
  const tags = Array.isArray(route.routeTags)
    ? route.routeTags.filter((tag): tag is string => typeof tag === 'string')
    : []
  if (tags.includes('SUGGESTED')) return 3
  if (tags.includes('MAX_OUTPUT')) return 2
  if (tags.includes('FASTEST')) return 1
  return 0
}

function parseRoute(
  rawRoute: unknown,
  input: {
    originChain: SocketChain
    destinationChain: SocketChain
    inputToken: SocketToken
    outputToken: SocketToken
    inputAmount: string
    inputAmountUnits: string
    userAddress: string
  },
): SocketQuote | null {
  try {
    const route = requiredRecord(rawRoute, 'route')
    const output = requiredRecord(route.output, 'route output')
    const outputToken = requiredRecord(output.token, 'output token')
    const txData = requiredRecord(route.txData, 'transaction data')
    const transaction = requiredRecord(txData.object, 'transaction')
    const origin = SOCKET_CHAINS[input.originChain]
    const destination = SOCKET_CHAINS[input.destinationChain]
    const expectedOutputAddress =
      destination.tokens[input.outputToken].address.toLowerCase()

    if (txData.kind !== 'evm_tx') return null
    if (
      transaction.chainId !== undefined &&
      transaction.chainId !== origin.chainId
    ) {
      return null
    }
    if (outputToken.chainId !== destination.chainId) return null
    if (
      typeof outputToken.address !== 'string' ||
      outputToken.address.toLowerCase() !== expectedOutputAddress
    ) {
      return null
    }

    const to = requiredString(transaction.to, 'transaction recipient')
    const data = requiredString(transaction.data, 'transaction calldata')
    const value = requiredString(transaction.value, 'transaction value')
    if (
      !EVM_ADDRESS.test(to) ||
      !HEX_DATA.test(data) ||
      !DECIMAL_INTEGER.test(value)
    ) {
      return null
    }

    const outputAmountUnits = requiredString(output.amount, 'output amount')
    const minimumOutputAmountUnits = requiredString(
      output.minAmountOut,
      'minimum output amount',
    )
    if (
      !DECIMAL_INTEGER.test(outputAmountUnits) ||
      !DECIMAL_INTEGER.test(minimumOutputAmountUnits)
    ) {
      return null
    }

    const quoteId = requiredString(route.quoteId, 'quote id')
    const expiresAtSeconds = requiredInteger(route.expiresAt, 'quote expiry')
    if (expiresAtSeconds * 1000 <= Date.now()) return null

    const bridge = asRecord(asRecord(route.routeDetails)?.bridgeDetails)
    const protocol = asRecord(bridge?.protocol)
    const provider =
      typeof protocol?.displayName === 'string'
        ? protocol.displayName
        : typeof protocol?.name === 'string'
          ? protocol.name
          : 'Socket'
    const statusCheck = asRecord(route.statusCheck)
    const interval =
      typeof statusCheck?.intervalSec === 'number'
        ? Math.min(30, Math.max(3, Math.floor(statusCheck.intervalSec)))
        : 5
    const maxDuration =
      typeof statusCheck?.maxDurationSec === 'number'
        ? Math.min(7_200, Math.max(60, Math.floor(statusCheck.maxDurationSec)))
        : 1_800

    let approval: SocketQuote['approval']
    if (route.approval !== null && route.approval !== undefined) {
      if (input.inputToken === 'eth') return null
      const rawApproval = requiredRecord(route.approval, 'approval')
      const expectedInputAddress = origin.tokens[input.inputToken].address
      const tokenAddress =
        typeof rawApproval.tokenAddress === 'string'
          ? rawApproval.tokenAddress
          : expectedInputAddress
      const spenderAddress = requiredString(
        rawApproval.spenderAddress,
        'approval spender',
      )
      const amount = requiredString(rawApproval.amount, 'approval amount')
      if (
        !EVM_ADDRESS.test(tokenAddress) ||
        tokenAddress.toLowerCase() !== expectedInputAddress.toLowerCase() ||
        !EVM_ADDRESS.test(spenderAddress) ||
        !DECIMAL_INTEGER.test(amount) ||
        BigInt(amount) <= 0n ||
        BigInt(amount) > BigInt(input.inputAmountUnits) ||
        (typeof rawApproval.userAddress === 'string' &&
          rawApproval.userAddress.toLowerCase() !==
            input.userAddress.toLowerCase())
      ) {
        return null
      }
      approval = { tokenAddress, spenderAddress, amount }
    }

    const outputDecimals = destination.tokens[input.outputToken].decimals
    return {
      quoteId,
      originChain: input.originChain,
      destinationChain: input.destinationChain,
      originChainId: origin.chainId,
      destinationChainId: destination.chainId,
      inputToken: input.inputToken,
      outputToken: input.outputToken,
      inputAmount: input.inputAmount,
      inputAmountUnits: input.inputAmountUnits,
      outputAmount: formatTokenAmount(outputAmountUnits, outputDecimals),
      outputAmountUnits,
      minimumOutputAmount: formatTokenAmount(
        minimumOutputAmountUnits,
        outputDecimals,
      ),
      minimumOutputAmountUnits,
      provider,
      estimatedTimeSeconds:
        typeof route.estimatedTime === 'number'
          ? Math.max(0, Math.floor(route.estimatedTime))
          : 0,
      expiresAt: expiresAtSeconds * 1000,
      statusIntervalSeconds: interval,
      statusMaxDurationSeconds: maxDuration,
      ...(approval ? { approval } : {}),
      transaction: { to, data, value },
    }
  } catch {
    return null
  }
}

export async function getSocketQuote(
  input: {
    originChain: SocketChain
    destinationChain: SocketChain
    inputToken: SocketToken
    outputToken: SocketToken
    inputAmount: string
    userAddress: string
    receiverAddress: string
  },
  config: SocketApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SocketQuote> {
  if (input.originChain === input.destinationChain) {
    throw new Error('Choose two different chains for a cross-chain swap.')
  }
  if (
    !EVM_ADDRESS.test(input.userAddress) ||
    !EVM_ADDRESS.test(input.receiverAddress)
  ) {
    throw new Error('Socket requires valid EVM wallet addresses.')
  }
  const origin = SOCKET_CHAINS[input.originChain]
  const destination = SOCKET_CHAINS[input.destinationChain]
  const inputAmountUnits = parseTokenAmount(
    input.inputAmount,
    origin.tokens[input.inputToken].decimals,
  )
  const query = new URLSearchParams({
    userOps: 'tx',
    originChainId: String(origin.chainId),
    destinationChainId: String(destination.chainId),
    inputToken: origin.tokens[input.inputToken].address,
    outputToken: destination.tokens[input.outputToken].address,
    inputAmount: inputAmountUnits,
    userAddress: input.userAddress,
    receiverAddress: input.receiverAddress,
    slippage: '1',
    ...(input.outputToken === 'eth' ? {} : { refuel: 'true' }),
  })
  const response = await socketFetch(
    `${config.baseUrl.replace(/\/$/, '')}/v3/swap/quote?${query}`,
    config,
    fetchImpl,
  )
  const requestId = response.headers.get('server-req-id')
  const body = (await response.json().catch(() => null)) as unknown
  const record = asRecord(body)
  if (!response.ok || record?.success !== true) {
    const message = typeof record?.message === 'string' ? record.message : ''
    throw new Error(
      `Socket could not quote this transfer${message ? `: ${message}` : '.'}${
        requestId ? ` Request ${requestId}.` : ''
      }`,
    )
  }
  const result = requiredRecord(record.result, 'quote result')
  const routes = Array.isArray(result.routes) ? result.routes : []
  const parsed = routes
    .map((route) => ({
      raw: asRecord(route),
      quote: parseRoute(route, { ...input, inputAmountUnits }),
    }))
    .filter(
      (item): item is { raw: Record<string, unknown>; quote: SocketQuote } =>
        item.raw !== null && item.quote !== null,
    )
    .sort((left, right) => {
      const scoreDifference = routeScore(right.raw) - routeScore(left.raw)
      if (scoreDifference !== 0) return scoreDifference
      const outputDifference =
        BigInt(right.quote.outputAmountUnits) -
        BigInt(left.quote.outputAmountUnits)
      if (outputDifference !== 0n) return outputDifference > 0n ? 1 : -1
      return left.quote.estimatedTimeSeconds - right.quote.estimatedTimeSeconds
    })
  const selected = parsed[0]?.quote
  if (!selected) {
    throw new Error('Socket returned no safe route for this transfer.')
  }
  return selected
}

export async function getSocketStatus(
  quoteId: string,
  config: SocketApiConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SocketStatus> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(quoteId)) {
    throw new Error('Socket quote id is invalid.')
  }
  const query = new URLSearchParams({ quoteId })
  const response = await socketFetch(
    `${config.baseUrl.replace(/\/$/, '')}/v3/swap/status?${query}`,
    config,
    fetchImpl,
  )
  const requestId = response.headers.get('server-req-id')
  const body = (await response.json().catch(() => null)) as unknown
  const record = asRecord(body)
  if (!response.ok || !record) {
    throw new Error(
      `Socket status is temporarily unavailable.${requestId ? ` Request ${requestId}.` : ''}`,
    )
  }
  const statusRecord = asRecord(record.result) ?? record
  const candidate =
    typeof statusRecord.status === 'string'
      ? statusRecord.status
      : statusRecord.statusCode
  if (
    typeof candidate !== 'string' ||
    !ROUTE_STATUSES.has(candidate as SocketRouteStatus)
  ) {
    throw new Error('Socket returned an unknown route status.')
  }
  const origin = asRecord(statusRecord.origin)
  const destination = asRecord(statusRecord.destination)
  return {
    status: candidate as SocketRouteStatus,
    ...(typeof origin?.txHash === 'string'
      ? { originTxHash: origin.txHash }
      : {}),
    ...(typeof destination?.txHash === 'string'
      ? { destinationTxHash: destination.txHash }
      : {}),
  }
}

export function explorerTransactionUrl(chain: SocketChain, hash: string) {
  return `${SOCKET_CHAINS[chain].explorerUrl}/tx/${hash}`
}
