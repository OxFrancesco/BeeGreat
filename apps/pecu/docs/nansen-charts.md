# Pecu Nansen charts

Pecu renders three saved Nansen snapshots in Agent and Stocks chat:

- Token flows: signed USD bars by cohort; `/nansen flows TOKEN [chain] [timeframe]`.
- Trading P&L: realized/unrealized token gains and losses; `/nansen pnl [ADDRESS] [chain]` (30 days by default).
- Portfolio exposure: wallet allocation and separate DeFi assets, debt, net value and rewards; `/nansen portfolio [ADDRESS]`.

Natural-language portfolio and P&L requests use the same tools. Explicit stock holdings requests keep the existing stock chart. Tool calls work through shared inference and connected ChatGPT paths. Each result stores a typed snapshot under its originating event and chart key. Saved replies and history retain the original observation; switching chart tabs makes no network request.

## Wallet P&L on the Agent page

Hovering the wallet address on `/agent` previews the last 30 days of Base trading P&L. Clicking it opens the full page at `#pnl` with 7-day, 30-day, 90-day and 1-year periods. Both read `GET /stocks/api/pnl?days=N`, which calls the `pnl` operation on `StocksGateway`. The Durable Object reads `wallet_pnl_breakdown` for the signed-in sender's own stored wallet on Base. Neither the browser nor the agent chooses the address.

Each wallet and period is cached in the `basedbot_web_pnl` table for ten minutes, so one Nansen read serves every hover and reopen in that window, and concurrent opens share one read. If a refresh fails, the last read comes back with its original retrieval time. With no read to fall back on, Nansen's own message is shown with a retry control. The browser reuses a response for one minute. These reads never create chat turns or saved analytics events. X Chat keeps `/nansen pnl` as its equivalent.

## Data and interpretation

Adapters validate documented Nansen responses before creating snapshots. P&L and balances request up to 1,000 rows and flag incomplete pagination. Missing values stay null. A failed portfolio source leaves the other source visible. Wallet token balances and DeFi positions are never added because receipt tokens can overlap. Cohorts can overlap, and transfers do not establish a buy or sell. Exchange and fresh-wallet counts are suppressed because Nansen does not track those counts in this endpoint.

Canvas charts use Dither Kit; exact rows, details and controls remain accessible HTML. Bars show up to eight largest amounts by magnitude. Allocation pies group amounts beyond the five largest as Other assets, with the full returned list expandable. No trade execution is attached.

## Surfaces

Pecu Agent and Stocks chat share one renderer. X Chat gets a source-attributed text summary, capped to 12 tokens/positions per section. Existing persisted reply text remains available. BeeGreat Expo, Android, CLI, iMessage, voice and Hive do not host Pecu and are outside this feature. No wire contract is forked between the two web clients.

## Verification and release

Documented fixtures cover gains/losses, null versus zero, partial pagination, portfolio source failure, saved-event isolation and provider tool calls. Browser specimens include all three charts plus missing, empty and unavailable states. The report demo uses fictional data.

Production stores NANSEN_API_KEY as a Worker secret. Collection scripts read it from the environment; credentials and raw responses are excluded from Git. Fixture tests do not prove live upstream responses; release verification must include read-only requests through the deployed app.

Sources: [flow intelligence](https://docs.nansen.ai/api/token-god-mode/flow-intelligence), [Nansen API](https://docs.nansen.ai/), [redistribution guidance](https://docs.nansen.ai/guides/redistribution-guide).

## Public showcase and collection

[pecu.app/nansen-showcase](https://pecu.app/nansen-showcase) presents saved token flows, wallet P&L and portfolio exposure. Each example includes a prompt that can be copied into Pecu. Switching examples or chart measures makes no Nansen request. The page labels illustrative data when used; collected snapshots retain their source and retrieval time.

The site build bundles the shared chart renderer and `apps/stocks/showcase/data.json`. Only selected normalized snapshots are published. Raw responses remain in the ignored `output/nansen-showcase` directory.

Run the collector from `apps/pecu`, with NANSEN_API_KEY in the environment and an absolute output directory:

```sh
bun scripts/nansen/collect.ts /path/to/BeeGreat/output/nansen-showcase
bun scripts/nansen/export.ts /path/to/BeeGreat/output/nansen-showcase
```

The batch plans 1,000 requests: 10 screeners, five reads for each of 150 tokens, and four reads for each of 60 public trader wallets. It covers Base, Ethereum, Arbitrum, Optimism and Polygon. Calls are paced, logged and capped at 1,000 requests and credits. Authentication, billing, rate-limit, unexpected cost and network errors stop collection. There are no automatic retries. Completed jobs are reused on restart; an unfinished ledger entry requires inspection before resuming. Export requires all three example categories.

The public site is the only deployment target for showcase changes. Agent/Stocks use the same chart component; the showcase introduces no chat, provider, transaction or mobile behavior.

The showcase header uses the shared button component with explicit padding and a 44px target. Below 900px, examples move into a select control; phone analysis tabs share three columns. The shared Dither X axis limits label density to the available plot width. Responsive checks cover all 27 examples at 320px and all three categories at 390, 768, 900, 1024, 1280 and 1536px.
