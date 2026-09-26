import { poolTypeLabel, toSugarJson, type SugarClient, type SugarParameters, type SugarPoolLocatorStore } from "@beegreat/sugar";
import { AeroCache } from "./aero-cache";
import { canonicalToken } from "../token-reference";
export { canonicalToken } from "../token-reference";
import { indexPools, matchingPools, mapConcurrent, type PoolIndex } from "../pool-discovery";

export async function focusedPools(client: Pick<SugarClient, "settings" | "getToken" | "getRawPools" | "getPoolByAddress">, p: SugarParameters, cache: AeroCache, locators: SugarPoolLocatorStore, catalog?: () => Promise<PoolIndex>) {
  const tokens = await Promise.all([p.token0, p.token1].filter(v => v !== undefined).map(async ref => {
    const token = await client.getToken(canonicalToken(String(ref)));
    if (!token) throw new Error("Pool token not found");
    return (token.wrappedTokenAddress ?? token.tokenAddress).toLowerCase();
  }));
  const limit = p.limit === undefined ? 100 : Number(p.limit);
  const index = catalog ? await catalog() : indexPools(await client.getRawPools());
  const selected = matchingPools(index, tokens, p.pool_type === undefined ? undefined : String(p.pool_type));
  // Verify cached offsets on chain through the SDK, then hydrate only the requested rows.
  const output = await mapConcurrent(selected.slice(0, limit), 4, async item => {
    await locators.set({ chainId: 8453, sugarContractAddress: client.settings.sugarContractAddress, poolAddress: item.address }, { offset: item.offset });
    const pool = await client.getPoolByAddress(item.address);
    if (!pool) return null;
    return {
      chain_id: pool.chainId, chain_name: pool.chainName, lp: pool.lp, symbol: pool.symbol,
      type: pool.type, type_label: poolTypeLabel(pool.type), is_cl: pool.isCl, is_stable: pool.isStable,
      pool_fee: pool.poolFee, tvl: pool.tvl,
      token0: { symbol: pool.token0.symbol, address: pool.token0.tokenAddress, decimals: pool.token0.decimals },
      token1: { symbol: pool.token1.symbol, address: pool.token1.tokenAddress, decimals: pool.token1.decimals },
      reserve0: pool.reserve0?.decimal ?? null, reserve1: pool.reserve1?.decimal ?? null,
      gauge: pool.gauge, gauge_alive: pool.gaugeAlive, weekly_emissions: pool.weeklyEmissions?.decimal ?? null,
      spot_price: pool.sqrtRatio > 0n ? (Number(pool.sqrtRatio) / 2 ** 96) ** 2 * 10 ** (pool.token0.decimals - pool.token1.decimals) : null,
      price_unit: `${pool.token1.symbol} per ${pool.token0.symbol}`,
    };
  });
  return toSugarJson(output.filter(pool => pool !== null));
}
