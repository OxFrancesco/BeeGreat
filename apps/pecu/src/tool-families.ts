export const toolFamilies = {
  wallet: "Wallet, token sends, approvals, generic contracts, Safe organization wallets, budgets and roles.",
  defi: "Aerodrome swaps and liquidity, stocks and baskets, veNFTs, or Aave supply, borrow, repay and withdraw.",
  markets: "Polymarket discovery, odds, market details, prices, books and history.",
  analytics: "Nansen on-chain analytics, token flows, portfolio and PnL.",
  funding: "Funding the Pecu wallet through Whop and checking those deposits.",
  all: "Several unrelated families, ambiguous intent, or a contextual follow-up whose family is unclear.",
} as const;
export type ToolFamily = keyof typeof toolFamilies;

const marketTools = new Set(["polymarket_search", "polymarket_market", "polymarket_market_by_slug", "polymarket_event", "polymarket_event_by_slug", "polymarket_midpoint", "polymarket_price", "polymarket_spread", "polymarket_book", "polymarket_prices_history"]);

export function toolInFamily(name: string, family: ToolFamily): boolean {
  if (family === "all" || name === "ask_user" || name === "enable_all_tools") return true;
  if (family === "markets") return marketTools.has(name);
  if (name.startsWith("wallet_")) return true;
  if (family === "wallet") return /^(evm_|safe_)/.test(name);
  if (family === "defi") return /^(aero_|aave_)/.test(name) || ["evm_token_balance", "evm_allowance", "evm_read", "evm_inspect", "evm_approve", "evm_revoke"].includes(name);
  if (family === "analytics") return name.startsWith("nansen_");
  return name.startsWith("deposit_");
}
