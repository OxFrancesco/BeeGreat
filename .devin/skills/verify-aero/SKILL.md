---
name: verify-aero
description: Verify the Aero SDK and CLI (packages/sugar) by driving real Base transactions from a dedicated micro-funded wallet. Reach for it before or after any change under packages/sugar to prove the user path still works end to end and to catch regressions against a baseline. Also use it when the user asks to "test aero" or exercise the aero CLI.
---

# Verify the Aero SDK and CLI

This skill drives the real `aero` CLI (`bun packages/sugar/src/cli.ts`) and the `SugarClient` SDK on Base mainnet (chain 8453) from a dedicated micro-funded wallet. It covers reads, swaps, basic and concentrated liquidity lifecycles, veNFT locking, stock trades, saved indices, the ALM dry-run path, and execution journals, and it writes structured evidence for every step.

Run it before calling any Aero change done. A full run costs under a dollar of capital per action plus gas and returns everything to ETH.

## Launch

There is no server or build step. Two one-time setup actions:

- `bun install` at the repository root so `packages/sugar` resolves.
- `bash .devin/skills/verify-aero/scripts/setup-wallet.sh` once per machine. It creates an isolated wallet under `AERO_VERIFY_HOME` (default `~/.aero-verify`) using `expect` to answer the CLI's interactive prompts. The CLI prints the mnemonic once on the terminal; the script never writes it to a file. To restore a known wallet instead, set `AERO_VERIFY_MNEMONIC` to the twelve words.

The wallet starts empty. Fund it once with at least 0.002 ETH on Base; the suite buys USDC, AERO, and NVDAc itself from that ETH and returns everything to ETH at the end.

Every drive goes through `scripts/aero <subcommand>` (the wrapper) or `bun scripts/verify.ts` (the runner). Both set the isolated environment themselves.

Git is not required at run time. The wrapper finds the repo root by walking up to `packages/sugar/package.json`, and when git itself is broken the report resolves the revision straight from `.git/HEAD` and marks `dirty` as null with a note instead of failing.

Persistent per-machine settings live in `$AERO_VERIFY_HOME/env`: plain `KEY=VALUE` lines (`#` comment lines allowed, no `export`), honoring only `AERO_VERIFY_RPC` and `SUGAR_*` keys that are not already set in the process environment. Put `AERO_VERIFY_RPC=https://...` in `~/.aero-verify/env` at mode 0600 to pin a dedicated Base RPC for every run without exporting it in your shell. Values are never printed or written to evidence.

## Doctor

`bun .devin/skills/verify-aero/scripts/doctor.ts` prints a JSON health report and exits 0 when the environment is driveable, 1 with a `problems` list otherwise. The runner calls it as preflight in every mode except `reads`.

The report covers the bun version, git revision and dirty flag, `AERO_VERIFY_HOME`, wallet presence and address, passphrase availability, RPC kind (`verify-override`, `user-env`, or `publicnode-default`, never the URL), the live chain id and block number, wallet balances (ETH, USDC, AERO, NVDAc, veNFT count), the ETH/USD price, the ETH required for the run, journal state (files, active journals, stale locks), the run lock, and confirmation that `SUGAR_WALLET_DIR` is not the real wallet directory.

Fix each problem as it reads: missing wallet means run `setup-wallet.sh`; missing passphrase means the `passphrase` file or `SUGAR_WALLET_PASSPHRASE` env is gone; wrong chain means the RPC override points off Base; insufficient ETH means fund the wallet; an active journal or lock means a previous run died mid-flight (see Isolation and safety); an existing `run.lock` requires checking whether its runner is still running. Locks are acquired atomically; stale or malformed locks require manual removal after verifying no runner or CLI child remains and reconciling executions.

## Drive

The runner is `bun .devin/skills/verify-aero/scripts/verify.ts`. Flags: `--mode full|dry-run|reads|sweep` (default `full`), `--only a,b` and `--skip a,b` to filter steps by id, id prefix, or feature name, `--budget-usd 0.8` to cap per-action spend, `--accept` to save a clean run's summary as the regression baseline, `--no-compare` to skip baseline comparison.

