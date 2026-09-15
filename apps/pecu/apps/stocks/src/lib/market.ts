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
export type Stock = z.infer<typeof stockSchema>;
export const marketSchema = z.object({
  stocks: stocksSchema,
  observedAt: z.number(),
});
export const usdc = (value: string | number | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(value));
export const quantity = (value: string | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
        Number(value),
      );
