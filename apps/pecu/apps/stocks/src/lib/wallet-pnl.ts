import { useEffect, useState } from "react";
import type { PnlSnapshot } from "../../../../src/analytics-contract";
import { webPnlSchema, type PnlDays, type WebPnl } from "../../../../src/web-contract";
import { request } from "./use-account";

export const pnlPeriods: readonly { days: PnlDays; short: string; long: string; last: string }[] = [
  { days: 7, short: "7D", long: "7 days", last: "7 days" },
  { days: 30, short: "30D", long: "30 days", last: "30 days" },
  { days: 90, short: "90D", long: "90 days", last: "90 days" },
  { days: 365, short: "1Y", long: "1 year", last: "year" },
];
export const pnlPeriod = (days: PnlDays) => pnlPeriods.find((period) => period.days === days)!;

const signed = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" });
export const signedUsd = (value: number | null) => (value === null ? "Unavailable" : signed.format(value));
export const lossClass = (value: number | null) => (value !== null && value <= -0.005 ? "pecu-pnl-loss" : undefined);

export type PnlRow = {
  key: string;
  symbol: string;
  address: string;
  realized: number | null;
  unrealized: number | null;
  total: number | null;
};
export type PnlSummary = {
  realized: number;
  unrealized: number;
  total: number;
  missing: number;
  rows: PnlRow[];
};

const magnitude = (row: PnlRow) => Math.abs(row.total ?? row.realized ?? row.unrealized ?? 0);

export function pnlSummary(snapshot: PnlSnapshot): PnlSummary {
  let realized = 0;
  let unrealized = 0;
  let missing = 0;
  const rows = snapshot.rows.map((row, index) => {
    if (row.realizedUsd === null || row.unrealizedUsd === null) missing++;
    realized += row.realizedUsd ?? 0;
    unrealized += row.unrealizedUsd ?? 0;
    return {
      key: `${row.address}:${index}`,
      symbol: row.symbol,
      address: row.address,
      realized: row.realizedUsd,
      unrealized: row.unrealizedUsd,
      total: row.realizedUsd === null || row.unrealizedUsd === null ? null : row.realizedUsd + row.unrealizedUsd,
    };
  });
  rows.sort((a, b) => magnitude(b) - magnitude(a));
  return { realized, unrealized, total: realized + unrealized, missing, rows };
}

export function retrievedAgo(observedAt: number, now = Date.now()) {
  const minutes = Math.floor((now - observedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(observedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const fresh = 60_000;
const results = new Map<string, { at: number; value: WebPnl }>();
const reads = new Map<string, Promise<WebPnl>>();

export function loadPnl(wallet: string, days: PnlDays): Promise<WebPnl> {
  const key = `${wallet.toLowerCase()}:${days}`;
  const hit = results.get(key);
  if (hit && Date.now() - hit.at < fresh) return Promise.resolve(hit.value);
  let read = reads.get(key);
  if (!read) {
    read = request(`pnl?days=${days}`)
      .then((raw) => {
        const value = webPnlSchema.parse(raw);
        results.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => reads.delete(key));
    reads.set(key, read);
  }
  return read;
}

export function useWalletPnl(wallet: string, days: PnlDays, active: boolean) {
  const key = `${wallet.toLowerCase()}:${days}`;
  const [state, setState] = useState<{ key: string; value?: WebPnl; error?: string }>({ key });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    setState((current) => (current.key === key ? { key, value: current.value } : { key, value: results.get(key)?.value }));
    loadPnl(wallet, days).then(
      (value) => live && setState({ key, value }),
      (error: unknown) =>
        live && setState({ key, value: results.get(key)?.value, error: error instanceof Error ? error.message : "Could not load your P&L. Try again." }),
    );
    return () => {
      live = false;
    };
  }, [key, wallet, days, active, attempt]);
  const current = state.key === key ? state : { key, value: results.get(key)?.value };
  return {
    value: current.value,
    error: current.error,
    retry: () => setAttempt((count) => count + 1),
  };
}
