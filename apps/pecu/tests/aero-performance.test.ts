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
import { z } from "zod";

test("a cold edge reads shared public metadata without extending its lifetime", async () => {
  const objects = new Map<string, string>();
  let writes = 0;
  const shared = {
    get: async (key: string) => { const body = objects.get(key); return body === undefined ? null : { text: async () => body }; },
    put: async (key: string, body: string) => { writes++; objects.set(key, body); },
    delete: async (key: string) => { objects.delete(key); },
  };
  const first = new AeroCache(undefined, () => {}, shared);
  await first.write("tokens:8453:test", [{ symbol: "TOKEN437" }], 600);
  const schema = z.array(z.object({ symbol: z.string() }));
  const observations: string[] = [];
  const anotherRegion = new AeroCache(undefined, event => observations.push(event.operation), shared);
  expect(await anotherRegion.read("tokens:8453:test", schema)).toEqual([{ symbol: "TOKEN437" }]);
  expect(observations).toContain("cache.tokens.r2.hit");
  objects.set("v1/tokens:8453:test", JSON.stringify({ expiresAt: Date.now() - 1, value: [{ symbol: "EXPIRED" }] }));
  expect(await anotherRegion.read("tokens:8453:test", schema)).toBeUndefined();
  objects.set("v1/tokens:8453:test", "broken JSON");
  expect(await anotherRegion.read("tokens:8453:test", schema)).toBeUndefined();
  const failedEdge = new AeroCache({ match: async () => { throw new Error("cache unavailable"); }, put: async () => { throw new Error("cache unavailable"); }, delete: async () => false }, () => {}, shared);
  await first.write("tokens:8453:test", [{ symbol: "FRESH" }], 600);
  expect(await failedEdge.read("tokens:8453:test", schema)).toEqual([{ symbol: "FRESH" }]);
  const locator = { chainId: 8453, sugarContractAddress: wallet, poolAddress: wallet };
  const before = writes;
  await first.locators().set(locator, { offset: 42 });
  await anotherRegion.locators().set(locator, { offset: 42 });
  expect(writes - before).toBe(1);
  await anotherRegion.locators().set(locator, { offset: 43 });
  expect(writes - before).toBe(2);
});

test("one public snapshot serves arbitrary tokens across requests and preserves ambiguity checks", async () => {
  const stored = new Map<string, Response>();
  const cache = new AeroCache({
    match: async request => stored.get(String(request instanceof Request ? request.url : request))?.clone(),
    put: async (request, response) => { stored.set(String(request instanceof Request ? request.url : request), response.clone()); },
    delete: async request => stored.delete(String(request instanceof Request ? request.url : request)),
  }, () => {});
  const tokens = Array.from({ length: 1000 }, (_, index) => ({ chainId: 8453 as const, chainName: "Base", tokenAddress: `0x${(index + 1).toString(16).padStart(40, "0")}`, symbol: `TOKEN${index}`, decimals: 18, listed: index % 2 === 0, emerging: false }));
  tokens.push({ ...tokens[0]!, tokenAddress: `0x${"f".repeat(40)}` });
  let scans = 0;
  const request = () => {
    const client = createSugarClient(8453);
    client.getAllTokens = async () => { scans++; return tokens; };
    cachePublicCatalog(client, cache);
    return client;
  };
  const first = request();
  const reads = await Promise.all([first.getToken("TOKEN19"), first.getToken(tokens[437]!.tokenAddress), first.getToken("TOKEN998")]);
  expect(reads.map(t => t?.symbol)).toEqual(["TOKEN19", "TOKEN437", "TOKEN998"]);
  const second = request();
  expect((await second.getToken("TOKEN888"))?.symbol).toBe("TOKEN888");
  expect(await second.getAllTokens(true)).toHaveLength(501);
  await expect(second.getToken("TOKEN0")).rejects.toThrow("Ambiguous token symbol");
  expect(await second.getToken("NOT_PRESENT")).toBeUndefined();
  expect(scans).toBe(1);
  stored.clear();
  await request().getToken("TOKEN19");
  expect(scans).toBe(2);
});
