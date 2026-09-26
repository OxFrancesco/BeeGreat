import { tupleValues, type SugarClient, type LiquidityPool } from "@beegreat/sugar";
import { z } from "zod";

const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
export const poolIndexSchema = z.array(z.object({ address, offset: z.number().int().nonnegative(), type: z.number().int(), token0: address, token1: address }));
export type PoolIndex = z.output<typeof poolIndexSchema>;

export function indexPools(raw: unknown[]): PoolIndex {
  return poolIndexSchema.parse(raw.map((row, offset) => {
    const values = tupleValues(row);
    return { address: values[0], offset, type: Number(values[4]), token0: values[7], token1: values[10] };
  }));
}

export async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

export function matchingPools(index: PoolIndex, tokens: readonly string[], type?: string): PoolIndex {
  const addresses = tokens.map(token => token.toLowerCase());
  return index.filter(pool => addresses.every(token => [pool.token0.toLowerCase(), pool.token1.toLowerCase()].includes(token))
    && (!type || (type === "cl" ? pool.type > 0 : type === "stable" ? pool.type === 0 : pool.type === -1)));
}

export async function discoverLiquidityPool(client: Pick<SugarClient, "getToken" | "getPoolByAddress">, pair: { token0: string; token1: string }, index: PoolIndex): Promise<LiquidityPool> {
  const tokens = await Promise.all([pair.token0, pair.token1].map(ref => client.getToken(ref)));
  if (!tokens[0] || !tokens[1]) throw new Error("Pool tokens were not found on Base");
  const addresses = tokens.map(token => (token!.wrappedTokenAddress ?? token!.tokenAddress).toLowerCase());
  if (addresses[0] === addresses[1]) throw new Error("Choose two different pool tokens");
  const candidates = matchingPools(index, addresses, "cl");
  // Bound live hydration; discovery never treats cached reserves as current liquidity.
  const pools = await mapConcurrent(candidates.slice(0, 8), 4, item => client.getPoolByAddress(item.address));
  const usable = pools.flatMap(pool => pool && pool.isCl && pool.sqrtRatio > 0n && pool.tvl > 0
    && addresses.every(address => [pool.token0.tokenAddress.toLowerCase(), pool.token1.tokenAddress.toLowerCase()].includes(address)) ? [pool] : []);
  usable.sort((a, b) => b.tvl - a.tvl || a.lp.localeCompare(b.lp));
  const pool = usable[0];
  if (!pool) throw new Error("No funded concentrated pool was found for this pair; choose a pool or request a new one");
  return pool;
}
