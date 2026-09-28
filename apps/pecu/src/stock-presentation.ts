import type { StockSnapshot } from "./stock-contract";

export type HoldingStock = Omit<StockSnapshot["stocks"][number], "address"> & { address?: string };
export type HoldingPresentation = { stocks: HoldingStock[]; observedAt: number };

/** Read-only recovery for complete old replies. No address or current balance is inferred. */
export function legacyStockHoldings(text: string, createdAt: number): HoldingPresentation | undefined {
  if (!text.trim() || text.length > 100_000) return undefined;
  const blocks = text.trim().split(/\n\s*\n/);
  if (blocks.length > 1000) return undefined;
  const stocks: HoldingStock[] = [];
  const seen = new Set<string>();
  const pattern = /^([^,\n]{1,120}),\s*([A-Za-z0-9._-]{1,40})\s+(?:(\d+(?:\.\d+)?) USDC|Price unavailable)(?:\s*·\s*You hold (\d+(?:\.\d+)?))?$/;
  for (const block of blocks) {
    const match = pattern.exec(block.trim());
    if (!match || seen.has(match[2]) || (match[3]?.length ?? 0) > 100 || (match[4]?.length ?? 0) > 100) return undefined;
    seen.add(match[2]);
    stocks.push({ name: match[1], symbol: match[2], price_usdc: match[3] ?? null, balance: match[4] ?? null, error: null });
  }
  return { stocks, observedAt: createdAt };
}