- `--mode reads` runs the read-only steps: wallet status, pools, quote, positions, epochs, epochs-latest, stocks list, executions list, and the after-run consistency reads. No preflight refusal, no lock, no transactions.
- `--mode dry-run` runs the reads, every `tx.*` step as `--dry-run` only (the unsigned plan is captured, nothing is broadcast), and the local steps. A thin wallet does not block this mode; steps that need live state or a balance come back `skipped`.
- `--mode sweep` runs only the pre-sweep steps and the final balance record. Use it to empty a stale wallet back to ETH.
- `--mode full` is the complete cycle: reads, pre-sweep of leftovers, ETH to USDC and AERO swaps, the full basic-pool lifecycle on `vAMM-USDC/AERO`, the full CL lifecycle on `CL2000-USDC/AERO` with the ALM init/status/serve-once detour while the CL position is live, a one-week veNFT lock, an NVDAc buy and sell, index create/list/show/rebalance-dry-run/update/delete, the post-sweep back to ETH, and the final balance accounting.

Step ids are stable and ordered. Run one feature with `--only`, for example `bun scripts/verify.ts --mode full --only swap,liquidity-basic,sweep` or `--only tx.swap`. Include `swap` and `sweep` when the feature needs funded balances: `swap` buys USDC/AERO first and `sweep` returns everything to ETH at the end.

A raw drive through the wrapper looks like `scripts/aero pools --token0 USDC --token1 AERO --full --limit 6` or `scripts/aero swap --from-token ETH --to-token USDC --amount 0.0002 --use-decimals --dry-run`. The wrapper sources `env.sh`, so the isolated environment applies to anything invoked through it, including manual commands.

The environment contract, also set by `env.sh`:

| variable | value | effect |
| --- | --- | --- |
| `AERO_VERIFY_HOME` | `~/.aero-verify` or override | root of all verification state |
| `SUGAR_WALLET_DIR` | `$AERO_VERIFY_HOME/wallet` | wallet file, `executions/` journals, locks, `alm-state.json` |
| `SUGAR_WALLET_NO_KEYCHAIN` | `1` | keeps the wallet out of the macOS Keychain |
| `SUGAR_WALLET_PASSPHRASE` | contents of `passphrase` file | non-interactive signing |
| `AERO_CACHE_DIR` | `$AERO_VERIFY_HOME/cache` | token and pool caches |
| `AERO_INDEX_DIR` | `$AERO_VERIFY_HOME/indices` | saved stock indices |
| `AERO_ALM_CONFIG` | `$AERO_VERIFY_HOME/alm.json` | ALM position registry |
| `AERO_VERIFY_RPC` | unset or `$AERO_VERIFY_HOME/env` | dedicated Base RPC for the run |
| `$AERO_VERIFY_HOME/env` | optional file | per-machine `KEY=VALUE` pins (0600) |
| `SUGAR_RPC_URI_8453` | resolved | Base RPC the CLI and runner share |

RPC resolution: `AERO_VERIFY_RPC` wins, then an ambient `SUGAR_RPC_URI_8453`, then `https://base-rpc.publicnode.com`. The SDK's public Alchemy default is too throttled for the quote path, so a dedicated endpoint makes runs faster; the TUI also raises scan concurrency when `SUGAR_RPC_URI_8453` is set. When publicnode is the resolved endpoint the environment caps `SUGAR_POOL_PAGINATION_MAX_SIZE_8453` at 75 and `SUGAR_PRICE_BATCH_SIZE_8453` at 8, because its multicall batches of the pool scan and price oracle exceed publicnode's call cap; user-pinned values always win. With those caps publicnode currently completes the ETH to USDC quote in about 1 minute 40 seconds through 429 retries, so a full cycle on publicnode is slow but works; a dedicated paid endpoint is the fast path. Reports show only the kind (`verify-override`, `user-env`, `publicnode-default`), never the URL.

## Evidence

Each run writes `runs/<YYYYMMDD-HHMMSS-mode>/` under `AERO_VERIFY_HOME`:

- `doctor.json` is the preflight report.
- `env.json` records the home path, RPC kind, git revision, bun version, budget, and wallet address. No secrets.
- `steps/NN-<id>.json` is one record per step with the command argv, exit code, stdout, stderr, the parsed JSON, the dry-run plan for tx steps, transaction hashes, independently fetched receipts, per-step balance deltas, named assertions, and the final status (`ok`, `fail`, `skipped`, `flaky`).
- `journals/` holds copies of every execution journal created or touched during the run.
- `summary.json` is the machine-readable rollup: per-step status, totals (tx count, gas wei, net ETH delta, dust list, veNFT count), and the comparison against baseline.
- `report.md` is the human-readable version.

