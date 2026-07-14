import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'

export type ScraperFailureCode =
  | 'scrape-failed'
  | 'tweet-not-found'
  | 'transcript-unavailable'
  | 'audio-too-long'
  | 'transcription-failed'
  | 'summary-failed'
  | 'unknown'

export type ProviderName =
  | 'chatgpt'
  | 'convex'
  | 'credential-broker'
  | 'elevenlabs'
  | 'firecrawl'
  | 'hivemind'
  | 'openrouter'
  | 'twitter'
  | 'youtube'

export type ProviderStage =
  | 'auth'
  | 'persistence'
  | 'scrape'
  | 'summarize'
  | 'workflow'

export type ProviderPolicy = Readonly<{
  attemptTimeoutMs: number
  baseDelayMs: number
  maxRetries: number
}>

export const DEFAULT_NETWORK_POLICY: ProviderPolicy = {
  attemptTimeoutMs: 30_000,
  baseDelayMs: 250,
  maxRetries: 2,
}

export class ProviderFailure extends Data.TaggedError('ProviderFailure')<{
  readonly cause: unknown
  readonly code: ScraperFailureCode
  readonly message: string
  readonly provider: ProviderName
  readonly retryAfterMs: number
  readonly retryable: boolean
  readonly stage: ProviderStage
}> {}

export class ProviderChainFailure extends Data.TaggedError(
  'ProviderChainFailure',
)<{
  readonly code: ScraperFailureCode
  readonly fallback: ProviderFailure
  readonly message: string
  readonly primary: ProviderFailure
}> {}

export type ScraperEffectFailure = ProviderFailure | ProviderChainFailure
export type ProviderTask<A> = (signal: AbortSignal) => PromiseLike<A>
export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

function errorChain(cause: unknown) {
  const chain: unknown[] = []
  const seen = new Set<unknown>()
  let current = cause
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current)
    chain.push(current)
    if (typeof current !== 'object' || !('cause' in current)) break
    current = current.cause
  }
  return chain
}

function errorName(value: unknown) {
  return typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
    ? value.name
    : undefined
}

function numericField(value: unknown, field: 'status' | 'statusCode') {
  if (typeof value !== 'object' || value === null || !(field in value)) {
    return undefined
  }
  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'number' ? candidate : undefined
}

function causeMessage(cause: unknown) {
  for (const candidate of errorChain(cause)) {
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'message' in candidate &&
      typeof candidate.message === 'string' &&
      candidate.message.trim()
    ) {
      return candidate.message.trim()
    }
  }
  return typeof cause === 'string' && cause.trim()
    ? cause.trim()
    : 'Provider request failed'
}

function retryAfterMs(cause: unknown) {
  for (const candidate of errorChain(cause)) {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('headers' in candidate) ||
      !candidate.headers ||
      typeof candidate.headers !== 'object' ||
      !('get' in candidate.headers) ||
      typeof candidate.headers.get !== 'function'
    ) {
      continue
    }
    const value = candidate.headers.get('Retry-After')
    if (typeof value !== 'string' || !value.trim()) continue
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.round(seconds * 1_000)
    }
    const at = Date.parse(value)
    if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  }
  return 0
}

function isRetryable(cause: unknown) {
  for (const candidate of errorChain(cause)) {
    const status =
      numericField(candidate, 'status') ?? numericField(candidate, 'statusCode')
    if (status !== undefined) {
      return status === 408 || status === 429 || status >= 500
    }
    const name = errorName(candidate)
    if (
      name === 'AbortError' ||
      name === 'FetchError' ||
      name === 'NetworkError' ||
      name === 'TimeoutError'
    ) {
      return true
    }
    if (candidate instanceof TypeError) return true
  }
  return false
}

