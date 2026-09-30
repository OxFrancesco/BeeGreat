import { z } from "zod";
import type { JsonInput, JsonValue } from "../json-contract";
import { log } from "../logger";

// Public DefiLlama, DefiLlama coins and growthepie reads. No keys. These
// back the chain_* tools and the deterministic evidence pack each research
// run starts from, so every number a report shows has one source and one
// calculation.

export type ChainSpec = Readonly<{
  id: string;
  name: string;
  /** DefiLlama chain name, for example "Base" or "OP Mainnet". */
  defillama: string;
  /** growthepie origin key when growthepie covers the chain. */
  growthepie?: string;
  /** Nansen chain id when Nansen covers the chain. */
  nansen?: string;
  /** DefiLlama coin ids priced in the pack, for example coingecko:ethereum. */
  coins: readonly string[];
}>;

export const researchWindows = ["1d", "7d", "30d"] as const;
export type ResearchWindow = (typeof researchWindows)[number];
export const windowDays = { "1d": 1, "7d": 7, "30d": 30 } as const satisfies Record<ResearchWindow, number>;

const day = 86_400_000;
const isoDay = (at: number) => new Date(at).toISOString().slice(0, 10);
const utcMidnight = (at: number) => Math.floor(at / day) * day;

export type ResearchPeriod = Readonly<{ start: string; end: string; priorStart: string; priorEnd: string; days: number }>;

/** Complete UTC days ending yesterday, and the same number of days before them. */
export function researchPeriod(window: ResearchWindow, now: number): ResearchPeriod {
  const days = windowDays[window];
  const end = utcMidnight(now) - day;
  const start = end - (days - 1) * day;
  return { start: isoDay(start), end: isoDay(end), priorStart: isoDay(start - days * day), priorEnd: isoDay(start - day), days };
}

function dates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let at = Date.parse(from); at <= Date.parse(to); at += day) out.push(isoDay(at));
  return out;
}

export const metricKeys = ["tvl", "stablecoins", "dex_volume", "app_fees", "app_revenue", "transactions", "active_addresses", "onchain_fees", "median_tx_cost"] as const;
export type MetricKey = (typeof metricKeys)[number];
type MetricKind = "level" | "flow" | "average";
type MetricDefinition = Readonly<{ label: string; unit: "usd" | "count"; kind: MetricKind; provider: "DefiLlama" | "growthepie" }>;

export const metricDefinitions = {
  tvl: { label: "DeFi TVL", unit: "usd", kind: "level", provider: "DefiLlama" },
  stablecoins: { label: "USD-pegged stablecoin supply", unit: "usd", kind: "level", provider: "DefiLlama" },
  dex_volume: { label: "DEX volume", unit: "usd", kind: "flow", provider: "DefiLlama" },
  app_fees: { label: "App fees", unit: "usd", kind: "flow", provider: "DefiLlama" },
  app_revenue: { label: "App revenue", unit: "usd", kind: "flow", provider: "DefiLlama" },
  transactions: { label: "Transactions", unit: "count", kind: "flow", provider: "growthepie" },
  active_addresses: { label: "Daily active addresses", unit: "count", kind: "average", provider: "growthepie" },
  onchain_fees: { label: "Onchain fees paid", unit: "usd", kind: "flow", provider: "growthepie" },
  median_tx_cost: { label: "Median transaction cost", unit: "usd", kind: "average", provider: "growthepie" },
} satisfies Record<MetricKey, MetricDefinition>;

type Series = ReadonlyMap<string, number>;

export type MetricSummary = Readonly<{
  key: MetricKey;
  label: string;
  unit: "usd" | "count";
  kind: MetricKind;
  /** Level: value on the last day. Flow: window sum. Average: window daily mean. */
  current: number | null;
  /** The same quantity for the prior window, or the level on the day before the window. */
  prior: number | null;
  change: number | null;
  changePct: number | null;
  /** The prior window's own change on the same basis, to show acceleration or reversal. */
  priorChange: number | null;
  priorChangePct: number | null;
  /** Daily values for the prior and current windows, oldest first; null is a missing day. */
  daily: readonly (readonly [string, number | null])[];
  missing: readonly string[];
  source: string;
}>;

export type EventDay = Readonly<{ date: string; metric: MetricKey; label: string; value: number; change: number; changePct: number | null; basis: string }>;
export type Mover = Readonly<{ name: string; category?: string; current: number; prior: number; change: number; changePct: number | null; share?: number | null; doublecounted?: boolean }>;
export type Lead = Readonly<{ name: string; slug: string; twitter: string | null; url: string | null; category: string | null; events: readonly Readonly<{ date: string; note: string }>[] }>;
export type PriceMove = Readonly<{ coin: string; symbol: string; start: number | null; end: number | null; changePct: number | null; daily: readonly (readonly [string, number])[] }>;

