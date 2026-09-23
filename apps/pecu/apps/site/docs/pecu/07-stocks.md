---
title: Stocks
description: Check, buy, sell and rebalance tokenized stocks on Base, in chat or in the Aero Stocks web app.
group: Use
---

Pecu trades tokenized stocks on Base through Aerodrome, paying and receiving USDC. The stocks are tokens held in your wallet. Their prices come from swap quotes for one token, not from a stock exchange.

## Supported stocks

| Symbol | Company |
| --- | --- |
| `NVDAc` | NVIDIA |
| `AAPLc` | Apple |
| `GOOGLc` | Alphabet |
| `METAc` | Meta |
| `AMZNc` | Amazon |
| `MSFTc` | Microsoft |
| `TSLAc` | Tesla |
| `MSTRc` | Strategy |
| `SNDKc` | Sandisk |
| `SPCXc` | SpaceX |

You can also write a symbol without the final `c`, such as `NVDA`, or use the token address. `/aero stocks` shows the current list with prices.

## See your holdings

```text
/stocks
```

"Show my stocks" and "Which stocks do I own?" work too. In X Chat you get each stock with its price in USDC and your balance. The web app adds a pie chart by estimated USDC value. Holdings without a price stay in the list but are left out of the chart.

`/aero stocks` reads the same data. A price shows as unavailable when no quote can be found.

## Buy and sell

A buy amount is the USDC you spend. A sell amount is the number of stock tokens you sell.

```text
/aero stock-buy --stock NVDAc --amount 10
/aero stock-sell --stock NVDAc --amount 0.01
```

You can also ask "Buy $10 of NVIDIA". Pecu checks your balance before it builds the preview. Each preview shows what you pay, about what you receive and the minimum you accept. Slippage defaults to 1%, and `--slippage 0.005` sets a tighter 0.5%.

### Several trades at once

Ask for up to eight buys and sells in one message, such as "Buy $5 of NVDAc and $5 of AAPLc". Pecu combines them into one basket preview with one code and one confirmation, listing each trade with its own minimum. This works in plain words only. There is no slash command for it.

## Rebalance to target weights

```text
/aero index-rebalance --allocations NVDAc=50,AAPLc=30,TSLAc=20 --cash 10
```

- Weights are `SYMBOL=percent` pairs that total 100, each with up to two decimals.
- `--cash` adds that much USDC to the rebalance. It defaults to 0.
- Pecu previews the sells and buys needed to reach the weights. If you already match them, it replies `Your index already matches these allocations. No transaction plan was created.`

## Not enough USDC

If a stock purchase needs more USDC than you have, Pecu stops and asks what to do. It shows your balances and offers your funded ETH or AERO, Deposit USDC, or Cancel. Other tokens are not offered, because the balance check covers only ETH, USDC and AERO.

- Choosing a token does not buy anything. Pecu quotes a swap to USDC, keeps ETH aside for fees and shows a swap preview.
- That swap preview needs your confirmation, even with YOLO on.
- After the swap is confirmed, Pecu checks your USDC again and prepares the stock purchase as its own preview.

## Aero Stocks in the browser

Aero Stocks is at pecu.app/stocks. Sign in with Google or with the X account you use with Pecu. It uses the same wallet and agent as the [web agent](/docs/pecu/web-agent).

- The Market tab lists every stock with its price in USDC and how much you hold. Search by name or symbol.
- The Holdings tab shows only what you hold, with the pie chart. Refresh reloads prices and your holdings.
- The trade panel has Buy, Sell and Basket tabs. Buy and Sell send the matching `/aero stock-buy` or `/aero stock-sell` command, and the preview appears in the chat panel.
- In Basket, set a weight for each stock until the total reaches 100%, optionally add USDC, then press Preview rebalance. Save basket stores the weights on your account so you can load them later.
- The chat panel is the same agent. Its conversation is the thread called First conversation in pecu.app/agent.
