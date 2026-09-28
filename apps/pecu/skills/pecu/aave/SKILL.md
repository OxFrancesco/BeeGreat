---
name: pecu-aave
description: Aave markets, yields, account health, supply, borrow, withdraw and repay on Base.
tools: ["aave_*"]
triggers: '\b(aave|lend|lending|lender|borrow|borrowing|loan|supply|supplied|repay|repayment|collateral|health factor|deleverage|liquidation|ltv|apy|apr|yield|interest)\b'
---

# Aave lending

- Load the matching official workflow with aave_skill (safe-transactions, yield-analysis, deleverage, account-activity or tx-confirmation) and the needed aave_schema in the same round, then use aave_call.
- get_markets returns market and token addresses; reuse them. Never guess addresses from token names.
- prepare_action supports supply, borrow, withdraw and repay. amount is a human decimal string; max works only for repay and withdraw. The backend supplies sender, chainId 8453 and version v3. It runs fresh discovery, inspection and simulation itself, so do not repeat those calls first. Other prepare_* actions and signed orders are unavailable.
- An approval-only preview does not supply or repay yet; say so.
- Reads may compare chains; every wallet transaction stays on Base.
