import { z } from "zod";

export const stageSchema = z.object({
  id: z.string().max(160), label: z.string().max(100),
  startedAt: z.number(), endedAt: z.number().optional(),
  status: z.enum(["running", "complete", "error"]),
});
export type TurnStage = z.infer<typeof stageSchema>;

export function toolLabel(name: string) {
  const labels = new Map(Object.entries({
    aero_pools: "Finding pools", aero_liquidity: "Preparing liquidity", aero_quote: "Getting a quote",
    wallet_balances: "Reading balances", wallet_address: "Checking wallet", ask_user: "Preparing a question",
    aero_stock_trades: "Preparing stock trades", enable_all_tools: "Loading tools",
  }));
  return labels.get(name) ?? (name.startsWith("aero_") ? "Reading Aerodrome" : name.startsWith("nansen_") ? "Reading market data" : name.startsWith("polymarket_") ? "Reading Polymarket" : name.startsWith("aave_") ? "Checking Aave" : "Running a tool");
}
