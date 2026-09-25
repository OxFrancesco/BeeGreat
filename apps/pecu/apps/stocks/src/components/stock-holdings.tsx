import { useMemo, useState } from "react";
import type { StockSnapshot } from "../../../../src/stock-contract";
import { stockHoldings } from "../lib/holdings";
import { quantity, usdc } from "../lib/market";
import { PieChart } from "./dither-kit/pie-chart";
import { Pie } from "./dither-kit/pie";
import { Tooltip } from "./dither-kit/tooltip";
import type { ChartConfig } from "./dither-kit/chart-context";
import type { DitherColor } from "./dither-kit/palette";
import { PALETTE, rgb } from "./dither-kit/palette";

const colors: DitherColor[] = ["orange", "blue", "green", "purple", "pink", "red", "grey"];

export function StockHoldings({ stocks, observedAt, embedded = false }: StockSnapshot & { embedded?: boolean }) {
  const [view, setView] = useState<"list" | "graph">("list");
  const { rows, total, chart, partial } = useMemo(() => stockHoldings(stocks), [stocks]);
  const config = useMemo<ChartConfig>(() => Object.fromEntries(rows.map((row, i) => [row.symbol, { label: row.symbol, color: colors[i % colors.length]! }])), [rows]);
  return (
    <section className={embedded ? "my-4 min-w-0 w-full text-card-foreground" : "my-4 min-w-0 w-full max-w-xl rounded-xl border border-border bg-card p-4 text-card-foreground"} aria-label="Your stock holdings">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong>{partial ? "Priced stock holdings" : "Stock holdings"}</strong>
        <span className="font-mono text-xl tabular-nums">{Number.isFinite(total) ? usdc(total) : "Value unavailable"}</span>
      </div>
      <div className="pecu-pnl-periods" role="group" aria-label="Stock positions view">
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>Graph</button>
      </div>
      {view === "graph" && chart.length ? (
        <div className="h-56 w-full" aria-hidden="true">
          <PieChart data={chart} config={config} dataKey="value" nameKey="symbol" animate={false} bloom="off">
            <Pie variant="dotted" />
            <Tooltip valueFormatter={(value) => usdc(value)} />
          </PieChart>
        </div>
      ) : null}
      {view === "graph" && chart.length > 0 ? <div className="flex flex-wrap gap-3 text-sm">{chart.map((row) => <span key={row.symbol} className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: rgb(PALETTE[config[row.symbol]!.color].fill) }} />{row.symbol} {Number.isFinite(total) && total > 0 ? `${(row.value / total * 100).toFixed(1)}%` : ""}</span>)}</div> : null}
      {view === "graph" && rows.length > 0 && !chart.length ? <p>No priced positions to graph.</p> : null}
      {rows.length ? (
        <ul className={view === "graph" ? "sr-only" : "!m-0 !list-none !p-0 divide-y divide-border"}>
          {rows.map((row) => (
            <li key={row.address} className="!m-0 flex items-center justify-between gap-3 !py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: rgb(PALETTE[config[row.symbol]!.color].fill) }} />
                <div className="min-w-0"><div>{row.symbol}</div><div className="text-sm text-muted-foreground">{quantity(row.balance)} shares</div></div>
              </div>
              <div className="text-right font-mono text-sm tabular-nums">
                <div>{row.value === null ? "Price unavailable" : usdc(row.value)}</div>
                {row.value !== null && total > 0 && Number.isFinite(total) ? <div className="text-muted-foreground">{(row.value / total * 100).toFixed(1)}%</div> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm">{partial ? "Holdings are temporarily unavailable." : "You don't own any stock tokens yet."}</p>}
      {partial && rows.length ? <p className="text-sm text-muted-foreground">Some balances or prices are unavailable. The chart includes only priced holdings.</p> : null}
      <p className="!mb-0 text-xs text-muted-foreground">{chart.length ? "Allocation by estimated USDC value. " : ""}Checked {new Date(observedAt).toLocaleString()}.</p>
    </section>
  );
}
