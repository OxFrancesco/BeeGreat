import { useMemo, useState, type ReactNode } from "react";
import {
  analyticsAddress,
  analyticsCents,
  analyticsCompactUsd,
  analyticsOdds,
  analyticsShares,
  analyticsUsd,
  type PolymarketSnapshot,
} from "../../../../src/analytics-contract";
import { lossClass, signedUsd } from "@/lib/wallet-pnl";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { AreaChart } from "./dither-kit/area-chart";
import { Area } from "./dither-kit/area";
import { Tooltip } from "./dither-kit/tooltip";
import { XAxis } from "./dither-kit/x-axis";
import { YAxis } from "./dither-kit/y-axis";
import { ReferenceLine } from "./dither-kit/reference-line";
import type { ChartConfig } from "./dither-kit/chart-context";
import { SignedBars } from "./nansen-charts";

type Of<K extends PolymarketSnapshot["kind"]> = Extract<PolymarketSnapshot, { kind: K }>;

const oddsConfig = { p: { label: "Odds", color: "orange" } } satisfies ChartConfig;
const pnlConfig = { pnl: { label: "P&L", color: "orange" } } satisfies ChartConfig;
const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const profileUrl = (wallet: string) => `https://polymarket.com/profile/${encodeURIComponent(wallet)}`;

