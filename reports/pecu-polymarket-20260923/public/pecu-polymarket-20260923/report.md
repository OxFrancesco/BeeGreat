# Polymarket in Pecu

Implemented 52 direct public read tools using Effect v4. No API key is required.

| API | Coverage |
| --- | --- |
| Data API v2 | All 20 reads: positions, activity, trades, holders, portfolio value, PnL, volume, rankings, combos, approvals and resolution state |
| Gamma | 19 reads: search, events, markets, tags, series, sports, teams and public profiles |
| CLOB | 13 reads: books, prices, midpoint, spread, last trades, fees, tick sizes, market details, rewards and server time |

`/polymarket QUESTION` now searches directly. `/polymarket help` lists available
reads. The shared agent tools work through both ChatGPT and OpenRouter capability
paths. Optional Exa research is selected explicitly with `/polymarket research`.

Requests validate inputs and responses, preserve pagination filters, retry
transient failures at most twice and stop after 20 seconds. Responses include
source URLs and retrieval timestamps. Missing data stays unavailable. Polymarket
wallets are supplied explicitly; Pecu does not infer them from its Base wallet.

Validation passed for 52 live public endpoints and six pagination checks. The
package suite passed across the initial run and the four Workerd tests rerun with
local-port access. The final focused run passed 72 tests. Type checking and all
four Worker dry-run builds passed.

Live CLOB prices arrive as decimal strings and midpoint uses `mid`, differing from
the published specification. The integration accepts those observed shapes and
the documented shapes, with regression coverage.

The changes are local. The production agent has not been deployed or tested in a
live model-selected chat session. No trading tools were added and no funds moved.

[Implementation task](https://linear.app/francesco-oddo/issue/FRA-555/implement-this-better-in-pecu)
· [Official Data API v2](https://docs.polymarket.com/api-reference/data-api/overview)
