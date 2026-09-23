# Polymarket in Pecu

Pecu has 52 public Polymarket read tools. Gamma supplies market discovery, CLOB
supplies pricing and orderbooks, and Data API v2 supplies portfolios and analytics.
These reads require no API key. Exa research and Nansen analytics remain separate.

## Use

Ask Pecu in ordinary language. The agent discovers the market and uses its returned
identifiers for subsequent reads. `/polymarket QUESTION` performs direct search.
`/polymarket help` lists endpoint names. Advanced callers can use:

```text
/polymarket read markets {"closed":false,"limit":5}
/polymarket read leaderboard {"time_period":"week","limit":5}
/polymarket read status {}
```

`/polymarket research QUESTION` explicitly starts optional paid Exa research.
`/polymarket status` preserves the old saved-research status behavior; use the
`status` read above for Data API freshness. Exa alone requires `EXA_API_KEY`.

For wallet reads, supply the actual Polymarket proxy/deposit wallet. Pecu does not
substitute its Base smart wallet. Polymarket tools never sign, place or cancel
orders, submit approvals, redeem positions, or bridge funds.

## Runtime

`src/integrations/polymarket/catalog.generated.ts` owns names, input schemas,
allowed paths, response codecs and pagination modes. Both the agent's OpenCode
tool registrations and explicit commands use this catalog. The same capability
crosses the per-user inference RPC bridge for ChatGPT and OpenRouter.

`client.ts` provides the `Polymarket` Effect service and layer. `readEndpoint`
also preserves the endpoint-specific response type for TypeScript callers. The
Promise adapter exists at Pecu's existing agent boundary. The implementation uses
the pinned Effect `4.0.0-rc.115`, whose schema-backed error API is named
`Schema.TaggedError`. The newer skill spelling `TaggedErrorClass` is not available
in that installed release.

Inputs reject unknown properties and invalid wallet/token identifiers. Market
positions, resolution selectors, mutually exclusive history windows and date
ranges have additional checks before HTTP. Every outbound request is GET to one
of the three fixed official hosts. Effect HttpClient validates responses with
Effect Schema. Transient transport errors and HTTP 408/429/500/502/503/504 retry
at most twice, with exponential delay respecting numeric Retry-After headers.
The complete request, retries and body decoding share a 20-second deadline;
interruption aborts fetch. Schema and input errors are not retried.

Each successful result includes `endpoint`, `source`, `observedAt`, decoded `data`
and `next`. `observedAt` means retrieval time. Data API timestamps and the status
endpoint expose the upstream observation/ingestion state. No source freshness is
inferred from retrieval time.

Data API v2 uses snake_case fields and `data` envelopes. Its continuation preserves
all supplied filters and opaque cursors, including after empty pages. Gamma
keyset reads use `after_cursor`, CLOB paged reads use `next_cursor`, and Gamma
search uses page numbers. Offset-based Gamma lists offer another page when full;
that continuation is a candidate and can return an empty terminal page. Default
page sizes are bounded; agent-supplied limit values cannot exceed 100.

Missing or null values remain unavailable. Bare size/volume is shares, while
`*_usdc` is USD. `outcome_index: 999` is an unknown outcome. Agent replies preserve
sources, describe prices as market-implied odds, and must not claim a complete
portfolio from one page. Commands render text; full data stays in `b/verbose`.

## Cards

Thirteen reads also produce a typed card in the shared analytics contract
(`apps/pecu/src/analytics-contract.ts`), next to the Nansen charts:

| Card | Reads |
| --- | --- |
| Odds | `market`, `market_by_slug`, `event`, `event_by_slug` |
| Market list | `markets`, `events`, `search` |
| Price history | `prices_history` |
| Order book | `book` |
| Leaderboard | `leaderboard` without `user` |
| Biggest wins | `biggest_winners` |
| Trader P&L | `user_pnl` |
| Positions | `positions` with `user` |

`src/integrations/polymarket/analytics.ts` builds the card from the decoded read.
Prices outside 0 to 1 and unparseable values stay unavailable. A read with a next
page is marked partial. The agent saves the card under the turn, so direct
commands and model tool calls both attach it, and replayed turns keep the saved
observation. A direct command whose only output is one card shows the card alone.

Pecu Agent and Stocks chat render cards with `PolymarketCard`
(`apps/pecu/apps/stocks/src/components/polymarket-cards.tsx`) through the shared
`AnalyticsCard`. Price history and trader P&L use the Dither Kit area chart; odds
and order books use plain HTML bars. Every card links its source and retrieval
time. X Chat gets the card's text summary, capped at 12 rows and ending with
`Data: Polymarket (polymarket.com)`.

## Showcase

