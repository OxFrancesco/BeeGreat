# Pecu Nansen charts

Pecu renders three saved Nansen snapshots in Agent and Stocks chat:

- Token flows: signed USD bars by cohort; `/nansen flows TOKEN [chain] [timeframe]`.
- Trading P&L: realized/unrealized token gains and losses; `/nansen pnl [ADDRESS] [chain]` (30 days by default).
- Portfolio exposure: wallet allocation and separate DeFi assets, debt, net value and rewards; `/nansen portfolio [ADDRESS]`.

Natural-language portfolio and P&L requests use the same tools. Explicit stock holdings requests keep the existing stock chart. Tool calls work through shared inference and connected ChatGPT paths. Each result stores a typed snapshot under its originating event and chart key. Saved replies and history retain the original observation; switching chart tabs makes no network request.

## Data and interpretation

Adapters validate documented Nansen responses before creating snapshots. P&L and balances request up to 1,000 rows and flag incomplete pagination. Missing values stay null. A failed portfolio source leaves the other source visible. Wallet token balances and DeFi positions are never added because receipt tokens can overlap. Cohorts can overlap, and transfers do not establish a buy or sell. Exchange and fresh-wallet counts are suppressed because Nansen does not track those counts in this endpoint.

Canvas charts use Dither Kit; exact rows, details and controls remain accessible HTML. Bars show up to eight largest amounts by magnitude. Allocation pies group amounts beyond the five largest as Other assets, with the full returned list expandable. No trade execution is attached.

## Surfaces

Pecu Agent and Stocks chat share one renderer. X Chat gets a source-attributed text summary, capped to 12 tokens/positions per section. Existing persisted reply text remains available. BeeGreat Expo, Android, CLI, iMessage, voice and Hive do not host Pecu and are outside this feature. No wire contract is forked between the two web clients.

## Verification and release

Documented fixtures cover gains/losses, null versus zero, partial pagination, portfolio source failure, saved-event isolation and provider tool calls. Browser specimens include all three charts plus missing, empty and unavailable states. The report demo uses fictional data.

The local checkout has no NANSEN_API_KEY. Live upstream responses and production deployment are not verified by fixture tests. Set the key in the intended environment and check a read-only Nansen request before releasing the app. This work does not deploy Pecu production.

Sources: [flow intelligence](https://docs.nansen.ai/api/token-god-mode/flow-intelligence), [Nansen API](https://docs.nansen.ai/), [redistribution guidance](https://docs.nansen.ai/guides/redistribution-guide).
