import type { JsonInput } from "../../src/json-contract";
import type { ChainProfile } from "../../src/research/agents";
import { curatedChain } from "../../src/research/agents";

export const now = Date.UTC(2026, 8, 30, 12);
const day = 86_400_000;
const midnight = (offset: number) => Date.UTC(2026, 8, 29) - offset * day;

export const base: ChainProfile = curatedChain("base")!;

/** Deterministic DefiLlama and growthepie responses for Base, ending 29 Sep 2026. TVL jumps on 22 Sep; fees spike on 24 Sep. */
export function chainFetch(overrides: Readonly<Record<string, JsonInput>> = {}) {
  const urls: string[] = [];
  const days = Array.from({ length: 60 }, (_, index) => midnight(59 - index));
  const tvl = days.map((at) => ({ date: at / 1000, tvl: at >= Date.UTC(2026, 8, 22) ? 6_300_000_000 : 6_000_000_000 }));
  const flow = (value: number, spike?: number) => days.map((at) => [at / 1000, at === spike ? value * 4 : value]);
  const overview = (value: number, spike?: number) => ({
    totalDataChart: flow(value, spike), total24h: value, total48hto24h: value, total7d: value * 7, total14dto7d: value * 6, total30d: value * 30, total60dto30d: value * 28,
    protocols: [
      { name: "Aerodrome Slipstream", category: "Dexs", total24h: value * 0.5, total48hto24h: value * 0.4, total7d: value * 3.5, total14dto7d: value * 2.5, total30d: value * 15, total60dto30d: value * 14 },
      { name: "Uniswap V3", category: "Dexs", total24h: value * 0.2, total48hto24h: value * 0.2, total7d: value * 1.4, total14dto7d: value * 1.5, total30d: value * 6, total60dto30d: value * 6 },
    ],
  });
  const growthepie = (value: number) => ({ details: { timeseries: { daily: { types: ["unix", "value"], data: days.map((at) => [at, value]) } } } });
  const responses = new Map<string, JsonInput>(Object.entries({
    "https://api.llama.fi/v2/historicalChainTvl/Base": tvl,
    "https://stablecoins.llama.fi/stablecoincharts/Base": days.map((at) => ({ date: String(at / 1000), totalCirculatingUSD: { peggedUSD: 5_000_000_000 + (at >= Date.UTC(2026, 8, 25) ? 400_000_000 : 0) } })),
    "https://api.llama.fi/overview/dexs/Base?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true": overview(900_000_000),
    "https://api.llama.fi/overview/fees/Base?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees": overview(2_000_000, Date.UTC(2026, 8, 24)),
    "https://api.llama.fi/overview/fees/Base?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue": overview(700_000),
    "https://api.growthepie.com/v1/metrics/chains/base/txcount.json": growthepie(10_000_000),
    "https://api.growthepie.com/v1/metrics/chains/base/daa.json": growthepie(330_000),
    "https://api.growthepie.com/v1/metrics/chains/base/fees.json": { details: { timeseries: { daily: { types: ["unix", "usd", "eth"], data: days.map((at) => [at, 100_000, 40]) } } } },
    "https://api.growthepie.com/v1/metrics/chains/base/txcosts.json": { details: { timeseries: { daily: { types: ["unix", "usd", "eth"], data: days.map((at) => [at, 0.0012, 0.0000004]) } } } },
    "https://api.llama.fi/lite/protocols2?b=2": { protocols: [
      { name: "Morpho Blue", category: "Lending", chainTvls: { Base: { tvl: 4_400_000_000, tvlPrevDay: 4_390_000_000, tvlPrevWeek: 4_150_000_000, tvlPrevMonth: 3_900_000_000 }, "Base-borrowed": { tvl: 9e9, tvlPrevWeek: 1 } } },
      { name: "Moonwell Lending", category: "Lending", chainTvls: { Base: { tvl: 11_000_000, tvlPrevDay: 11_000_000, tvlPrevWeek: 23_000_000, tvlPrevMonth: 24_000_000 } } },
      { name: "Coinbase", category: "CEX", chainTvls: { Base: { tvl: 9e9, tvlPrevDay: 1e9, tvlPrevWeek: 1e9, tvlPrevMonth: 1e9 } } },
      { name: "Tiny", category: "Dexs", chainTvls: { Base: { tvl: 500_000, tvlPrevDay: 100, tvlPrevWeek: 100, tvlPrevMonth: 100 } } },
    ] },
    "https://stablecoins.llama.fi/stablecoins?includePrices=false": { peggedAssets: [
      { name: "USD Coin", symbol: "USDC", pegType: "peggedUSD", chainCirculating: { Base: { current: { peggedUSD: 4_200_000_000 }, circulatingPrevDay: { peggedUSD: 4_190_000_000 }, circulatingPrevWeek: { peggedUSD: 4_100_000_000 }, circulatingPrevMonth: { peggedUSD: 4_000_000_000 } } } },
    ] },
    "https://api.llama.fi/v2/chains": [{ name: "Base", tvl: 6.3e9 }, { name: "Tron", gecko_id: "tron", gasTokenGeckoId: "tron", tvl: 5.6e9 }],
    "https://api.llama.fi/summary/fees/morpho-blue?dataType=dailyFees": { name: "Morpho Blue", slug: "morpho-blue", category: "Lending", twitter: "morpho", url: "https://morpho.org", chains: ["Base"], hallmarks: [[Date.UTC(2026, 8, 22) / 1000, "Vault campaign"]], totalDataChartBreakdown: [[Date.UTC(2026, 8, 24) / 1000, { Base: { "Morpho Blue": 800_000 }, Ethereum: { "Morpho Blue": 1_000_000 } }]] },
    ...overrides,
  }));
  const request: typeof fetch = Object.assign(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const prices = url.startsWith("https://coins.llama.fi/chart/");
    const body = prices
      ? { coins: { "coingecko:ethereum": { symbol: "ETH", prices: [{ timestamp: Date.UTC(2026, 8, 22) / 1000, price: 2600 }, { timestamp: Date.UTC(2026, 8, 29) / 1000, price: 2700 }] } } }
      : responses.get(url);
    if (body === undefined) return new Response("{}", { status: 404 });
    return Response.json(body);
  }, { preconnect() {} });
  return { request, urls };
}