export type ResearchPack = Readonly<{
  chain: ChainSpec;
  window: ResearchWindow;
  period: ResearchPeriod;
  generatedAt: string;
  metrics: readonly MetricSummary[];
  eventDays: readonly EventDay[];
  prices: readonly PriceMove[];
  tvlMovers: Readonly<{ basis: string; ranked: number; up: readonly Mover[]; down: readonly Mover[] }>;
  dexMovers: Readonly<{ basis: string; total: number | null; rows: readonly Mover[] }>;
  feeMovers: Readonly<{ basis: string; total: number | null; rows: readonly Mover[] }>;
  revenueMovers: Readonly<{ basis: string; total: number | null; rows: readonly Mover[] }>;
  stablecoins: Readonly<{ basis: string; rows: readonly Mover[] }>;
  /** DefiLlama profiles of the biggest movers: X handle, site and dated event notes. */
  leads: readonly Lead[];
  notes: readonly string[];
  sources: readonly Readonly<{ label: string; url: string }>[];
}>;

const finite = z.number().finite();
const numberish = z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i).transform(Number)]);
const tvlSchema = z.array(z.object({ date: numberish, tvl: z.number() }).loose());
const stableChartSchema = z.array(z.object({ date: numberish, totalCirculatingUSD: z.object({ peggedUSD: z.number().optional() }).loose().optional() }).loose());
const dimensionProtocolSchema = z.object({
  name: z.string(), displayName: z.string().optional(), category: z.string().nullish(), slug: z.string().optional(),
  total24h: z.number().nullish(), total48hto24h: z.number().nullish(), total7d: z.number().nullish(), total14dto7d: z.number().nullish(),
  total30d: z.number().nullish(), total60dto30d: z.number().nullish(),
}).loose();
const overviewSchema = z.object({
  totalDataChart: z.array(z.tuple([z.number(), z.number()])).default([]),
  total24h: z.number().nullish(), total48hto24h: z.number().nullish(), total7d: z.number().nullish(), total14dto7d: z.number().nullish(),
  total30d: z.number().nullish(), total60dto30d: z.number().nullish(),
  protocols: z.array(dimensionProtocolSchema).default([]),
}).loose();
const growthepieSchema = z.object({ details: z.object({ timeseries: z.object({ daily: z.object({ types: z.array(z.string()), data: z.array(z.array(z.number().nullable())) }) }) }) });
const chainTvlSchema = z.object({ tvl: z.number().nullish(), tvlPrevDay: z.number().nullish(), tvlPrevWeek: z.number().nullish(), tvlPrevMonth: z.number().nullish() }).loose();
const liteSchema = z.object({ protocols: z.array(z.object({ name: z.string(), category: z.string().nullish(), chainTvls: z.record(z.string(), chainTvlSchema).default({}) }).loose()) }).loose();
const peggedSchema = z.object({ peggedUSD: z.number().nullish() }).loose().nullish();
const stablecoinsSchema = z.object({ peggedAssets: z.array(z.object({
  name: z.string(), symbol: z.string(), pegType: z.string().optional(),
  chainCirculating: z.record(z.string(), z.object({ current: peggedSchema, circulatingPrevDay: peggedSchema, circulatingPrevWeek: peggedSchema, circulatingPrevMonth: peggedSchema }).loose()).default({}),
}).loose()) }).loose();
const chainsSchema = z.array(z.object({ name: z.string(), gecko_id: z.string().nullish(), gasTokenGeckoId: z.string().nullish(), tokenSymbol: z.string().nullish(), tvl: z.number().nullish(), chainId: z.number().nullish() }).loose());
const pricesSchema = z.object({ coins: z.record(z.string(), z.object({ symbol: z.string().optional(), prices: z.array(z.object({ timestamp: z.number(), price: z.number() })) }).loose()) });
const protocolSummarySchema = z.object({
  name: z.string(), displayName: z.string().nullish(), slug: z.string().nullish(), category: z.string().nullish(), twitter: z.string().nullish(), url: z.string().nullish(), description: z.string().nullish(),
  chains: z.array(z.string()).default([]), hallmarks: z.array(z.tuple([z.number(), z.string()])).nullish(),
  total24h: z.number().nullish(), total7d: z.number().nullish(), total30d: z.number().nullish(), change_1d: z.number().nullish(),
  totalDataChartBreakdown: z.array(z.tuple([z.number(), z.record(z.string(), z.record(z.string(), z.number()))])).default([]),
}).loose();

