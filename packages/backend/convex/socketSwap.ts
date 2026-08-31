import * as Data from 'effect/Data'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import * as Result from 'effect/Result'
import * as Schedule from 'effect/Schedule'
import { jsonRecord, type JsonRecord, type JsonValue } from './jsonValue'

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
  if (value === null || value.trim() === '') return 0
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
    Effect.timeoutOrElse({
      duration: SOCKET_RETRY_POLICY.attemptTimeoutMs,
      orElse: () =>
        Effect.fail(
          new SocketTransientFailure({
            cause: new Error(
              `Socket request timed out after ${SOCKET_RETRY_POLICY.attemptTimeoutMs}ms`,
            ),
            retryAfterMs: 0,
          }),
        ),
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
  // Exponential backoff bounded by maxRetries; the Retry-After hint
  // stretches (never shortens) the computed delay.
  const program = Effect.retry(attempt, {
    schedule: Schedule.exponential(
      Duration.millis(SOCKET_RETRY_POLICY.baseDelayMs),
    ).pipe(
      Schedule.upTo({ times: SOCKET_RETRY_POLICY.maxRetries }),
      Schedule.setInputType<SocketTransientFailure>(),
      Schedule.modifyDelay(({ duration, input }) =>
        Effect.succeed(Duration.max(duration, Duration.millis(input.retryAfterMs))),
      ),
    ),
  })
  const result = await Effect.runPromise(Effect.result(program))
  if (Result.isSuccess(result)) return result.success
  if (result.failure.response) return result.failure.response
  throw result.failure.cause
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
const ROUTE_STATUSES: ReadonlySet<string> = new Set<SocketRouteStatus>([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
])

function isRouteStatus(value: string): value is SocketRouteStatus {
  return ROUTE_STATUSES.has(value)
}

function requiredRecord(value: JsonValue | undefined, field: string) {
  const record = jsonRecord(value)
  if (!record) throw new Error(`Socket returned an invalid ${field}.`)
  return record
}

function requiredString(value: JsonValue | undefined, field: string) {
  if (!Predicate.isString(value) || value.length === 0) {
    throw new Error(`Socket returned an invalid ${field}.`)
  }
  return value
}

function requiredInteger(value: JsonValue | undefined, field: string) {
  if (!Predicate.isNumber(value) || !Number.isSafeInteger(value) || value < 0) {
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

function routeScore(route: JsonRecord) {
  const routeTags = route.routeTags
  const tags = Array.isArray(routeTags)
    ? routeTags.filter(Predicate.isString)
    : []
  if (tags.includes('SUGGESTED')) return 3
  if (tags.includes('MAX_OUTPUT')) return 2
  if (tags.includes('FASTEST')) return 1
  return 0
}

function parseRoute(
  rawRoute: JsonValue,
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
    const outputTokenAddress = outputToken.address
    if (
      !Predicate.isString(outputTokenAddress) ||
      outputTokenAddress.toLowerCase() !== expectedOutputAddress
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

    const bridge = jsonRecord(jsonRecord(route.routeDetails)?.bridgeDetails)
    const protocol = jsonRecord(bridge?.protocol)
    const displayName = protocol?.displayName
    const protocolName = protocol?.name
    const provider = Predicate.isString(displayName)
      ? displayName
      : Predicate.isString(protocolName)
        ? protocolName
        : 'Socket'
    const statusCheck = jsonRecord(route.statusCheck)
    const intervalSec = statusCheck?.intervalSec
    const interval = Predicate.isNumber(intervalSec)
      ? Math.min(30, Math.max(3, Math.floor(intervalSec)))
      : 5
    const maxDurationSec = statusCheck?.maxDurationSec
    const maxDuration = Predicate.isNumber(maxDurationSec)
      ? Math.min(7_200, Math.max(60, Math.floor(maxDurationSec)))
      : 1_800

    let approval: SocketQuote['approval']
    if (route.approval !== null && route.approval !== undefined) {
      if (input.inputToken === 'eth') return null
      const rawApproval = requiredRecord(route.approval, 'approval')
      const expectedInputAddress = origin.tokens[input.inputToken].address
      const rawTokenAddress = rawApproval.tokenAddress
      const tokenAddress = Predicate.isString(rawTokenAddress)
        ? rawTokenAddress
        : expectedInputAddress
      const spenderAddress = requiredString(
        rawApproval.spenderAddress,
        'approval spender',
      )
      const amount = requiredString(rawApproval.amount, 'approval amount')
      const approvalUserAddress = rawApproval.userAddress
      if (
        !EVM_ADDRESS.test(tokenAddress) ||
        tokenAddress.toLowerCase() !== expectedInputAddress.toLowerCase() ||
        !EVM_ADDRESS.test(spenderAddress) ||
        !DECIMAL_INTEGER.test(amount) ||
        BigInt(amount) <= 0n ||
        BigInt(amount) > BigInt(input.inputAmountUnits) ||
        (Predicate.isString(approvalUserAddress) &&
          approvalUserAddress.toLowerCase() !==
            input.userAddress.toLowerCase())
      ) {
        return null
      }
      approval = { tokenAddress, spenderAddress, amount }
    }

    const outputDecimals = destination.tokens[input.outputToken].decimals
    const estimatedTime = route.estimatedTime
    const quote: SocketQuote = {
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
      estimatedTimeSeconds: Predicate.isNumber(estimatedTime)
        ? Math.max(0, Math.floor(estimatedTime))
        : 0,
      expiresAt: expiresAtSeconds * 1000,
      statusIntervalSeconds: interval,
      statusMaxDurationSeconds: maxDuration,
      transaction: { to, data, value },
    }
    if (approval) quote.approval = approval
    return quote
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
  })
  if (input.outputToken !== 'eth') query.set('refuel', 'true')
  const response = await socketFetch(
    `${config.baseUrl.replace(/\/$/, '')}/v3/swap/quote?${query}`,
    config,
    fetchImpl,
  )
  const requestId = response.headers.get('server-req-id')
  const record = jsonRecord(await response.json().catch(() => null))
  if (!response.ok || record?.success !== true) {
    const rawMessage = record?.message
    const message = Predicate.isString(rawMessage) ? rawMessage : ''
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
      raw: jsonRecord(route),
      quote: parseRoute(route, { ...input, inputAmountUnits }),
    }))
    .filter(
      (item): item is { raw: JsonRecord; quote: SocketQuote } =>
        item.raw !== undefined && item.quote !== null,
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
  const record = jsonRecord(await response.json().catch(() => null))
  if (!response.ok || !record) {
    throw new Error(
      `Socket status is temporarily unavailable.${requestId ? ` Request ${requestId}.` : ''}`,
    )
  }
  const statusRecord = jsonRecord(record.result) ?? record
  const statusValue = statusRecord.status
  const candidate = Predicate.isString(statusValue)
    ? statusValue
    : statusRecord.statusCode
  if (!Predicate.isString(candidate) || !isRouteStatus(candidate)) {
    throw new Error('Socket returned an unknown route status.')
  }
  const origin = jsonRecord(statusRecord.origin)
  const destination = jsonRecord(statusRecord.destination)
  const status: SocketStatus = { status: candidate }
  const originTxHash = origin?.txHash
  if (Predicate.isString(originTxHash)) status.originTxHash = originTxHash
  const destinationTxHash = destination?.txHash
  if (Predicate.isString(destinationTxHash)) {
    status.destinationTxHash = destinationTxHash
  }
  return status
}

export function explorerTransactionUrl(chain: SocketChain, hash: string) {
  return `${SOCKET_CHAINS[chain].explorerUrl}/tx/${hash}`
}
