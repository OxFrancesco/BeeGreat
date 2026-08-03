import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import { SugarRpcError, type SugarRpcErrorCode } from '../errors'
import type { SugarRpcPolicyOptions } from '../types'

export type RpcReadTask<A> = (signal: AbortSignal) => PromiseLike<A>

type RpcPolicy = Readonly<{
  baseDelayMs: number
  deadlineMs: number
  maxRetries: number
}>

export type RpcDeadline = {
  readonly deadlineMs: number
  readonly expiresAt: number
  readonly operation: string
  attempts: number
  readonly pendingCauses: Map<symbol, unknown>
}

export type RpcReadResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly error: SugarRpcError; readonly ok: false }

class RpcAttemptFailure extends Data.TaggedError('RpcAttemptFailure')<{
  readonly error: SugarRpcError
  readonly retryAfterMs: number
}> {}

class RpcDeadlineFailure extends Data.TaggedError('RpcDeadlineFailure')<{
  readonly attempts: number
  readonly cause: unknown
  readonly deadlineMs: number
  readonly operation: string
}> {}

const HTTP_RETRY_STATUSES = new Set([403, 408, 413, 429, 500, 502, 503, 504])
const RPC_RETRY_CODES = new Set([-1, -32_603, -32_005, -32_002])
const TRANSPORT_ERROR_NAMES = new Set([
  'ChainDisconnectedError',
  'HttpRequestError',
  'ProviderDisconnectedError',
  'SocketClosedError',
  'TimeoutError',
  'WebSocketRequestError',
])