function scraperFailureCode(cause: unknown, fallback: ScraperFailureCode) {
  for (const candidate of errorChain(cause)) {
    if (typeof candidate !== 'object' || candidate === null || !('code' in candidate)) {
      continue
    }
    const code = candidate.code
    if (
      code === 'scrape-failed' ||
      code === 'tweet-not-found' ||
      code === 'transcript-unavailable' ||
      code === 'audio-too-long' ||
      code === 'transcription-failed' ||
      code === 'summary-failed' ||
      code === 'unknown'
    ) {
      return code
    }
  }
  return fallback
}

function validatePolicy(policy: ProviderPolicy) {
  if (!Number.isInteger(policy.attemptTimeoutMs) || policy.attemptTimeoutMs <= 0) {
    throw new Error('attemptTimeoutMs must be a positive integer')
  }
  if (!Number.isInteger(policy.baseDelayMs) || policy.baseDelayMs < 0) {
    throw new Error('baseDelayMs must be a non-negative integer')
  }
  if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0) {
    throw new Error('maxRetries must be a non-negative integer')
  }
  return policy
}

export function providerAttempt<A>(options: {
  code: ScraperFailureCode
  policy?: ProviderPolicy
  provider: ProviderName
  stage: ProviderStage
  task: ProviderTask<A>
}) {
  const policy = validatePolicy(options.policy ?? DEFAULT_NETWORK_POLICY)
  const failure = (cause: unknown, message = causeMessage(cause)) =>
    new ProviderFailure({
      cause,
      code: scraperFailureCode(cause, options.code),
      message,
      provider: options.provider,
      retryAfterMs: retryAfterMs(cause),
      retryable: isRetryable(cause),
      stage: options.stage,
    })
  const attempt = Effect.tryPromise({
    try: options.task,
    catch: (cause) => failure(cause),
  }).pipe(
    Effect.timeoutFail({
      duration: policy.attemptTimeoutMs,
      onTimeout: () =>
        new ProviderFailure({
          cause: new Error(`${options.provider} request timed out`),
          code: options.code,
          message: `${options.provider} request timed out after ${policy.attemptTimeoutMs}ms`,
          provider: options.provider,
          retryAfterMs: 0,
          retryable: true,
          stage: options.stage,
        }),
    }),
  )
  if (policy.maxRetries === 0) return attempt
  return Effect.retry(
    attempt,
    Schedule.identity<ProviderFailure>().pipe(
      Schedule.addDelay((providerFailure) => providerFailure.retryAfterMs),
      Schedule.intersect(Schedule.exponential(policy.baseDelayMs)),
      Schedule.intersect(Schedule.recurs(policy.maxRetries)),
      Schedule.whileInput((providerFailure) => providerFailure.retryable),
    ),
  )
}

export function withProviderFallback<A>(options: {
  code: ScraperFailureCode
  fallback: () => Effect.Effect<A, ProviderFailure>
  primary: Effect.Effect<A, ProviderFailure>
  shouldFallback?: (failure: ProviderFailure) => boolean
}): Effect.Effect<A, ScraperEffectFailure> {
  return Effect.catchAll(
    options.primary,
    (primary): Effect.Effect<A, ScraperEffectFailure> =>
      options.shouldFallback && !options.shouldFallback(primary)
        ? Effect.fail(primary)
        : Effect.mapError(options.fallback(), (fallback) =>
            new ProviderChainFailure({
              code: options.code,
              fallback,
              message: `${primary.provider} failed: ${primary.message}; ${fallback.provider} failed: ${fallback.message}`,
              primary,
            }),
          ),
  )
}

export function abortableFetch(fetcher: Fetcher, signal: AbortSignal): Fetcher {
  return async (input, init) => {
    const existing = init?.signal
    const requestSignal = existing
      ? AbortSignal.any([signal, existing])
      : signal
    return await fetcher(input, { ...init, signal: requestSignal })
  }
}

export function failureCode(failure: ScraperEffectFailure) {
  return failure.code
}

export function failureMessage(failure: ScraperEffectFailure) {
  return failure.message
}

export async function runScraperEffect<A>(
  program: Effect.Effect<A, ScraperEffectFailure>,
) {
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Right') return result.right
  throw result.left
}
