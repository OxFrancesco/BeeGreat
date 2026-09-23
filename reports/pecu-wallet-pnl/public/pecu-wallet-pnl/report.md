# Wallet P&L on Pecu Agent

Live on [pecu.app/agent](https://pecu.app/agent) since 23 September 2026.

- Hovering the wallet address opens a card with the last 30 days of Base trading P&L: total, realized, unrealized and the three largest movers.
- Clicking the address opens a full page at `#pnl` with 7D, 30D, 90D and 1Y. It shows the total, a realized/unrealized split, bars for the eight largest movers and every token.
- Back, Escape and browser Back close it. Basescan moved from the address to the page header.
- On phones, a tap opens the page directly. The token table keeps Token and Total and puts realized and unrealized under the total.

## Data

The Durable Object reads Nansen `profiler/address/pnl` for the signed-in sender's own wallet on Base. Neither the browser nor the model picks the address. Each wallet and period is cached for ten minutes, so hovering again does not spend a credit. If a refresh fails, the last read comes back with its original time. Tokens Nansen cannot price stay visible as Unavailable and are left out of the totals, with a note saying how many.

## Verification

- 414 backend and 54 frontend tests pass, including a new cache test (one read per wallet and period, shared by concurrent opens, stale fallback, no chat history) and a browser test for `#pnl`.
- Typecheck, design check and the Worker dry-run builds pass.
- Headless Chrome against a fixture: hover, click, period switch, Escape, Back, keyboard focus, focus return and a 390px phone with no horizontal overflow.
- Production, on your account: the page opened from the address, 30D and 1Y loaded real Nansen data (+$0.32 on Base), and Back returned to the chat. No funds moved.

Screenshots and the video use fictional fixture data.

## Shipped

Commits on `main`, not pushed:

- `061e8cfa` Aero tile palette and animated mark (another agent's uncommitted work)
- `d6f2139c` Polymarket public reads (another agent's uncommitted work)
- `5ded96f7` wallet P&L
- `41ae8e88` "last year" label for 1Y

Deployed: `basedbot`, `aero-stocks`, `pecu-app`. The Codex, EVM and Aero workers had no changes.

The Stocks page still links its address to Basescan. It uses the separate Aero Stocks design, so it was left alone.