const urls = {
  tvl: (chain: string) => `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chain)}`,
  stablecoins: (chain: string) => `https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chain)}`,
  dexs: (chain: string) => `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`,
  fees: (chain: string, type: "dailyFees" | "dailyRevenue") => `https://api.llama.fi/overview/fees/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=${type}`,
  growthepie: (key: string, metric: string) => `https://api.growthepie.com/v1/metrics/chains/${encodeURIComponent(key)}/${metric}.json`,
  lite: "https://api.llama.fi/lite/protocols2?b=2",
  stableAssets: "https://stablecoins.llama.fi/stablecoins?includePrices=false",
  chains: "https://api.llama.fi/v2/chains",
  prices: (coins: readonly string[], start: number, span: number) => `https://coins.llama.fi/chart/${coins.map(encodeURIComponent).join(",")}?start=${Math.floor(start / 1000)}&span=${span}&period=1d`,
  protocol: (kind: "fees" | "dexs", slug: string, type?: string) => `https://api.llama.fi/summary/${kind}/${encodeURIComponent(slug)}${type ? `?dataType=${type}` : ""}`,
};

const growthepieMetric = new Map<MetricKey, string>([["transactions", "txcount"], ["active_addresses", "daa"], ["onchain_fees", "fees"], ["median_tx_cost", "txcosts"]]);
const excludedCategories = new Set(["CEX", "Chain", "Canonical Bridge"]);
const cacheMs = 10 * 60_000;

