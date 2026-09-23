import { z } from "zod";

const money = z.number().finite().nullable();
const token = z.object({ chain: z.string(), address: z.string(), symbol: z.string() });
const base = { key: z.string(), observedAt: z.number().int().nonnegative(), subject: z.string(), chain: z.string(), period: z.string(), partial: z.boolean() };
const odds = z.number().min(0).max(1).nullable();
const link = z.string().url().nullable();
const level = z.object({ price: z.number().min(0).max(1), size: z.number().nonnegative() });

export const pnlSnapshotSchema = z.object({
  ...base, kind: z.literal("pnl"),
  rows: z.array(token.extend({ realizedUsd: money, unrealizedUsd: money })).max(1000),
});
export type PnlSnapshot = z.infer<typeof pnlSnapshotSchema>;

const nansenSnapshots = [
  z.object({
    ...base, kind: z.literal("flows"),
    rows: z.array(z.object({ label: z.string(), netUsd: money, wallets: z.number().int().nonnegative().nullable() })).max(6),
  }),
  pnlSnapshotSchema,
  z.object({
    ...base, kind: z.literal("portfolio"),
    balances: z.array(token.extend({ amount: money, valueUsd: money })).max(1000).nullable(),
    defi: z.object({
      assetsUsd: money, debtUsd: money, rewardsUsd: money, netUsd: money,
      protocols: z.array(z.object({ name: z.string(), chain: z.string(), assetsUsd: money, debtUsd: money, netUsd: money })).max(1000),
    }).nullable(),
  }),
] as const;

const polymarketSnapshots = [
  z.object({
    ...base, kind: z.literal("pm_odds"),
    title: z.string(), url: link, endDate: z.string().nullable(), volume24hUsd: money, liquidityUsd: money,
    rows: z.array(z.object({ label: z.string(), probability: odds })).max(60),
  }),
  z.object({
    ...base, kind: z.literal("pm_markets"),
    rows: z.array(z.object({ title: z.string(), url: link, leader: z.string().nullable(), probability: odds, volume24hUsd: money, endDate: z.string().nullable() })).max(25),
  }),
  z.object({
    ...base, kind: z.literal("pm_history"),
    title: z.string().nullable(), outcome: z.string().nullable(),
    points: z.array(z.object({ t: z.number().int().nonnegative(), p: z.number().min(0).max(1) })).max(1000),
  }),
  z.object({
    ...base, kind: z.literal("pm_book"),
    title: z.string().nullable(), outcome: z.string().nullable(), midpoint: odds, spread: odds, lastTrade: odds,
    bids: z.array(level).max(50), asks: z.array(level).max(50),
  }),
  z.object({
    ...base, kind: z.literal("pm_leaderboard"),
    board: z.enum(["pnl", "volume"]),
    rows: z.array(z.object({ rank: z.number().int().nonnegative(), name: z.string(), wallet: z.string(), pnlUsd: money, volume: money })).max(100),
  }),
  z.object({
    ...base, kind: z.literal("pm_wins"),
    rows: z.array(z.object({ rank: z.number().int().nonnegative(), name: z.string(), wallet: z.string(), title: z.string(), url: link, pnlUsd: money, costUsd: money })).max(100),
  }),
  z.object({
    ...base, kind: z.literal("pm_trader"),
    name: z.string().nullable(),
    points: z.array(z.object({ t: z.number().int().nonnegative(), pnlUsd: z.number().finite() })).max(1000),
  }),
  z.object({
    ...base, kind: z.literal("pm_positions"),
    rows: z.array(z.object({ title: z.string(), outcome: z.string(), url: link, size: money, avgPrice: odds, currentPrice: odds, valueUsd: money, pnlUsd: money })).max(100),
  }),
] as const;

