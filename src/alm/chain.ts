import type { Address, PublicClient } from 'viem'
import { abis } from '../abis'

/**
 * Direct pool reads for the ALM poll loop. Polling goes straight to the CL
 * pool contract (one eth_call for slot0) instead of through the Sugar
 * catalog, so a 30s cadence costs nothing and always sees a fresh tick.
 */

export type PoolTick = { sqrtPriceX96: bigint; tick: number }

export async function readPoolTick(client: PublicClient, pool: Address): Promise<PoolTick> {
  // SAFETY: the poolCl slot0 ABI pins the tuple head to (uint160, int24),
  // which viem decodes as [bigint, number].
  const slot0 = await client.readContract({ address: pool, abi: abis.poolCl, functionName: 'slot0' }) as readonly [bigint, number]
  return { sqrtPriceX96: slot0[0], tick: Number(slot0[1]) }
}

/**
 * Time-weighted average tick over the last `seconds`, from the pool's own
 * oracle (`observe`). Returns undefined when the pool's observation history
 * is too short — callers fall back to their locally sampled history.
 */
export async function readTwapTick(client: PublicClient, pool: Address, seconds: number): Promise<number | undefined> {
  try {
    // SAFETY: the poolCl observe ABI pins the output to (int56[], uint160[]),
    // which viem decodes as two bigint arrays.
    const observed = await client.readContract({
      address: pool,
      abi: abis.poolCl,
      functionName: 'observe',
      args: [[seconds, 0]],
    }) as readonly [readonly bigint[], readonly bigint[]]
    const [older, latest] = observed[0]
    return Math.floor(Number(latest - older) / seconds)
  } catch {
    return undefined
  }
}

/** Rolling in-memory tick samples, the TWAP fallback for young pools. */
export type TickHistory = { samples: Array<{ at: number; tick: number }> }

export function pushTickSample(history: TickHistory, tick: number, at: number, windowMs: number): void {
  history.samples.push({ at, tick })
  const cutoff = at - windowMs
  while (history.samples.length > 0 && history.samples[0].at < cutoff) history.samples.shift()
}

export function averageTick(history: TickHistory, windowMs: number, now: number): number | undefined {
  const cutoff = now - windowMs
  const samples = history.samples.filter((sample) => sample.at >= cutoff)
  // A single sample is just the spot tick again; it cannot smooth anything.
  if (samples.length < 2) return undefined
  // Require coverage of most of the window so a burst of fresh samples
  // cannot masquerade as a time-weighted average.
  if (samples[0].at > cutoff + windowMs * 0.5) return undefined
  return Math.round(samples.reduce((sum, sample) => sum + sample.tick, 0) / samples.length)
}

export type TwapGate =
  | { allowed: true; twapTick: number }
  | { allowed: false; reason: string }

/**
 * Mellow-style manipulation guard: refuse to rebalance while the spot tick
 * deviates from the time-weighted average by more than the configured limit.
 */
export function checkTwapGate(spotTick: number, twapTick: number | undefined, maxDeviationTicks: number): TwapGate {
  if (twapTick === undefined) {
    return { allowed: false, reason: 'no TWAP available yet (pool oracle too young and local history too short); waiting' }
  }
  const deviation = Math.abs(spotTick - twapTick)
  if (deviation > maxDeviationTicks) {
    return { allowed: false, reason: `spot tick ${spotTick} deviates ${deviation} ticks from TWAP ${twapTick} (max ${maxDeviationTicks}); possible manipulation or wick` }
  }
  return { allowed: true, twapTick }
}
