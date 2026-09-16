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

- A live CL position exists (the runner takes the id captured by `tx.deposit.cl`).
- `AERO_ALM_CONFIG` points at `$AERO_VERIFY_HOME/alm.json`, not the user's real config.

- **Init.** Run `scripts/aero alm init --force --position-id <id>`. The file at `AERO_ALM_CONFIG` is created and names the CL pool `0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1`.
- **Status.** Run `scripts/aero alm status`. The JSON entry for the CL pool shows `position_id` matching the deposited id and `in_range: true` (the runner brackets spot when depositing).
- **Serve once.** Run `scripts/aero serve --once`. Exit 0, and the `wallet/executions/` listing is byte-identical before and after, proving nothing was broadcast.
- **Runner.** These run automatically inside `--mode full` as `local.alm-init`, `read.alm-status`, and `read.alm-serve-once` between the CL deposit and stake.

## Gotchas

- `serve` without `--once` loops forever; never run it bare in a verification session.
- `--execute` would broadcast rebalance transactions; it is intentionally absent from this map. If a live ALM run is ever needed, add it as its own feature entry.
- `alm-state.json` lives in the wallet dir and `alm.json` at `AERO_ALM_CONFIG`; `cleanup.sh` removes both.
