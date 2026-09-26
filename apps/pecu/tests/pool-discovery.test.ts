import { expect, test } from "bun:test";
import { z } from "zod";
import { createPoolSpec, getChainSettings, KNOWN_TOKENS } from "@beegreat/sugar";
import { discoverLiquidityPool, mapConcurrent, poolIndexSchema } from "../src/pool-discovery";

test("bounded reads overlap, preserve result order, and never exceed four", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([0, 1, 2, 3, 4, 5], 4, async value => {
    peak = Math.max(peak, ++active);
    await Bun.sleep(value % 2 ? 1 : 10);
    active--;
    return value;
  });
  expect(peak).toBe(4);
  expect(result).toEqual([0, 1, 2, 3, 4, 5]);
});

test("discovery bounds hydration, uses fresh TVL, and rejects mismatched live pairs", async () => {
  const { eth, usdc, aero } = KNOWN_TOKENS[8453];
  const weth = { ...eth, symbol: "WETH", tokenAddress: eth.wrappedTokenAddress!, wrappedTokenAddress: undefined };
  const spec = createPoolSpec(getChainSettings(8453), weth, usdc, { tickSpacing: 100 });
  const index = poolIndexSchema.parse(Array.from({ length: 20 }, (_, offset) => ({ address: `0x${String(offset + 1).padStart(40, "0")}`, offset, type: 100, token0: weth.tokenAddress, token1: usdc.tokenAddress })));
  let reads = 0;
  const pool = await discoverLiquidityPool({
    getToken: async ref => ref === "WETH" ? weth : usdc,
    getPoolByAddress: async address => { reads++; const n = Number(address); return { ...spec, lp: z.templateLiteral(["0x", z.string()]).parse(address), sqrtRatio: 1n, tvl: n, token1: n === 8 ? aero : usdc }; },
  }, { token0: "WETH", token1: "USDC" }, index);
  expect(reads).toBe(8);
  expect(pool.lp).toBe(index[6]!.address);
});
