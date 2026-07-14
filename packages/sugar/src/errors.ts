export type SugarRpcErrorCode =
  | 'RPC_RATE_LIMITED'
  | 'RPC_READ_FAILED'
  | 'RPC_TIMEOUT'
  | 'RPC_UNAVAILABLE'

export class SugarRpcError extends Error {
  override readonly name = 'SugarRpcError'
  readonly code: SugarRpcErrorCode
  readonly operation: string
  readonly retryable: boolean
  readonly attempts: number

  constructor(options: {
    code: SugarRpcErrorCode
    operation: string
    retryable: boolean
    attempts: number
    cause?: unknown
    message?: string
  }) {
    const message = options.message ?? (() => {
      if (options.code === 'RPC_TIMEOUT') return `RPC read ${options.operation} timed out`
      if (options.code === 'RPC_RATE_LIMITED') return `RPC read ${options.operation} was rate limited`
      if (options.code === 'RPC_UNAVAILABLE') return `RPC read ${options.operation} is unavailable`
      return `RPC read ${options.operation} failed`
    })()
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.code = options.code
    this.operation = options.operation
    this.retryable = options.retryable
    this.attempts = options.attempts
  }
}
