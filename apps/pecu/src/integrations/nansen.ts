import { z } from "zod";
import { log } from "../logger";

export const nansenChains = [
  "arbitrum", "avalanche", "base", "bitcoin", "bnb", "ethereum", "hyperevm", "hyperliquid",
  "injective", "iotaevm", "linea", "mantle", "mantra", "monad", "near", "optimism", "plasma",
  "polygon", "robinhood", "sei", "solana", "sonic", "starknet", "sui", "ton", "tron",
] as const;

const chain = z.enum(nansenChains).default("base");
const walletChain = z.enum(["all", ...nansenChains]).default("base");
const pnlChain = z.enum(["all", "arbitrum", "avalanche", "base", "bnb", "ethereum", "linea", "mantle", "monad", "optimism", "plasma", "polygon", "robinhood", "sei", "solana", "sonic", "sui"]).default("base");
const address = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const days = z.number().int().min(1).max(365);
const limit = z.number().int().min(1).max(25).default(10);
const marketId = z.string().min(1).max(128);
const tgmTimeframe = z.enum(["5m", "1h", "6h", "12h", "1d", "7d"]).default("1d");

const range = (count: number) => ({
  from: new Date(Date.now() - count * 86_400_000).toISOString(),
  to: new Date(Date.now()).toISOString(),
});

const attribution = "Data: Nansen (nansen.ai)";
const empty = `No results from Nansen for that query.\n${attribution}`;

const usd = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const num = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
};

