---
title: Stocks and indices
description: Buy and sell tokenized stocks on Base with USDC, save target weights as a local index and rebalance your holdings toward them in one transaction.
group: CLI
---

## Stocks

Aero trades ten tokenized stocks on Base, chain 8453, against USDC at `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`. Every stock command fails on other chains with "Tokenized stocks are available on Base only, chain 8453".

| Symbol | Company | Token address |
| --- | --- | --- |
| NVDAc | NVIDIA | `0xb20000000000000000000078ee7ce2fe4908108c` |
| AAPLc | Apple | `0xb200000000000000000000c2e324d24d7eecd1fb` |
| GOOGLc | Alphabet | `0xb2000000000000000000002d0ba3164cc74f58b7` |
| METAc | Meta | `0xb2000000000000000000008bc8786b856e61707c` |
| AMZNc | Amazon | `0xb200000000000000000000d9192b6b456483c2e8` |
| MSFTc | Microsoft | `0xb200000000000000000000ab99cfa739e253872b` |
| TSLAc | Tesla | `0xb2000000000000000000001e800a7f5189430cd0` |
| MSTRc | Strategy | `0xb2000000000000000000004884b426556b92883d` |
| SNDKc | Sandisk | `0xb200000000000000000000397293cb8cda9a10c5` |
| SPCXc | SpaceX | `0xb2000000000000000000007b9fcbd005511acbd5` |

`--stock` accepts the symbol, the symbol without the trailing `c` such as `NVDA`, or the token address, in any case.

### List

```sh
aero stocks list
```

For each stock, `price_usdc` is the current quote for selling one token into USDC. It is indicative, not an order price. With a connected wallet or `--wallet`, `balance` shows your holding. A stock that cannot be quoted has its reason in `error` and does not stop the others.

### Buy and sell

```sh
aero stocks buy --stock NVDAc --amount 25 --dry-run
aero stocks sell --stock NVDAc --amount 0.1 --dry-run
```

On `buy`, `--amount` is the USDC you spend. On `sell`, it is the number of stock tokens you sell. Both are plain decimals with no more decimal places than the token has. USDC has 6. Aero checks your balance before building the plan and stops with "Insufficient USDC balance", or the stock's symbol, when it is short.

`--slippage` defaults to `0.01`. The plan approves the input token to Permit2 and Permit2 to the swapper when needed, then swaps. The summary shows the amount in, the expected amount out and the minimum out. Remove `--dry-run` to review and sign through the normal flow in [Transactions](/docs/aero/transactions).

## Indices

An index is a saved list of target weights. It is a local file, not a token, vault or fund, and saving or deleting it moves no assets.

### Save weights

```sh
aero index create --name tech --allocations 'NVDAc=50,AAPLc=50'
aero index list
aero index show --name tech
aero index update --name tech --allocations 'NVDAc=0,AAPLc=100'
aero index delete --name tech
```

- Names are 1 to 64 letters, digits, hyphens or underscores, starting with a letter or digit.
- `--allocations` is a comma-separated list of `SYMBOL=percent`. Each percent is 0 to 100 with at most two decimal places, each stock appears once, and the total must be exactly 100.
- A stock at 0 is sold when you rebalance. Keep an exiting stock at 0 until it is sold. A stock left out of the list is ignored, not sold.
- `create` fails if the name exists. `update` fails if it does not.

Indices are stored as `<name>.json` in `~/.config/aero/indices`, or in `AERO_INDEX_DIR` when set.

### Rebalance

```sh
aero index rebalance --name tech --cash 100 --dry-run
```

Rebalancing reads the saved weights and trades toward them:

1. Every unit your wallet holds of each stock in the index counts, valued at a current quote for selling the whole holding into USDC.
2. `--cash` adds that much USDC on top, default `0`. Other USDC in the wallet is not touched.
3. Target values are the total times each weight.
4. Overweight stocks are sold down. The budget for buys is `--cash` plus the minimum proceeds of those sells, and it is split across underweight stocks in proportion to how far each is below target.

Stocks outside the index, staked assets and liquidity positions are not part of the calculation. Two indices that share a stock share the same holding. If the index holds nothing and `--cash` is 0, Aero stops with "No index holdings. Add a USDC contribution to fund this index." Fees, slippage and token precision can leave small weight differences and some USDC.

The summary shows the portfolio value in USDC, the added USDC, each stock's current and target percentage, and every trade with its minimum output. An index already on target prints "Already balanced. No transactions needed."

The CLI rebalances saved indices only. To try weights without saving them, use the Rebalance index form in the TUI.

### One transaction for the whole basket

All sells and buys go into a single swapper transaction. If any leg fails, the whole basket reverts. Before it, the plan adds approvals for each input token, covering the combined amount across legs. Approvals that confirmed before a failed basket stay on chain. Nothing runs on a schedule. Rebalancing happens only when you run the command.

## In the TUI

Open `aero tui` and pick Stocks or Indices from the home menu. The Stocks screen asks you to switch to Base when you are on another chain.

| Stocks key | Action |
| --- | --- |
| up, down | Select a stock |
| `b` or Enter | Open the Buy stock form for the selected stock |
| `s` | Open the Sell stock form |
| `h` | Show only stocks you hold. Needs a wallet. |
| `o` | Sort by catalog order, company name or holding value |
| `/` | Search by symbol or company. Submit an empty search to clear it. |
| `ctrl+r` | Reload quotes and balances |
| Esc | Back |

The Indices screen lists saved indices with a weight bar per stock. Enter edits the selected index, `n` creates one, `r` switches to Base and opens the Rebalance index form with the saved weights, and `d` deletes the weights after a confirmation.

| Editor key | Action |
| --- | --- |
| up, down | Move between the name row and the stocks |
| Enter | Name a new index, or type an exact weight for the selected stock |
| Space | Add the selected stock at 1%, or remove it |
| left, right | Lower or raise the weight by 1% |
| `e` | Split 100% equally across stocks with a weight above 0. Stocks at 0 stay at 0. |
| `f` | Give the selected stock whatever percentage remains |
| `s` | Save |
| `r` | Save and open the Rebalance index form |
| Esc | Cancel |

The editor shows the allocated total and any remainder or excess, and the total must be 100% to save. When you edit a saved index, a stock you remove is saved at 0 so the next rebalance sells it. The Rebalance index form takes target weights, optional added USDC, and slippage under More options, then builds the same plan as the CLI.
