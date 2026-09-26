import { z } from "zod";
import { plannedCallSchema } from "./domain";

const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
const amount = z.string().max(100).regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/);

export const liquidityRequestSchema = z.strictObject({
  selection: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pool"), pool: address }),
    z.strictObject({ kind: z.literal("pair"), token0: z.string().min(1), token1: z.string().min(1), tick_spacing: z.number().int().positive(), initial_price: z.number().positive().optional() }),
  ]),
  funding_token: z.string().min(1).max(256),
  budget: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("amount"), amount }),
    z.strictObject({ kind: z.literal("fraction"), bps: z.number().int().min(1).max(10000) }),
  ]),
  range: z.strictObject({ lower: z.number().positive(), upper: z.number().positive() }).optional(),
  slippage: z.number().gt(0).max(0.01).default(0.005),
});
export type LiquidityRequest = z.output<typeof liquidityRequestSchema>;

export const liquidityIntentParameters = z.strictObject({
  request: liquidityRequestSchema,
  groups: z.tuple([
    z.strictObject({ action: z.literal("swap"), count: z.number().int().min(1).max(15) }),
    z.strictObject({ action: z.literal("deposit"), count: z.number().int().min(1).max(15) }),
  ]),
});
export const liquidityPlanSchema = z.strictObject({
  parameters: liquidityIntentParameters,
  calls: z.array(plannedCallSchema).min(1).max(16),
  preview: z.string().min(1),
  tokens: z.array(z.strictObject({ address: z.string(), symbol: z.string(), decimals: z.number().int().min(0).max(255) })).length(2),
});
export type LiquidityPlan = z.output<typeof liquidityPlanSchema>;
