---
name: pecu-nansen
description: Nansen on-chain analytics, token flows, buyers and sellers, holders, wallet portfolios, trading PnL and related wallets.
tools: ["nansen_*"]
triggers: '\b(nansen|smart money|flows?|inflows?|outflows?|who (is |are )?(buying|selling|bought|sold)|buyers|sellers|counterpart(y|ies)|related wallets|pnl|p&l|profit|losses|portfolio|screener|dex trades|token transfers|whales?)\b'
---

# Nansen analytics

- Default chain is Base; pass another only when the user names it. Token tools resolve AERO, USDC and other supported symbols locally, so call them directly with the symbol or a verified contract address. Never read a wallet balance to resolve a token for market research. Ask for the contract of an unsupported symbol.
- Wallet tools default to the user's Pecu wallet when no address is given. nansen_wallet_portfolio covers exposure; nansen_wallet_pnl_breakdown charts trading gains and losses.
- Run independent reads together. For Polymarket, prefer polymarket_* tools; use Nansen prediction tools only for Nansen enrichment.
- Flow, detailed PnL and portfolio tools attach verified charts. Explain the main finding without repeating chart rows or inventing data. Flow groups can overlap, deposits do not prove sales, and wallet tokens must not be added to DeFi positions because receipt tokens overlap.
- End with the line "Data: Nansen (nansen.ai)". Report what the data shows; it is not financial advice or a prediction.
