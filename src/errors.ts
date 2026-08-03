import * as Data from 'effect/Data'

export type SugarRpcErrorCode =
  | 'RPC_RATE_LIMITED'
  | 'RPC_READ_FAILED'
  | 'RPC_TIMEOUT'
  | 'RPC_UNAVAILABLE'

function defaultMessage(code: SugarRpcErrorCode, operation: string): string {
  if (code === 'RPC_TIMEOUT') return `RPC read ${operation} timed out`
  if (code === 'RPC_RATE_LIMITED') return `RPC read ${operation} was rate limited`
  if (code === 'RPC_UNAVAILABLE') return `RPC read ${operation} is unavailable`
  return `RPC read ${operation} failed`
}

export class SugarRpcError extends Data.TaggedError('SugarRpcError')<{
  readonly code: SugarRpcErrorCode
  readonly operation: string
  readonly retryable: boolean
  readonly attempts: number
  readonly message: string
  readonly cause?: unknown
}> {
  constructor(options: {
    code: SugarRpcErrorCode
    operation: string
    retryable: boolean
    attempts: number
    cause?: unknown
    message?: string
  }) {
    super({
      attempts: options.attempts,
      code: options.code,
      message: options.message ?? defaultMessage(options.code, options.operation),
      operation: options.operation,
      retryable: options.retryable,
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    })
  }
}
