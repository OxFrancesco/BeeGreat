# Aero verification map

This directory is the maintained source for verifying the user-facing behavior of the Aero SDK and CLI (`packages/sugar`, invoked as `aero`). Read the index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- Work inside the isolated environment: `AERO_VERIFY_HOME` (default `~/.aero-verify`) holds the wallet, caches, indices, ALM config, journals, and run evidence.
- `SUGAR_WALLET_NO_KEYCHAIN=1` is always set so `wallet create` never touches the macOS Keychain entry `beegreat-sugar-cli/local-wallet`.
- A dedicated wallet exists at `$AERO_VERIFY_HOME/wallet/wallet.enc`, funded with ETH on Base (8453). It is not the user's real wallet.
- `bun .devin/skills/verify-aero/scripts/doctor.ts` exits 0 before any live run.
- Per-machine pins can live in `$AERO_VERIFY_HOME/env` (`KEY=VALUE` lines, only `AERO_VERIFY_RPC` and `SUGAR_*` honored, process env wins, keep it 0600).
- RPC comes from `AERO_VERIFY_RPC` if set, else an ambient `SUGAR_RPC_URI_8453`, else `https://base-rpc.publicnode.com`; the SDK's public default is too throttled for the quote path and a dedicated endpoint makes runs faster (the TUI raises scan concurrency when `SUGAR_RPC_URI_8453` is set). The env picks the SDK profile by endpoint: publicnode gets small batches (it caps call size), keyed endpoints get the SDK's default sizes on one worker (they throttle on request count); env-file and process values always win.
- `reads` and `dry-run` can run on the publicnode fallback. `full` and `sweep` require a receipt-capable endpoint — publicnode 403s every `eth_getTransactionReceipt`, so preflight refuses with exit 3 when `rpc.receipts` is false; pin a receipt-capable URL via `AERO_VERIFY_RPC` in the env file.
- Every command runs through `.devin/skills/verify-aero/scripts/aero` (the wrapper) or `bun .devin/skills/verify-aero/scripts/verify.ts` (the runner). Never run `bun packages/sugar/src/cli.ts` directly with the default environment.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Treat every command as literal. Keep addresses, pool names, and flags unchanged.
- Most read commands print JSON on stdout; `wallet status` prints text. `index delete` also prints text. Transaction commands print a plan summary, per-step send lines, then a `{"status":"sent",...}` JSON object; with `--dry-run` they print only the unsigned plan JSON.
- Pass `--yes` to broadcast without the interactive confirm, `--dry-run` to build the plan without broadcasting, and `--use-decimals` when an amount is given in human units.
- After a mutation, restore baseline: the post-sweep returns USDC, AERO, and stock balances to ETH. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the command, stdout, stderr, and exit code for every invocation. For transactions also capture the plan JSON, the `hashes` array, independently fetched receipts (viem), balance deltas, and a copy of the execution journal.
- Record the step id with every artifact; `runs/<run-id>/steps/NN-<id>.json` is the canonical record.
- A step that cannot run because a precondition is unmet is reported `skipped` with the reason, never claimed verified through another path.
- A step that failed on RPC infrastructure (`rate limited`, `429`, timeouts) is `flaky`, not a regression. The runner stops on `fail` or `flaky` with a nonzero exit. Health-check again before a fresh run, using a better RPC when necessary.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-aero` starts with `Preconditions:` and uses labeled bullets that pair each user action with the exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Reads](./reads.md) covers quote, pools, positions, epochs, epochs-latest, stocks list, wallet status, and executions list.
- [Swap](./swap.md) covers the ETH/USDC/AERO swap path with dry-run and broadcast evidence.
- [Basic liquidity](./liquidity-basic.md) covers deposit, stake, claim emissions, unstake, claim fees, and withdraw on `vAMM-USDC/AERO`.
- [CL liquidity](./liquidity-cl.md) covers the same lifecycle on `CL2000-USDC/AERO` plus the price range and NFT burn.
- [veNFT](./venft.md) covers `create-venft` and the SDK-only expired-lock sweep.
- [Stocks and indices](./stocks-and-indices.md) covers stock list, buy, sell, and the saved-index lifecycle with rebalance dry-run.
- [ALM dry-run](./alm-dry-run.md) covers `alm init`, `alm status`, and `serve --once`, with manual recovery prerequisites; `--execute` is deliberately never driven.
- [Wallet](./wallet.md) covers expect-driven create and restore, text status, prompted removal, and manual external pairing.
- [Executions](./executions.md) covers the journal list and manual resume/cancel recovery.
- [TUI](./tui.md) covers `aero tui` driven through tmux; it is not part of the automated runner.
