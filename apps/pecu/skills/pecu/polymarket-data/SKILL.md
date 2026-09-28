---
name: pecu-polymarket-data
description: Polymarket wallet positions, activity, trades, holders, PnL, leaderboards, volume, open interest, resolutions, tags, sports, rewards and explicit Exa research.
tools: ["polymarket_*"]
triggers: '(?=[\s\S]*\bpolymarket\b)[\s\S]*\b(leaderboards?|holders?|positions?|trades?|traders?|pnl|p&l|profit|volume|activity|winners?|open interest|resolutions?|resolved|tags?|series|sports?|teams?|profiles?|rewards?|research|proxy|rank\w*|0x[0-9a-f]{40})\b'
---

# Polymarket accounts and research

These are public reads with no API key. They cannot trade, sign, approve or bridge.

- Portfolio reads need the user's Polymarket proxy or deposit wallet. Ask for it; never assume the Base Pecu wallet owns Polygon positions.
- Discover exact event, market, condition and outcome token identifiers before account or market reads, and never substitute one type for another.
- Data API v2 tools cover positions, activity, trades, holders, PnL, volume, rankings and resolution. Time windows are epoch seconds. polymarket_status shows ingestion lag.
- Pagination: pass the returned next.endpoint and next.input unchanged, keeping filters and cursor. One page is not a whole portfolio or history, and an empty or short page can still continue. Prefer small limits. Report an API error as unavailable data.
- Selected event, leaderboard, biggest winners, user PnL and user positions reads attach verified cards. Explain the main finding without repeating every row.
- Bare size and volume are shares; *_usdc fields are USD. Null is unavailable, never zero. Probabilities are market-implied odds, not forecasts.
- polymarket_research runs paid Exa research. Use it only when the user explicitly asks for deeper research or synthesis. Omit query to check the saved run without starting another.
