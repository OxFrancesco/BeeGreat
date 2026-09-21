import { z } from "zod";
import { analyticsSnapshotSchema, type AnalyticsSnapshot } from "../analytics-contract";

const amount = z.number().finite().nullish().transform((value) => value ?? null);
const pagination = z.object({ is_last_page: z.boolean() }).optional();
const token = { chain: z.string(), token_address: z.string(), token_symbol: z.string() };
const balancesSchema = z.object({ pagination, data: z.array(z.object({ ...token, token_amount: amount, value_usd: amount })).max(1000) });
const pnlSchema = z.object({ pagination, data: z.array(z.object({ ...token, chain: z.string().optional(), pnl_usd_realised: amount, pnl_usd_unrealised: amount })).max(1000) });
const defiSchema = z.object({
  summary: z.object({ total_assets_usd: amount, total_debts_usd: amount, total_rewards_usd: amount, total_value_usd: amount }),
  protocols: z.array(z.object({ protocol_name: z.string(), chain: z.string(), total_assets_usd: amount, total_debts_usd: amount, total_value_usd: amount })).max(1000),
});
const cohorts = [
  ["smart_trader", "Smart traders"], ["whale", "Whales"], ["exchange", "Exchanges"],
  ["fresh_wallets", "Fresh wallets"], ["top_pnl", "Top P&L"], ["public_figure", "Public figures"],
] as const;
const flowSchema = z.object({ data: z.array(z.record(z.string(), z.unknown())).max(1) });
const contextSchema = z.object({ chain: z.string().default("all"), address: z.string().optional(), token_address: z.string().optional(), timeframe: z.string().optional(), date: z.object({ from: z.string(), to: z.string() }).optional() });

export function nansenAnalytics(endpoint: string, request: unknown, body: unknown, observedAt: number): AnalyticsSnapshot | undefined {
  if (!["token_flow_intelligence", "wallet_pnl_breakdown", "wallet_portfolio"].includes(endpoint)) return undefined;
  const context = contextSchema.parse(request);
  const subject = context.token_address ?? context.address ?? "";
  const period = context.date ? `${context.date.from.slice(0, 10)} to ${context.date.to.slice(0, 10)}` : context.timeframe ?? "Current";
  const base = { key: JSON.stringify([endpoint, context.chain, subject, period]), observedAt, subject, chain: context.chain, period };
  if (endpoint === "token_flow_intelligence") {
    const parsed = flowSchema.safeParse(body);
    if (!parsed.success) return undefined;
    const row = parsed.data.data[0];
    const rows = row ? cohorts.map(([key, label]) => {
      const value = amount.safeParse(row[`${key}_net_flow_usd`]);
      const wallets = z.number().int().nonnegative().safeParse(row[`${key}_wallet_count`]);
      return { label, netUsd: value.success ? value.data : null, wallets: !["exchange", "fresh_wallets"].includes(key) && wallets.success ? wallets.data : null };
    }) : [];
    return analyticsSnapshotSchema.parse({ ...base, kind: "flows", rows, partial: rows.some((row) => row.netUsd === null) });
  }
  if (endpoint === "wallet_pnl_breakdown") {
    const parsed = pnlSchema.safeParse(body);
    if (!parsed.success) return undefined;
    const rows = parsed.data.data.map((row) => ({ chain: row.chain ?? context.chain, address: row.token_address, symbol: row.token_symbol, realizedUsd: row.pnl_usd_realised, unrealizedUsd: row.pnl_usd_unrealised }));
    return analyticsSnapshotSchema.parse({ ...base, kind: "pnl", rows, partial: parsed.data.pagination?.is_last_page !== true || rows.some((row) => row.realizedUsd === null || row.unrealizedUsd === null) });
  }
  const combined = z.object({ balances: z.unknown(), defi: z.unknown() }).safeParse(body);
  if (!combined.success) return undefined;
  const balances = balancesSchema.safeParse(combined.data.balances);
  const defi = defiSchema.safeParse(combined.data.defi);
  if (!balances.success && !defi.success) return undefined;
  const rows = balances.success ? balances.data.data.map((row) => ({ chain: row.chain, address: row.token_address, symbol: row.token_symbol, amount: row.token_amount, valueUsd: row.value_usd })) : null;
  const positions = defi.success ? {
    assetsUsd: defi.data.summary.total_assets_usd, debtUsd: defi.data.summary.total_debts_usd,
    rewardsUsd: defi.data.summary.total_rewards_usd, netUsd: defi.data.summary.total_value_usd,
    protocols: defi.data.protocols.map((row) => ({ name: row.protocol_name, chain: row.chain, assetsUsd: row.total_assets_usd, debtUsd: row.total_debts_usd, netUsd: row.total_value_usd })),
  } : null;
  return analyticsSnapshotSchema.parse({ ...base, kind: "portfolio", balances: rows, defi: positions,
    partial: !balances.success || balances.data.pagination?.is_last_page !== true || rows?.some((row) => row.valueUsd === null) || !defi.success || positions?.assetsUsd === null || positions?.debtUsd === null || positions?.protocols.some((row) => row.assetsUsd === null || row.debtUsd === null) });
}
