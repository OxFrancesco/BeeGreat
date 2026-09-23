import { useMemo, useState } from "react";
import { analyticsAddress, analyticsTotal, analyticsUsd, type AnalyticsSnapshot } from "../../../../src/analytics-contract";
import { Button } from "./ui/button";
import { BarChart } from "./dither-kit/bar-chart";
import { Bar } from "./dither-kit/bar";
import { PieChart } from "./dither-kit/pie-chart";
import { Pie } from "./dither-kit/pie";
import { Tooltip } from "./dither-kit/tooltip";
import { XAxis } from "./dither-kit/x-axis";
import { YAxis } from "./dither-kit/y-axis";
import { ReferenceLine } from "./dither-kit/reference-line";
import type { ChartConfig } from "./dither-kit/chart-context";
import type { DitherColor } from "./dither-kit/palette";

type ChartRow = { key: string; label: string; detail: string; value: number | null };
const colors: DitherColor[] = ["orange", "blue", "green", "purple", "pink", "grey"];
const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const barConfig = { value: { label: "USD", color: "orange" } } satisfies ChartConfig;

export function SignedBars({ rows, selectedIndex }: { rows: { label: string; value: number }[]; selectedIndex?: number }) {
  return <BarChart data={rows} config={barConfig} animate={false} bloom="off" margins={{ left: 60, right: 20, bottom: 30 }} markerIndex={selectedIndex}>
    <XAxis dataKey="label" maxTicks={4} tickFormatter={(value) => String(value).split(" ")[0]?.slice(0, 9) ?? ""} />
    <YAxis tickFormatter={(value) => compact.format(value)} />
    <ReferenceLine y={0} strokeDasharray="" />
    <Bar dataKey="value" variant="dotted" />
    <Tooltip labelKey="label" valueFormatter={analyticsUsd} />
  </BarChart>;
}

function ValueChart({ rows, allocation = false }: { rows: ChartRow[]; allocation?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const chart = useMemo(() => rows.filter((row): row is ChartRow & { value: number } => row.value !== null && row.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8), [rows]);
  const pie = useMemo(() => {
    const positive = rows.filter((row): row is ChartRow & { value: number } => row.value !== null && row.value > 0).sort((a, b) => b.value - a.value);
    const shown = positive.slice(0, 5);
    const other = analyticsTotal(positive.slice(5).map((row) => row.value));
    return [...shown, ...(other !== null && other > 0 ? [{ key: "other", label: "Other assets", detail: "", value: other }] : [])];
  }, [rows]);
  const config = useMemo<ChartConfig>(() => Object.fromEntries(pie.map((row, index) => [row.key, { label: row.label, color: colors[index] ?? "grey" }])), [pie]);
  const active = rows.find((row) => row.key === selected);
  const selectedIndex = chart.findIndex((row) => row.key === selected);
  const shownRows = expanded ? rows : rows.slice(0, 8);
  const total = analyticsTotal(rows.filter((row) => row.value !== null && row.value > 0).map((row) => row.value));
  const validPie = allocation && total !== null && total > 0 && !rows.some((row) => row.value !== null && row.value < 0);
  return <>
    {chart.length ? <div className="h-56 w-full min-w-0" aria-hidden="true">
      {validPie ? <PieChart data={pie} config={config} dataKey="value" nameKey="key" animate={false} bloom="off">
        <Pie variant="dotted" /><Tooltip valueFormatter={analyticsUsd} />
      </PieChart> : <SignedBars rows={chart} selectedIndex={selectedIndex < 0 ? undefined : selectedIndex} />}
    </div> : null}
    {rows.length ? <ul className="!m-0 !list-none !p-0 divide-y divide-border">
      {shownRows.map((row) => <li key={row.key} className="!m-0 !p-0">
        <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring" aria-pressed={selected === row.key} onClick={() => setSelected(selected === row.key ? null : row.key)}>
          <span className="min-w-0 break-words">{row.label}</span>
          <span className="ml-auto max-w-full break-all text-right font-mono text-sm tabular-nums">{analyticsUsd(row.value)}{validPie && row.value !== null && total !== null ? <span className="block text-muted-foreground">{(row.value / total * 100).toFixed(1)}%</span> : null}</span>
        </button>
      </li>)}
    </ul> : <p className="text-sm text-muted-foreground">No data returned for this selection.</p>}
    {rows.length > 8 ? <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : "Show all"}</Button> : null}
    {active ? <p role="status" className="mt-2 break-words text-sm text-muted-foreground">{active.detail}</p> : null}
    {!allocation && chart.length < rows.filter((row) => row.value !== null && row.value !== 0).length ? <p className="text-sm text-muted-foreground">Chart shows the eight largest amounts by magnitude.</p> : null}
  </>;
}

