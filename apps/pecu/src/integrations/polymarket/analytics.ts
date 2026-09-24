import type { PolymarketToken } from "./model-output";
import { z } from "zod";
import { analyticsAddress, analyticsSnapshotSchema, analyticsText, type AnalyticsResult, type PolymarketSnapshot } from "../../analytics-contract";
import type { PolymarketRead } from "./client";

const number = z.unknown().optional().transform((value) => {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
});
const probability = number.transform((value) => value !== null && value >= 0 && value <= 1 ? value : null);
const text = z.unknown().optional().transform((value) => typeof value === "string" && value ? value : null);
const flag = z.unknown().optional().transform((value) => value === true);
const jsonList = z.unknown().optional().transform((value): unknown[] => {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
});
const list = <T extends z.ZodType>(row: T) => z.unknown().optional().transform((value) => Array.isArray(value) ? value.flatMap((item) => {
  const parsed = row.safeParse(item);
  return parsed.success ? [parsed.data as z.output<T>] : [];
}) : []);

const marketSchema = z.object({
  question: text, slug: text, groupItemTitle: text, outcomes: jsonList, outcomePrices: jsonList,
  volume24hr: number, liquidityNum: number, liquidity: number, endDate: text, closed: flag,
  events: list(z.object({ slug: text })),
});
const eventSchema = z.object({ title: text, slug: text, volume24hr: number, liquidity: number, endDate: text, closed: flag, markets: list(marketSchema) });
const envelope = <T extends z.ZodType>(row: T) => z.object({ data: z.array(row) });

type Market = z.infer<typeof marketSchema>;
type Event = z.infer<typeof eventSchema>;

const eventUrl = (slug: string | null) => slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null;
const marketUrl = (market: Market) => eventUrl(market.events[0]?.slug ?? null);

function outcomes(market: Market) {
  return market.outcomes.map((label, index) => ({ label: String(label), probability: probability.parse(market.outcomePrices[index]) }));
}

function eventRows(event: Event) {
  const open = event.markets.filter((market) => !market.closed);
  if (open.length === 1 && open[0]) return outcomes(open[0]);
  return open
    .map((market) => ({ label: market.groupItemTitle ?? market.question ?? "Outcome", probability: probability.parse(market.outcomePrices[0]) }))
    .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1));
}

function leader(rows: { label: string; probability: number | null }[]) {
  return rows.reduce<{ label: string; probability: number | null } | undefined>((best, row) => (row.probability ?? -1) > (best?.probability ?? -1) ? row : best, undefined);
}

const windows: Record<string, string> = { "1h": "Past hour", "6h": "Past 6 hours", "12h": "Past 12 hours", "1d": "Past day", day: "Past day", "1w": "Past week", week: "Past week", "1m": "Past month", month: "Past month", max: "All time", all: "All time" };
const windowLabel = (value: unknown, fallback: string) => typeof value === "string" && windows[value] ? windows[value] : fallback;
const nameOf = (name: string | null, wallet: string) => name && !/^0x[0-9a-f]{40}/i.test(name) ? name : analyticsAddress(wallet);