[pecu.app/polymarket-showcase](https://pecu.app/polymarket-showcase) shows saved
cards in four sections: market odds, order books, top traders and trader
profiles. Each example has a prompt to copy into Pecu for the live version.
Switching examples makes no Polymarket request.

The page lives in `apps/pecu/apps/stocks/polymarket-showcase` and builds into the
site with the Nansen showcase. Refresh its data from `apps/pecu` with
`bun scripts/polymarket/showcase.ts`. The script makes about 50 public reads,
runs them through the same card builder, validates the result and writes
`data.json`. Profiles use public wallets from Polymarket's profit leaderboard.


## API coverage

| Tool | API route |
| --- | --- |
| `polymarket_activity` | data `/v2/activity` |
| `polymarket_activity_combos` | data `/v2/activity/combos` |
| `polymarket_approvals` | data `/v2/approvals` |
| `polymarket_biggest_winners` | data `/v2/biggest-winners` |
| `polymarket_builders_leaderboard` | data `/v2/builders/leaderboard` |
| `polymarket_builders_volume` | data `/v2/builders/volume` |
| `polymarket_holders` | data `/v2/holders` |
| `polymarket_leaderboard` | data `/v2/leaderboard` |
| `polymarket_live_volume` | data `/v2/live-volume` |
| `polymarket_oi` | data `/v2/oi` |
| `polymarket_positions` | data `/v2/positions` |
| `polymarket_positions_combos` | data `/v2/positions/combos` |
| `polymarket_prices_history` | data `/v2/prices-history` |
| `polymarket_resolutions` | data `/v2/resolutions` |
| `polymarket_status` | data `/v2/status` |
| `polymarket_trades` | data `/v2/trades` |
| `polymarket_user_pnl` | data `/v2/user-pnl` |
| `polymarket_user_stats` | data `/v2/user-stats` |
| `polymarket_user_volume` | data `/v2/user-volume` |
| `polymarket_value` | data `/v2/value` |
| `polymarket_search` | gamma `/public-search` |
| `polymarket_events` | gamma `/events/keyset` |
| `polymarket_markets` | gamma `/markets/keyset` |
| `polymarket_event` | gamma `/events/{id}` |
| `polymarket_event_by_slug` | gamma `/events/slug/{slug}` |
| `polymarket_market` | gamma `/markets/{id}` |
| `polymarket_market_by_slug` | gamma `/markets/slug/{slug}` |
| `polymarket_tags` | gamma `/tags` |
| `polymarket_tag` | gamma `/tags/{id}` |
| `polymarket_tag_by_slug` | gamma `/tags/slug/{slug}` |
| `polymarket_event_tags` | gamma `/events/{id}/tags` |
| `polymarket_market_tags` | gamma `/markets/{id}/tags` |
| `polymarket_related_tags` | gamma `/tags/{id}/related-tags/tags` |
| `polymarket_series` | gamma `/series` |
| `polymarket_series_detail` | gamma `/series/{id}` |
| `polymarket_sports` | gamma `/sports` |
| `polymarket_sports_market_types` | gamma `/sports/market-types` |
| `polymarket_teams` | gamma `/teams` |
| `polymarket_profile` | gamma `/public-profile` |
| `polymarket_book` | clob `/book` |
| `polymarket_price` | clob `/price` |
| `polymarket_midpoint` | clob `/midpoint` |
| `polymarket_spread` | clob `/spread` |
| `polymarket_last_trade_price` | clob `/last-trade-price` |
| `polymarket_fee_rate` | clob `/fee-rate` |
| `polymarket_tick_size` | clob `/tick-size` |
| `polymarket_negative_risk` | clob `/neg-risk` |
| `polymarket_clob_market` | clob `/clob-markets/{condition_id}` |
| `polymarket_market_by_token` | clob `/markets-by-token/{token_id}` |
| `polymarket_rewards` | clob `/rewards/markets/current` |
| `polymarket_market_rewards` | clob `/rewards/markets/{condition_id}` |
| `polymarket_server_time` | clob `/time` |

## Updating contracts

The official OpenAPI snapshots live in `apps/pecu/scripts/polymarket/specs`.
`sources.json` records URLs, hashes and the inspected official SDK revision.
Regenerate with `bun apps/pecu/scripts/polymarket/generate.mjs` from the monorepo
root. Re-fetch specs deliberately, inspect the diff, regenerate and reverify.
The SDK reference is `resources/polymarket`, managed by codeview.

The 2026-09-23 live checks found two CLOB documentation mismatches. `/price`
returns a decimal string where the spec says number. `/midpoint` returns `mid`
where the spec says `mid_price`. The generator accepts those observed shapes
alongside the documented ones. Tests reject nonnumeric price strings. Gamma
codecs also require event/market identity and keyset list fields that its spec
marks optional. Other contracts follow the snapshots.

## Verification and release boundary

On 2026-09-23, all 52 public endpoints passed live response validation. Six next-page
checks passed for markets, events, trades, positions, leaderboard and history.
These are public API adapter checks, not a live model-selected chat session.

Run `bun apps/pecu/scripts/verify-polymarket.ts /tmp/polymarket-evidence` for the
read-only live check. It uses a public example wallet from Polymarket's docs,
discovers a market/event, writes local evidence, and never requests credentials.
Pass endpoint names after the output directory to recheck individual reads.

Unit tests cover invalid identifiers and selectors, empty-page continuations,
filter preservation, null versus missing data, documented/live CLOB contracts,
retry bounds, Retry-After pacing, cancellation, command routing and event replay.
The inference bridge test exercises the capability under both provider selections
and verifies that explanation-only turns cannot invoke it.

Pecu's web and X Chat entry points share this agent. Web renders cards; X Chat
gets their text. BeeGreat's separate Expo, Android, web twin, CLI and iMessage agent
are not Pecu clients and were not changed. No wire contracts in Convex, wallet
lifecycle or generative-UI contracts were added. Cards need the Pecu Worker (agent
and per-user inference tools), then the Stocks app. The showcase deploys with the
pecu.app site.
