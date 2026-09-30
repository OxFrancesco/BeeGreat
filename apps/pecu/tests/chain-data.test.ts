import { expect, test } from "bun:test";
import { ChainDataService, chainDataTool, researchPeriod, slugify } from "../src/integrations/chain-data";
import { base, chainFetch, now } from "./fixtures/chain-data";

test("windows are complete UTC days ending yesterday against the span before", () => {
  expect(researchPeriod("7d", now)).toEqual({ start: "2026-09-23", end: "2026-09-29", priorStart: "2026-09-16", priorEnd: "2026-09-22", days: 7 });
  expect(researchPeriod("1d", now)).toEqual({ start: "2026-09-29", end: "2026-09-29", priorStart: "2026-09-28", priorEnd: "2026-09-28", days: 1 });
  expect(researchPeriod("30d", now)).toMatchObject({ start: "2026-08-31", end: "2026-09-29", priorEnd: "2026-08-30" });
});

test("levels compare the last day with the day before the window, flows compare sums, averages compare means", async () => {
  const data = new ChainDataService(chainFetch().request, () => now);
  const period = researchPeriod("7d", now);
  const tvl = await data.metric(base, "tvl", period);
  expect(tvl).toMatchObject({ current: 6_300_000_000, prior: 6_300_000_000, change: 0 });
  const earlier = researchPeriod("7d", now - 3 * 86_400_000);
  const jump = await data.metric(base, "tvl", earlier);
  expect(jump).toMatchObject({ current: 6_300_000_000, prior: 6_000_000_000, change: 300_000_000 });
  expect(jump.changePct).toBeCloseTo(5, 9);
  const fees = await data.metric(base, "app_fees", period);
  expect(fees).toMatchObject({ kind: "flow", current: 2_000_000 * 6 + 8_000_000, prior: 14_000_000, missing: [] });
  const daa = await data.metric(base, "active_addresses", period);
  expect(daa).toMatchObject({ kind: "average", current: 330_000, prior: 330_000, changePct: 0 });
  expect(tvl.daily).toHaveLength(14);
});

test("the pack names event days, movers, issuers, prices and protocol leads with sources", async () => {
  const { request, urls } = chainFetch();
  const pack = await new ChainDataService(request, () => now).pack(base, "7d");
  expect(pack.metrics.map((metric) => metric.key)).toEqual(["tvl", "stablecoins", "dex_volume", "app_fees", "app_revenue", "transactions", "active_addresses", "onchain_fees", "median_tx_cost"]);
  expect(pack.eventDays[0]).toMatchObject({ date: "2026-09-24", metric: "app_fees", changePct: 300 });
  expect(pack.eventDays.some((event) => event.metric === "stablecoins" && event.date === "2026-09-25")).toBe(true);
  expect(pack.tvlMovers.up[0]).toMatchObject({ name: "Morpho Blue", change: 250_000_000 });
  expect(pack.tvlMovers.down[0]).toMatchObject({ name: "Moonwell Lending", change: -12_000_000 });
  expect(pack.tvlMovers.ranked).toBe(2);
  expect(pack.dexMovers.rows[0]).toMatchObject({ name: "Aerodrome Slipstream", share: 50 });
  expect(pack.stablecoins.rows[0]).toMatchObject({ name: "USDC (USD Coin)", change: 100_000_000 });
  expect(pack.prices[0]).toMatchObject({ symbol: "ETH", start: 2600, end: 2700 });
  expect(pack.leads).toContainEqual({ name: "Morpho Blue", slug: "morpho-blue", twitter: "morpho", url: "https://morpho.org", category: "Lending", events: [{ date: "2026-09-22", note: "Vault campaign" }] });
  expect(pack.notes).toEqual([]);
  expect(pack.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
  expect(urls.filter((url) => url.includes("lite/protocols2"))).toHaveLength(1);
});

test("a missing source becomes a note, not a zero", async () => {
  const { request } = chainFetch({ "https://api.llama.fi/v2/historicalChainTvl/Base": undefined });
  const pack = await new ChainDataService(request, () => now).pack(base, "7d");
  expect(pack.metrics.some((metric) => metric.key === "tvl")).toBe(false);
  expect(pack.notes.join(" ")).toContain("DeFi TVL unavailable");
});

test("chains without growthepie skip activity metrics and say so", async () => {
  const pack = await new ChainDataService(chainFetch().request, () => now).pack({ ...base, growthepie: undefined }, "7d");
  expect(pack.metrics.map((metric) => metric.key)).not.toContain("transactions");
  expect(pack.notes[0]).toContain("growthepie does not cover Base");
});

test("chain tools return compact JSON with the comparison basis and source", async () => {
  const data = new ChainDataService(chainFetch().request);
  const resolve = async () => base;
  const protocols = JSON.parse(await chainDataTool(data, resolve, "protocols", { chain: "base", window: "7d", limit: 1 }));
  expect(protocols).toMatchObject({ source: "DefiLlama", chain: "Base", ranked: 2, up: [{ name: "Morpho Blue" }] });
  expect(protocols.basis).toContain("previous-week");
  const profile = JSON.parse(await chainDataTool(data, resolve, "protocol", { slug: "morpho-blue", chain: "base", kind: "fees", days: 30 }));
  expect(profile).toMatchObject({ twitter: "morpho", daily: [["2026-09-24", 800_000]] });
  await expect(chainDataTool(data, resolve, "protocol", { slug: "Not A Slug" })).rejects.toThrow();
  expect(slugify("Aerodrome Slipstream")).toBe("aerodrome-slipstream");
  expect(slugify("Moonwell Lending")).toBe("moonwell-lending");
});

test("rate limits are retried; curators whose TVL sits in other protocols are marked and not ranked", async () => {
  const { request } = chainFetch({ "https://api.llama.fi/lite/protocols2?b=2": { protocols: [
    { name: "Steakhouse Financial", category: "Risk Curators", chainTvls: { Base: { tvl: 1_160_000_000, tvlPrevDay: 1_180_000_000, tvlPrevWeek: 1_555_000_000, tvlPrevMonth: 1_545_000_000 }, "Base-doublecounted": { tvl: 1_160_000_000 } } },
    { name: "Morpho Blue", category: "Lending", chainTvls: { Base: { tvl: 4_400_000_000, tvlPrevDay: 4_390_000_000, tvlPrevWeek: 4_150_000_000, tvlPrevMonth: 3_900_000_000 } } },
  ] } });
  let limited = 0;
  const flaky: typeof fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("lite/protocols2") && limited++ === 0) return new Response("slow down", { status: 429 });
    return request(input, init);
  }, { preconnect() {} });
  const waits: number[] = [];
  const data = new ChainDataService(flaky, () => now, async (ms) => { waits.push(ms); });
  const movers = await data.tvlMovers(base, "7d");
  expect(waits).toEqual([1_000]);
  expect(movers.ranked).toBe(1);
  expect(movers.down[0]).toMatchObject({ name: "Steakhouse Financial", doublecounted: true });
  expect(movers.up[0]).toMatchObject({ name: "Morpho Blue" });
  expect(movers.up[0]!.doublecounted).toBeUndefined();
});
