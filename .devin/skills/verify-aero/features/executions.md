# Executions

Every broadcast plan leaves a journal under `wallet/executions/<uuid>.json` tracking each step's hash and state. `aero executions` lists them, and `resume`/`cancel` are the manual recovery paths when a run dies with a plan in flight.

## Sub-features

- `executions-list` shows all journals with status.
- `executions-resume` continues an interrupted plan.
- `executions-cancel` abandons an interrupted plan.

## How to get to it (user POV)

- Run `aero executions list`.
- Run `aero executions resume --id <id>` or `aero executions cancel --id <id>`.

## Driving it with verify-aero

Preconditions:

- The isolated wallet directory is set; journals live under it.

- **List.** Run `scripts/aero executions list`. A JSON array of journals with `id`, `status` (`active`, `complete`, `failed`, `cancelled`), and per-step entries carrying `hash` and `kind` (`ready`, `submitting`, `submitted`, `confirmed`, `reverted`).
- **Gate.** The runner runs this read as `read.executions.before` and refuses transaction steps while any journal is `active`, printing the resume/cancel hint. `read.executions.after` asserts every journal is settled and none are `active` or `failed`.
- **Recover by hand.** When a run is interrupted mid-plan: inspect `scripts/aero executions list`, then either `scripts/aero executions resume --id <id>` to finish the remaining steps or `scripts/aero executions cancel --id <id>` to abandon them. Both are interactive and stay manual; the suite never auto-resolves.
- **Runner.** `bun scripts/verify.ts --mode reads` includes the list read; resume and cancel are exercised only by hand when recovery is needed.

## Gotchas

- An `active` journal blocks all new plans for the wallet, not just the same action. Reconcile before retrying.
- `*.lock` files next to the journals are stale-write guards; the doctor reports them as problems.
- The runner copies new and touched journals into `runs/<run-id>/journals/` as evidence.
