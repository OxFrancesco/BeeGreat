import { z } from "zod";

export const stageSchema = z.object({
  id: z.string().max(160), label: z.string().max(100),
  startedAt: z.number(), endedAt: z.number().optional(),
  status: z.enum(["running", "complete", "error"]),
});
export type TurnStage = z.infer<typeof stageSchema>;

export function toolLabel(name: string) {
  const labels = new Map(Object.entries({
    run_tools: "Working on your request", aero_pools: "Finding pools", aero_liquidity: "Preparing liquidity", aero_quote: "Getting a quote",
    wallet_balances: "Reading balances", wallet_address: "Checking wallet", ask_user: "Preparing a question",
    aero_stock_trades: "Preparing stock trades", load_skills: "Loading skills",
    task_create: "Scheduling", task_list: "Reading automations", task_update: "Updating automation",
    research_start: "Starting research", research_list: "Reading research", research_get: "Reading research", research_cancel: "Cancelling research",
  }));
  return labels.get(name) ?? (name.startsWith("aero_") ? "Reading Aerodrome" : name.startsWith("nansen_") ? "Reading market data" : name.startsWith("polymarket_") ? "Reading Polymarket" : name.startsWith("aave_") ? "Checking Aave" : name.startsWith("twitter_") ? "Reading X" : name.startsWith("chain_") ? "Reading chain data" : "Running a tool");
}

export const codeModeCallsSchema = z.array(z.object({
  name: z.string(), status: z.enum(["running", "complete", "error"]),
  startedAt: z.number(), endedAt: z.number().optional(), outputBytes: z.number().optional(),
}));
