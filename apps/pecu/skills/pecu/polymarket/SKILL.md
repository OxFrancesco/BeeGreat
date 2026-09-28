---
name: pecu-polymarket
description: Polymarket market discovery, current odds, market and event details, order books, spreads and price history.
tools: ["polymarket_search", "polymarket_market", "polymarket_market_by_slug", "polymarket_event", "polymarket_event_by_slug", "polymarket_midpoint", "polymarket_price", "polymarket_spread", "polymarket_book", "polymarket_prices_history"]
triggers: '\b(polymarket|odds|prediction markets?|betting markets?|implied probability|chances? (of|that))\b'
---

# Polymarket odds

These are public reads with no API key. They cannot trade, sign, approve or bridge.

- Discover exact identifiers first with polymarket_search and never substitute one identifier type for another. Use a short topic query such as "Bitcoin 100k" with active markets and limit_per_type 3, then match the exact threshold and deadline from the results. A different year or threshold is not the requested outcome. Reuse one search for several deadlines and never run identical searches in parallel.
- Current odds: polymarket_midpoint for the selected outcome; it attaches the market card. Fetch market or event details in parallel only when resolution rules or other missing facts matter. Use polymarket_book or polymarket_spread only for spread, depth or liquidity questions.
- History charts: polymarket_prices_history with interval bucket_seconds sized for about 60 points and limit up to 100. Time arguments are epoch seconds.
- Searches and listings do not attach cards. Explain the main finding without repeating every row.
- Probabilities are market-implied odds, not forecasts. Bare size and volume are shares; *_usdc fields are USD. Null is unavailable, never zero; outcome_index 999 is unknown. Preserve source URLs and observation times; retrievedAt is retrieval time, not source freshness.
- If presentation.partial is true, fetch a focused result by the returned id or slug, or lower the limit.
- Wallet positions, trades, holders, PnL, leaderboards, volume, resolutions and research use polymarket-data tools; load that skill only if its tools are missing.