export const analyticsSnapshotSchema = z.discriminatedUnion("kind", [...nansenSnapshots, ...polymarketSnapshots]);
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
export type PolymarketSnapshot = Extract<AnalyticsSnapshot, { kind: `pm_${string}` }>;
export type NansenSnapshot = Exclude<AnalyticsSnapshot, PolymarketSnapshot>;
export const isPolymarketSnapshot = (snapshot: AnalyticsSnapshot): snapshot is PolymarketSnapshot => snapshot.kind.startsWith("pm_");
export const analyticsResultSchema = z.object({ snapshot: analyticsSnapshotSchema, text: z.string() });
export const analyticsResultsSchema = z.array(analyticsResultSchema).max(12);
export type AnalyticsResult = z.infer<typeof analyticsResultSchema>;

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const analyticsUsd = (value: number | null): string => value === null ? "Unavailable" : dollars.format(value);
export const analyticsCompactUsd = (value: number | null): string => value === null ? "Unavailable" : Math.abs(value) < 1000 ? dollars.format(value) : compactDollars.format(value);
export const analyticsShares = (value: number | null): string => value === null ? "Unavailable" : `${compactNumber.format(value)} shares`;
export const analyticsOdds = (value: number | null): string => value === null ? "Unavailable" : `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
export const analyticsCents = (value: number | null): string => value === null ? "Unavailable" : `${(value * 100).toFixed(1)}¢`;
export const analyticsAddress = (value: string): string => value.length > 18 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
export function analyticsTotal(values: (number | null)[]): number | null {
  if (values.some((value) => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return Number.isFinite(total) ? total : null;
}

const capped = <T>(rows: readonly T[], line: (row: T) => string, noun: string): string[] =>
  [...rows.slice(0, 12).map(line), ...(rows.length > 12 ? [`Text shows the first 12 ${noun}.`] : [])];

function polymarketLines(snapshot: PolymarketSnapshot): string[] {
  switch (snapshot.kind) {
    case "pm_odds":
      return [`${snapshot.title} · market-implied odds`,
        ...capped(snapshot.rows, (row) => `${row.label}: ${analyticsOdds(row.probability)}`, "outcomes"),
        `24h volume: ${analyticsCompactUsd(snapshot.volume24hUsd)}; liquidity: ${analyticsCompactUsd(snapshot.liquidityUsd)}${snapshot.endDate ? `; ends ${snapshot.endDate.slice(0, 10)}` : ""}`,
        ...(snapshot.url ? [snapshot.url] : [])];
    case "pm_markets":
      return ["Polymarket markets · market-implied odds",
        ...capped(snapshot.rows, (row) => `${row.title}: ${row.leader ? `${row.leader} ` : ""}${analyticsOdds(row.probability)}, 24h volume ${analyticsCompactUsd(row.volume24hUsd)}${row.url ? ` ${row.url}` : ""}`, "markets")];
    case "pm_history": {
      const first = snapshot.points[0], last = snapshot.points.at(-1);
      return [`Price history · ${snapshot.title ?? `outcome token ${analyticsAddress(snapshot.subject)}`}${snapshot.outcome ? ` · ${snapshot.outcome}` : ""} · ${snapshot.period}`,
        first && last ? `${analyticsOdds(first.p)} on ${new Date(first.t * 1000).toISOString().slice(0, 10)} to ${analyticsOdds(last.p)} on ${new Date(last.t * 1000).toISOString().slice(0, 10)}, ${snapshot.points.length} points` : "No price points returned for this window."];
    }
    case "pm_book": {
      const bid = snapshot.bids[0], ask = snapshot.asks[0];
      return [`Order book · ${snapshot.title ?? `outcome token ${analyticsAddress(snapshot.subject)}`}${snapshot.outcome ? ` · ${snapshot.outcome}` : ""}`,
        `Best bid ${bid ? `${analyticsCents(bid.price)} for ${analyticsShares(bid.size)}` : "none"}; best ask ${ask ? `${analyticsCents(ask.price)} for ${analyticsShares(ask.size)}` : "none"}`,
        `Midpoint ${analyticsCents(snapshot.midpoint)}; spread ${analyticsCents(snapshot.spread)}; last trade ${analyticsCents(snapshot.lastTrade)}`];
    }
    case "pm_leaderboard":
      return [`Polymarket ${snapshot.board === "pnl" ? "profit" : "volume"} leaderboard · ${snapshot.period}`,
        ...capped(snapshot.rows, (row) => `#${row.rank} ${row.name}: P&L ${analyticsUsd(row.pnlUsd)}, volume ${analyticsShares(row.volume)}`, "traders")];
    case "pm_wins":
      return [`Biggest Polymarket wins · ${snapshot.period}`,
        ...capped(snapshot.rows, (row) => `#${row.rank} ${row.name}: ${analyticsUsd(row.pnlUsd)} on ${row.title}`, "wins")];
    case "pm_trader": {
      const last = snapshot.points.at(-1);
      return [`Polymarket P&L · ${snapshot.name ?? analyticsAddress(snapshot.subject)} · ${snapshot.period}`,
        last ? `Cumulative P&L ${analyticsUsd(last.pnlUsd)} on ${new Date(last.t * 1000).toISOString().slice(0, 10)}, ${snapshot.points.length} points` : "No P&L points returned for this window."];
    }
    case "pm_positions":
      return [`Polymarket positions · ${analyticsAddress(snapshot.subject)}`,
        ...(snapshot.rows.length ? capped(snapshot.rows, (row) => `${row.title} · ${row.outcome}: value ${analyticsUsd(row.valueUsd)}, P&L ${analyticsUsd(row.pnlUsd)}`, "positions") : ["No positions returned."])];
  }
}

