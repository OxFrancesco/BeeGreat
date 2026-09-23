---
title: CLI reference
description: Every aero command and subcommand with its flags, defaults and one example, taken from the CLI source and its help output.
group: CLI
---

## Common flags

These flags appear on many commands. The tables further down list them again only where their meaning changes.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--chain` | no | `8453` | Chain id. Every Aerodrome and Velodrome command takes it. |
| `--wallet` | no | connected wallet | Address the plan or read is built for. Transaction commands need it when no wallet is connected. An address other than the connected wallet prints an unsigned plan instead of signing. |
| `--yes`, `-y` | no | off | Skip the "Sign and broadcast?" prompt. Browser and WalletConnect wallets still ask for approval. |
| `--dry-run` | no | off | Print the unsigned plan and never sign. |

Global flags work on every command.

| Flag | Meaning |
| --- | --- |
| `--help`, `-h` | Show help for the command |
| `--version`, `-v` | Print the CLI version |
| `--wizard` | Ask for each flag interactively, then run the command |
| `--completions` | Print a completion script for bash, zsh, fish or sh |
| `--log-level` | Minimum log level, one of all, trace, debug, info, warn, warning, error, fatal or none |

Transaction commands are `swap`, `deposit`, `withdraw`, `stake`, `unstake`, `claim-emissions`, `claim-fees`, `create-venft`, `stocks buy`, `stocks sell` and `index rebalance`. They take `--chain`, `--wallet`, `--yes` and `--dry-run`. How they sign is described in [Transactions](/docs/aero/transactions).

## Reads

Reads print JSON and never sign.

### aero quote

Quote a swap through the best route without building transactions.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--from-token` | yes | none | Token you pay with, symbol or `0x` address. Asked for in a terminal when missing. |
| `--to-token` | yes | none | Token you receive. Asked for in a terminal when missing. |
| `--amount` | yes | none | Amount in raw units, or human units with `--use-decimals` |
| `--use-decimals` | no | off | Read `--amount` as human units |
| `--chain` | no | `8453` | Chain id |

The result has both tokens, the input and output amounts in raw and decimal form, the price, USD prices when available, `price_impact_pct` and the route with each hop's pool.

```sh
aero quote --from-token ETH --to-token USDC --amount 0.1 --use-decimals
```

### aero pools

Browse liquidity pools.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--token0` | no | none | Only pools containing this token |
| `--token1` | no | none | Only pools containing this token too |
| `--pool-type` | no | all | `cl`, `stable` or `volatile` |
| `--full` | no | off | Include symbol, tokens, reserves, TVL, fee, gauge and weekly emissions |
| `--limit` | no | all pools | Return at most this many pools, 1 to 100 |
| `--chain` | no | `8453` | Chain id |

Without `--full` each entry has the pool address, type and token addresses only.

```sh
aero pools --token0 ETH --token1 USDC --full --limit 5
```

### aero positions

List liquidity positions, basic and concentrated.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--owner` | no | connected wallet | List positions for another address |
| `--wallet` | no | connected wallet | Same as `--owner` when `--owner` is absent |
| `--chain` | no | `8453` | Chain id |

Fails with "positions requires wallet or owner" when no wallet is connected and neither flag is set. Each entry has the position id, pool, liquidity, staked amount, token amounts, earned fees and emissions, and the tick range.

```sh
aero positions --owner 0xOWNER
```

### aero epochs-latest

Latest voting epoch per pool, with votes, emissions, fees and incentives.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--pool-type` | no | all | `cl`, `stable` or `volatile` |
| `--chain` | no | `8453` | Chain id |

```sh
aero epochs-latest --pool-type cl
```

### aero epochs

Voting epoch history for one pool.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--lp` | yes | none | Pool address |
| `--pool-type` | no | all | `cl`, `stable` or `volatile` |
| `--limit` | no | `10` | Epochs to return, 1 to 100 |
| `--offset` | no | `0` | Skip this many epochs |
| `--chain` | no | `8453` | Chain id |

```sh
aero epochs --lp 0xPOOL --limit 5
```

## Transactions

