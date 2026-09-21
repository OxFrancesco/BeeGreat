# Stock holdings chart

`/stocks`, `/aero stocks`, and common ownership questions read the sender's
stock tokens on Base. Other natural-language requests use the same tool through
either inference provider. The read resolves the stock catalog in one `tokens`
contract call and prices it with the Sugar price oracle, two RPC calls in
total. Oracle prices were measured within about 0.25 percent of a one-unit
quoter price. The stock tool saves validated data and observation
time per incoming event in both SQLite stores. Web replies carry this snapshot;
history and request replays retain it. Unrelated replies cannot reuse a previous
turn's chart. Successful reads also update the Stocks holdings cache.

Pecu chat, Stocks chat, and the Holdings tab render Dither Kit's pie chart.
Slices represent estimated USDC value, not share count. Only positive holdings
with finite prices enter the pie. The accessible list keeps unpriced holdings,
quantities, values, and percentages. Unknown balances produce a partial-data
notice. Empty wallets have no pie. Entrance animation and bloom are off.
Direct stock replies show the chart and list without repeating the catalog.
Model explanations remain visible. Text channels retain the existing stock text.

The React component supports desktop and mobile browser widths. BeeGreat's
separate Expo, Kotlin, CLI, and iMessage clients do not host Pecu chat and need
no changes. X Chat stays plain text. No transaction path or SDK changed.

Upstream core and pie-chart 0.1.0 are vendored under
`apps/stocks/src/components/dither-kit`, with provenance in `NOTICE.md`.
D3 scale and shape packages are installed through Bun. See
https://www.tripwire.sh/dither-kit for the upstream API.

Verification uses synthetic holdings. It does not prove a live wallet lookup
or production deployment, and moves no funds.

Generic crypto portfolio requests now use Nansen analytics. Explicit stock holdings requests retain this stock chart. See [Nansen charts](nansen-charts.md).
