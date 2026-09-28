export const toolFamilies = {
  wallet: "Wallet, token sends, approvals, generic contracts, Safe organization wallets, budgets and roles.",
  defi: "Aerodrome swaps and liquidity, stocks and baskets, veNFTs, or Aave supply, borrow, repay and withdraw.",
  markets: "Polymarket discovery, odds, market details, prices, books and history.",
  analytics: "Nansen on-chain analytics, token flows, portfolio and PnL.",
  funding: "Funding the Pecu wallet through Whop and checking those deposits.",
  all: "Several unrelated families, ambiguous intent, or a contextual follow-up whose family is unclear.",
} as const;
export type ToolFamily = keyof typeof toolFamilies;

