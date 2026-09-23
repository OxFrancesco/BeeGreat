---
title: Running the CLI
description: Run aero in a terminal to read Aerodrome and Velodrome data, build transaction plans and sign them with your own wallet.
group: CLI
---

## Run aero

Aero runs on Bun, either from a clone of the repository or as a dependency of a Bun project. See [Install](/docs/aero/install) for setup.

```sh
bun run cli -- pools --token0 ETH --token1 USDC --full --limit 5
bun run aero pools --token0 ETH --token1 USDC --full --limit 5
```

The first line runs from a clone, the second from a project that installed the package. The package links two binaries, `aero` and `sugar-ts`, and both run the same entry point. The examples in these docs write `aero` for whichever form you use.

`bun run build` bundles the CLI into `dist/cli.js` plus `dist/worker.js`, the data worker the TUI starts. Run the bundle with `bun dist/cli.js` where the package's dependencies are installed.

## Command structure

Commands take the form `aero <command> [subcommand] [flags]`.

| Command | What it does |
| --- | --- |
| `quote`, `pools`, `positions`, `epochs-latest`, `epochs` | Read pools, positions, epochs and swap quotes |
| `swap`, `deposit`, `withdraw`, `stake`, `unstake`, `claim-emissions`, `claim-fees`, `create-venft` | Build a transaction plan and, with a wallet, sign it |
| `stocks list`, `stocks buy`, `stocks sell` | Tokenized stocks on Base |
| `index create`, `update`, `list`, `show`, `delete`, `rebalance` | Saved stock weights and rebalancing |
| `wallet connect`, `create`, `restore`, `status`, `disconnect`, `remove` | The signing wallet |
| `executions list`, `resume`, `cancel` | Plans Aero has started sending |
| `serve`, `alm init`, `status`, `safe-setup`, `recover`, `resolve` | Self-hosted range rebalancing |
| `tui` | Full-screen terminal UI |
| `guide` | Walkthroughs printed in the terminal |

Every flag and default is listed in the [CLI reference](/docs/aero/cli-reference).

Flags take a value as `--name value` or `--name=value`. Boolean flags take no value, for example `--use-decimals`. A boolean that is on by default appears as `--no-<name>`, for example `--no-collect` on `aero withdraw`.

## Help

Every command and subcommand has its own help, with each flag, its description, allowed choices and examples:

```sh
aero --help
aero swap --help
aero wallet connect --help
```

`-h` is the short form. `aero --version` prints the CLI version. `--log-level` sets the minimum log level.

## Wizard mode

Add `--wizard` to any command to be asked for each value instead of typing flags:

```sh
aero swap --wizard
aero --wizard
```

For every optional flag the wizard first asks whether to set it. Choices such as `--pool-type` open a picker. On a command with subcommands, such as `aero wallet` or plain `aero`, it asks you to pick one. When all values are in, it prints the full command line and asks "Run this command?". A transaction command started from the wizard still shows its plan and asks before signing.

## Output

Read commands print JSON to stdout, indented with two spaces, so you can pipe them into other tools:

```sh
aero pools --token0 USDC --token1 AERO --full --limit 3 > pools.json
```

Transaction commands behave in one of two ways:

- With a connected wallet that matches `--wallet`, and without `--dry-run`, Aero prints the chain, the sender and a plan summary, asks "Sign and broadcast?", then prints one progress line per step and a final JSON result with the transaction hashes.
- With `--dry-run`, or with a `--wallet` address that is not the connected wallet, Aero prints the unsigned plan as JSON. Without any connected wallet you must pass `--wallet`. Hints about connecting a wallet go to stderr, so stdout stays valid JSON.

The `index` subcommands and `executions list` also print JSON. Wallet commands and guides print plain text. There is no flag that switches the CLI between JSON and readable output. The [TUI](/docs/aero/tui) shows readable results and switches to JSON with `j`.

Errors print one line to stderr and exit with code 1. A usage error, such as a missing required flag, prints the command help with the problem.

Plans, confirmation and recovery are covered in [Transactions](/docs/aero/transactions).

## Chains

Every Aerodrome and Velodrome command takes `--chain <id>`. The default is 8453, Base.

| Chain id | Network |
| --- | --- |
| 8453 | Base (Aerodrome) |
| 10 | OP Mainnet (Velodrome) |
| 130 | Unichain |
| 252 | Fraxtal |
| 1135 | Lisk |
| 1868 | Soneium |
| 5330 | Superseed |
| 34443 | Mode |
| 42220 | Celo |
| 57073 | Ink |

Stocks and indices work on Base only. `SUGAR_RPC_URI_<chainId>`, for example `SUGAR_RPC_URI_8453`, replaces the public RPC for one chain. `SUGAR_RPC_URI` without a suffix applies to every chain.

## Tokens and amounts

Token flags such as `--from-token`, `--to-token`, `--token0` and `--token1` accept a symbol or a `0x` address.

- An exact symbol resolves against the chain's listed tokens.
- A `0x` address is used as given, which is how you reach unlisted tokens.
- A partial or ambiguous symbol opens a picker when you run in a terminal. Type to filter, use the arrow keys to move, Enter to pick and Esc to cancel. `ctrl+u` clears the search.
- In a script or pipe there is no picker. The command fails and lists up to five of the closest tokens with their addresses.
- `aero swap` and `aero quote` ask for a missing `--from-token` or `--to-token` in a terminal.

Amounts on Aerodrome commands are raw integer units unless you pass `--use-decimals`. With it, `--amount 0.1` on ETH means 0.1 ETH. Stock and index amounts are always human decimals.

## Shell completions

Aero prints completion scripts for bash, zsh, fish and sh. The scripts complete every subcommand and flag, including choice values such as `--pool-type`.

```sh
aero --completions zsh > ~/.config/zsh/completions/_aero
aero --completions bash > ~/.local/share/bash-completion/completions/aero
aero --completions fish > ~/.config/fish/completions/aero.fish
```

For zsh, the directory must be in your `fpath`. Then run `autoload -Uz compinit && compinit`. The scripts complete a command named `aero`, so they apply when `aero` is on your `PATH`. Regenerate them after upgrading.

## Guides

`aero guide` lists the topics. `aero guide <topic>` prints one.

```sh
aero guide
aero guide getting-started
```

| Topic | Covers |
| --- | --- |
| `getting-started` | A short tour of a pool read, a quote, connecting a wallet, a swap and the TUI |
| `wallet` | Browser wallet, WalletConnect and the local encrypted wallet |
| `swap` | Quoting, routes, approvals and slippage |
| `liquidity` | Deposits, CL ranges and withdrawals |
| `staking` | Staking positions in gauges |
| `rewards` | Trading fees, gauge emissions and voting rewards |
| `venft` | Locking AERO or VELO and lock durations |
| `alm` | `aero serve`, strategies, safety rails and recovery |
| `analytics` | The TUI Analytics dashboard |
| `chains` | Chain ids and RPC overrides |
| `completions` | Installing shell completions |
