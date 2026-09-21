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

Production release verified on 2026-09-21. The Worker has NANSEN_API_KEY configured. Read-only portfolio, DeFi, P&L and USDC cohort-flow requests returned live data in the signed-in Pecu Agent. Chart controls worked and snapshots survived leaving and reopening the thread. No funds moved. The demo above remains fictional data.

Sources: [flow intelligence](https://docs.nansen.ai/api/token-god-mode/flow-intelligence), [Nansen API](https://docs.nansen.ai/), [redistribution guidance](https://docs.nansen.ai/guides/redistribution-guide).

## Release evidence

- Source commit: fa1819d078ab5d2d9464c20404c94e8140a1d126, pushed to GitHub main.
- Backend: 90d32f89-10a5-40bd-b704-af5f16ddde32.
- Agent/Stocks frontend: 6a25981e-f66d-4faf-a831-6e8903258f67.
- Pecu site: 6648784c-5009-4fde-896c-c68169ecbc8b.
- 360 backend tests and 49 frontend tests passed. Backend, frontend and site typechecks, design checks, frontend/site builds and four Worker dry-run builds passed. Staged secret scan passed.
- Production backend health returned ok and Nansen configured. Both deployed backend and frontend versions were read back. The live design page contains the chart reference.
- The Agent browser path was verified with live data. Stocks chat shares its renderer but was not separately exercised with live data. X Chat text fallback and provider tool paths were covered by tests.

## Public showcase — 2026-09-21

[Open the showcase](https://pecu.app/nansen-showcase). It includes 15 token-flow, six trading P&L and six wallet/DeFi examples, drawn from saved Nansen responses. Charts lead; copyable prompts follow. Desktop uses an example list and mobile uses a select control.

The collection completed exactly 1,000 requests, all HTTP 200, using 1,000 credits. It covers 150 tokens on five chains and 60 public wallets discovered in DEX trades. Raw responses and the request ledger remain local and ignored by Git. Credentials are stored in macOS Keychain and excluded from code and output. No funds moved.

Source: 916fa82, with layout refinement 7bc14e5. Both pushed to GitHub main. Backend, frontend and site typechecks passed, along with frontend/site builds, design lint, 21 focused backend tests and two chart rendering tests. Collector tests verify the 1,000-request ceiling, resumability and stopping on authentication or unexpected-cost errors.

Browser checks covered all three categories, realized/unrealized P&L, wallet/DeFi selection, expanded rows, prompt copying and mobile selection without horizontal overflow. The public site is the only deployment target; existing chat deployments were unchanged.

Final site version: 6162dbbf-966d-47f9-b6c1-1f8141a1a36a. The live public URL rendered all three categories and measure controls. Browser recording returned no frames on the final pass; the attached video is a screenshot walkthrough of the deployed views.

## Responsive refinement

The header link now uses the shared button component, explicit 14px type, horizontal padding and a 44px touch target. Analysis tabs use quiet selection states. At phone widths they share three columns; up to 900px the example list becomes a select control. Long amounts and addresses wrap. Dither X-axis labels fit the plot width, shared by the showcase, Agent and Stocks.

Source b921359. All 27 examples passed a 320px sweep, and the three analysis categories passed at 390, 768, 900, 1024, 1280 and 1536px. Measurements found no page overflow or overlapping axis labels. All visible controls met the 44px target within subpixel rounding. Typechecks, design lint, both builds and 50 frontend tests passed. The data collection was not rerun.

Responsive release: site 86a8f56b-19ad-42d4-9206-85fb620f6012; Agent/Stocks 745b056d-15d9-4fa9-b6cf-9f6dec774a5f. Production mobile widths were rechecked and Open Pecu reached the authenticated Agent page.
