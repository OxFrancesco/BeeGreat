import { z } from "zod";

const money = z.number().finite().nullable();
const token = z.object({ chain: z.string(), address: z.string(), symbol: z.string() });
const base = { key: z.string(), observedAt: z.number().int().nonnegative(), subject: z.string(), chain: z.string(), period: z.string(), partial: z.boolean() };

export const analyticsSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base, kind: z.literal("flows"),
    rows: z.array(z.object({ label: z.string(), netUsd: money, wallets: z.number().int().nonnegative().nullable() })).max(6),
  }),
  z.object({
    ...base, kind: z.literal("pnl"),
    rows: z.array(token.extend({ realizedUsd: money, unrealizedUsd: money })).max(1000),
  }),
  z.object({
    ...base, kind: z.literal("portfolio"),
    balances: z.array(token.extend({ amount: money, valueUsd: money })).max(1000).nullable(),
    defi: z.object({
      assetsUsd: money, debtUsd: money, rewardsUsd: money, netUsd: money,
      protocols: z.array(z.object({ name: z.string(), chain: z.string(), assetsUsd: money, debtUsd: money, netUsd: money })).max(1000),
    }).nullable(),
  }),
]);
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
export const analyticsResultSchema = z.object({ snapshot: analyticsSnapshotSchema, text: z.string() });
export const analyticsResultsSchema = z.array(analyticsResultSchema).max(12);
export type AnalyticsResult = z.infer<typeof analyticsResultSchema>;

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const analyticsUsd = (value: number | null): string => value === null ? "Unavailable" : dollars.format(value);
export const analyticsAddress = (value: string): string => value.length > 18 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
export function analyticsTotal(values: (number | null)[]): number | null {
  if (values.some((value) => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return Number.isFinite(total) ? total : null;
}

export function analyticsText(snapshot: AnalyticsSnapshot): string {
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