function pct(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return (current / prior - 1) * 100;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function slugify(name: string): string {
  return name.toLowerCase().replaceAll("'", "").trim().split(/\s+/).join("-");
}

export class ChainDataService {
  private readonly cache = new Map<string, { at: number; value: Promise<JsonValue> }>();

  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private async json(url: string): Promise<JsonValue> {
    const cached = this.cache.get(url);
    if (cached && this.clock() - cached.at < cacheMs) return cached.value;
    const value = (async () => {
      // DefiLlama's free API rate-limits bursts; retry 429 and 5xx twice with a short backoff.
      for (let attempt = 0; ; attempt++) {
        const response = await this.request.call(globalThis, url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45_000) });
        log("info", "chain_data_call", { host: new URL(url).hostname, path: new URL(url).pathname.slice(0, 80), status: response.status, attempt });
        if (response.ok) {
          // SAFETY: Response.json() parses JSON text, so the result is a JsonValue; each caller decodes it with its own schema.
          return response.json() as Promise<JsonValue>;
        }
        if (attempt >= 2 || (response.status !== 429 && response.status < 500)) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
        await response.body?.cancel();
        await this.sleep(1_000 * 3 ** attempt);
      }
    })();
    this.cache.set(url, { at: this.clock(), value });
    value.catch(() => this.cache.delete(url));
    return value;
  }

  private async optional<T>(work: Promise<T>, notes: string[], label: string): Promise<T | undefined> {
    try { return await work; }
    catch (error) {
      notes.push(`${label} unavailable: ${error instanceof Error ? error.message : String(error)}.`);
      return undefined;
    }
  }

  async chains() {
    return chainsSchema.parse(await this.json(urls.chains));
  }

  /** A DefiLlama chain by name, case-insensitive. */
  async findChain(name: string) {
    const wanted = name.trim().toLowerCase();
    const list = await this.chains();
    return list.find((chain) => chain.name.toLowerCase() === wanted);
  }

  async series(chain: ChainSpec, metric: MetricKey): Promise<Series> {
    switch (metric) {
      case "tvl":
        return new Map(tvlSchema.parse(await this.json(urls.tvl(chain.defillama))).map((row) => [isoDay(Number(row.date) * 1000), row.tvl]));
      case "stablecoins":
        return new Map(stableChartSchema.parse(await this.json(urls.stablecoins(chain.defillama))).flatMap((row) => row.totalCirculatingUSD?.peggedUSD === undefined ? [] : [[isoDay(Number(row.date) * 1000), row.totalCirculatingUSD.peggedUSD] as const]));
      case "dex_volume":
        return new Map(overviewSchema.parse(await this.json(urls.dexs(chain.defillama))).totalDataChart.map(([at, value]) => [isoDay(at * 1000), value]));
      case "app_fees":
      case "app_revenue":
        return new Map(overviewSchema.parse(await this.json(urls.fees(chain.defillama, metric === "app_fees" ? "dailyFees" : "dailyRevenue"))).totalDataChart.map(([at, value]) => [isoDay(at * 1000), value]));
      default: {
        const key = chain.growthepie;
        const name = growthepieMetric.get(metric);
        if (!key || !name) throw new Error(`growthepie does not cover ${chain.name}`);
        const parsed = growthepieSchema.parse(await this.json(urls.growthepie(key, name))).details.timeseries.daily;
        const column = parsed.types.indexOf(parsed.types.includes("usd") ? "usd" : "value");
        if (column < 0) throw new Error("growthepie returned an unknown series");
        return new Map(parsed.data.flatMap((row) => {
          const at = finite.safeParse(row[0]);
          const value = finite.safeParse(row[column]);
          return at.success && value.success ? [[isoDay(at.data), value.data] as const] : [];
        }));
      }
    }
  }

  metricSource(chain: ChainSpec, metric: MetricKey): string {
    switch (metric) {
      case "tvl": return urls.tvl(chain.defillama);
      case "stablecoins": return urls.stablecoins(chain.defillama);
      case "dex_volume": return urls.dexs(chain.defillama);
      case "app_fees": return urls.fees(chain.defillama, "dailyFees");
      case "app_revenue": return urls.fees(chain.defillama, "dailyRevenue");
      default: return chain.growthepie ? urls.growthepie(chain.growthepie, growthepieMetric.get(metric) ?? metric) : "";
    }
  }

  summarize(chain: ChainSpec, metric: MetricKey, series: Series, period: ResearchPeriod): MetricSummary {
    const definition = metricDefinitions[metric];
    const window = dates(period.start, period.end);
    const prior = dates(period.priorStart, period.priorEnd);
    const value = (date: string) => series.get(date) ?? null;
    const present = (days: readonly string[]) => days.map(value).filter((v): v is number => v !== null);
    const missing = window.filter((date) => value(date) === null);
    const earlier = dates(isoDay(Date.parse(period.priorStart) - period.days * day), isoDay(Date.parse(period.priorStart) - day));
    let current: number | null;
    let base: number | null;
    let older: number | null;
    if (definition.kind === "level") {
      current = value(period.end);
      base = value(period.priorEnd);
      older = value(isoDay(Date.parse(period.priorStart) - day));
    } else {
      const total = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) : null;
      const measure = (days: readonly string[]) => {
        const values = present(days);
        return definition.kind === "flow" ? total(values) : values.length ? total(values)! / values.length : null;
      };
      current = measure(window);
      base = measure(prior);
      older = measure(earlier);
    }
    return {
      key: metric, label: definition.label, unit: definition.unit, kind: definition.kind,
      current, prior: base,
      change: current !== null && base !== null ? current - base : null,
      changePct: pct(current, base),
      priorChange: base !== null && older !== null ? base - older : null,
      priorChangePct: pct(base, older),
      daily: [...prior, ...window].map((date) => [date, value(date)] as const),
      missing,
      source: this.metricSource(chain, metric),
    };
  }

  async metric(chain: ChainSpec, metric: MetricKey, period: ResearchPeriod): Promise<MetricSummary> {
    return this.summarize(chain, metric, await this.series(chain, metric), period);
  }

  /** Protocol TVL on the chain against DefiLlama's reading a day, week or month earlier. */
  async tvlMovers(chain: ChainSpec, window: ResearchWindow, limit = 10) {
    const field = window === "1d" ? "tvlPrevDay" : window === "7d" ? "tvlPrevWeek" : "tvlPrevMonth";
    const lite = liteSchema.parse(await this.json(urls.lite));
    const rows: Mover[] = lite.protocols.flatMap((protocol) => {
      if (protocol.category && excludedCategories.has(protocol.category)) return [];
      const tvl = protocol.chainTvls[chain.defillama];
      const current = tvl?.tvl ?? null;
      const prior = tvl?.[field] ?? null;
      if (current === null || prior === null || Math.max(current, prior) < 1_000_000) return [];
      // Curators and allocators whose whole TVL sits inside other protocols, the rule OnChain-Reports uses.
      const doubled = protocol.chainTvls[`${chain.defillama}-doublecounted`]?.tvl ?? null;
      const doublecounted = doubled !== null && current > 0 && Math.abs(doubled - current) <= current * 0.01;
      return [{ name: protocol.name, category: protocol.category ?? undefined, current, prior, change: current - prior, changePct: pct(current, prior), doublecounted: doublecounted || undefined }];
    });
    const sorted = [...rows].sort((a, b) => b.change - a.change);
    return {
      basis: `DefiLlama current ${chain.defillama} TVL per protocol against its ${field === "tvlPrevDay" ? "previous-day" : field === "tvlPrevWeek" ? "previous-week" : "previous-month"} reading. Protocols with at least $1M on either reading; CEX, Chain and Canonical Bridge categories excluded. Changes include token price moves. Rows marked double counted are curators or allocators whose TVL is also inside the protocols they deposit into; never add them to a total.`,
      ranked: rows.filter((row) => !row.doublecounted).length,
      up: sorted.filter((row) => row.change > 0).slice(0, limit),
      down: sorted.filter((row) => row.change < 0).reverse().slice(0, limit),
    };
  }

  /** DEX volume, app fees or app revenue per protocol on the chain, rolling window against the one before. */
  async dimensionMovers(chain: ChainSpec, kind: "dexs" | "fees" | "revenue", window: ResearchWindow, limit = 12) {
    const overview = overviewSchema.parse(await this.json(kind === "dexs" ? urls.dexs(chain.defillama) : urls.fees(chain.defillama, kind === "fees" ? "dailyFees" : "dailyRevenue")));
    const [now, before] = window === "1d" ? ["total24h", "total48hto24h"] as const : window === "7d" ? ["total7d", "total14dto7d"] as const : ["total30d", "total60dto30d"] as const;
    const total = overview[now] ?? null;
    const rows = overview.protocols.flatMap((protocol): Mover[] => {
      const current = protocol[now] ?? null;
      const prior = protocol[before] ?? null;
      if (current === null || prior === null || Math.max(current, prior) <= 0) return [];
      return [{ name: protocol.displayName ?? protocol.name, category: protocol.category ?? undefined, current, prior, change: current - prior, changePct: pct(current, prior), share: total ? round(current / total * 100) : null }];
    });
    const label = kind === "dexs" ? "DEX volume" : kind === "fees" ? "app fees" : "app revenue";
    return {
      basis: `DefiLlama rolling ${label} per protocol on ${chain.defillama}: the latest ${windowDays[window]} complete days against the ${windowDays[window]} before.`,
      total,
      rows: [...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, limit),
    };
  }

  async stablecoinMovers(chain: ChainSpec, window: ResearchWindow, limit = 10) {
    const field = window === "1d" ? "circulatingPrevDay" : window === "7d" ? "circulatingPrevWeek" : "circulatingPrevMonth";
    const list = stablecoinsSchema.parse(await this.json(urls.stableAssets));
    const rows = list.peggedAssets.flatMap((asset): Mover[] => {
      const circulating = asset.chainCirculating[chain.defillama];
      const current = circulating?.current?.peggedUSD ?? null;
      const prior = circulating?.[field]?.peggedUSD ?? null;
      if (current === null || prior === null || Math.max(current, prior) < 100_000) return [];
      return [{ name: `${asset.symbol} (${asset.name})`, current, prior, change: current - prior, changePct: pct(current, prior) }];
    });
    return {
      basis: `DefiLlama circulating supply on ${chain.defillama} per USD-pegged stablecoin, current against the ${field.replace("circulatingPrev", "previous-").toLowerCase()} reading.`,
      rows: [...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, limit),
    };
  }

  async prices(coins: readonly string[], from: string, to: string): Promise<PriceMove[]> {
    if (!coins.length) return [];
    const start = Date.parse(from);
    const span = Math.round((Date.parse(to) - start) / day) + 1;
    const parsed = pricesSchema.parse(await this.json(urls.prices(coins, start, span)));
    return coins.map((coin) => {
      const entry = parsed.coins[coin];
      const daily = (entry?.prices ?? []).map((point) => [isoDay(point.timestamp * 1000), point.price] as const);
      const first = daily[0]?.[1] ?? null;
      const last = daily.at(-1)?.[1] ?? null;
      return { coin, symbol: entry?.symbol ?? coin.split(":").at(-1) ?? coin, start: first, end: last, changePct: pct(last, first), daily };
    });
  }

  /** A protocol's fees, revenue or volume per day on one chain, with its X handle and DefiLlama event notes. */
  async protocol(slug: string, chain: ChainSpec | undefined, kind: "fees" | "revenue" | "dexs", days: number) {
    const summary = protocolSummarySchema.parse(await this.json(urls.protocol(kind === "dexs" ? "dexs" : "fees", slug, kind === "dexs" ? undefined : kind === "fees" ? "dailyFees" : "dailyRevenue")));
    const since = utcMidnight(this.clock()) - days * day;
    const daily = summary.totalDataChartBreakdown.filter(([at]) => at * 1000 >= since).map(([at, byChain]) => {
      const values = chain ? byChain[chain.defillama] : undefined;
      const total = chain ? Object.values(values ?? {}).reduce((a, b) => a + b, 0) : Object.values(byChain).flatMap((row) => Object.values(row)).reduce((a, b) => a + b, 0);
      return [isoDay(at * 1000), round(total)] as const;
    });
    return {
      name: summary.displayName ?? summary.name,
      slug: summary.slug ?? slug,
      category: summary.category ?? null,
      twitter: summary.twitter ?? null,
      url: summary.url ?? null,
      description: summary.description?.slice(0, 400) ?? null,
      chains: summary.chains,
      totals: { last24h: summary.total24h ?? null, last7d: summary.total7d ?? null, last30d: summary.total30d ?? null },
      events: (summary.hallmarks ?? []).filter(([at]) => at * 1000 >= since - 90 * day).map(([at, note]) => ({ date: isoDay(at * 1000), note })),
      daily,
      source: urls.protocol(kind === "dexs" ? "dexs" : "fees", slug, kind === "dexs" ? undefined : kind === "fees" ? "dailyFees" : "dailyRevenue"),
    };
  }

  /** The largest single-day moves in the window, ranked by size against each metric's own scale. */
  eventDays(metrics: readonly MetricSummary[], period: ResearchPeriod, limit = 8): EventDay[] {
    const window = new Set(dates(period.start, period.end));
    const candidates: (EventDay & { score: number })[] = [];
    for (const metric of metrics) {
      const points = metric.daily.filter((point): point is readonly [string, number] => point[1] !== null);
      if (metric.kind === "level") {
        for (let index = 1; index < points.length; index++) {
          const [date, value] = points[index]!;
          const previous = points[index - 1]![1];
          if (!window.has(date) || previous === 0) continue;
          const change = value - previous;
          candidates.push({ date, metric: metric.key, label: metric.label, value, change, changePct: pct(value, previous), basis: "change from the previous day", score: Math.abs(change / previous) });
        }
      } else {
        const baseline = points.filter(([date]) => !window.has(date)).map(([, value]) => value);
        const mean = baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : null;
        if (mean === null || mean === 0) continue;
        for (const [date, value] of points) {
          if (!window.has(date)) continue;
          candidates.push({ date, metric: metric.key, label: metric.label, value, change: value - mean, changePct: pct(value, mean), basis: "against the prior window's daily average", score: Math.abs(value / mean - 1) });
        }
      }
    }
    const perMetric = new Map<MetricKey, number>();
    return candidates.sort((a, b) => b.score - a.score).filter((candidate) => {
      const used = perMetric.get(candidate.metric) ?? 0;
      if (used >= 2 || candidate.score < 0.03) return false;
      perMetric.set(candidate.metric, used + 1);
      return true;
    }).slice(0, limit).map(({ score: _score, ...event }) => event);
  }

  async pack(chain: ChainSpec, window: ResearchWindow): Promise<ResearchPack> {
    const now = this.clock();
    const period = researchPeriod(window, now);
    const notes: string[] = [];
    const available = metricKeys.filter((metric) => metricDefinitions[metric].provider === "DefiLlama" || chain.growthepie);
    if (!chain.growthepie) notes.push(`growthepie does not cover ${chain.name}, so transactions, active addresses and onchain fees are not in this report.`);
    const summaries = (await Promise.all(available.map((metric) => this.optional(this.metric(chain, metric, period), notes, metricDefinitions[metric].label)))).filter((summary): summary is MetricSummary => summary !== undefined);
    for (const summary of summaries) if (summary.missing.length) notes.push(`${summary.label} has no reading for ${summary.missing.join(", ")}.`);
    const empty = { basis: "", total: null, rows: [] };
    const [tvlMovers, dexMovers, feeMovers, revenueMovers, stablecoins, prices] = await Promise.all([
      this.optional(this.tvlMovers(chain, window), notes, "Protocol TVL movers"),
      this.optional(this.dimensionMovers(chain, "dexs", window), notes, "DEX volume by protocol"),
      this.optional(this.dimensionMovers(chain, "fees", window), notes, "App fees by protocol"),
      this.optional(this.dimensionMovers(chain, "revenue", window), notes, "App revenue by protocol"),
      this.optional(this.stablecoinMovers(chain, window), notes, "Stablecoins by asset"),
      this.optional(this.prices(chain.coins, period.priorEnd, period.end), notes, "Prices"),
    ]);
    const leadNames = new Map<string, "fees" | "dexs">();
    for (const row of [...(tvlMovers?.up.slice(0, 3) ?? []), ...(tvlMovers?.down.slice(0, 2) ?? []), ...(feeMovers?.rows.slice(0, 2) ?? [])]) if (!leadNames.has(row.name)) leadNames.set(row.name, "fees");
    for (const row of dexMovers?.rows.slice(0, 2) ?? []) if (!leadNames.has(row.name)) leadNames.set(row.name, "dexs");
    const leads = (await Promise.all([...leadNames].slice(0, 7).map(async ([name, kind]): Promise<Lead | undefined> => {
      try {
        const profile = await this.protocol(slugify(name), chain, kind, period.days * 2);
        return { name, slug: profile.slug, twitter: profile.twitter, url: profile.url, category: profile.category, events: profile.events };
      } catch { return undefined; }
    }))).filter((lead): lead is Lead => lead !== undefined);
    const sources = [
      ...summaries.map((summary) => ({ label: `${summary.label} (${metricDefinitions[summary.key].provider})`, url: summary.source })),
      { label: "Protocol TVL (DefiLlama)", url: urls.lite },
      { label: "Stablecoins by asset (DefiLlama)", url: urls.stableAssets },
      ...(chain.coins.length ? [{ label: "Prices (DefiLlama coins)", url: urls.prices(chain.coins, Date.parse(period.priorEnd), period.days + 1) }] : []),
    ];
    return {
      chain, window, period, generatedAt: new Date(now).toISOString(),
      metrics: summaries,
      eventDays: this.eventDays(summaries, period),
      prices: prices ?? [],
      tvlMovers: tvlMovers ?? { basis: "", ranked: 0, up: [], down: [] },
      dexMovers: dexMovers ?? empty,
      feeMovers: feeMovers ?? empty,
      revenueMovers: revenueMovers ?? empty,
      stablecoins: stablecoins ?? { basis: "", rows: [] },
      leads,
      notes,
      sources,
    };
  }
}

