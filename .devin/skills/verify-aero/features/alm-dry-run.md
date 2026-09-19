# ALM dry-run

The ALM commands manage an automated liquidity position: `alm init` writes a config naming a CL position, `alm status` reports whether it is in range, and `serve --once` evaluates one rebalance pass. Only the dry-run path is driven; `serve` with `--execute` is deliberately never run by this suite.

## Sub-features

- `alm-init` writes the position registry file.
- `alm-status` reports in-range state for each configured position.
- `alm-serve-once` evaluates one dry-run pass without broadcasting.

## How to get to it (user POV)

- Run `aero alm init --force --position-id <id>` after creating a CL position.
- Run `aero alm status` to inspect configured positions.
- Run `aero serve --once` for a single evaluation pass.

## Driving it with verify-aero

Preconditions:

- No unresolved ALM recovery cycle remains.
- A live CL position exists (the runner takes the id captured by `tx.deposit.cl`).
- `AERO_ALM_CONFIG` points at `$AERO_VERIFY_HOME/alm.json`, not the user's real config.

- **Init.** Run `scripts/aero alm init --force --position-id <id>`. The file at `AERO_ALM_CONFIG` is created and names the CL pool `0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1`.
- **Status.** Run `scripts/aero alm status`. The JSON entry for the CL pool shows `position_id` matching the deposited id and reports `in_range`. Check that value against the actual position; the deposit bounds use a routed estimate, so `true` is not guaranteed.
- **Serve once.** Run `scripts/aero serve --once`. Require exit 0 and inspect the evaluation output for a completed evaluation without `failed`, `blocked`, or manual-recovery messages. Exit 0 alone can hide a failed or blocked pass. Snapshot journal contents before and after, not just filenames; unchanged names do not prove unchanged journals. Confirm the invocation omits `--execute` and preserve its output alongside those snapshots.
- **Recovery (manual prerequisite).** An unresolved ALM cycle prevents a new evaluation. Inspect `scripts/aero alm status`, then run `scripts/aero alm recover --id <cycle-id>` to reconcile receipts without signing. Repair partial positions manually before `scripts/aero alm resolve --id <cycle-id> --note <verified-outcome> [--position-id <funded-owned-cl-nft>]`. Resolve requires verified receipts, balances, NFT ownership and staking, an owned funded CL NFT, and explicit confirmation; unknown submissions must be reconciled first. This suite does not create a failed cycle to exercise recovery.
- **Runner.** These run automatically inside `--mode full` as `local.alm-init`, `read.alm-status`, and `read.alm-serve-once` between the CL deposit and stake.

## Gotchas

- `serve` without `--once` loops forever; never run it bare in a verification session.
- `--execute` would broadcast rebalance transactions; it is intentionally absent from this map. If a live ALM run is ever needed, add it as its own feature entry.
- `alm-state.json` lives in the wallet dir and `alm.json` at `AERO_ALM_CONFIG`; `cleanup.sh` removes both.
