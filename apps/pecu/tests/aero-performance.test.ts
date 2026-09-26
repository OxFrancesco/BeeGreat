import { expect, test } from "bun:test";
import { AerodromeService } from "../src/aerodrome";
import { canonicalToken, focusedPools } from "../src/cloudflare/aero-pools";
import { AeroCache } from "../src/cloudflare/aero-cache";
import { createPoolSpec, getChainSettings, KNOWN_TOKENS } from "@beegreat/sugar";

const wallet = "0x1111111111111111111111111111111111111111" as const;
test("independent service-binding reads start without another user's queue", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const service = new AerodromeService({ maxSlippageBps: 100, baseRpcUrl: "https://unused.invalid" }, async () => { calls++; await pending; return []; });
  const first = service.run(wallet, "pools", {});
  const second = service.run(wallet, "pools", {});
  expect(calls).toBe(2);
  release();
  await Promise.all([first, second]);
});

test("known wrapped and native token identities stay distinct", () => {
  expect(canonicalToken("weth")).toBe(KNOWN_TOKENS[8453].eth.wrappedTokenAddress!);
  expect(canonicalToken("ETH")).toBe(KNOWN_TOKENS[8453].eth.tokenAddress);
  expect(canonicalToken("UNLISTED")).toBe("UNLISTED");
});

test("pool limit applies before hydration and unrelated pools are not priced", async () => {
  const settings = getChainSettings(8453);
  const { eth, usdc } = KNOWN_TOKENS[8453];
  const weth = { ...eth, tokenAddress: eth.wrappedTokenAddress!, symbol: "WETH", wrappedTokenAddress: undefined };
  const pool = { ...createPoolSpec(settings, weth, usdc, { tickSpacing: 100 }), lp: wallet };
  const hydrated: string[] = [];
  const indexed: number[] = [];
  const output = await focusedPools({ settings,
    getToken: async ref => ref === weth.tokenAddress ? weth : usdc,
    getRawPools: async () => Array.from({ length: 20 }, (_, i) => {
      const row: unknown[] = []; row[0] = wallet; row[4] = i === 0 ? -1 : 100;
      row[7] = weth.tokenAddress; row[10] = usdc.tokenAddress; return row;
    }),
    getPoolByAddress: async address => { hydrated.push(address); return pool; },
  }, { token0: "WETH", token1: "USDC", pool_type: "cl", limit: 2 }, new AeroCache(undefined, () => {}), {
    get: async () => undefined, set: async (_key, value) => { indexed.push(value.offset); }, delete: async () => {},
  });
  expect(output).toHaveLength(2);
  expect(hydrated).toHaveLength(2);
  expect(indexed).toEqual([1, 2]);
});
import { cachePublicCatalog } from "../src/cloudflare/aero-cache";
import { createSugarClient } from "@beegreat/sugar";

test("known token lookups never load the catalog and distinguish ETH from WETH", async () => {
  const client = createSugarClient(8453);
  client.getAllTokens = async () => { throw new Error("Unexpected catalog read"); };
  cachePublicCatalog(client, new AeroCache(undefined, () => {}));
  const eth = await client.getToken("ETH");
  const weth = await client.getToken("WETH");
  expect(weth?.tokenAddress).toBe(eth?.wrappedTokenAddress);
  expect(weth?.wrappedTokenAddress).toBeUndefined();
  expect((await client.getToken("USDC"))?.decimals).toBe(6);
  expect((await client.getToken(weth!.tokenAddress))?.symbol).toBe("WETH");
});
