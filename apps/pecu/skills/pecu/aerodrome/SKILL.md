---
name: pecu-aerodrome
description: Swaps and quotes, liquidity positions and rewards, pools, veNFT locks, tokenized stock trades and index rebalances.
tools: ["aero_*"]
triggers: '\b(swaps?|swapping|quotes?|convert|exchange|aerodrome|velodrome|liquidity|lp|pools?|positions?|stake|staked|unstake|staking|emissions|claim|rewards?|fees|venft|vote|voting|lock|stocks?|shares?|equit(y|ies)|nvda\w*|aapl\w*|tsla\w*|index|basket|rebalance|buy|sell|trade|epochs?)\b'
---

# Aerodrome and stocks

## Liquidity

- When the user accepts a suggested liquidity plan or repeats a request, call aero_liquidity right away with the accepted pair and budget. It reads fresh balances itself, so it is the recheck; do not read balances first or ask again.
- A token pair and a total budget go straight to aero_liquidity: selection {"kind":"discover","token0":…,"token1":…}, or {"kind":"pool","pool":…} for a pool address the user gave. It reads fresh balances, ranks up to eight matching concentrated pools by TVL, quotes the funding swap and prepares the swap, approvals and deposit as one batch. Do not call wallet_balances, aero_pools or aero_quote first, and do not replay older multi-step discovery from chat history.
- "Use half my ETH" means funding_token "ETH" and budget {"kind":"fraction","bps":5000} for the whole position, not a separate wrap or swap confirmation.
- Ask only for a missing pair or budget, and suggest both from reads when needed. Never ask for token splits, tick spacing, price bounds or initial prices.
- The default range is 20 percent below and above spot and can be adjusted on request. Explain that fees stop outside the range and exposure changes; never call the range or pool optimal. An explicit range needs a known pool, in token1-per-token0 units.
- Prefer an existing pool. Use selection kind pair only for an explicitly requested new pool, with verified token order, supported tick spacing and an initial price from a live quote or contract read, in token1-per-token0 units. Never invent or invert a price.
- Full aero_pools listings include spot_price with price_unit; use it rather than a separate quote.
- A dollar budget can use held USDC; otherwise quote to suggest a funded-token budget.
- A linked external wallet cannot run this batch; say it needs the Pecu smart wallet and never switch signers silently.

## Tools

- Price questions use aero_quote (from_token, to_token, amount) and never create a preview. An accepted swap uses aero_swap. Slippage is a fraction: 0.005 is 0.5 percent.
- aero_deposit is for accepted explicit token amounts and range. Pass pool or the pair selection, never both, and keep token0/token1 order from discovery.
- The user's own positions: aero_positions with {}. Omit owner; Pecu binds the verified wallet. Set owner only to a public address the user supplied, never a zero or placeholder address. Use the returned position ID or pool for aero_withdraw, aero_stake, aero_unstake, aero_claim_fees and aero_claim_emissions; never guess IDs. Withdraw fraction 0.5 means half. Unstake amount is raw integer liquidity.
- Reward history: aero_epochs with lp, limit and offset; aero_epochs_latest for the current period. Filter aero_pools by pair with a small limit; it matches both token orders, so one call per pair.
- aero_create_venft takes amount and lock_duration_seconds. Get the lock duration from the user.

## Stocks

- A named stock symbol such as NVDAc goes straight to the trade tool, which rejects unknown symbols. Call aero_stocks only to list options, show holdings or find a symbol. aero_stock_buy amount is USDC to spend; aero_stock_sell amount is stock tokens. Both are human decimal strings with no use_decimals.
- Several trades in one message go into one aero_stock_trades call; never refuse or pick one.
- aero_index_rebalance allocations are SYMBOL=percent pairs totaling 100; cash is extra USDC, default zero. A balanced index creates no plan.
- Buying without enough USDC: a funding-token choice does not authorize an arbitrary swap. Quote the funding swap, keep ETH for fees and prepare the swap preview first. If stock_buy asks about other holdings, repeat the question and wait. After the swap is confirmed, recheck USDC and prepare the purchase separately. Never assume a held token has enough value or liquidity.
