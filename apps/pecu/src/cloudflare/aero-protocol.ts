import { SUGAR_ACTIONS } from "@beegreat/sugar/contracts";
import { z } from "zod";
import { stockTradeSchema } from "../stock-contract";

export const sugarRequestSchema = z.object({
  action: z.enum(SUGAR_ACTIONS),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const stockBasketRequestSchema = z.strictObject({
  action: z.literal("stock_basket"),
  chain: z.literal(8453),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value as `0x${string}`),
  trades: z.array(stockTradeSchema).min(1).max(8),
  slippage: z.number().gt(0).lt(1),
});

export const aeroRequestSchema = z.union([stockBasketRequestSchema, sugarRequestSchema]);
export type AeroRequest = z.infer<typeof aeroRequestSchema>;
export type StockBasketRequest = z.infer<typeof stockBasketRequestSchema>;
