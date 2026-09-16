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
- **Gate.** The runner runs this read as `read.executions.before` and refuses transaction steps while any journal is `active`, printing the resume/cancel hint (`dry-run` never sends, so a stale journal does not block it). `read.executions.after` asserts every journal is settled and none are `active` or `failed`.
- **Recover by hand.** When a run is interrupted mid-plan: inspect `scripts/aero executions list`, then `scripts/aero executions resume --id <id>` to finish the remaining steps. `resume` asks `Reconcile receipts and continue unsubmitted steps of this reviewed plan?`; drive it non-interactively with expect (script on stdin, `spawn /bin/bash $env(AERO_CLI) executions resume --id <id>`, answer `y` at the prompt), the same pattern `setup-wallet.sh` uses. `cancel` (`scripts/aero executions cancel --id <id>`) abandons the plan and stays manual-only.
- **Runner.** `bun scripts/verify.ts --mode reads` includes the list read. Two mid-plan failure shapes are reconciled automatically when the journal was created by the run itself: a lost receipt wait (`Execution outcome unknown; resume <id> to check <hash>`, the step already `submitted`) and a preparation failure (`Local transaction preparation failed before broadcast`, the step still `ready`). The runner drives `executions resume` through expect, and if that resume leaves the journal `active` with nothing newly broadcast (no `submitting`, no new `submitted`) it waits 60 s and resumes once more, then collects every hash from the settled journal and marks the step `flaky`. A journal with a step still `submitting` is never touched (its broadcast outcome is unknown), and a journal that predates the run only trips the unresolved-execution gate; both mark the step `fail`, abort the run, and print the manual hint.

## Gotchas

- An `active` journal blocks all new plans for the wallet, not just the same action. Reconcile before retrying.
- `*.lock` files next to the journals are stale-write guards; the doctor reports them as problems.
- The runner copies new and touched journals into `runs/<run-id>/journals/` as evidence.