// Model-facing tools. Outputs are compact JSON with the source URL and the
// basis of every comparison, never presentation text.

const chainInput = z.string().trim().min(2).max(60).describe("Chain id such as base, ethereum, solana, or a DefiLlama chain name such as OP Mainnet.");
const windowInput = z.enum(researchWindows).default("7d").describe("Complete UTC days ending yesterday: 1d, 7d or 30d, compared with the same span before.");

export const chainDataEndpoints = {
  overview: {
    description: "Headline metrics for a chain over a window with the prior window: DeFi TVL, stablecoin supply, DEX volume, app fees and revenue, plus transactions, active addresses and onchain fees where growthepie covers the chain.",
    input: z.strictObject({ chain: chainInput, window: windowInput }),
  },
  metric: {
    description: "One chain metric per day for up to 365 days, oldest first, with window totals. Use it to date a move precisely.",
    input: z.strictObject({ chain: chainInput, metric: z.enum(metricKeys), days: z.number().int().min(2).max(365).default(30) }),
  },
  protocols: {
    description: "Protocols whose TVL on the chain moved most over the window, up and down, with category. Changes include token price moves.",
    input: z.strictObject({ chain: chainInput, window: windowInput, limit: z.number().int().min(1).max(25).default(10) }),
  },
  dexes: {
    description: "DEX volume per protocol on the chain for the window against the one before, with market share.",
    input: z.strictObject({ chain: chainInput, window: windowInput, limit: z.number().int().min(1).max(25).default(12) }),
  },
  fees: {
    description: "App fees or app revenue per protocol on the chain for the window against the one before.",
    input: z.strictObject({ chain: chainInput, kind: z.enum(["fees", "revenue"]).default("fees"), window: windowInput, limit: z.number().int().min(1).max(25).default(12) }),
  },
  stablecoins: {
    description: "Circulating supply per USD stablecoin on the chain, current against a day, week or month earlier. Shows which issuer minted or burned.",
    input: z.strictObject({ chain: chainInput, window: windowInput, limit: z.number().int().min(1).max(25).default(10) }),
  },
  protocol: {
    description: "One protocol's daily fees, revenue or DEX volume on a chain, its X handle, website, category and DefiLlama event notes. Slug is the DefiLlama slug, usually the lowercase name with hyphens, for example morpho-blue or aerodrome-slipstream.",
    input: z.strictObject({ slug: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{1,80}$/), chain: chainInput.optional(), kind: z.enum(["fees", "revenue", "dexs"]).default("fees"), days: z.number().int().min(2).max(120).default(30) }),
  },
  prices: {
    description: "Daily USD prices from DefiLlama coins, for separating price moves from deposits. Coins are ids like coingecko:ethereum, coingecko:bitcoin or base:0xTOKEN.",
    input: z.strictObject({ coins: z.array(z.string().regex(/^[a-z0-9-]+:[A-Za-z0-9.-]{1,80}$/)).min(1).max(8), from: z.iso.date(), to: z.iso.date() }),
  },
} as const;
export type ChainDataEndpointName = keyof typeof chainDataEndpoints;
export const chainDataEndpointNames = Object.keys(chainDataEndpoints).filter((name): name is ChainDataEndpointName => Object.hasOwn(chainDataEndpoints, name));