function PnlChart({ snapshot }: { snapshot: Extract<AnalyticsSnapshot, { kind: "pnl" }> }) {
  const [metric, setMetric] = useState<"realizedUsd" | "unrealizedUsd">("realizedUsd");
  const rows = useMemo(() => snapshot.rows.map((row, index) => ({ key: `${row.chain}:${row.address}:${index}`, label: row.symbol, detail: `${row.symbol} · ${row.chain} · ${row.address}`, value: row[metric] })).sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0)), [snapshot.rows, metric]);
  return <>
    <div role="group" aria-label="Profit and loss measure" className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant={metric === "realizedUsd" ? "secondary" : "ghost"} aria-pressed={metric === "realizedUsd"} onClick={() => setMetric("realizedUsd")}>Realized</Button>
      <Button size="sm" variant={metric === "unrealizedUsd" ? "secondary" : "ghost"} aria-pressed={metric === "unrealizedUsd"} onClick={() => setMetric("unrealizedUsd")}>Unrealized</Button>
    </div>
    {rows.length ? <p className="mt-3 font-mono text-lg tabular-nums" aria-live="polite">{snapshot.partial ? "Returned tokens: " : "Total: "}{analyticsUsd(analyticsTotal(rows.map((row) => row.value)))}</p> : null}
    <ValueChart key={metric} rows={rows} />
  </>;
}

function PortfolioChart({ snapshot }: { snapshot: Extract<AnalyticsSnapshot, { kind: "portfolio" }> }) {
  const [view, setView] = useState<"wallet" | "defi">("wallet");
  const rows = useMemo<ChartRow[]>(() => view === "wallet"
    ? (snapshot.balances ?? []).map((row, index) => ({ key: `${row.chain}:${row.address}:${index}`, label: `${row.symbol} · ${row.chain}`, detail: `${row.symbol} · ${row.address}${row.amount === null ? "" : ` · ${row.amount.toLocaleString("en-US", { maximumSignificantDigits: 8 })} tokens`}`, value: row.valueUsd }))
    : (snapshot.defi?.protocols ?? []).map((row, index) => ({ key: `${row.chain}:${row.name}:${index}`, label: `${row.name} · ${row.chain}`, detail: `Assets ${analyticsUsd(row.assetsUsd)} · Debt ${analyticsUsd(row.debtUsd)} · Net ${analyticsUsd(row.netUsd)}`, value: row.assetsUsd })), [snapshot, view]);
  return <>
    <div role="group" aria-label="Portfolio exposure" className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant={view === "wallet" ? "secondary" : "ghost"} aria-pressed={view === "wallet"} onClick={() => setView("wallet")}>Wallet tokens</Button>
      <Button size="sm" variant={view === "defi" ? "secondary" : "ghost"} aria-pressed={view === "defi"} onClick={() => setView("defi")}>DeFi positions</Button>
    </div>
    {(view === "wallet" && snapshot.balances === null) || (view === "defi" && snapshot.defi === null) ? <p role="status" className="text-sm">{view === "wallet" ? "Wallet balances" : "DeFi positions"} are unavailable. Ask Pecu to check again.</p> : <>
      <p className="mt-3 font-mono text-lg tabular-nums">{view === "wallet" ? "Returned wallet value: " : "DeFi assets: "}{analyticsUsd(view === "wallet" ? analyticsTotal(rows.map((row) => row.value)) : snapshot.defi?.assetsUsd ?? null)}</p>
      <ValueChart key={view} rows={rows} allocation />
      {view === "defi" && snapshot.defi ? <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>Debt</dt><dd className="text-right font-mono">{analyticsUsd(snapshot.defi.debtUsd)}</dd><dt>Net value</dt><dd className="text-right font-mono">{analyticsUsd(snapshot.defi.netUsd)}</dd><dt>Rewards</dt><dd className="text-right font-mono">{analyticsUsd(snapshot.defi.rewardsUsd)}</dd></dl> : null}
    </>}
    <p className="text-sm text-muted-foreground">Wallet tokens and DeFi positions stay separate because receipt tokens can overlap. Allocation uses priced assets.</p>
  </>;
}

export function NansenChart({ snapshot, illustrative = false }: { snapshot: AnalyticsSnapshot; illustrative?: boolean }) {
  const title = snapshot.kind === "flows" ? "Token flows" : snapshot.kind === "pnl" ? "Trading P&L" : "Portfolio exposure";
  return <section className="my-4 min-w-0 w-full max-w-xl rounded-xl border border-border bg-card p-4 text-card-foreground" aria-label={title}>
    <h3 className="!m-0 text-base font-semibold">{title}</h3>
    <p className="!mt-1 text-sm text-muted-foreground">{illustrative ? "Illustrative data" : analyticsAddress(snapshot.subject)} · {snapshot.chain === "all" ? "All chains" : snapshot.chain} · {snapshot.period}</p>
    {snapshot.kind === "flows" ? <>
      <ValueChart rows={snapshot.rows.map((row) => ({ key: row.label, label: row.label, value: row.netUsd, detail: `${row.label}: net inflow ${analyticsUsd(row.netUsd)}${row.wallets === null ? " · Wallet count unavailable" : ` · ${row.wallets} wallets`}` }))} />
      <p className="text-sm text-muted-foreground">Positive values mean net inflows to the group. Groups may overlap; transfers are not necessarily trades.</p>
    </> : snapshot.kind === "pnl" ? <PnlChart snapshot={snapshot} /> : <PortfolioChart snapshot={snapshot} />}
    {snapshot.partial ? <p role="status" className="text-sm text-muted-foreground">Partial data. Missing values are not counted as zero; returned rows may not cover the full result.</p> : null}
    <p className="!mb-0 mt-3 text-xs text-muted-foreground"><a href="https://nansen.ai" target="_blank" rel="noreferrer" className="underline">{illustrative ? "Nansen integration" : "Data: Nansen"}</a>{illustrative ? null : <> · Retrieved {new Date(snapshot.observedAt).toLocaleString()}</>}</p>
  </section>;
}
