# Polymarket showcase and chat cards

Live at [pecu.app/polymarket-showcase](https://pecu.app/polymarket-showcase) since 23 September 2026.

## Showcase

The page follows the Nansen showcase: four sections, a list of examples, the cards, and a prompt to copy into Pecu.

- Market odds: 8 markets with every outcome's odds, 24h volume, liquidity and a month of price history for the leading outcome.
- Order books: 6 liquid markets with midpoint, spread, last trade and eight levels of bids and asks.
- Top traders: weekly, monthly and all-time profit boards, weekly volume, and the week's biggest winning positions.
- Trader profiles: 5 public wallets from the profit leaderboard, with cumulative P&L over the month and open positions.

The data is saved from 48 free public reads. Switching examples makes no request. `bun scripts/polymarket/showcase.ts` refreshes it.

## Chat cards

The showcase and chat use the same cards and the same card builder. In Agent and Stocks chat, these Polymarket reads now attach a card: markets, events, search, price history, order books, leaderboards, biggest wins, user P&L and user positions. X Chat gets the same content as text. A direct `/polymarket read` command whose only output is one card shows just the card.

Odds show as percentages, books in cents per share and sizes in shares. Missing prices stay unavailable, and a read with more pages says so.

## Verification

- 418 backend and 57 frontend tests pass, including new tests for every card type, sparse and malformed responses, and cards attached by both commands and model tool calls.
- Typecheck, design check, lint and all builds pass.
- Headless Chrome: all four sections at 1440px and 390px with no horizontal overflow, chat cards in the Agent fixture, and the production page after deploy.
- The live chat card was not clicked through in production because your browser was in use.

Screenshots of chat use saved public data.

## Shipped

Commit `9e6ed3df` on `main`, not pushed. Deployed `basedbot`, `aero-stocks` and `pecu-app` from that commit.

Another agent's docs-site work was uncommitted in the same files. It was left out of the commit and the deploys.
