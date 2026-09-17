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