function errorChain(cause: unknown): unknown[] {
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

function numericField(value: unknown, field: 'code' | 'status'): number | undefined {
  if (typeof value !== 'object' || value === null || !(field in value)) return undefined
  const fieldValue = (value as Record<string, unknown>)[field]
  return typeof fieldValue === 'number' ? fieldValue : undefined
}

function errorName(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string'
    ? value.name
    : undefined
}

/** Whether a failure is transient (throttling, outage, timeout) rather than deterministic. */
export function isTransientRpcFailure(cause: unknown): boolean {
  return classifyRpcError(cause).retryable
}

function classifyRpcError(cause: unknown): { code: SugarRpcErrorCode; retryable: boolean } {
  const chain = errorChain(cause)
  if (chain.some((error) => errorName(error) === 'ContractFunctionRevertedError')) {
    return { code: 'RPC_READ_FAILED', retryable: false }
  }

  for (const error of chain) {
    const status = numericField(error, 'status')
    const code = numericField(error, 'code')
    const name = errorName(error)
    if (status === 429 || code === -32_005) return { code: 'RPC_RATE_LIMITED', retryable: true }
    if (name === 'TimeoutError' || name === 'AbortError') return { code: 'RPC_TIMEOUT', retryable: true }
    if ((status !== undefined && HTTP_RETRY_STATUSES.has(status)) || (code !== undefined && RPC_RETRY_CODES.has(code))) {
      return { code: 'RPC_UNAVAILABLE', retryable: true }
    }
    if (name && TRANSPORT_ERROR_NAMES.has(name)) return { code: 'RPC_UNAVAILABLE', retryable: true }
  }
  return { code: 'RPC_READ_FAILED', retryable: false }
}

function getRetryAfterMs(cause: unknown): number {
  for (const error of errorChain(cause)) {
    if (typeof error !== 'object' || error === null || !('headers' in error)) continue
    const headers = error.headers
    if (!headers || typeof headers !== 'object' || !('get' in headers) || typeof headers.get !== 'function') continue
    const value = headers.get('Retry-After')
    if (typeof value !== 'string' || value.trim() === '') continue
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000)
    const at = Date.parse(value)
    if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  }
  return 0
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`)
  return value
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

function resolveRpcPolicy(options: SugarRpcPolicyOptions = {}): RpcPolicy {
  return {
    baseDelayMs: nonNegativeInteger(options.baseDelayMs ?? 150, 'rpcPolicy.baseDelayMs'),
    deadlineMs: positiveInteger(options.deadlineMs ?? 120_000, 'rpcPolicy.deadlineMs'),
    maxRetries: nonNegativeInteger(options.maxRetries ?? 3, 'rpcPolicy.maxRetries'),
  }
}

function attemptProgram<A>(
  operation: string,
  task: RpcReadTask<A>,
  policy: RpcPolicy,
  deadline: RpcDeadline,
) {
  const attempts = { count: 0 }
  const causeKey = Symbol(operation)
  const clearCause = () => deadline.pendingCauses.delete(causeKey)
  const attempt = Effect.tryPromise({
    try: (signal) => {
      attempts.count += 1
      deadline.attempts += 1
      return task(signal)
    },
    catch: (cause) => {
      deadline.pendingCauses.delete(causeKey)
      deadline.pendingCauses.set(causeKey, cause)
      const classification = classifyRpcError(cause)
      return new RpcAttemptFailure({
        error: new SugarRpcError({
          ...classification,
          attempts: attempts.count,
          cause,
          operation,
        }),
        retryAfterMs: getRetryAfterMs(cause),
      })
    },
  })
  const retried = policy.maxRetries === 0
    ? attempt
    : Effect.retry(
        attempt,
        Schedule.identity<RpcAttemptFailure>().pipe(
          Schedule.addDelay((failure) => failure.retryAfterMs),
          Schedule.intersect(Schedule.exponential(policy.baseDelayMs)),
          Schedule.intersect(Schedule.recurs(policy.maxRetries)),
          Schedule.whileInput((failure) => failure.error.retryable),
        ),
      )
  return {
    clearCause,
    effect: Effect.tap(retried, () => Effect.sync(clearCause)),
  }
}

function readResultProgram<A>(program: {
  readonly clearCause: () => boolean
  readonly effect: Effect.Effect<A, RpcAttemptFailure>
}): Effect.Effect<RpcReadResult<A>, RpcAttemptFailure> {
  return Effect.catchAll(
    Effect.map(program.effect, (value): RpcReadResult<A> => ({ ok: true, value })),
    (failure) => {
      if (failure.error.retryable) return Effect.fail(failure)
      return Effect.sync((): RpcReadResult<A> => {
        program.clearCause()
        return { error: failure.error, ok: false }
      })
    },
  )
}

function makeDeadline(operation: string, policy: RpcPolicy): RpcDeadline {
  return {
    attempts: 0,
    deadlineMs: policy.deadlineMs,
    expiresAt: Date.now() + policy.deadlineMs,
    operation,
    pendingCauses: new Map(),
  }
}

function deadlineFailure(deadline: RpcDeadline): RpcDeadlineFailure {
  const pendingCauses = [...deadline.pendingCauses.values()]
  return new RpcDeadlineFailure({
    attempts: deadline.attempts,
    cause: pendingCauses.at(-1),
    deadlineMs: deadline.deadlineMs,
    operation: deadline.operation,
  })
}

function withDeadline<A, E>(
  effect: Effect.Effect<A, E>,
  deadline: RpcDeadline,
) {
  const remainingMs = deadline.expiresAt - Date.now()
  if (remainingMs <= 0) return Effect.fail(deadlineFailure(deadline))
  return Effect.timeoutFail(effect, {
    duration: remainingMs,
    onTimeout: () => deadlineFailure(deadline),
  })
}

function toDeadlineError(failure: RpcDeadlineFailure): SugarRpcError {
  return new SugarRpcError({
    attempts: failure.attempts,
    cause: failure.cause,
    code: 'RPC_TIMEOUT',
    message: `RPC read ${failure.operation} exceeded its ${failure.deadlineMs}ms deadline`,
    operation: failure.operation,
    retryable: true,
  })
}

async function runReadProgram<A>(
  program: Effect.Effect<A, RpcAttemptFailure | RpcDeadlineFailure>,
): Promise<A> {
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Right') return result.right
  const failure = result.left
  if (failure._tag === 'RpcAttemptFailure') throw failure.error
  throw toDeadlineError(failure)
}

export type RpcReadExecutor = Readonly<{
  policy: RpcPolicy
  deadline(operation: string): RpcDeadline
  read<A>(operation: string, task: RpcReadTask<A>, deadline?: RpcDeadline): Promise<A>
  forEachRead<I, A>(
    operation: string,
    items: Iterable<I>,
    task: (item: I, index: number, signal: AbortSignal) => PromiseLike<A>,
    concurrency: number,
    deadline?: RpcDeadline,
  ): Promise<A[]>
  forEachReadResult<I, A>(
    operation: string,
    items: Iterable<I>,
    task: (item: I, index: number, signal: AbortSignal) => PromiseLike<A>,
    concurrency: number,
    deadline?: RpcDeadline,
  ): Promise<Array<RpcReadResult<A>>>
}>

export function makeRpcReadExecutor(options: SugarRpcPolicyOptions = {}): RpcReadExecutor {
  const policy = resolveRpcPolicy(options)
  return {
    policy,
    deadline: (operation) => makeDeadline(operation, policy),
    read: (operation, task, requestedDeadline) => {
      const deadline = requestedDeadline ?? makeDeadline(operation, policy)
      const program = attemptProgram(operation, task, policy, deadline)
      return runReadProgram(withDeadline(program.effect, deadline))
    },
    forEachRead: (operation, items, task, concurrency, requestedDeadline) => {
      const limit = positiveInteger(concurrency, 'requestConcurrency')
      const deadline = requestedDeadline ?? makeDeadline(operation, policy)
      const program = Effect.forEach(
        items,
        (item, index) => {
          return attemptProgram(
            operation,
            (signal) => task(item, index, signal),
            policy,
            deadline,
          ).effect
        },
        { concurrency: limit },
      )
      return runReadProgram(withDeadline(program, deadline))
    },
    forEachReadResult: (operation, items, task, concurrency, requestedDeadline) => {
      const limit = positiveInteger(concurrency, 'requestConcurrency')
      const deadline = requestedDeadline ?? makeDeadline(operation, policy)
      const program = Effect.forEach(
        items,
        (item, index) => {
          const itemProgram = attemptProgram(
            operation,
            (signal) => task(item, index, signal),
            policy,
            deadline,
          )
          return readResultProgram(itemProgram)
        },
        { concurrency: limit },
      )
      return runReadProgram(withDeadline(program, deadline))
    },
  }
}
