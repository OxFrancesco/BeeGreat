---
name: verify-pecu
description: Verify Pecu's production web agent, commands, unsigned previews, transaction lifecycles and recovery, with evidence and row-by-row regression comparison.
---

# Verify Pecu

## Launch

Use the deployed Cloudflare app at `https://pecu.app/agent`. Use T3 `preview_status`, then `preview_open` and `preview_navigate`. If the old tab is unavailable and reuse times out, open one new tab with `reuseExistingTab: false`; preserve the signed-in browser session. Do not restart the browser or touch unrelated tabs.

Pecu runs on Cloudflare. Local workerd fixtures are isolated tests, not a replacement production agent. From the repository root:

```sh
bun run --cwd apps/pecu typecheck
bun run --cwd apps/pecu test
bun run --cwd apps/pecu build
bun run --cwd apps/pecu/apps/stocks typecheck
bun run --cwd apps/pecu/apps/stocks build
bun apps/pecu/scripts/command-inventory.ts > /private/tmp/pecu-command-inventory.json
```

Workerd tests need loopback listeners. Check existing listeners before starting a fixture. Fixtures own their processes and stop them in `finally`; never kill processes by name.

## Doctor

Record the git revision, dirty paths and active deployments before testing. Use the configured personal account `157a8b025a13404b16f11ad7078e53f1`; never the Humane/Mentasuave account. Read `apps/pecu/AGENTS.md` and deployment configs before publishing.

In the selected thread, send `/wallet` and `/yolo`. Match the complete returned wallet to the task's authorized wallet. Confirm the thread ID in the URL. For unsigned verification, YOLO must be off. Do not infer a wallet from an old balance or another thread. Stop dependent checks if authentication, wallet or deployment is wrong.

## Drive

Use the feature map in `features/README.md`. Inspect the current page, then type into `textarea[name="message"]` and click the `Send` button. Enter can select command autocomplete without submitting, so check that the composer clears and the message appears. Wait for the persisted reply and enabled composer. Capture reply text, preview fields, timing and network outcome. Use exact button labels from the current snapshot. Refresh to prove persistence.

Inventory every supported command, alias, behavior-changing flag, natural-language action, provider and channel. Each matrix row needs an ID, exact recipe, prerequisites, expected result, status and evidence. A partial smoke pass is not a full command run. Nansen may be marked skipped when the user excludes it; never turn missing credits into a pass.

On-chain lifecycle coverage includes preparation, approval, execution, independent receipt/state checks, cancellation, expiry, duplicate confirmations and supported reversals. An unsigned preview, mock receipt or simulation does not prove execution. Respect the operating agent's transaction restrictions. If signing is unavailable or prohibited, hand execution to the user and keep those rows blocked until independent evidence exists. Never ask the model to waive a warning or infer an amount, recipient, spender or approval.

Use one thread for a supplied sequential checklist. Preserve prerequisites: funding before spending, LP before staking, supply before borrowing, and Safe deployment before module operations. Do not execute a later row using an unrelated preview.

## Evidence

Store artifacts under `output/pecu-verification/YYYY-MM-DD-RUN/`: `results.json`, command inventory, screenshots, recording, exact deviation replies, checks and deployed versions. Keep private wallet data, confirmation codes, tokens and RPC credentials out of git, public reports and telemetry. Do not print secret-bearing environment files or raw provider errors.

Results format:

```json
{"scope":"partial","rows":[{"id":"wallet.web","status":"pass","evidence":["wallet.png"]}]}
```

Allowed statuses: `pass`, `fail`, `blocked`, `skipped`. Select the last completed **full** run as baseline and compare every row:

```sh
bun .cursor/skills/verify-pecu/scripts/compare.ts BASELINE_JSON CURRENT_JSON
bun test ./.cursor/skills/verify-pecu/scripts/compare.test.ts
```

Report regressions first. Any previously passing row now failed, blocked, skipped or missing is a regression, including excluded rows; state the exclusion separately. Do not overwrite a full baseline with a partial run. If no full baseline exists, say so explicitly and report the current scope without claiming regression completeness.

## Cleanup

Cancel only previews created by this run, and restore settings changed by this run. Stop and save the recording before closing only the tab or processes created for verification. Preserve all evidence after cleanup. Do not remove user history, balances, positions or modules as incidental cleanup. Publish reports privately through the canonical Reports publisher and verify anonymous access remains denied.

## Helpers

`scripts/compare.ts` checks baseline status and prints regressions before other outcomes; exit 1 means regressions, exit 2 means invalid input. The command inventory is generated from Pecu's source, not copied counts. `apps/pecu/scripts/probe-fallback.ts` measures isolated inference requests and workerd heap; its tools reject all wallet actions. Its timings are not production latency or lifecycle evidence.
