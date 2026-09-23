---
title: Analytics and markets
description: Read-only Nansen analytics, public Polymarket odds and research, and Aave rates, positions and previews.
group: Use
---

## Nansen

Nansen answers on-chain questions about tokens, wallets and prediction markets. It is read-only, and every Nansen reply ends with `Data: Nansen (nansen.ai)`.

| Command | Returns |
| --- | --- |
| `/nansen token 0xTOKEN [chain] [timeframe]` | Price, market cap, FDV, liquidity, volume with the buy and sell split, trades, traders and holders. |
| `/nansen flows 0xTOKEN [chain] [timeframe]` | Net inflows and outflows by holder group, such as whales, smart traders, exchanges and fresh wallets. |
| `/nansen wallet [0xADDRESS] [chain]` | Token balances for an address. |
| `/nansen pnl [0xADDRESS] [chain]` | Realized and unrealized profit and loss by token over the last 30 days. |
| `/nansen portfolio [0xADDRESS]` | Wallet tokens across chains, plus DeFi positions including debt. |
| `/nansen markets [words]` | Active Polymarket markets ranked by 24-hour volume, filtered by your words. |

- Without an address, the wallet commands use your Pecu wallet.
- The chain defaults to `base`. Others include `ethereum`, `arbitrum`, `optimism`, `polygon`, `bnb` and `solana`.
- `token` and `flows` take a timeframe of `5m`, `1h`, `6h`, `12h`, `1d` or `7d`. The default is `1d`.
- The chain and timeframe can come in either order after the token.

Plain words work for more, such as "Who is buying AERO on Base today?" or "Show my wallet PnL for the last 30 days". The agent can also look up who bought or sold a token, transfers, DEX trades, a token screener, price candles, wallet transactions, counterparties and related wallets, plus Polymarket order books, trades, holders and P&L through Nansen.

### Charts

In the web app, flows, P&L and portfolio replies come with a chart. In X Chat you get a text summary of up to 12 rows per section. Portfolio replies keep wallet tokens and DeFi positions apart and never add them together, because receipt tokens can be counted in both.

### What is not available

Address labels, smart money lists, P&L leaderboards and token holder lists are not available in Pecu. Nansen replies report what the data shows. They are not financial advice or predictions.

## Polymarket

Pecu reads public Polymarket data directly. No account or API key is needed, and nothing can be bet, signed or bridged.

```text
/polymarket What are the odds of a Fed rate cut?
/polymarket help
/polymarket read markets {"closed":false,"limit":5}
/polymarket read leaderboard {"time_period":"week","limit":5}
```

- `/polymarket QUESTION` searches Polymarket and returns up to five matches of each kind.
- `/polymarket help` lists every read you can call by name.
- `/polymarket read ENDPOINT JSON` runs one read with JSON arguments. Pecu checks the arguments before it calls Polymarket, and limits cannot go above 100.
- `/polymarket read status {}` shows how far behind Polymarket's data feed is.
- Replies describe prices as market-implied odds and include the source and the time Pecu retrieved the data. Missing values are shown as unavailable, never as zero.
- Wallet reads need your Polymarket wallet address. Pecu does not assume your Base wallet holds Polymarket positions.

Ask in plain words about markets, prices, order books, price history, positions, activity, holders, rankings, sports or rewards.

### Deeper research

```text
/polymarket research Compare Fed market probabilities
/polymarket status
```

`/polymarket research QUESTION` starts an optional research run through Exa, a paid search service, and can take a while. `/polymarket status` returns the result of your latest run without starting another. Pecu only uses Exa when you use this command or ask for deeper research in plain words.

## Aave

Ask about Aave in plain words. `/aave help` shows examples.

```text
Check my Aave positions
Preview supplying 0.000001 ETH to Aave on Base
```

- Reads cover rates, markets, your positions, account history, yield analysis and ways to reduce debt. They can compare chains.
- Pecu previews supply, borrow, withdraw and repay, all on Aave v3 on Base. `max` works for withdraw and repay.
- Before each preview, Pecu checks the market, your account and the reserve, then runs Aave's simulation. An error from those checks stops the preview. Other warnings are shown in it.
- If a token approval is needed first, it gets its own preview. After you confirm it, ask Pecu to continue with the supply or repayment.
- Aave previews follow the same confirmation and YOLO rules as every other transaction.
- Signed orders, liquidations and other Aave actions are not available.

Aave reads and previews send your wallet address to Aave's public service.