A mutation step is proven when the record contains the CLI command, the plan JSON from `--dry-run`, the transaction hashes from the send, receipts fetched directly through viem (independent of the CLI's own report), the balance delta, and the journal copy. Dry-run mode proves plan building only; the runner verifies nothing was sent by checking that no new journal appears and `aero executions list` stays unchanged on the `serve --once` path.

Drive only through real user paths: the `aero` CLI for everything it covers. The single exception is `sweep.pre.venft-expired`, which withdraws expired veNFT locks through `SugarClient.withdrawVeNft` + `sendPlan` because the CLI has no withdraw command. Never call internal setters or write state files directly to manufacture a pass.

## Regression

The baseline lives at `AERO_VERIFY_HOME/baseline.json` and is a copy of a clean run's `summary.json`. Save one after a known-good full run with `--accept` (accepted only when the run exits 0). Every later run compares step-by-step: a step that was `ok` and is now `fail` is a regression; `ok` to `skipped`, a step missing from the run, or a changed `transaction_steps` count is a warning; new steps are informational; `flaky` never counts.

Exit codes: 0 all good, 1 step failures with no regression, 2 at least one regression versus baseline, 3 preflight refused.

## Cleanup

`bash .devin/skills/verify-aero/scripts/cleanup.sh` refuses every existing `run.lock` and never terminates a process. For a stale or malformed lock, verify no runner or CLI child remains and reconcile executions before removing the lock manually. Cleanup acquires its own exclusive lock while removing the cache, the index store, `alm.json`, `wallet/alm-state.json`, and `runs/*/tmp`. It never touches `wallet/`, `passphrase`, `baseline.json`, or the evidence in `runs/`. It prints what it removed.

## Isolation and safety

One wallet means one run. `AERO_VERIFY_HOME` holds everything the CLI can write, so nothing escapes to the real configuration. Never point `SUGAR_WALLET_DIR` at `~/.config/sugar-ts`; all entry points check canonical paths before accessing verification state, including symlink aliases and directories used by cleanup. `SUGAR_WALLET_NO_KEYCHAIN=1` is mandatory because without it `aero wallet create` seals into the macOS Keychain entry `beegreat-sugar-cli/local-wallet` and overwrites the real wallet. The passphrase and mnemonic never appear in evidence files, env.json, or step records; `setup-wallet.sh` lets the mnemonic reach the terminal once and stores only a generated passphrase at 0600.

Spend stays under `--budget-usd` (default $0.80) per action, checked at sizing time. Full and sweep modes refuse at preflight when live pricing is unavailable; real transactions are never sized on made-up prices. Sweep swaps return whatever balance accumulated, so a sweep action can exceed the per-action budget by design. Every position is closed and every non-ETH balance above $0.05 dust is swapped back to ETH by the post-sweep. The one deliberate remainder is the current run's veNFT lock: VotingEscrow rounds the unlock down to the weekly Thursday 00:00 UTC boundary, and the next run's `sweep.pre.venft-expired` withdraws it once expired.

If a run dies mid-transaction, an `active` journal in `wallet/executions/` blocks new plans for that wallet. Reconcile by hand with `scripts/aero executions list`, then `scripts/aero executions resume --id <id>` to finish the plan or `scripts/aero executions cancel --id <id>` to abandon it. The runner refuses to send while an active journal exists and prints the hint.

The wallet file is encrypted; deleting `AERO_VERIFY_HOME` entirely retires the wallet. Nothing in this skill touches mainnet outside Base or any account other than the isolated one.

## Helpers

- `scripts/env.sh` is sourced, not executed. Exports the full isolation contract and prints nothing.
- `scripts/aero` wraps `bun packages/sugar/src/cli.ts` with cwd `packages/sugar` and the isolated env. Use it for any manual drive; exit code is the CLI's.
- `scripts/setup-wallet.sh` creates or restores the isolated wallet via `expect`. `--force` overwrites an existing wallet. `AERO_VERIFY_MNEMONIC` switches create to restore. Exits 0 on success and prints the address plus the funding note.
- `bun scripts/doctor.ts` prints the JSON health report; exit 0 clean, 1 problems. `--budget-usd=<n>` changes the funding threshold.
- `bun scripts/verify.ts` is the runner described under Drive.
- `bash scripts/cleanup.sh` removes disposable state; see Cleanup.
- `bunx tsc --noEmit -p scripts/tsconfig.json` typechecks the TypeScript helpers.

## Feature map

`features/README.md` is the index of user-facing features with per-feature recipes pairing each user action with the exact command and observable result. Read it before driving; report skipped steps as skipped, never as verified through another path.
