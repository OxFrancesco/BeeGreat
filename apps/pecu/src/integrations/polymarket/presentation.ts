import { z } from "zod";
import { isJsonObject, jsonValueSchema, type JsonInput } from "../../json-contract";
import type { PolymarketRead } from "./client";

const object = (value: JsonInput) => isJsonObject(value) ? value : null;
const text = z.string().catch("").parse;
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const visible = new Set([
  "outcome", "status", "side", "price", "mid", "mid_price", "spread", "size", "amount", "value", "volume", "volume24hr", "liquidity", "current_size", "current_value", "avg_price", "current_price", "realized_pnl", "unrealized_pnl", "total_pnl", "pnl", "volume_usdc", "entry_cost_usdc", "trade_count", "trades", "biggest_win", "rank", "rank_pnl", "rank_volume", "taker_volume_total", "taker_volume", "active_users", "endDate", "end_date", "timestamp", "computed_at", "age_seconds", "lag_seconds", "resolution_seconds", "base_fee", "minimum_tick_size", "neg_risk", "redeemable", "mergeable", "resolution_source", "resolved_at", "sport", "league", "label", "t", "p", "bids", "asks", "allowed", "approved", "allowance", "symbol", "decimals"
]);
const label = (key: string) => key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
function valueText(value: JsonInput): string {
  if (value === null) return "unavailable";
  const number = z.number().safeParse(value);
  return number.success ? number.data.toLocaleString("en-US", { maximumFractionDigits: 6 }) : String(value);
}

function rowText(value: JsonInput): string {
  const row = object(value);
  if (!row) return valueText(value);
  const title = [row.question, row.title, row.name, row.user_name, row.builder].map(value => text(value)).find(Boolean);
  const fields = Object.entries(row).filter(([key, item]) => visible.has(key) && item !== title && scalar.safeParse(item).success).slice(0, 7);
  const parts = fields.map(([key, item]) => `${label(key)}: ${valueText(item)}`);
  const eventSlug = text(row.event_slug);
  const slug = text(row.slug);
  if (eventSlug) parts.push(`https://polymarket.com/event/${encodeURIComponent(eventSlug)}`);
  else if (slug && row.title && !row.question) parts.push(`https://polymarket.com/event/${encodeURIComponent(slug)}`);
  const outcomesText = z.string().safeParse(row.outcomes);
  const pricesText = z.string().safeParse(row.outcomePrices);
  if (outcomesText.success && pricesText.success) {
    try {
      const outcomes = z.array(jsonValueSchema).safeParse(JSON.parse(outcomesText.data));
      const prices = z.array(jsonValueSchema).safeParse(JSON.parse(pricesText.data));
      if (outcomes.success && prices.success) {
        outcomes.data.forEach((outcome, index) => {
          const raw = prices.data[index];
          const numeric = z.union([z.number(), z.string().trim().min(1)]).safeParse(raw);
          const price = numeric.success ? Number(numeric.data) : NaN;
          const name = z.string().safeParse(outcome);
          if (name.success && Number.isFinite(price) && price >= 0 && price <= 1) parts.push(`${name.data}: ${(price * 100).toFixed(1)}% market-implied odds`);
        });
      }
    } catch { parts.push("Outcome prices unavailable"); }
  }
  return [title, ...parts].filter(Boolean).join(" | ");
}

export function polymarketText(result: PolymarketRead): string {
  const root = object(result.data);
  const payload = root && "data" in root ? root.data : result.data;
  const record = object(payload);
  const rootRows = Array.isArray(payload) ? payload : record
    ? [record.events, record.markets, record.points].find(Array.isArray)
    : undefined;
  let lines: string[];
  if (payload === null) lines = ["No matching Polymarket record."];
  else if (rootRows) lines = rootRows.length ? rootRows.slice(0, 10).flatMap(row => {
    const markets = object(row)?.markets;
    return [rowText(row), ...(Array.isArray(markets) ? markets.slice(0, 3).map(rowText) : [])];
  }) : ["No matching Polymarket results."];
  else if (record) {
    lines = [rowText(record)];
    for (const [key, item] of Object.entries(record)) {
      if (Array.isArray(item)) lines.push(`${label(key)}:`, ...item.slice(0, 5).map(rowText));
      else if (object(item)) lines.push(`${label(key)}: ${rowText(item)}`);
    }
  } else lines = [valueText(payload)];
  if (rootRows && rootRows.length > 10) lines.push("Showing the first 10 results; b/verbose contains this page's full data.");
  if (result.next) lines.push("More results are available. Ask for the next page.");
  lines.push(`Data: Polymarket. Retrieved ${result.observedAt}.`);
  return lines.filter(Boolean).join("\n");
}
