import { z } from "zod";

export const stockSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  price_usdc: z.string().nullable(),
  balance: z.string().nullable(),
  error: z.string().nullable(),
});
export const stocksSchema = z.array(stockSchema);
export const stockSnapshotSchema = z.object({ stocks: stocksSchema, observedAt: z.number() });
export type StockSnapshot = z.infer<typeof stockSnapshotSchema>;

export const stockTradeSchema = z.strictObject({
  side: z.enum(["buy", "sell"]),
  stock: z.string().trim().min(1).max(64),
  amount: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/),
});
export type StockTrade = Readonly<z.infer<typeof stockTradeSchema>>;

export const stockBasketParameters = z.strictObject({
  trades: z.array(stockTradeSchema).min(1).max(8),
  slippage: z.number().gt(0).lt(1),
});
export type StockBasketParameters = z.infer<typeof stockBasketParameters>;