function timeLabels(points: readonly { t: number }[]) {
  const first = points[0]?.t ?? 0, last = points.at(-1)?.t ?? 0;
  const format = new Intl.DateTimeFormat("en-US", last - first < 2 * 86_400 ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" });
  return points.map((point) => format.format(new Date(point.t * 1000)));
}

function Shell({ title, meta, snapshot, illustrative, children }: { title: string; meta: string; snapshot: PolymarketSnapshot; illustrative: boolean; children: ReactNode }) {
  return <section className="my-4 min-w-0 w-full max-w-xl rounded-xl border border-border bg-card p-4 text-card-foreground" aria-label={title}>
    <h3 className="!m-0 text-base font-semibold break-words">{title}</h3>
    <p className="!mt-1 text-sm text-muted-foreground">{illustrative ? "Illustrative data" : meta}</p>
    {children}
    {snapshot.partial ? <p role="status" className="text-sm text-muted-foreground">More results are available. This shows one page.</p> : null}
    <p className="!mb-0 mt-3 text-xs text-muted-foreground"><a href="https://polymarket.com" target="_blank" rel="noreferrer" className="underline">{illustrative ? "Polymarket integration" : "Data: Polymarket"}</a>{illustrative ? null : <> · Retrieved {new Date(snapshot.observedAt).toLocaleString()}</>}</p>
  </section>;
}

function OddsBar({ label, probability, href }: { label: string; probability: number | null; href?: string | null }) {
  return <div className="grid gap-1.5">
    <span className="flex min-w-0 items-baseline justify-between gap-4">
      {href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 break-words">{label}</a> : <span className="min-w-0 break-words">{label}</span>}
      <span className="shrink-0 font-mono text-sm tabular-nums">{analyticsOdds(probability)}</span>
    </span>
    <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((probability ?? 0) * 1000) / 10}%` }} /></span>
  </div>;
}

function Expandable<T>({ rows, limit, children }: { rows: readonly T[]; limit: number; children: (row: T, index: number) => ReactNode }) {
  const [all, setAll] = useState(false);
  return <>
    <ul className="!m-0 !mt-3 !list-none !p-0 divide-y divide-border">{(all ? rows : rows.slice(0, limit)).map(children)}</ul>
    {rows.length > limit ? <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all"}</Button> : null}
  </>;
}

function Odds({ snapshot, illustrative }: { snapshot: Of<"pm_odds">; illustrative: boolean }) {
  const ends = snapshot.endDate ? new Date(snapshot.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  return <Shell title={snapshot.title} meta={["Market-implied odds", ends ? `ends ${ends}` : null].filter(Boolean).join(" · ")} snapshot={snapshot} illustrative={illustrative}>
    {snapshot.rows.length ? <Expandable rows={snapshot.rows} limit={8}>{(row, index) => <li key={`${row.label}:${index}`} className="!m-0 py-2"><OddsBar label={row.label} probability={row.probability} /></li>}</Expandable> : <p className="text-sm text-muted-foreground">No open outcomes returned.</p>}
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt className="text-muted-foreground">24h volume</dt><dd className="text-right font-mono tabular-nums">{analyticsCompactUsd(snapshot.volume24hUsd)}</dd><dt className="text-muted-foreground">Liquidity</dt><dd className="text-right font-mono tabular-nums">{analyticsCompactUsd(snapshot.liquidityUsd)}</dd></dl>
    {snapshot.url ? <p className="mt-3 text-sm"><a href={snapshot.url} target="_blank" rel="noreferrer" className="underline">View on Polymarket</a></p> : null}
  </Shell>;
}

function Markets({ snapshot, illustrative }: { snapshot: Of<"pm_markets">; illustrative: boolean }) {
  return <Shell title="Polymarket markets" meta="Leading outcome and market-implied odds" snapshot={snapshot} illustrative={illustrative}>
    {snapshot.rows.length ? <Expandable rows={snapshot.rows} limit={6}>{(row, index) => <li key={`${row.title}:${index}`} className="!m-0 py-2">
      <OddsBar label={row.title} probability={row.probability} href={row.url} />
      <p className="!m-0 text-xs text-muted-foreground">{row.leader ? `${row.leader} leads` : "Leader unavailable"} · 24h volume {analyticsCompactUsd(row.volume24hUsd)}</p>
    </li>}</Expandable> : <p className="text-sm text-muted-foreground">No markets returned.</p>}
  </Shell>;
}

function History({ snapshot, illustrative }: { snapshot: Of<"pm_history">; illustrative: boolean }) {
  const data = useMemo(() => { const labels = timeLabels(snapshot.points); return snapshot.points.map((point, index) => ({ label: labels[index], p: point.p })); }, [snapshot.points]);
  const first = snapshot.points[0], last = snapshot.points.at(-1);
  const change = first && last ? (last.p - first.p) * 100 : null;
  return <Shell title={snapshot.title ?? "Price history"} meta={[snapshot.outcome, snapshot.title ? null : `Outcome token ${analyticsAddress(snapshot.subject)}`, snapshot.period].filter(Boolean).join(" · ")} snapshot={snapshot} illustrative={illustrative}>
    {last ? <p className="mt-3 font-mono text-lg tabular-nums">{analyticsOdds(last.p)}{change !== null ? <span className={cn("ml-2 text-sm", change < 0 ? "pecu-pnl-loss" : "text-muted-foreground")}>{change > 0 ? "+" : ""}{change.toFixed(1)} pts</span> : null}</p> : null}
    {data.length > 1 ? <div className="h-56 w-full min-w-0" aria-hidden="true">
      <AreaChart data={data} config={oddsConfig} animate={false} bloom="off" margins={{ left: 44, right: 12, bottom: 26 }}>
        <XAxis dataKey="label" maxTicks={5} />
        <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
        <Area dataKey="p" variant="dotted" />
        <Tooltip labelKey="label" valueFormatter={(value) => analyticsOdds(value)} />
      </AreaChart>
    </div> : <p className="text-sm text-muted-foreground">Not enough price points to chart this window.</p>}
  </Shell>;
}

function Book({ snapshot, illustrative }: { snapshot: Of<"pm_book">; illustrative: boolean }) {
  const bids = snapshot.bids.slice(0, 8), asks = snapshot.asks.slice(0, 8);
  const max = Math.max(1, ...bids.map((level) => level.size), ...asks.map((level) => level.size));
  const side = (label: string, levels: typeof bids, fill: string) => <div className="min-w-0">
    <h4 className="!m-0 mb-1 flex justify-between text-xs font-medium text-muted-foreground"><span>{label}</span><span>Shares</span></h4>
    {levels.length ? <ul className="!m-0 !list-none !p-0">{levels.map((level) => <li key={level.price} className="relative !m-0 flex justify-between gap-2 overflow-hidden rounded-sm px-1.5 py-1 font-mono text-xs tabular-nums">
      <span className={cn("absolute inset-y-0 left-0", fill)} style={{ width: `${Math.max(2, (level.size / max) * 100)}%` }} aria-hidden="true" />
      <span className="relative">{analyticsCents(level.price)}</span><span className="relative">{analyticsShares(level.size).replace(" shares", "")}</span>
    </li>)}</ul> : <p className="text-xs text-muted-foreground">No {label.toLowerCase()}.</p>}
  </div>;
  return <Shell title={snapshot.title ?? "Order book"} meta={[snapshot.outcome, snapshot.title ? null : `Outcome token ${analyticsAddress(snapshot.subject)}`, "Prices in cents per share"].filter(Boolean).join(" · ")} snapshot={snapshot} illustrative={illustrative}>
    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
      {([["Midpoint", snapshot.midpoint], ["Spread", snapshot.spread], ["Last trade", snapshot.lastTrade]] as const).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-muted px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="!m-0 font-mono tabular-nums">{analyticsCents(value)}</dd></div>)}
    </dl>
    <div className="mt-3 grid grid-cols-2 gap-3">{side("Bids", bids, "bg-primary/25")}{side("Asks", asks, "bg-muted-foreground/15")}</div>
  </Shell>;
}

function Leaderboard({ snapshot, illustrative }: { snapshot: Of<"pm_leaderboard">; illustrative: boolean }) {
  const value = (row: Of<"pm_leaderboard">["rows"][number]) => snapshot.board === "pnl" ? row.pnlUsd : row.volume;
  const bars = snapshot.rows.slice(0, 8).flatMap((row) => { const amount = value(row); return amount === null ? [] : [{ label: row.name, value: amount }]; });
  return <Shell title={snapshot.board === "pnl" ? "Top traders by profit" : "Top traders by volume"} meta={`Polymarket leaderboard · ${snapshot.period}`} snapshot={snapshot} illustrative={illustrative}>
    {snapshot.board === "pnl" && bars.length ? <div className="h-56 w-full min-w-0" aria-hidden="true"><SignedBars rows={bars} /></div> : null}
    {snapshot.rows.length ? <Expandable rows={snapshot.rows} limit={8}>{(row) => <li key={`${row.rank}:${row.wallet}`} className="!m-0 flex min-h-11 items-center justify-between gap-3 py-2">
      <span className="min-w-0"><span className="mr-2 font-mono text-xs text-muted-foreground">#{row.rank}</span><a href={profileUrl(row.wallet)} target="_blank" rel="noreferrer" className="break-all">{row.name}</a></span>
      <span className="shrink-0 text-right font-mono text-sm tabular-nums">{snapshot.board === "pnl" ? <span className={lossClass(row.pnlUsd)}>{signedUsd(row.pnlUsd)}</span> : analyticsShares(row.volume)}<span className="block text-xs text-muted-foreground">{snapshot.board === "pnl" ? analyticsShares(row.volume) : signedUsd(row.pnlUsd)}</span></span>
    </li>}</Expandable> : <p className="text-sm text-muted-foreground">No traders returned.</p>}
  </Shell>;
}

function Wins({ snapshot, illustrative }: { snapshot: Of<"pm_wins">; illustrative: boolean }) {
  return <Shell title="Biggest winning positions" meta={`Resolved positions · ${snapshot.period}`} snapshot={snapshot} illustrative={illustrative}>
    {snapshot.rows.length ? <Expandable rows={snapshot.rows} limit={6}>{(row) => <li key={`${row.rank}:${row.wallet}:${row.title}`} className="!m-0 grid gap-1 py-2">
      <span className="flex items-baseline justify-between gap-3"><span className="min-w-0"><span className="mr-2 font-mono text-xs text-muted-foreground">#{row.rank}</span><a href={profileUrl(row.wallet)} target="_blank" rel="noreferrer" className="break-all">{row.name}</a></span><span className={cn("shrink-0 font-mono text-sm tabular-nums", lossClass(row.pnlUsd))}>{signedUsd(row.pnlUsd)}</span></span>
      <span className="text-xs text-muted-foreground">{row.url ? <a href={row.url} target="_blank" rel="noreferrer">{row.title}</a> : row.title} · cost {analyticsCompactUsd(row.costUsd)}</span>
    </li>}</Expandable> : <p className="text-sm text-muted-foreground">No winning positions returned.</p>}
  </Shell>;
}

function Trader({ snapshot, illustrative }: { snapshot: Of<"pm_trader">; illustrative: boolean }) {
  const data = useMemo(() => { const labels = timeLabels(snapshot.points); return snapshot.points.map((point, index) => ({ label: labels[index], pnl: point.pnlUsd })); }, [snapshot.points]);
  const last = snapshot.points.at(-1);
  return <Shell title={`P&L · ${snapshot.name ?? analyticsAddress(snapshot.subject)}`} meta={`Cumulative Polymarket P&L · ${snapshot.period}`} snapshot={snapshot} illustrative={illustrative}>
    {last ? <p className={cn("mt-3 font-mono text-lg tabular-nums", lossClass(last.pnlUsd))}>{signedUsd(last.pnlUsd)}</p> : null}
    {data.length > 1 ? <div className="h-56 w-full min-w-0" aria-hidden="true">
      <AreaChart data={data} config={pnlConfig} animate={false} bloom="off" margins={{ left: 56, right: 12, bottom: 26 }}>
        <XAxis dataKey="label" maxTicks={5} />
        <YAxis tickFormatter={(value) => compactUsd.format(Number(value))} />
        <ReferenceLine y={0} strokeDasharray="" />
        <Area dataKey="pnl" variant="dotted" />
        <Tooltip labelKey="label" valueFormatter={(value) => analyticsUsd(value)} />
      </AreaChart>
    </div> : <p className="text-sm text-muted-foreground">Not enough P&L points to chart this window.</p>}
    <p className="mt-2 text-sm"><a href={profileUrl(snapshot.subject)} target="_blank" rel="noreferrer" className="underline">View profile on Polymarket</a></p>
  </Shell>;
}

function Positions({ snapshot, illustrative }: { snapshot: Of<"pm_positions">; illustrative: boolean }) {
  return <Shell title="Positions" meta={`${analyticsAddress(snapshot.subject)} · ${snapshot.period === "OPEN" ? "Open and unredeemed" : snapshot.period.toLowerCase()}`} snapshot={snapshot} illustrative={illustrative}>
    {snapshot.rows.length ? <Expandable rows={snapshot.rows} limit={6}>{(row, index) => <li key={`${row.title}:${row.outcome}:${index}`} className="!m-0 grid gap-1 py-2">
      <span className="flex items-baseline justify-between gap-3"><span className="min-w-0 break-words">{row.url ? <a href={row.url} target="_blank" rel="noreferrer">{row.title}</a> : row.title}</span><span className="shrink-0 font-mono text-sm tabular-nums">{analyticsCompactUsd(row.valueUsd)}</span></span>
      <span className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{row.outcome} · {analyticsShares(row.size)} · avg {analyticsCents(row.avgPrice)} → {analyticsCents(row.currentPrice)}</span><span className={cn("shrink-0 font-mono tabular-nums", lossClass(row.pnlUsd))}>{signedUsd(row.pnlUsd)}</span></span>
    </li>}</Expandable> : <p className="text-sm text-muted-foreground">No positions returned.</p>}
  </Shell>;
}

export function PolymarketCard({ snapshot, illustrative = false }: { snapshot: PolymarketSnapshot; illustrative?: boolean }) {
  switch (snapshot.kind) {
    case "pm_odds": return <Odds snapshot={snapshot} illustrative={illustrative} />;
    case "pm_markets": return <Markets snapshot={snapshot} illustrative={illustrative} />;
    case "pm_history": return <History snapshot={snapshot} illustrative={illustrative} />;
    case "pm_book": return <Book snapshot={snapshot} illustrative={illustrative} />;
    case "pm_leaderboard": return <Leaderboard snapshot={snapshot} illustrative={illustrative} />;
    case "pm_wins": return <Wins snapshot={snapshot} illustrative={illustrative} />;
    case "pm_trader": return <Trader snapshot={snapshot} illustrative={illustrative} />;
    case "pm_positions": return <Positions snapshot={snapshot} illustrative={illustrative} />;
  }
}
