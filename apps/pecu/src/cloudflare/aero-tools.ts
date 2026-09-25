import { ACTION_SPECS } from "@beegreat/sugar";
import { isSugarTxAction, SUGAR_ACTIONS, type SugarAction } from "@beegreat/sugar/contracts";
import { z } from "zod";

const descriptions = {
  stocks: "Read the SDK's supported tokenized stocks, live USDC prices, and verified wallet holdings. Report any unavailable prices as errors, never as zero.",
  stock_buy: "Propose buying a tokenized stock with USDC. amount is the USDC spend in human units. Requires sufficient wallet funds and explicit user confirmation. For more than one stock trade in one message use aero_stock_trades.",
  stock_sell: "Propose selling a tokenized stock for USDC. amount is in human stock token units. Requires sufficient wallet holdings and explicit user confirmation. For more than one stock trade in one message use aero_stock_trades.",
  index_rebalance: "Propose rebalancing tokenized stock holdings to allocations with an optional USDC cash contribution. Requires explicit user confirmation.",
  quote: "Get a live swap quote. This only reads prices and never creates a transaction plan. amount_out_decimal is the output token amount. from_price_usd and to_price_usd are reference prices, not the implied execution price.",
  swap: "Propose a swap. This persists a transaction plan for explicit user confirmation.",
  positions: "Read liquidity positions. Omit owner to use the verified sender's wallet.",
  pools: "Read pools. Use limit for a small response. Filtering or full details can require a full pool scan.",
  epochs: "Read a pool's historical epochs using its lp address.",
  epochs_latest: "Read latest pool epochs, optionally filtered by pool_type.",
  deposit: "Propose a liquidity deposit. Supply pool, or token0, token1 and pool_type. A new CL pool also requires tick_spacing. Supply amount0 or amount1. CL deposits require price or tick bounds.",
  withdraw: "Propose withdrawal from pool or position. fraction is between 0 and 1. Explicit user confirmation is required.",
  stake: "Propose staking liquidity identified by pool or position.",
  unstake: "Propose unstaking liquidity identified by pool or position. Optional amount is raw integer liquidity units.",
  claim_emissions: "Propose claiming emissions for pool or position.",
  claim_fees: "Propose claiming fees for pool or position.",
  create_venft: "Propose locking AERO for lock_duration_seconds to create a veNFT.",
} satisfies Record<SugarAction, string>;

const fieldDescriptions = new Map(Object.entries({
  stock: "Supported stock symbol or public address. Use stocks to discover the current catalog, for example NVDAc or AAPLc.",
  allocations: "Comma-separated SYMBOL=percent pairs totaling 100 percent, for example NVDAc=50,AAPLc=50. No repeated stocks.",
  cash: "Additional USDC contribution in human units, for example 10. Defaults to zero, using existing stock holdings only.",
  from_token: "Input token symbol or public contract address, for example ETH.",
  to_token: "Output token symbol or public contract address, for example USDC.",
  token0: "First token symbol or public contract address.",
  token1: "Second token symbol or public contract address.",
  amount: "Token amount as a string, for example 0.001. Human token units by default when use_decimals is available. Unstake uses raw integer liquidity units.",
  amount0: "First token amount as a string, in human token units by default.",
  amount1: "Second token amount as a string, in human token units by default.",
  use_decimals: "Defaults to true for human token amounts. Set false only when amount strings already contain raw integer base units.",
  slippage: "Fraction, for example 0.005 means 0.5 percent. Omit to use the configured maximum. Cannot exceed that maximum.",
  position: "Position ID as a decimal integer string. Supply position or pool for position actions.",
  pool: "Public liquidity pool contract address. Supply pool or position for position actions.",
  owner: "Public address to inspect. Omit for the verified sender's wallet.",
  fraction: "Fraction of the position to withdraw, greater than zero and at most 1.",
  lock_duration_seconds: "Positive integer lock duration in seconds.",
}));

function inputSchema(action: SugarAction) {
  const spec = ACTION_SPECS[action];
  const fields: Record<string, z.ZodType<string | number | boolean | undefined>> = {};
  for (const [name, kind] of Object.entries(spec.allowed)) {
    if (name === "chain" || name === "wallet") continue;
    const base = kind === "boolean" ? z.boolean()
      : kind === "number" ? z.number()
      : kind === "address" ? z.string().regex(/^0x[0-9a-fA-F]{40}$/)
      : kind === "integer_string" ? z.string().regex(/^\d+$/)
      : z.string().min(1).max(256);
    const constrained = name === "pool_type" ? z.enum(["cl", "stable", "volatile"]) : base;
    const presence = spec.required.includes(name) ? constrained : constrained.optional();
    const field = name === "use_decimals" ? z.boolean().default(true) : presence;
    fields[name] = field.describe(fieldDescriptions.get(name) ?? name.replaceAll("_", " "));
  }
  return z.strictObject(fields);
}

export const aeroTools = SUGAR_ACTIONS.map((action) => ({
  action,
  name: `aero_${action}`,
  description: `${descriptions[action]} Base mainnet only.${isSugarTxAction(action) ? " Never executes a transaction." : ""}`,
  input: inputSchema(action),
}));
