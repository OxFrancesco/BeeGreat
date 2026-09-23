import type { PolymarketRead } from "./client";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const visible = new Set([
  "outcome", "status", "side", "price", "mid", "mid_price", "spread", "size", "amount", "value", "volume", "volume24hr", "liquidity", "current_size", "current_value", "avg_price", "current_price", "realized_pnl", "unrealized_pnl", "total_pnl", "pnl", "volume_usdc", "entry_cost_usdc", "trade_count", "trades", "biggest_win", "rank", "rank_pnl", "rank_volume", "taker_volume_total", "taker_volume", "active_users", "endDate", "end_date", "timestamp", "computed_at", "age_seconds", "lag_seconds", "resolution_seconds", "base_fee", "minimum_tick_size", "neg_risk", "redeemable", "mergeable", "resolution_source", "resolved_at", "sport", "league", "label", "t", "p", "bids", "asks", "allowed", "approved", "allowance", "symbol", "decimals"
]);
const label = (key: string) => key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
const valueText = (value: unknown) => value === null ? "unavailable" : typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : String(value);

function rowText(value: unknown): string {
  if (!object(value)) return valueText(value);
  const title = [value.question, value.title, value.name, value.user_name, value.builder].find(item => typeof item === "string" && item.length > 0);
  const fields = Object.entries(value).filter(([key, item]) => visible.has(key) && item !== title && (item === null || ["string", "number", "boolean"].includes(typeof item))).slice(0, 7);
  const parts = fields.map(([key, item]) => `${label(key)}: ${valueText(item)}`);
  if (typeof value.event_slug === "string" && value.event_slug) parts.push(`https://polymarket.com/event/${encodeURIComponent(value.event_slug)}`);
  else if (typeof value.slug === "string" && value.title && !value.question) parts.push(`https://polymarket.com/event/${encodeURIComponent(value.slug)}`);
  if (typeof value.outcomes === "string" && typeof value.outcomePrices === "string") {
    try {
      const outcomes: unknown = JSON.parse(value.outcomes), prices: unknown = JSON.parse(value.outcomePrices);
      if (Array.isArray(outcomes) && Array.isArray(prices)) {
        outcomes.forEach((outcome, index) => {
          const raw = prices[index];
          const price = typeof raw === "number" || typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
          if (typeof outcome === "string" && Number.isFinite(price) && price >= 0 && price <= 1) parts.push(`${outcome}: ${(price * 100).toFixed(1)}% market-implied odds`);
        });
      }
    } catch { parts.push("Outcome prices unavailable"); }
  }
  return [title, ...parts].filter(Boolean).join(" | ");
}

export function polymarketText(result: PolymarketRead): string {
  const payload = object(result.data) && "data" in result.data ? result.data.data : result.data;
  const rootRows = Array.isArray(payload) ? payload : object(payload)
    ? [payload.events, payload.markets, payload.points].find(Array.isArray)
    : undefined;
  let lines: string[];
  if (payload === null) lines = ["No matching Polymarket record."];
  else if (rootRows) lines = rootRows.length ? rootRows.slice(0, 10).flatMap(row => [rowText(row), ...(object(row) && Array.isArray(row.markets) ? row.markets.slice(0, 3).map(rowText) : [])]) : ["No matching Polymarket results."];
  else if (object(payload)) {
    lines = [rowText(payload)];
    for (const [key, item] of Object.entries(payload)) {
      if (Array.isArray(item)) lines.push(`${label(key)}:`, ...item.slice(0, 5).map(rowText));
      else if (object(item)) lines.push(`${label(key)}: ${rowText(item)}`);
    }
  } else lines = [valueText(payload)];
  if (rootRows && rootRows.length > 10) lines.push("Showing the first 10 results; b/verbose contains this page's full data.");
  if (result.next) lines.push("More results are available. Ask for the next page.");
  lines.push(`Data: Polymarket. Retrieved ${result.observedAt}.`);
  return lines.filter(Boolean).join("\n");
}
