---
title: Using the TUI
description: A full-screen terminal UI for browsing pools, positions and epochs, filling transaction forms, connecting a wallet and signing plans.
group: TUI
---

## Launch

```sh
aero tui
```

The TUI needs an interactive terminal. It opens on Base with the active wallet from [Wallets](/docs/aero/wallets), if there is one. Chain reads run in a background worker so the screen stays responsive. On start and after a chain or wallet change, Aero warms the slow scans in the background: the token list, swap pools, prices, all pools, the latest epochs and your positions. On Base and OP Mainnet it also starts the Dune and DefiLlama loads for Analytics.

The status bar at the bottom shows the key hints for the screen, the current chain and the wallet's short address and source, or "no wallet".

## Global keys

| Key | Action |
| --- | --- |
| `ctrl+k` or `ctrl+p` | Open the command palette |
| Esc | Go back, or close the open dialog |
| `ctrl+r` | Reload a list, rerun a result, or run the form |
| Enter | Open the selected item. On a token, pool or position field, open a picker. |
| `j` | Toggle raw JSON on a result or plan screen |
| `o` | Open a sort picker on the Stocks screen and the Analytics Trade tab |
| `ctrl+c` | Quit. During a broadcast the first press warns and a second press within 3 seconds quits. |

## Screens

### Home

| Item | Opens |
| --- | --- |
| Swap | Swap form |
| Quote | Quote form |
| Pools | Pools list |
| Add liquidity | Deposit form |
| Positions | Your positions |
| Stocks | Stocks screen |
| Indices | Saved indices |
| Epochs | Voting epochs list |
| Analytics | Analytics dashboard |
| Lock veNFT | veNFT lock form |
| Wallet | Wallet screen |

Move with the arrow keys or `j` and `k`, open with Enter, press `c` to switch chain and `q` to quit. In a terminal at least 100 columns wide and 30 rows tall, Base and OP Mainnet show TVL, 24-hour volume and 24-hour fees from DefiLlama under the logo.

### Pools

Every pool on the chain, sorted by TVL with a bar per row, and a mark on pools with a live gauge. Type to filter by symbol, type or address. Enter on a row offers Deposit liquidity, Epoch history, and Pool address. `ctrl+n` opens the deposit form with no pool, to create one. Page Up and Page Down move ten rows. The list mounts up to 200 rows and asks you to refine the filter beyond that.

### Positions

Your positions on the chain with pool, id, both token amounts, staked state and earned emissions. It needs a wallet. Enter on a row offers Withdraw, Stake, Unstake, Claim emissions, Claim fees, and Deposit more, each opening its form with the pool and position filled in.

### Epochs

The latest voting epoch per pool, sorted by votes, with votes, emissions, fees and incentives. A banner on top shows the vote share of the leading pools. Enter on a row offers Epoch history and Deposit liquidity.

### Action forms