const compactMetric = (summary: MetricSummary, dailyFrom?: string) => ({
  metric: summary.key, label: summary.label, unit: summary.unit,
  measure: summary.kind === "level" ? "value on the last day, change against the day before the window" : summary.kind === "flow" ? "window sum against the prior window's sum" : "window daily average against the prior window's",
  current: round(summary.current), prior: round(summary.prior), change: round(summary.change), change_pct: round(summary.changePct),
  missing_days: summary.missing.length ? summary.missing : undefined,
  daily: dailyFrom ? summary.daily.filter(([date]) => date >= dailyFrom).map(([date, value]) => [date, round(value)]) : undefined,
  source: summary.source,
});

type ChainToolValue = string | number | boolean | null | undefined | readonly ChainToolValue[] | { readonly [key: string]: ChainToolValue };
/** What a chain_* tool returns before the source stamp: JSON-compatible, with readonly rows from the service. */
type ChainToolOutput = Readonly<Record<string, ChainToolValue>>;

export async function chainDataTool(service: ChainDataService, resolve: (chain: string) => Promise<ChainSpec>, name: ChainDataEndpointName, raw: JsonInput): Promise<string> {
  const retrievedAt = new Date().toISOString();
  const output = async (): Promise<ChainToolOutput> => {
    switch (name) {
      case "overview": {
        const input = chainDataEndpoints.overview.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        const period = researchPeriod(input.window, Date.now());
        const notes: string[] = [];
        const keys = metricKeys.filter((metric) => metricDefinitions[metric].provider === "DefiLlama" || chain.growthepie);
        const metrics = (await Promise.all(keys.map((metric) => service.metric(chain, metric, period).catch((error) => { notes.push(`${metricDefinitions[metric].label}: ${error instanceof Error ? error.message : String(error)}`); return undefined; })))).flatMap((summary) => summary ? [compactMetric(summary)] : []);
        return { chain: chain.name, period, metrics, notes: notes.length ? notes : undefined };
      }
      case "metric": {
        const input = chainDataEndpoints.metric.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        const end = utcMidnight(Date.now()) - day;
        const period: ResearchPeriod = { start: isoDay(end - (input.days - 1) * day), end: isoDay(end), priorStart: isoDay(end - (2 * input.days - 1) * day), priorEnd: isoDay(end - input.days * day), days: input.days };
        return { chain: chain.name, period, ...compactMetric(await service.metric(chain, input.metric, period), period.start) };
      }
      case "protocols": {
        const input = chainDataEndpoints.protocols.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        return { chain: chain.name, ...(await service.tvlMovers(chain, input.window, input.limit)) };
      }
      case "dexes": {
        const input = chainDataEndpoints.dexes.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        return { chain: chain.name, ...(await service.dimensionMovers(chain, "dexs", input.window, input.limit)) };
      }
      case "fees": {
        const input = chainDataEndpoints.fees.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        return { chain: chain.name, ...(await service.dimensionMovers(chain, input.kind, input.window, input.limit)) };
      }
      case "stablecoins": {
        const input = chainDataEndpoints.stablecoins.input.parse(raw ?? {});
        const chain = await resolve(input.chain);
        return { chain: chain.name, ...(await service.stablecoinMovers(chain, input.window, input.limit)) };
      }
      case "protocol": {
        const input = chainDataEndpoints.protocol.input.parse(raw ?? {});
        return await service.protocol(input.slug, input.chain ? await resolve(input.chain) : undefined, input.kind, input.days);
      }
      case "prices": {
        const input = chainDataEndpoints.prices.input.parse(raw ?? {});
        return { prices: (await service.prices(input.coins, input.from, input.to)).map((price) => ({ ...price, start: round(price.start, 6), end: round(price.end, 6), changePct: round(price.changePct) })) };
      }
      default: {
        const _exhaustive: never = name;
        throw new Error(`Unknown chain data tool ${String(_exhaustive)}`);
      }
    }
  };
  return JSON.stringify({ source: name === "overview" || name === "metric" ? "DefiLlama and growthepie" : "DefiLlama", retrieved_at: retrievedAt, ...(await output()) });
}