export function analyticsText(snapshot: AnalyticsSnapshot): string {
  if (isPolymarketSnapshot(snapshot)) {
    const lines = polymarketLines(snapshot);
    if (snapshot.partial) lines.push("More results are available. This shows one page.");
    return `${lines.join("\n")}\nData: Polymarket (polymarket.com)`;
  }
  let lines: string[];
  switch (snapshot.kind) {
    case "flows":
      lines = [`Token flows · ${analyticsAddress(snapshot.subject)} · ${snapshot.chain} · ${snapshot.period}`,
        ...snapshot.rows.map((row) => `${row.label}: ${analyticsUsd(row.netUsd)} net${row.wallets === null ? "" : `, ${row.wallets} wallets`}`),
        "Positive values mean net inflows to the group. Groups may overlap; transfers are not necessarily trades."];
      break;
    case "pnl":
      lines = [`Trading P&L · ${analyticsAddress(snapshot.subject)} · ${snapshot.chain} · ${snapshot.period}`,
        ...snapshot.rows.toSorted((a, b) => Math.max(Math.abs(b.realizedUsd ?? 0), Math.abs(b.unrealizedUsd ?? 0)) - Math.max(Math.abs(a.realizedUsd ?? 0), Math.abs(a.unrealizedUsd ?? 0))).slice(0, 12).map((row) => `${row.symbol} [${row.chain}]: realized ${analyticsUsd(row.realizedUsd)}, unrealized ${analyticsUsd(row.unrealizedUsd)}`)];
      if (!snapshot.rows.length) lines.push("No trading P&L returned for this period.");
      if (snapshot.rows.length > 12) lines.push("Text shows the 12 largest gains or losses by magnitude.");
      break;
    case "portfolio":
      lines = [`Portfolio exposure · ${analyticsAddress(snapshot.subject)} · ${snapshot.chain}`];
      if (snapshot.balances === null) lines.push("Wallet balances are unavailable.");
      else if (!snapshot.balances.length) lines.push("No wallet token balances returned.");
      else {
        lines.push(...snapshot.balances.toSorted((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)).slice(0, 12).map((row) => `${row.symbol} [${row.chain}]: ${analyticsUsd(row.valueUsd)}`));
        if (snapshot.balances.length > 12) lines.push("Text shows the 12 largest wallet holdings.");
      }
      if (snapshot.defi === null) lines.push("DeFi positions are unavailable.");
      else {
        lines.push(`DeFi assets: ${analyticsUsd(snapshot.defi.assetsUsd)}; debt: ${analyticsUsd(snapshot.defi.debtUsd)}; net value: ${analyticsUsd(snapshot.defi.netUsd)}`);
        lines.push(...snapshot.defi.protocols.toSorted((a, b) => (b.assetsUsd ?? 0) - (a.assetsUsd ?? 0)).slice(0, 12).map((row) => `${row.name} [${row.chain}]: assets ${analyticsUsd(row.assetsUsd)}, debt ${analyticsUsd(row.debtUsd)}`));
        if (snapshot.defi.protocols.length > 12) lines.push("Text shows the 12 largest DeFi positions by asset value.");
      }
      lines.push("Wallet tokens and DeFi positions are shown separately because receipt tokens can overlap.");
      break;
  }
  if (snapshot.partial) lines.push("Partial data. Missing values are not counted as zero; returned rows may not cover the full result.");
  return `${lines.join("\n")}\nData: Nansen (nansen.ai)`;
}
