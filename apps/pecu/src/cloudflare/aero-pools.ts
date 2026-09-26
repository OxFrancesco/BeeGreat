import { KNOWN_TOKENS, poolTypeLabel, toSugarJson, tupleValues, type SugarClient, type SugarParameters, type SugarPoolLocatorStore } from "@beegreat/sugar";
import { z } from "zod";
import { AeroCache } from "./aero-cache";

export function canonicalToken(reference: string): string {
  if (reference.toUpperCase() === "WETH") return KNOWN_TOKENS[8453].eth.wrappedTokenAddress!;
  return Object.values(KNOWN_TOKENS[8453]).find(t => t.symbol.toLowerCase() === reference.toLowerCase())?.tokenAddress ?? reference;
}

export async function focusedPools(client: Pick<SugarClient, "settings" | "getToken" | "getRawPools" | "getPoolByAddress">, p: SugarParameters, cache: AeroCache, locators: SugarPoolLocatorStore) {
  const tokens = await Promise.all([p.token0, p.token1].filter(v => v !== undefined).map(async ref => {
    const token = await client.getToken(canonicalToken(String(ref)));
    if (!token) throw new Error("Pool token not found");
    return (token.wrappedTokenAddress ?? token.tokenAddress).toLowerCase();
  }));
  const limit = p.limit === undefined ? 100 : Number(p.limit);
  const key = `pools:${client.settings.sugarContractAddress}:${tokens.sort().join(":")}:${p.pool_type ?? "all"}`;
  const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
  let selected = await cache.read(key, z.array(z.object({ address, offset: z.number().int().nonnegative() })));
  if (!selected) {
    const raw = await client.getRawPools();
    selected = raw.flatMap((item, offset) => {
      const values = tupleValues(item);
      const type = Number(values[4]);
      const pair = [String(values[7]).toLowerCase(), String(values[10]).toLowerCase()];
      const matches = tokens.every(t => pair.includes(t)) && (!p.pool_type || (p.pool_type === "cl" ? type > 0 : p.pool_type === "stable" ? type === 0 : type === -1));
      return matches ? [{ address: address.parse(values[0]), offset }] : [];
    });
    await cache.write(key, selected, 60);
  }
  // Verify cached offsets on chain through the SDK, then hydrate only the requested rows.
  const output = [];
  for (const item of selected.slice(0, limit)) {
    await locators.set({ chainId: 8453, sugarContractAddress: client.settings.sugarContractAddress, poolAddress: item.address }, { offset: item.offset });
    const pool = await client.getPoolByAddress(item.address);
    if (!pool) continue;
    output.push({
      chain_id: pool.chainId, chain_name: pool.chainName, lp: pool.lp, symbol: pool.symbol,
      type: pool.type, type_label: poolTypeLabel(pool.type), is_cl: pool.isCl, is_stable: pool.isStable,
      pool_fee: pool.poolFee, tvl: pool.tvl,
      token0: { symbol: pool.token0.symbol, address: pool.token0.tokenAddress, decimals: pool.token0.decimals },
      token1: { symbol: pool.token1.symbol, address: pool.token1.tokenAddress, decimals: pool.token1.decimals },
      reserve0: pool.reserve0?.decimal ?? null, reserve1: pool.reserve1?.decimal ?? null,
      gauge: pool.gauge, gauge_alive: pool.gaugeAlive, weekly_emissions: pool.weeklyEmissions?.decimal ?? null,
      spot_price: pool.sqrtRatio > 0n ? (Number(pool.sqrtRatio) / 2 ** 96) ** 2 * 10 ** (pool.token0.decimals - pool.token1.decimals) : null,
      price_unit: `${pool.token1.symbol} per ${pool.token0.symbol}`,
    });
  }
  return toSugarJson(output);
}
