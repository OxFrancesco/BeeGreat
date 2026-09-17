import { z } from "zod";
import { stockSchema, stocksSchema } from "../../../../src/stock-contract";
export { stockSchema, stocksSchema };
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