const short = (value: unknown): string => {
  const s = String(value ?? "");
  if (/^0x[0-9a-fA-F]{20,}$/.test(s)) return `${s.slice(0, 6)}…${s.slice(-4)}`;
  return s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-6)}` : s;
};

const timestamp = (value: unknown): string => {
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : String(value ?? "-");
};

const day = (value: unknown): string => {
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : String(value ?? "-");
};

const rows = (body: unknown): Record<string, unknown>[] => {
  const source = typeof body === "object" && body !== null ? Reflect.get(body, "data") : undefined;
  const list = Array.isArray(source) ? source : [];
  return list.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
};

const field = (row: Record<string, unknown>, ...names: string[]): unknown => {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const list = (body: unknown, line: (row: Record<string, unknown>) => string): string => {
  const items = rows(body);
  if (items.length === 0) return empty;
  return `${items.map(line).join("\n")}\n${attribution}`;
};

const flowCohorts: ReadonlyArray<readonly [string, string]> = [
  ["whale", "Whales"],
  ["smart_trader", "Smart traders"],
  ["top_pnl", "Top PnL"],
  ["public_figure", "Public figures"],
  ["exchange", "Exchanges"],
  ["fresh_wallets", "Fresh wallets"],
];

const summarizeFlowIntelligence = (body: unknown): string => {
  const row = rows(body)[0];
  if (!row) return empty;
  const lines = flowCohorts
    .map(([key, name]) => {
      const net = Number(field(row, `${key}_net_flow_usd`));
      const wallets = field(row, `${key}_wallet_count`);
      if (!Number.isFinite(net)) return undefined;
      return `${name}: net ${usd(net)} across ${num(wallets)} wallets`;
    })
    .filter((line): line is string => line !== undefined);
  if (lines.length === 0) return empty;
  return `${["Token flow intelligence", ...lines].join("\n")}\n${attribution}`;
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};

const summarizeTokenInfo = (body: unknown): string => {
  const data = record(record(body).data);
  if (Object.keys(data).length === 0) return empty;
  const details = record(data.token_details);
  const spot = record(data.spot_metrics);
  const name = field(data, "name");
  const symbol = field(data, "symbol");
  const title = name !== undefined
    ? (symbol !== undefined ? `${name} (${symbol})` : String(name))
    : symbol !== undefined ? String(symbol) : "Token";
  const lines: string[] = [];
  const push = (label: string, value: unknown, format: (v: unknown) => string) => {
    if (value !== undefined) lines.push(`${label}: ${format(value)}`);
  };
  push("Market cap", field(details, "market_cap_usd"), usd);
  push("FDV", field(details, "fdv_usd"), usd);
  push("Circulating supply", field(details, "circulating_supply"), num);
  push("Total supply", field(details, "total_supply"), num);
  push("Liquidity", field(spot, "liquidity_usd"), usd);
  const volume = field(spot, "volume_total_usd");
  if (volume !== undefined) {
    const buy = field(spot, "buy_volume_usd");
    const sell = field(spot, "sell_volume_usd");
    lines.push(`Volume: ${usd(volume)}${buy !== undefined && sell !== undefined ? ` (buy ${usd(buy)} / sell ${usd(sell)})` : ""}`);
  }
  const buys = field(spot, "total_buys");
  const sells = field(spot, "total_sells");
  if (buys !== undefined && sells !== undefined) lines.push(`Trades: ${num(buys)} buys / ${num(sells)} sells`);
  const buyers = field(spot, "unique_buyers");
  const sellers = field(spot, "unique_sellers");
  if (buyers !== undefined && sellers !== undefined) lines.push(`Unique traders: ${num(buyers)} buyers / ${num(sellers)} sellers`);
  push("Holders", field(spot, "total_holders"), num);
  push("Deployed", field(details, "token_deployment_date"), day);
  push("Website", field(details, "website"), String);
  push("X", field(details, "x"), String);
  return `${[title, ...lines].join("\n")}\n${attribution}`;
};

const summarizeWalletPnl = (body: unknown): string => {
  if (typeof body !== "object" || body === null) return empty;
  const row = body as Record<string, unknown>;
  if (field(row, "realized_pnl_usd") === undefined && field(row, "traded_token_count") === undefined) return empty;
  const pnl = usd(field(row, "realized_pnl_usd"));
  const pct = Number(field(row, "realized_pnl_percent"));
  const winRate = Number(field(row, "win_rate"));
  const lines = [
    `Realized PnL: ${pnl}${Number.isFinite(pct) ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`,
    `Win rate: ${Number.isFinite(winRate) ? (winRate >= 0 && winRate <= 1 ? `${(winRate * 100).toFixed(0)}%` : num(winRate)) : "-"}`,
    `Traded ${num(field(row, "traded_token_count"))} tokens in ${num(field(row, "traded_times"))} trades`,
  ];
  const top = Array.isArray(row.top5_tokens) ? row.top5_tokens : [];
  for (const entry of top) {
    if (typeof entry !== "object" || entry === null) continue;
    const t = entry as Record<string, unknown>;
    lines.push(`${String(field(t, "token_symbol") ?? short(field(t, "token_address")))}: ${usd(field(t, "realized_pnl"))} (${num(field(t, "realized_roi"))}% ROI)`);
  }
  return `${lines.join("\n")}\n${attribution}`;
};

const summarizeCandles = (body: unknown): string => {
  const items = rows(body).slice(-10).toReversed();
  if (items.length === 0) return empty;
  return `${items.map((row) => `${day(field(row, "interval_start", "period_start", "date"))}  O ${num(field(row, "open"))}  H ${num(field(row, "high"))}  L ${num(field(row, "low"))}  C ${num(field(row, "close"))}  vol ${usd(field(row, "volume_usd", "volume"))}`).join("\n")}\n${attribution}`;
};

type NansenContext = Readonly<{ wallet: `0x${string}` }>;

type NansenEntry<S extends z.ZodType> = Readonly<{
  path: string;
  description: string;
  input: S;
  summarize(body: unknown): string;
  buildBody(input: unknown, context: NansenContext): Record<string, unknown>;
}>;

const entry = <S extends z.ZodType>(definition: Readonly<{
  path: string;
  description: string;
  input: S;
  body(input: z.output<S>, context: NansenContext): Record<string, unknown>;
  summarize(body: unknown): string;
}>): NansenEntry<S> => ({
  path: definition.path,
  description: definition.description,
  input: definition.input,
  summarize: definition.summarize,
  buildBody: (input, context) => definition.body(definition.input.parse(input ?? {}), context),
});

const wallet = (input: { address?: string }, context: NansenContext): string => input.address ?? context.wallet;

export const nansenEndpoints = {
  token_info: entry({
    path: "tgm/token-information",
    description: "Token God Mode snapshot for a token: price, market cap, FDV, liquidity, volume with buy/sell split, trades, unique traders, holders, and links. Default chain is Base.",
    input: z.object({ chain, token: address, timeframe: tgmTimeframe }),
    body: (i) => ({ chain: i.chain, token_address: i.token, timeframe: i.timeframe }),
    summarize: summarizeTokenInfo,
  }),
  token_flow_intelligence: entry({
    path: "tgm/flow-intelligence",
    description: "Net token inflows and outflows per holder cohort (whales, smart traders, exchanges, fresh wallets) over a timeframe. Default chain is Base.",
    input: z.object({ chain, token: address, timeframe: tgmTimeframe }),
    body: (i) => ({ chain: i.chain, token_address: i.token, timeframe: i.timeframe }),
    summarize: summarizeFlowIntelligence,
  }),
  token_flows: entry({
    path: "tgm/flows",
    description: "Daily token flow buckets: net value, DEX and CEX inflows/outflows, price, and holder count. Optionally filter to one holder label.",
    input: z.object({ chain, token: address, days: days.default(7), label: z.enum(["whale", "public_figure", "smart_money", "top_100_holders", "exchange"]).optional(), limit }),
    body: (i) => ({ chain: i.chain, token_address: i.token, date: range(i.days), pagination: { page: 1, per_page: i.limit }, ...(i.label ? { label: i.label } : {}) }),
    summarize: (body) => list(body, (row) =>
      `${day(field(row, "date"))}: net ${usd((Number(field(row, "total_inflows_dex")) + Number(field(row, "total_inflows_cex"))) - (Number(field(row, "total_outflows_dex")) + Number(field(row, "total_outflows_cex"))))}, in ${usd(Number(field(row, "total_inflows_dex")) + Number(field(row, "total_inflows_cex")))}, out ${usd(Number(field(row, "total_outflows_dex")) + Number(field(row, "total_outflows_cex")))}, price ${usd(field(row, "price_usd"))}, ${num(field(row, "holders_count"))} holders`),
  }),
  token_who_bought_sold: entry({
    path: "tgm/who-bought-sold",
    description: "Wallets that bought or sold a token with USD volumes. Use side to keep only buyers or sellers.",
    input: z.object({ chain, token: address, side: z.enum(["BUY", "SELL"]).optional(), days: days.default(1), limit }),
    body: (i) => ({ chain: i.chain, token_address: i.token, date: range(i.days), pagination: { page: 1, per_page: i.limit }, ...(i.side ? { buy_or_sell: i.side } : {}) }),
    summarize: (body) => list(body, (row) =>
      `${short(field(row, "address"))}${field(row, "address_label") ? ` (${String(field(row, "address_label"))})` : ""}: bought ${usd(field(row, "bought_volume_usd"))}, sold ${usd(field(row, "sold_volume_usd"))}`),
  }),
  token_transfers: entry({
    path: "tgm/transfers",
    description: "Recent large token transfers between wallets with USD values.",
    input: z.object({ chain, token: address, days: days.default(7), limit }),
    body: (i) => ({ chain: i.chain, token_address: i.token, date: range(i.days), pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${timestamp(field(row, "block_timestamp"))}  ${short(field(row, "from_address"))} -> ${short(field(row, "to_address"))}  ${num(field(row, "transfer_amount"))} (${usd(field(row, "transfer_value_usd"))})`),
  }),
  token_dex_trades: entry({
    path: "tgm/dex-trades",
    description: "Recent DEX trades for a token with trader, side, size, and USD value.",
    input: z.object({ chain, token: address, days: days.default(1), limit }),
    body: (i) => ({ chain: i.chain, token_address: i.token, only_smart_money: false, date: range(i.days), pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${timestamp(field(row, "block_timestamp"))}  ${String(field(row, "action") ?? "?")} ${num(field(row, "token_amount"))} ${String(field(row, "token_name") ?? "")} for ${usd(field(row, "estimated_value_usd"))} by ${short(field(row, "trader_address"))}`),
  }),
  token_screener: entry({
    path: "token-screener",
    description: "Top tokens on a chain ranked by Nansen's screener for a timeframe: price change, volume, netflow, market cap, liquidity.",
    input: z.object({ chain, timeframe: z.enum(["5m", "10m", "1h", "6h", "24h", "7d", "30d"]).default("24h"), limit }),
    body: (i) => ({ chains: [i.chain], timeframe: i.timeframe, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${String(field(row, "token_symbol") ?? short(field(row, "token_address")))}: ${usd(field(row, "price_usd"))}, change ${num(field(row, "price_change"))}%, vol ${usd(field(row, "volume"))}, netflow ${usd(field(row, "netflow"))}, mcap ${usd(field(row, "market_cap_usd"))}`),
  }),
  token_price: entry({
    path: "tgm/token-ohlcv",
    description: "OHLCV price candles for a token: open, high, low, close, and volume per interval.",
    input: z.object({ chain, token: address, timeframe: z.enum(["1h", "4h", "1d", "1w"]).default("1d"), days: days.default(30) }),
    body: (i) => ({ chain: i.chain, token_address: i.token, timeframe: i.timeframe, date: range(i.days) }),
    summarize: summarizeCandles,
  }),
  wallet_balances: entry({
    path: "profiler/address/current-balance",
    description: "Current token balances for a wallet with USD values. Defaults to the user's own Pecu wallet on Base.",
    input: z.object({ address: address.optional(), chain: walletChain, limit }),
    body: (i, context) => ({ address: wallet(i, context), chain: i.chain, hide_spam_token: true, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${String(field(row, "token_symbol") ?? short(field(row, "token_address")))}${field(row, "chain") ? ` [${String(field(row, "chain"))}]` : ""}: ${num(field(row, "token_amount"))} (${usd(field(row, "value_usd"))})`),
  }),
  wallet_transactions: entry({
    path: "profiler/address/transactions",
    description: "Recent transactions for a wallet with method, tokens moved, and USD volume. Defaults to the user's own Pecu wallet on Base.",
    input: z.object({ address: address.optional(), chain: walletChain, days: days.default(7), limit }),
    body: (i, context) => ({ address: wallet(i, context), chain: i.chain, date: range(i.days), hide_spam_token: true, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${timestamp(field(row, "block_timestamp"))}  ${String(field(row, "chain") ?? "")} ${String(field(row, "method") ?? "tx")}  ${usd(field(row, "volume_usd"))}  ${short(field(row, "transaction_hash"))}`),
  }),
  wallet_pnl: entry({
    path: "profiler/address/pnl-summary",
    description: "Realized PnL summary for a wallet: profit, win rate, trade counts, and top tokens. Defaults to the user's own Pecu wallet on Base.",
    input: z.object({ address: address.optional(), chain: pnlChain, days: days.default(30) }),
    body: (i, context) => ({ address: wallet(i, context), chain: i.chain, date: range(i.days) }),
    summarize: summarizeWalletPnl,
  }),
  wallet_counterparties: entry({
    path: "profiler/address/counterparties",
    description: "Top counterparties a wallet interacted with: labels, interaction counts, and USD volume in and out.",
    input: z.object({ address: address.optional(), chain: walletChain, days: days.default(30), group_by: z.enum(["wallet", "entity"]).default("wallet"), limit }),
    body: (i, context) => ({ address: wallet(i, context), chain: i.chain, date: range(i.days), group_by: i.group_by, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) => {
      const labels = field(row, "counterparty_address_label");
      const label = Array.isArray(labels) && labels.length ? ` (${labels.map(String).join(", ")})` : "";
      return `${short(field(row, "counterparty_address"))}${label}: ${num(field(row, "interaction_count"))} interactions, in ${usd(field(row, "volume_in_usd"))}, out ${usd(field(row, "volume_out_usd"))}`;
    }),
  }),
  wallet_related: entry({
    path: "profiler/address/related-wallets",
    description: "Wallets related to an address by funding or first transactions, with labels and relation type.",
    input: z.object({ address: address.optional(), chain, limit }),
    body: (i, context) => ({ address: wallet(i, context), chain: i.chain, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${short(field(row, "address"))}${field(row, "address_label") ? ` (${String(field(row, "address_label"))})` : ""}: ${String(field(row, "relation") ?? "related")} on ${String(field(row, "chain") ?? "")}`),
  }),
  prediction_markets: entry({
    path: "prediction-market/market-screener",
    description: "Polymarket markets ranked by volume, liquidity, or traders. Use query to search by words in the question.",
    input: z.object({ query: z.string().trim().min(1).max(200).optional(), status: z.enum(["active", "closed"]).default("active"), sort_by: z.enum(["volume_24hr", "volume", "volume_1wk", "volume_1mo", "liquidity", "open_interest", "unique_traders_24h", "age_hours"]).default("volume_24hr"), limit }),
    body: (i) => ({ status: i.status, sort_by: i.sort_by, pagination: { page: 1, per_page: i.limit }, ...(i.query ? { query: i.query } : {}) }),
    summarize: (body) => list(body, (row) =>
      `${String(field(row, "question") ?? field(row, "market_id"))} | 24h ${usd(field(row, "volume_24hr"))}, OI ${usd(field(row, "open_interest"))}, last ${num(field(row, "last_trade_price"))}, ends ${day(field(row, "end_date"))} | id ${String(field(row, "market_id") ?? "")}`),
  }),
  prediction_events: entry({
    path: "prediction-market/event-screener",
    description: "Polymarket events (groups of related markets) ranked by volume or open interest.",
    input: z.object({ query: z.string().trim().min(1).max(200).optional(), status: z.enum(["active", "closed"]).default("active"), sort_by: z.enum(["volume_24hr", "volume", "volume_1wk", "volume_1mo", "liquidity", "open_interest", "unique_traders_24h", "age_hours"]).default("volume_24hr"), limit }),
    body: (i) => ({ status: i.status, sort_by: i.sort_by, pagination: { page: 1, per_page: i.limit }, ...(i.query ? { query: i.query } : {}) }),
    summarize: (body) => list(body, (row) =>
      `${String(field(row, "event_title") ?? field(row, "event_id"))} | ${num(field(row, "market_count"))} markets, 24h ${usd(field(row, "total_volume_24hr"))}, OI ${usd(field(row, "total_open_interest"))} | id ${String(field(row, "event_id") ?? "")}`),
  }),
  prediction_orderbook: entry({
    path: "prediction-market/orderbook",
    description: "Current order book for a Polymarket market id: bids and asks with price and size.",
    input: z.object({ market_id: marketId, limit }),
    body: (i) => ({ market_id: i.market_id, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${String(field(row, "side") ?? "?")} ${String(field(row, "outcome") ?? "")} @ ${num(field(row, "price"))} x ${num(field(row, "size"))}`),
  }),
  prediction_trades: entry({
    path: "prediction-market/trades-by-market",
    description: "Recent trades on a Polymarket market id: side, size, price, and USDC value.",
    input: z.object({ market_id: marketId, days: days.default(7), limit }),
    body: (i) => ({ market_id: i.market_id, date: range(i.days), pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${timestamp(field(row, "timestamp"))}  ${String(field(row, "taker_action") ?? field(row, "side") ?? "?")} ${num(field(row, "size"))} @ ${num(field(row, "price"))} (${usd(field(row, "usdc_value"))})`),
  }),
  prediction_top_holders: entry({
    path: "prediction-market/top-holders",
    description: "Largest position holders in a Polymarket market id with entry price and unrealized PnL.",
    input: z.object({ market_id: marketId, limit }),
    body: (i) => ({ market_id: i.market_id, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${short(field(row, "address"))}: ${String(field(row, "side") ?? "")} ${num(field(row, "position_size"))} @ ${num(field(row, "avg_entry_price"))}, uPnL ${usd(field(row, "unrealized_pnl_usd"))}`),
  }),
  prediction_market_pnl: entry({
    path: "prediction-market/pnl-by-market",
    description: "Profit and loss per wallet for a Polymarket market id.",
    input: z.object({ market_id: marketId, limit }),
    body: (i) => ({ market_id: i.market_id, pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${short(field(row, "address"))}: total PnL ${usd(field(row, "total_pnl_usd"))} (${String(field(row, "side_held") ?? "")})`),
  }),
  prediction_wallet: entry({
    path: "prediction-market/address-summary",
    description: "Polymarket performance summary for a wallet: total PnL, win rate, markets traded. Defaults to the user's own Pecu wallet.",
    input: z.object({ address: address.optional(), limit }),
    body: (i, context) => ({ address: wallet(i, context), pagination: { page: 1, per_page: i.limit } }),
    summarize: (body) => list(body, (row) =>
      `${short(field(row, "address"))}: total PnL ${usd(field(row, "total_pnl_usd"))}, win rate ${num(Number(field(row, "win_rate")) * 100)}%, ${num(field(row, "markets_won"))}/${num(field(row, "markets_traded"))} markets won`),
  }),
};

export type NansenEndpointName = keyof typeof nansenEndpoints;
export const nansenEndpointNames = Object.keys(nansenEndpoints) as NansenEndpointName[];

export type NansenResult = Readonly<{
  endpoint: NansenEndpointName;
  text: string;
  data: unknown;
  credits: { cost?: string; remaining?: string };
}>;

const errorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  retry_after: z.number().optional(),
}).loose();

const invalidCodes = new Set([
  "missing_field", "unknown_field", "invalid_field_value", "invalid_address_format",
  "invalid_date_format", "invalid_date_range", "mutually_exclusive_fields",
  "value_out_of_range", "too_many_items",
]);

function nansenError(body: string, status: number, retryAfterHeader: string | null): string {
  let detail: { code?: string; message?: string; retry_after?: number } = {};
  try {
    const parsed = errorSchema.safeParse(JSON.parse(body));
    if (parsed.success) detail = parsed.data;
  } catch { /* non-JSON error body */ }
  switch (detail.code) {
    case "rate_limit_exceeded": {
      const wait = detail.retry_after ?? (retryAfterHeader !== null && Number.isFinite(Number(retryAfterHeader)) ? Number(retryAfterHeader) : 60);
      return `Nansen is busy. Try again in ${wait} seconds.`;
    }
    case "insufficient_credits":
    case "plan_upgrade_required":
      return "Nansen analytics credits are exhausted. The bot administrator needs to top up.";
    case "unauthenticated":
    case "forbidden":
      return "Nansen analytics is not available right now (access).";
    case "geo_blocked":
      return "Nansen is not available from this region.";
    case "not_found":
      return "Nansen has no data for that.";
    default:
      if (detail.code !== undefined && invalidCodes.has(detail.code)) {
        return `Nansen rejected the request: ${(detail.message ?? "invalid request").slice(0, 200)}`;
      }
      return `Nansen is unavailable right now (${status}).`;
  }
}

const envelope = z.object({ data: z.unknown().optional() }).loose();

export class NansenService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly apiUrl = "https://api.nansen.ai/api/v1",
    private readonly request: typeof fetch = fetch,
  ) {}

  async call(endpointName: NansenEndpointName, input: unknown, context: NansenContext): Promise<NansenResult> {
    if (!this.apiKey) throw new Error("Nansen analytics is not configured yet.");
    const spec = nansenEndpoints[endpointName];
    const response = await this.request.call(globalThis, `${this.apiUrl}/${spec.path}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: this.apiKey },
      body: JSON.stringify(spec.buildBody(input, context)),
      signal: AbortSignal.timeout(25_000),
    });
    const cost = response.headers.get("X-Nansen-Credits-Cost") ?? undefined;
    const remaining = response.headers.get("X-Nansen-Credits-Remaining") ?? undefined;
    const requestId = response.headers.get("X-Request-Id") ?? undefined;
    log("info", "nansen_call", { endpoint: endpointName, status: response.status, creditsCost: cost, creditsRemaining: remaining, requestId });
    if (!response.ok) throw new Error(nansenError(await response.text(), response.status, response.headers.get("Retry-After")));
    const body = envelope.parse(await response.json());
    return { endpoint: endpointName, text: spec.summarize(body), data: body, credits: { cost, remaining } };
  }
}
