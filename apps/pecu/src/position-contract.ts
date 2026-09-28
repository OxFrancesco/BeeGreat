import { z } from "zod";
import type { JsonInput } from "./json-contract";

const amount = z.string().regex(/^\d+(?:\.\d+)?$/).max(160);
const symbol = z.string().min(1).max(40);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const token = z.object({ symbol, unstaked: amount, staked: amount });
export const liquidityPositionSchema = z.object({
  id: z.string().regex(/^\d+$/).max(80),
  pool: address,
  label: z.string().min(1).max(160),
  chain: z.string().min(1).max(60),
  token0: token,
  token1: token,
});
export const positionSnapshotSchema = z.object({ positions: z.array(liquidityPositionSchema).max(1000), observedAt: z.number() });
export type LiquidityPosition = z.infer<typeof liquidityPositionSchema>;
export type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;

const units = z.string().regex(/^\d+$/).max(100);
const rawToken = z.object({ symbol, decimals: z.number().int().min(0).max(36) });
const rawPositions = z.array(z.object({
  id: units, chain_name: z.string().min(1).max(60),
  pool: z.object({ symbol: z.string().min(1).max(160), lp: address, token0: rawToken, token1: rawToken }),
  amount_token0: units, amount_token1: units, staked_token0: units, staked_token1: units,
})).max(1000);

function decimal(value: string, places: number): string {
  if (!places) return BigInt(value).toString();
  const padded = value.padStart(places + 1, "0");
  return `${padded.slice(0, -places)}.${padded.slice(-places)}`.replace(/0+$/, "").replace(/\.$/, "");
}

export function readPositionSnapshot(output: JsonInput, observedAt = Date.now()): PositionSnapshot | undefined {
  const parsed = rawPositions.safeParse(output);
  if (!parsed.success) return undefined;
  return { observedAt, positions: parsed.data.map((row) => ({
    id: row.id, pool: row.pool.lp, label: row.pool.symbol, chain: row.chain_name,
    token0: { symbol: row.pool.token0.symbol, unstaked: decimal(row.amount_token0, row.pool.token0.decimals), staked: decimal(row.staked_token0, row.pool.token0.decimals) },
    token1: { symbol: row.pool.token1.symbol, unstaked: decimal(row.amount_token1, row.pool.token1.decimals), staked: decimal(row.staked_token1, row.pool.token1.decimals) },
  })) };
}

/** Read-only display. Exact strings stay in the snapshot and the details disclosure. */
export function compactPositionAmount(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");
  const integer = BigInt(whole).toString();
  if (!/[1-9]/.test(value)) return "0";
  if (integer === "0" && !/[1-9]/.test(fraction.slice(0, 6))) return "<0.000001";
  const places = integer === "0" ? Math.min(6, fraction.search(/[1-9]/) + 4) : Math.max(0, 4 - integer.length);
  const shortened = `${integer}${places && fraction ? `.${fraction.slice(0, places)}` : ""}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `${/[1-9]/.test(fraction.slice(places)) ? "≈" : ""}${shortened}`;
}

export function positionSummary(snapshot: PositionSnapshot): string {
  if (!snapshot.positions.length) return "You have no liquidity positions.";
  const rows = snapshot.positions.slice(0, 3).map((row) => {
    const values = [row.token0, row.token1].flatMap((asset) => [
      /[1-9]/.test(asset.unstaked) ? `${compactPositionAmount(asset.unstaked)} ${asset.symbol} unstaked` : null,
      /[1-9]/.test(asset.staked) ? `${compactPositionAmount(asset.staked)} ${asset.symbol} staked` : null,
    ].filter((value) => value !== null));
    return `${row.token0.symbol}/${row.token1.symbol}: ${values.join(" + ") || "empty"}`;
  });
  return `${rows.join("\n")}${snapshot.positions.length > 3 ? "\nMore positions available. Ask for details." : ""}`;
}

/** Convert only the complete historical position format; never hide surrounding prose. */
export function legacyPositions(text: string): LiquidityPosition[] | undefined {
  const pattern = /([^\n·]+?)\s*·\s*Position (\d+)\s*·\s*([^\n]+?)\s+Pool:\s*(0x[0-9a-fA-F]{40})\s+Unstaked:\s*(\d+(?:\.\d+)?)\s+(\S+)\s*\+\s*(\d+(?:\.\d+)?)\s+(\S+)\s+Staked:\s*(\d+(?:\.\d+)?)\s+(\S+)\s*\+\s*(\d+(?:\.\d+)?)\s+(\S+)/g;
  let end = 0;
  const rows: LiquidityPosition[] = [];
  for (const match of text.matchAll(pattern)) {
    if (text.slice(end, match.index).trim() || match[6] !== match[10] || match[8] !== match[12]) return undefined;
    const row = liquidityPositionSchema.safeParse({ label: match[1]?.trim(), id: match[2], chain: match[3]?.trim(), pool: match[4], token0: { symbol: match[6], unstaked: match[5], staked: match[9] }, token1: { symbol: match[8], unstaked: match[7], staked: match[11] } });
    if (!row.success) return undefined;
    rows.push(row.data);
    end = match.index + match[0].length;
  }
  return rows.length && rows.length <= 1000 && !text.slice(end).trim() ? rows : undefined;
}
