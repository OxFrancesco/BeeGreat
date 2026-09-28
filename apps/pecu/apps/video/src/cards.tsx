import { ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, formatAmount, frames, linear, mix, rise, tween } from "./motion";

/** Every figure below is a fictional fixture, like the /design specimens. */

function Card({ height, children, style }: { height: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="card" style={{ height, display: "flex", flexDirection: "column", ...style }}>
      {children}
    </div>
  );
}

const balances = [
  { symbol: "ETH", name: "Ether", value: 0.42, digits: 4 },
  { symbol: "USDC", name: "USD Coin", value: 1204.5, digits: 2 },
  { symbol: "AERO", name: "Aerodrome", value: 88, digits: 2 },
];

export function BalanceCard({ at, height }: { at: number; height: number }) {
  const frame = useCurrentFrame();
  return (
    <Card height={height} style={{ gap: 8 }}>
      <div className="card-head" style={{ alignItems: "center" }}>
        <span className="card-title">Base wallet</span>
        <span className="address">
          0x7a3f…91c2
          <Copy size={13} strokeWidth={2.2} />
        </span>
      </div>
      {balances.map((token, i) => {
        const start = at + 0.12 + i * 0.08;
        return (
          <div className="balance-row" key={token.symbol} style={{ ...rise(tween(frame, start, 0.5), 10), height: 42 }}>
            <span className="coin">{token.symbol.slice(0, 1)}</span>
            <span className="balance-name">
              <strong>{token.symbol}</strong>
              <span>{token.name}</span>
            </span>
            <span className="mono balance-amount">
              {formatAmount(token.value * tween(frame, start + 0.05, 0.8), token.digits)}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

/** Route geometry inside the recessed panel: ETH → Aerodrome pool → USDC. */
const ROUTE = { width: 349, height: 60 };
const nodes = [
  { key: "eth", x: 40, label: "ETH", layer: 0 },
  { key: "pool", x: 175, label: "WETH/USDC", detail: "Aerodrome CL100", layer: 1 },
  { key: "usdc", x: 312, label: "USDC", layer: 2 },
];
const edges = [
  { key: "in", from: 67, to: 121, layer: 0, chip: true },
  { key: "out", to: 283, from: 229, layer: 1, chip: false },
];

export function SwapCard({ at, confirm, height }: { at: number; confirm: number; height: number }) {
  const frame = useCurrentFrame();
  const route = at + 0.3;
  const sending = confirm + 0.1;
  const confirmed = confirm + 0.5;
  const done = tween(frame, confirmed, 0.3);
  const widen = tween(frame, confirmed, 0.4, easeInOut);
  const pressed = frame >= frames(confirm) && frame < frames(confirm + 0.1);
  const label = (from: number, to: number) =>
    tween(frame, from, 0.12, linear) * (1 - tween(frame, to, 0.12, linear));

  return (
    <Card height={height} style={{ gap: 12 }}>
      <div className="card-head">
        <span className="card-title">Swap</span>
        <span className="card-meta">Base</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <span className="amount-label">You pay</span>
          <strong className="mono amount">0.01 ETH</strong>
        </div>
        <ArrowRight size={18} className="muted" style={{ marginBottom: 9 }} />
        <div style={{ display: "grid", gap: 4 }}>
          <span className="amount-label">You receive about</span>
          <strong className="mono amount">{formatAmount(24.61 * tween(frame, at + 0.15, 0.7), 2)} USDC</strong>
        </div>
      </div>

      <dl className="panel row" style={{ margin: 0, padding: "9px 12px" }}>
        <dt>Minimum received</dt>
        <dd className="mono">24.36 USDC</dd>
      </dl>

      <div className="recessed" style={{ padding: 8 }}>
        <div className="route" style={{ height: ROUTE.height }}>
          <svg viewBox={`0 0 ${ROUTE.width} ${ROUTE.height}`} aria-hidden="true">
            {edges.map((edge) => {
              const d = `M ${edge.from} 30 L ${edge.to} 30`;
              const draw = tween(frame, route + edge.layer * 0.14 + 0.12, 0.42, easeInOut);
              const cycle = ((frame - frames(route + 0.9 + edge.layer * 0.56)) / frames(1.8)) % 1;
              const comet = frame < frames(route + 0.9 + edge.layer * 0.56) ? -1 : cycle;
              const cometOpacity = comet < 0 ? 0 : comet < 0.06 ? comet / 0.06 : comet < 0.58 ? 1 : comet < 0.66 ? (0.66 - comet) / 0.08 : 0;
              return (
                <g key={edge.key}>
                  <path d={d} pathLength={100} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - draw * 100} />
                  <path d={d} pathLength={100} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" opacity={done} />
                  <path
                    d={d}
                    pathLength={100}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="26 74"
                    strokeDashoffset={26 - Math.max(0, comet) * 100 / 0.66}
                    opacity={cometOpacity * (1 - done)}
                  />
                </g>
              );
            })}
          </svg>
          {edges
            .filter((edge) => edge.chip)
            .map((edge) => (
              <span
                className="chip"
                key={edge.key}
                style={{
                  left: (edge.from + edge.to) / 2 - 11,
                  top: 19,
                  opacity: tween(frame, route + edge.layer * 0.14 + 0.38, 0.2),
                }}
              >
                <span>1</span>
              </span>
            ))}
          {nodes.map((node) => {
            const t = tween(frame, route + node.layer * 0.14, 0.24);
            return (
              <span
                className={`node${node.detail ? " is-pool" : ""}`}
                key={node.key}
                style={{
                  left: node.x,
                  top: 30,
                  opacity: t,
                  transform: `translate(-50%, -50%) scale(${mix(0.94, 1, t)})`,
                }}
              >
                <strong>{node.label}</strong>
                {node.detail ? <small>{node.detail}</small> : null}
              </span>
            );
          })}
        </div>
      </div>

      <div className="actions">
        <div
          className="button primary"
          style={{
            left: 0,
            width: mix(228, 365, widen),
            transform: pressed ? "translateY(1px)" : undefined,
          }}
        >
          <span style={{ position: "absolute", opacity: 1 - tween(frame, sending, 0.12, linear) }}>Confirm swap</span>
          <span style={{ position: "absolute", display: "flex", alignItems: "center", gap: 8, opacity: label(sending, confirmed) }}>
            <LoaderCircle size={16} style={{ transform: `rotate(${frame * 9}deg)` }} />
            Sending
          </span>
          <span style={{ position: "absolute", display: "flex", alignItems: "center", gap: 8, opacity: tween(frame, confirmed, 0.12, linear) }}>
            <Check size={16} strokeWidth={2.6} />
            Confirmed on Base
          </span>
        </div>
        <div className="button" style={{ left: 238, width: 127, opacity: 1 - tween(frame, confirm + 0.05, 0.2) }}>
          Cancel
        </div>
      </div>
    </Card>
  );
}

const basket = [
  { symbol: "NVDAc", name: "NVIDIA", weight: 50, color: "var(--chart-3)" },
  { symbol: "AAPLc", name: "Apple", weight: 30, color: "var(--chart-2)" },
  { symbol: "TSLAc", name: "Tesla", weight: 20, color: "var(--chart-1)" },
];

export function BasketCard({ at, height }: { at: number; height: number }) {
  const frame = useCurrentFrame();
  return (
    <Card height={height} style={{ gap: 10 }}>
      <div className="card-head">
        <span className="card-title">Stock basket</span>
        <span className="card-meta">3 trades on Aerodrome</span>
      </div>
      <div>
        {basket.map((stock, i) => {
          const grow = tween(frame, at + 0.25 + i * 0.08, 0.64);
          return (
            <div className="basket-row" key={stock.symbol} style={rise(tween(frame, at + 0.1 + i * 0.08, 0.4), 8)}>
              <span className="symbol">
                <strong>{stock.symbol}</strong>
                <span>{stock.name}</span>
              </span>
              <span className="track">
                <span
                  className="fill"
                  style={{ display: "block", width: `${stock.weight}%`, background: stock.color, transform: `scaleX(${mix(0.12, 1, grow)})` }}
                />
              </span>
              <b>{Math.round(stock.weight * grow)}%</b>
              <b>{Math.round(stock.weight * grow)} USDC</b>
            </div>
          );
        })}
      </div>
      <div
        className="row"
        style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center", ...rise(tween(frame, at + 0.5, 0.5), 6) }}
      >
        <span className="muted">You pay</span>
        <strong className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.04em" }}>
          100 USDC
        </strong>
      </div>
    </Card>
  );
}

const flows = [
  { group: "Smart traders", value: 412 },
  { group: "Whales", value: 268 },
  { group: "Fresh wallets", value: 91 },
  { group: "Exchanges", value: -530 },
];
const FLOW_MAX = 412;
const FLOW_MIN = -530;

export function FlowsCard({ at, height }: { at: number; height: number }) {
  const frame = useCurrentFrame();
  const axis = (-FLOW_MIN / (FLOW_MAX - FLOW_MIN)) * 100;
  return (
    <Card height={height} style={{ gap: 12 }}>
      <div className="card-head">
        <span className="card-title">AERO token flows</span>
        <span className="card-meta">Base · 24 hours</span>
      </div>
      <div>
        {flows.map((flow, i) => {
          const grow = tween(frame, at + 0.25 + i * 0.08, 0.64);
          const share = (Math.abs(flow.value) / (FLOW_MAX - FLOW_MIN)) * 100;
          const gain = flow.value > 0;
          const shown = Math.round(Math.abs(flow.value) * grow);
          return (
            <div className="flow-row" key={flow.group} style={rise(tween(frame, at + 0.1 + i * 0.08, 0.4), 8)}>
              <span>{flow.group}</span>
              <span className="flow-track">
                <span className="flow-axis" style={{ left: `${axis}%` }} />
                <span
                  className="flow-bar"
                  style={{
                    left: gain ? `${axis}%` : `${axis - share}%`,
                    width: `${share}%`,
                    background: gain ? "var(--primary)" : "color-mix(in oklch, var(--destructive) 78%, var(--foreground))",
                    transformOrigin: gain ? "0 50%" : "100% 50%",
                    transform: `scaleX(${grow})`,
                  }}
                />
              </span>
              <b className={`mono ${gain ? "gain" : "loss"}`} style={{ textAlign: "right", fontWeight: 600 }}>
                {gain ? "+" : "−"}${shown}K
              </b>
            </div>
          );
        })}
      </div>
      <span className="card-meta" style={{ marginTop: "auto", fontSize: 12, ...rise(tween(frame, at + 0.6, 0.4), 4) }}>
        Data: Nansen (nansen.ai)
      </span>
    </Card>
  );
}

export function OddsCard({ at, height }: { at: number; height: number }) {
  const frame = useCurrentFrame();
  const fill = tween(frame, at + 0.2, 0.7);
  const yes = Math.round(62 * fill);
  return (
    <Card height={height} style={{ gap: 10, padding: "16px 20px" }}>
      <div className="card-head">
        <span style={{ fontSize: 14.5, fontWeight: 650 }}>Fed cuts rates in December?</span>
        <span className="card-meta" style={{ fontSize: 12 }}>
          Polymarket
        </span>
      </div>
      <div className="odds-bar" style={{ position: "relative" }}>
        <span className="odds-yes" style={{ width: `${mix(8, 62, fill)}%` }} />
        <span className="mono" style={{ position: "absolute", left: 10, top: 5, fontSize: 12, fontWeight: 700, color: "var(--primary-foreground)" }}>
          Yes {yes}%
        </span>
        <span className="mono muted" style={{ position: "absolute", right: 10, top: 5, fontSize: 12, fontWeight: 700 }}>
          No {100 - yes}%
        </span>
      </div>
    </Card>
  );
}
