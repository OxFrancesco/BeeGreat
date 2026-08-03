import { fallback, http, type Transport } from 'viem'
import { isTransientRpcFailure } from './internal/rpc-executor'

export type SugarFailoverTransportOptions = {
  /** Per-attempt HTTP timeout for each endpoint. */
  timeoutMs?: number
}

/**
 * A transport that fails over to backup RPC endpoints only for transient
 * failures (throttling, outages, timeouts). Deterministic errors such as
 * contract reverts throw immediately: Viem's default fallback would replay
 * them across every endpoint and multiply quoter latency, since quoter
 * reads revert by design for unusable paths. Viem-level retries stay off so
 * the Sugar RPC policy remains the single retry authority.
 */
export function createSugarFailoverTransport(
  rpcUrls: readonly string[],
  options: SugarFailoverTransportOptions = {},
): Transport {
  if (rpcUrls.length === 0) {
    throw new Error('createSugarFailoverTransport requires at least one RPC URL')
  }
  const httpOptions = { retryCount: 0, timeout: options.timeoutMs ?? 30_000 }
  return fallback(
    rpcUrls.map((url) => http(url, httpOptions)),
    {
      retryCount: 0,
      shouldThrow: (error) => !isTransientRpcFailure(error),
    },
  )
}