export function polymarketAnalytics(input: Record<string, unknown>, result: PolymarketRead, selected?: PolymarketToken): PolymarketSnapshot | undefined {
  const observedAt = Date.parse(result.observedAt);
  const context = (subject: string, period: string, partial = false) => ({
    key: JSON.stringify(["polymarket", result.endpoint, subject, period]),
    observedAt: Number.isFinite(observedAt) ? observedAt : Date.now(),
    subject, chain: "polygon", period, partial,
  });
  const build = (value: unknown) => {
    const parsed = analyticsSnapshotSchema.safeParse(value);
    return parsed.success && parsed.data.kind.startsWith("pm_") ? parsed.data as PolymarketSnapshot : undefined;
  };
  const data = result.data;
  switch (result.endpoint) {
    case "midpoint": {
      if (!selected) return undefined;
      const value = z.object({mid:probability}).safeParse(data);
      if (!value.success) return undefined;
      return build({ ...context(selected.slug ?? selected.tokenId, "Current"), kind:"pm_odds", title:selected.title, url:selected.url,
        endDate:selected.endDate, volume24hUsd:null, liquidityUsd:null, rows:[{label:selected.outcome,probability:value.data.mid}] });
    }
    case "market":
    case "market_by_slug": {
      const market = marketSchema.safeParse(data);
      if (!market.success || !market.data.outcomes.length) return undefined;
      const m = market.data;
      return build({ ...context(m.slug ?? String(input.slug ?? input.id ?? "market"), "Current"), kind: "pm_odds", title: m.question ?? "Polymarket market", url: marketUrl(m), endDate: m.endDate, volume24hUsd: m.volume24hr, liquidityUsd: m.liquidityNum ?? m.liquidity, rows: outcomes(m).slice(0, 60) });
    }
    case "event":
    case "event_by_slug": {
      const event = eventSchema.safeParse(data);
      if (!event.success) return undefined;
      const rows = eventRows(event.data);
      if (!rows.length) return undefined;
      return build({ ...context(event.data.slug ?? String(input.slug ?? input.id ?? "event"), "Current", rows.length > 60), kind: "pm_odds", title: event.data.title ?? "Polymarket event", url: eventUrl(event.data.slug), endDate: event.data.endDate, volume24hUsd: event.data.volume24hr, liquidityUsd: event.data.liquidity, rows: rows.slice(0, 60) });
    }
    case "markets": {
      const list = z.object({ markets: z.array(marketSchema) }).safeParse(data);
      if (!list.success) return undefined;
      const rows = list.data.markets.slice(0, 25).map((market) => {
        const top = leader(outcomes(market));
        return { title: market.question ?? "Polymarket market", url: marketUrl(market), leader: top?.label ?? null, probability: top?.probability ?? null, volume24hUsd: market.volume24hr, endDate: market.endDate };
      });
      return build({ ...context("markets", "Current"), kind: "pm_markets", rows });
    }
    case "events":
    case "search": {
      const list = z.object({ events: z.array(eventSchema) }).safeParse(data);
      if (!list.success) return undefined;
      const all = list.data.events.flatMap((event) => event.markets.length ? event.markets.filter(m => !m.closed).map(m => {
        const top = leader(outcomes(m));
        return { title:m.question ?? m.groupItemTitle ?? event.title ?? "Polymarket market", url:eventUrl(event.slug), leader:top?.label ?? null,
          probability:top?.probability ?? null, volume24hUsd:m.volume24hr, endDate:m.endDate };
      }) : [{title:event.title ?? "Polymarket event",url:eventUrl(event.slug),leader:null,probability:null,volume24hUsd:event.volume24hr,endDate:event.endDate}]);
      return build({ ...context(String(input.q ?? "events"), "Current", all.length > 25 || result.next !== null), kind: "pm_markets", rows:all.slice(0,25) });
    }
    case "prices_history": {
      const series = envelope(z.object({ price: z.number().finite(), timestamp: z.number().int().nonnegative() })).safeParse(data);
      if (!series.success) return undefined;
      const points = series.data.data.filter((point) => point.price >= 0 && point.price <= 1).slice(-1000).map((point) => ({ t: point.timestamp, p: point.price }));
      return build({ ...context(String(input.token_id ?? "token"), windowLabel(input.interval, "Custom window"), result.next !== null), kind: "pm_history", title: selected?.title ?? null, outcome: selected?.outcome ?? null, points });
    }
    case "book": {
      const level = z.object({ price: number, size: number });
      const book = z.object({ asset_id: text, bids: z.array(level), asks: z.array(level), last_trade_price: probability }).safeParse(data);
      if (!book.success) return undefined;
      const side = (levels: { price: number | null; size: number | null }[], best: "high" | "low") => levels
        .filter((row): row is { price: number; size: number } => row.price !== null && row.price >= 0 && row.price <= 1 && row.size !== null && row.size >= 0)
        .sort((a, b) => best === "high" ? b.price - a.price : a.price - b.price)
        .slice(0, 15);
      const bids = side(book.data.bids, "high"), asks = side(book.data.asks, "low");
      const bid = bids[0]?.price, ask = asks[0]?.price;
      return build({ ...context(book.data.asset_id ?? String(input.token_id ?? "token"), "Current"), kind: "pm_book", title: selected?.title ?? null, outcome: selected?.outcome ?? null, midpoint: bid !== undefined && ask !== undefined ? (bid + ask) / 2 : null, spread: bid !== undefined && ask !== undefined ? ask - bid : null, lastTrade: book.data.last_trade_price, bids, asks });
    }
    case "leaderboard": {
      if (input.user !== undefined) return undefined;
      const board = envelope(z.object({ rank: z.number().int().nonnegative(), user_id: z.string(), user_name: text, pnl: number, volume: number })).safeParse(data);
      if (!board.success) return undefined;
      const rows = board.data.data.slice(0, 100).map((row) => ({ rank: row.rank, name: nameOf(row.user_name, row.user_id), wallet: row.user_id, pnlUsd: row.pnl, volume: row.volume }));
      return build({ ...context(String(input.category ?? "overall"), windowLabel(input.time_period ?? "day", "Past day")), kind: "pm_leaderboard", board: input.sort_by === "VOLUME" ? "volume" : "pnl", rows });
    }
    case "biggest_winners": {
      const wins = envelope(z.object({ win_rank: z.number().int().nonnegative(), user_id: z.string(), user_name: text, event_title: text, event_slug: text, kind: text, pnl: number, initial_value: number })).safeParse(data);
      if (!wins.success) return undefined;
      const rows = wins.data.data.slice(0, 100).map((row) => ({ rank: row.win_rank, name: nameOf(row.user_name, row.user_id), wallet: row.user_id, title: row.event_title ?? "Polymarket market", url: row.kind === "market" ? eventUrl(row.event_slug) : null, pnlUsd: row.pnl, costUsd: row.initial_value }));
      return build({ ...context(String(input.category ?? "overall"), windowLabel(input.time_period ?? "day", "Past day")), kind: "pm_wins", rows });
    }
    case "user_pnl": {
      const series = z.object({ data: z.object({ points: z.array(z.object({ timestamp: z.number().int().nonnegative(), economic_pnl: number })) }) }).safeParse(data);
      if (!series.success || typeof input.user !== "string") return undefined;
      const points = series.data.data.points.flatMap((point) => point.economic_pnl === null ? [] : [{ t: point.timestamp, pnlUsd: point.economic_pnl }]).slice(-1000);
      return build({ ...context(input.user, windowLabel(input.interval ?? "1d", "Past day"), points.length < series.data.data.points.length), kind: "pm_trader", name: null, points });
    }
    case "positions": {
      if (typeof input.user !== "string") return undefined;
      const page = envelope(z.object({ title: text, outcome: text, event_slug: text, current_size: number, avg_price: probability, current_price: probability, current_value: number, total_pnl: number })).safeParse(data);
      if (!page.success) return undefined;
      const rows = page.data.data.slice(0, 100).map((row) => ({ title: row.title ?? "Polymarket market", outcome: row.outcome ?? "Outcome", url: eventUrl(row.event_slug), size: row.current_size, avgPrice: row.avg_price, currentPrice: row.current_price, valueUsd: row.current_value, pnlUsd: row.total_pnl }));
      return build({ ...context(input.user, String(input.status ?? "OPEN"), result.next !== null), kind: "pm_positions", rows });
    }
    default:
      return undefined;
  }
}

export function coalescePolymarketAnalytics(results: AnalyticsResult[]): AnalyticsResult[] {
  const merged: AnalyticsResult[] = [];
  for (const result of results) {
    const current = result.snapshot;
    if (current.kind !== "pm_odds") { merged.push(result); continue; }
    const index = merged.findIndex(({snapshot}) => snapshot.kind === "pm_odds" && snapshot.subject === current.subject && snapshot.title === current.title && snapshot.endDate === current.endDate);
    const previous = merged[index]?.snapshot;
    if (previous?.kind !== "pm_odds") { merged.push(result); continue; }
    const midpointKey = JSON.stringify(["polymarket", "midpoint", current.subject, current.period]);
    const selected = previous.key === midpointKey ? previous : current;
    const other = selected === previous ? current : previous;
    const snapshot = { ...selected, url:selected.url ?? other.url,
      volume24hUsd:selected.volume24hUsd ?? other.volume24hUsd, liquidityUsd:selected.liquidityUsd ?? other.liquidityUsd };
    merged[index] = { snapshot, text:analyticsText(snapshot) };
  }
  return merged;
}