Every command here builds a plan with approvals first and the action last. Each also takes the [common flags](#common-flags) `--chain`, `--wallet`, `--yes` and `--dry-run`.

### aero swap

Swap tokens through the best route.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--from-token` | yes | none | Token you pay with. Asked for in a terminal when missing. |
| `--to-token` | yes | none | Token you receive. Asked for in a terminal when missing. |
| `--amount` | yes | none | Amount in raw units, or human units with `--use-decimals` |
| `--slippage` | no | `0.01` | Tolerance from 0 to 1. `0.01` is 1%. `SUGAR_SWAP_SLIPPAGE` changes the default. |
| `--use-decimals` | no | off | Read `--amount` as human units |

An ERC-20 input adds a token approval to Permit2 and a Permit2 approval to the swapper when the current allowance is too low, each for the exact amount. A native ETH input needs none. For listed tokens, routes that quote more than twice the on-chain oracle's expected output are rejected. The summary shows both asset addresses, the minimum output and the price impact.

```sh
aero swap --from-token USDC --to-token AERO --amount 25 --use-decimals --dry-run
```

### aero deposit

Add liquidity to a pool, or create a pool from a token pair.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--pool` | one pool form | none | Existing pool address |
| `--token0` | one pool form | none | First token of a new pool |
| `--token1` | one pool form | none | Second token of a new pool |
| `--pool-type` | one pool form | none | `cl`, `stable` or `volatile` for a new pool |
| `--tick-spacing` | new CL pool | none | Tick spacing of a new CL pool |
| `--amount0` | no | none | Amount of token0 |
| `--amount1` | no | none | Amount of token1 |
| `--price-lower` | no | none | CL range lower bound as a price |
| `--price-upper` | no | none | CL range upper bound as a price |
| `--tick-lower` | no | none | CL range lower bound as a tick |
| `--tick-upper` | no | none | CL range upper bound as a tick |
| `--initial-price` | no | none | Starting price for an uninitialized CL pool |
| `--slippage` | no | `0.01` | Tolerance from 0 to 1 |
| `--deadline-minutes` | no | `30` | Transaction deadline in minutes |
| `--use-decimals` | no | off | Read amounts as human units |

Use either `--pool` or the new-pool form with `--token0`, `--token1` and `--pool-type`. Combining them fails. A new CL pool also needs `--tick-spacing`, and `--tick-spacing` is rejected for other types. On an existing basic pool, pass one amount and Aero quotes the other side. A new basic pool needs both amounts. CL range flags are rejected on basic pools.

```sh
aero deposit --pool 0xPOOL --amount0 100 --use-decimals --dry-run
```

### aero withdraw

Remove liquidity from a position, fully or in part.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--position` | pool or position | none | Position id from `aero positions` |
| `--pool` | pool or position | none | Pool of the position |
| `--fraction` | no | everything | Share to withdraw, above 0 and at most 1. `0.5` is half. |
| `--burn` | no | off | Burn the emptied CL position NFT |
| `--no-collect` | no | collect | Skip collecting owed fees while withdrawing (CL only) |
| `--unwrap-native` | no | off | Return the wrapped native leg as the native token |
| `--slippage` | no | `0.01` | Tolerance from 0 to 1 |
| `--deadline-minutes` | no | `30` | Transaction deadline in minutes |

A staked position must be unstaked first.

```sh
aero withdraw --position 123 --pool 0xPOOL --fraction 0.5 --dry-run
```

### aero stake

Stake a position in its gauge to earn emissions instead of trading fees.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--position` | pool or position | none | Position id |
| `--pool` | pool or position | none | Pool of the position |

Staking a CL position approves the NFT to the gauge first.

```sh
aero stake --position 123 --pool 0xPOOL
```

### aero unstake

Take a position out of its gauge.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--position` | pool or position | none | Position id |
| `--pool` | pool or position | none | Pool of the position |
| `--amount` | no | everything | LP amount to unstake from a basic pool, in raw units |

```sh
aero unstake --position 123 --pool 0xPOOL
```

### aero claim-emissions

Claim gauge emissions earned by a staked position.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--position` | pool or position | none | Position id |
| `--pool` | pool or position | none | Pool of the position |

```sh
aero claim-emissions --position 123 --pool 0xPOOL
```

### aero claim-fees

Claim trading fees earned by an unstaked position.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--position` | pool or position | none | Position id |
| `--pool` | pool or position | none | Pool of the position |
| `--burn` | no | off | Burn the CL position NFT if it is empty |
| `--unwrap-native` | no | off | Return the wrapped native leg as the native token |

```sh
aero claim-fees --position 123 --pool 0xPOOL --unwrap-native
```

### aero create-venft

Lock AERO on Base, or VELO on OP Mainnet, into a veNFT for voting power.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--amount` | yes | none | Amount to lock, raw units unless `--use-decimals` |
| `--lock-duration-seconds` | yes | none | Lock length in seconds, rounded down to whole weeks, at most 4 years. One year is `31536000`. |
| `--use-decimals` | no | off | Read `--amount` as human units |

The plan includes the token approval.

```sh
aero create-venft --amount 100 --use-decimals --lock-duration-seconds 31536000
```

## Stocks and indices

All stock commands require Base. See [Stocks and indices](/docs/aero/stocks-and-indices) for how amounts and rebalancing work.

### aero stocks list

Tokenized stocks with an indicative USDC price and, with a wallet, your balances.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--wallet` | no | connected wallet | Address whose balances to show |
| `--chain` | no | `8453` | Must be 8453 |

```sh
aero stocks list
```

### aero stocks buy

Buy a tokenized stock with USDC.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--stock` | yes | none | NVDAc, AAPLc, GOOGLc, METAc, AMZNc, MSFTc, TSLAc, MSTRc, SNDKc or SPCXc |
| `--amount` | yes | none | USDC to spend |
| `--slippage` | no | `0.01` | Tolerance, at least 0 and below 1 |

```sh
aero stocks buy --stock NVDAc --amount 25 --dry-run
```

### aero stocks sell

Sell tokenized stock units for USDC.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--stock` | yes | none | Stock symbol, as for `stocks buy` |
| `--amount` | yes | none | Stock token units to sell |
| `--slippage` | no | `0.01` | Tolerance, at least 0 and below 1 |

```sh
aero stocks sell --stock NVDAc --amount 0.1 --dry-run
```

### aero index create

Save a new index. Fails if the name exists.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | yes | none | Index name |
| `--allocations` | yes | none | Target percentages such as `NVDAc=50,AAPLc=50`. Use 0 to exit a stock. |

```sh
aero index create --name tech --allocations 'NVDAc=50,AAPLc=50'
```

### aero index update

Replace the weights of a saved index.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | yes | none | Existing index name |
| `--allocations` | yes | none | New target percentages |

```sh
aero index update --name tech --allocations 'NVDAc=0,AAPLc=100'
```

### aero index list

List saved indices as JSON. No flags.

```sh
aero index list
```

### aero index show

Show one saved index.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | yes | none | Index name |

```sh
aero index show --name tech
```

### aero index delete

Delete saved weights. Wallet holdings are not touched.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | yes | none | Index name |

```sh
aero index delete --name tech
```

### aero index rebalance

Trade wallet holdings toward a saved index.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | yes | none | Saved index name |
| `--cash` | no | `0` | USDC added on top of existing holdings |
| `--slippage` | no | `0.01` | Tolerance, at least 0 and below 1 |
| `--wallet` | no | connected wallet | Address to rebalance |
| `--chain` | no | `8453` | Must be 8453 |
| `--yes`, `-y` | no | off | Skip the prompt |
| `--dry-run` | no | off | Print the unsigned plan |

```sh
aero index rebalance --name tech --cash 100 --dry-run
```

## Wallet

See [Wallets](/docs/aero/wallets) for how each wallet type signs and where it is stored.

### aero wallet connect

Pair a wallet over WalletConnect, or a browser extension with `--browser`.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--browser` | no | off | Connect Rabby or another browser extension through a local page |
| `--chain` | no | `8453` | Chain the wallet must approve |

```sh
aero wallet connect --browser
```

### aero wallet create

Generate a local wallet. The recovery phrase is shown once, then sealed with your passphrase. No flags.

```sh
aero wallet create
```

### aero wallet restore

Import an existing recovery phrase into the local encrypted wallet. No flags.

```sh
aero wallet restore
```

### aero wallet status

Show the active wallet and where it comes from. No flags.

```sh
aero wallet status
```

### aero wallet disconnect

Disconnect the browser wallet and the WalletConnect session. A stored local wallet stays. No flags.

```sh
aero wallet disconnect
```

### aero wallet remove

Delete the local encrypted wallet after a confirmation. No flags.

```sh
aero wallet remove
```

## Executions

Plans Aero has started sending, saved in the execution journal. See [Transactions](/docs/aero/transactions#the-execution-journal).

### aero executions list

List saved executions with id, chain, sender, status and each step's state and hash. No flags.

```sh
aero executions list
```

### aero executions resume

Check receipts and send the remaining unsubmitted steps of a saved plan, without resending submitted ones. Asks for confirmation.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--id` | yes | none | Execution id from `aero executions list` |

```sh
aero executions resume --id PLAN_ID
```

### aero executions cancel

Cancel the unsubmitted steps of an active execution. Asks for confirmation.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--id` | yes | none | Execution id |

```sh
aero executions cancel --id PLAN_ID
```

## ALM

Self-hosted rebalancing of concentrated positions. See [ALM](/docs/aero/alm) before using `--execute`.

### aero serve

Watch configured CL positions and rebalance them. Dry-run unless `--execute` is passed.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--config` | no | `~/.config/sugar-ts/alm.json` | ALM config file |
| `--execute` | no | off | Sign and broadcast with the local encrypted wallet |
| `--once` | no | off | Run one pass and exit |
| `--interval` | no | `pollSeconds` from the config | Poll interval in seconds, at least 1 |
| `--allow-unsimulated` | no | off | Broadcast even when the RPC cannot run `eth_simulateV1` |
| `--wallet` | no | connected wallet | Wallet to observe in dry-run. Ignored with `--execute`. |

```sh
aero serve --once
```

### aero alm init

Write the ALM config from your current CL positions.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--chain` | no | `8453` | Chain id written to the config |
| `--wallet` | no | connected wallet | Owner of the positions |
| `--position-id` | no | all | Only this NFT. Required when several positions share a pool. |
| `--strategy` | no | `original` | `original`, `lazy-syncing`, `lazy-ascending`, `lazy-descending` or `expand` |
| `--force` | no | off | Overwrite an existing config file |
| `--config` | no | `~/.config/sugar-ts/alm.json` | Where to write |

```sh
aero alm init --strategy lazy-syncing
```

### aero alm status

Show tick, range, strategy and rebalance gate for every managed position, or the cycles that need recovery.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--config` | no | `~/.config/sugar-ts/alm.json` | ALM config file |
| `--wallet` | no | Safe in the config, then connected wallet | Wallet to inspect |

```sh
aero alm status
```

### aero alm safe-setup

Disabled in this release. The command exits with an error before doing anything. Its flags are listed for completeness.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--safe` | yes | none | Safe that owns the positions |
| `--keeper` | no | local wallet | Keeper address |
| `--role` | no | `aero-alm` | Role name |
| `--salt-nonce` | no | `0` | Module proxy factory salt nonce |
| `--out` | no | `./aero-alm-safe-setup.json` | Output file |
| `--config` | no | `~/.config/sugar-ts/alm.json` | ALM config file |

```sh
aero alm safe-setup --safe 0xOWNER
```

### aero alm recover

Check receipts for an interrupted ALM cycle. Never signs or restarts a phase.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--id` | yes | none | Cycle id from `aero alm status` |

```sh
aero alm recover --id CYCLE_ID
```

### aero alm resolve

Mark a manually repaired cycle as resolved so new cycles can start. Asks for confirmation.

| Flag | Required | Default | Meaning |
| --- | --- | --- | --- |
| `--id` | yes | none | Cycle id |
| `--note` | yes | none | What you verified and repaired |
| `--position-id` | no | replacement NFT, then original | NFT to manage from now on |

```sh
aero alm resolve --id CYCLE_ID --note "Verified receipts and restaked the new position"
```

## TUI

### aero tui

Open the full-screen terminal UI. No flags. See [TUI](/docs/aero/tui).

```sh
aero tui
```

## Guide

### aero guide

Print a walkthrough. Without a topic it lists all topics.

| Argument | Required | Meaning |
| --- | --- | --- |
| `topic` | no | `getting-started`, `wallet`, `swap`, `liquidity`, `staking`, `rewards`, `venft`, `alm`, `analytics`, `chains` or `completions` |

```sh
aero guide liquidity
```