Swap, Quote, Add liquidity, Lock veNFT and every form from the palette or a row action share one layout. See [Forms and More options](#forms-and-more-options).

### Stocks and Indices

Buy and sell stocks, edit saved weights and open a rebalance. Keys are listed in [Stocks and indices](/docs/aero/stocks-and-indices#in-the-tui).

### Analytics

A dashboard of protocol health, voting returns, pools, token supply and DEX share. See [Analytics](/docs/aero/analytics).

### Wallet

The top box shows the active wallet and its source. The menu offers:

- Connect browser wallet, for Rabby or another extension. Keep the page open to reuse the connection.
- Connect WalletConnect, with a QR code.
- Create local wallet, which shows the recovery phrase once and asks for a passphrase twice.
- Restore local wallet, from a hidden recovery phrase prompt.
- Disconnect wallet, when a browser or WalletConnect wallet is active.
- Remove local wallet, when one is stored, after a confirmation.

While a browser pairing waits, Esc cancels it. A WalletConnect pairing cannot be cancelled with Esc.

## Command palette

`ctrl+k` opens a searchable list with these entries:

- The home menu items.
- A form for every other action, tagged `tx` or `read`: Positions, Pools, Latest epochs, Epoch history, Withdraw, Stake, Unstake, Claim emissions, Claim fees, Buy stock, Sell stock and Rebalance index. Positions and Pools here are plain forms, next to the list screens of the same name from the home menu.
- Switch chain, Home and Quit.

In any list dialog, type to filter, move with the arrow keys or `ctrl+p` and `ctrl+n`, jump with Page Up and Page Down, pick with Enter and close with Esc. Confirmation dialogs also accept `y` and `n`.

## Switching chains

Press `c` on Home, or pick Switch chain in the palette. The list has all ten supported chains. Switching resets open forms and reloads data for the new chain.

## Forms and More options

Forms come from the same parameter list as the CLI flags, so the fields match `aero <command> --help`. The TUI fills chain and wallet itself.

| Key | Action |
| --- | --- |
| up, down, Tab, Shift+Tab | Move between fields |
| Space, left, right | Toggle an on/off field, or cycle a choice field |
| Enter | Open the picker on token, pool and position fields. Otherwise move to the next field, and on the last field run the form. |
| `ctrl+r` | Run the form from any field |
| Esc | Back |

Required fields end in `*`. The line under the form explains the active field.

- Token fields open a searchable list of the chain's listed tokens. Picking a token stores its address, so two tokens with the same symbol stay distinct.
- Pool and position fields open a list of pools on the chain or of your positions. Picking a position fills both the pool and the position id.
- Human units starts on, so amounts like `0.1` mean 0.1 tokens. On the Pools form, Full details starts on.
- The More options row shows slippage, the deadline and the CL range fields.
- On Add liquidity, the new-pool fields appear while no pool is set. Tick spacing appears for a new CL pool, and the CL range fields appear when the picked pool is concentrated.

A read shows a readable result. `j` switches to JSON, and `ctrl+r` or Enter runs it again with fresh data.

## Plans and signing

A transaction form needs a wallet. Running it builds the plan and shows a summary box, then each step as `approve` or `execute` with its target address, and a reminder that signing sends real transactions on the current chain.

- Enter signs and broadcasts. A local wallet asks for its passphrase first. A browser or WalletConnect wallet asks you to approve each step in the wallet.
- `j` shows the raw plan JSON.
- Esc goes back to the form.

During the broadcast the screen logs each step. When it finishes, it lists the confirmed hashes and Enter returns to the previous screen. If the chain or wallet changed after the plan was built, Aero refuses to sign and asks you to rebuild it. Sending uses the same execution journal as the CLI. See [Transactions](/docs/aero/transactions).

## Disk snapshots

The Pools, Positions and Epochs lists, the token picker list and the Analytics report are saved to disk after each successful load. On the next launch the saved data shows at once, marked with its age, while the live scan replaces it. If the refresh fails, the saved data stays on screen with a warning and `ctrl+r` retries. Snapshots older than 24 hours are ignored.

Quotes and transaction plans never use snapshots. They always read live chain state.

| Location | Used when |
| --- | --- |
| `$AERO_CACHE_DIR/snapshots` | `AERO_CACHE_DIR` is set |
| `$XDG_CACHE_HOME/aero/snapshots` | `XDG_CACHE_HOME` is set |
| `~/.cache/aero/snapshots` | Otherwise |

## RPC endpoints and speed

The TUI reads through the same RPC settings as the CLI. With only public endpoints, it keeps request concurrency at 5 and warms scans one after another to stay under rate limits. When any `SUGAR_RPC_URI` variable is set, such as `SUGAR_RPC_URI_8453`, it raises concurrency to 16 and runs the warm-up scans in parallel. `SUGAR_THREADING_MAX_WORKERS` sets the concurrency yourself.

For faster quotes, the TUI tries the 128 shortest candidate routes in batches of 32, and caches prices for 30 seconds. The CLI tries up to 3000 routes. `SUGAR_QUOTE_MAX_PATHS`, `SUGAR_QUOTE_BATCH_SIZE` and `SUGAR_PRICING_CACHE_TIMEOUT_SECONDS` override these values.

Loading spinners show how many RPC reads have completed.
