import { fallback, http, type Transport } from 'viem'
import { isTransientRpcFailure } from './internal/rpc-executor'
import type { SugarRpcEvent, SugarRpcObserver } from './types'

export type SugarFailoverTransportOptions = {
  /** Per-attempt HTTP timeout for each endpoint. */
  timeoutMs?: number
  /** Optional low-cardinality telemetry callback. URLs and parameters are omitted. */
  onRpcEvent?: SugarRpcObserver
}

function emitRpcEvent(observer: SugarRpcObserver | undefined, event: SugarRpcEvent): void {
  try {
    observer?.(event)
  } catch {
    // Observability must never alter transport behavior.
  }
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
  const transport = fallback(
    rpcUrls.map((url, index) => http(url, { ...httpOptions, key: `sugar-rpc-${index}` })),
    {
      retryCount: 0,
      shouldThrow: (error) => !isTransientRpcFailure(error),
    },
  )
  return ((parameters) => {
    const configured = transport(parameters)
    configured.value?.onResponse(({ method, status, transport: attemptedTransport }) => {
      const endpointIndex = Number(attemptedTransport.config.key.replace('sugar-rpc-', ''))
      emitRpcEvent(options.onRpcEvent, {
        attemptCount: endpointIndex + 1,
        failoverUsed: endpointIndex > 0,
        operation: method,
        phase: 'transport',
        status,
      })
    })
    return configured
  }) as Transport
}
