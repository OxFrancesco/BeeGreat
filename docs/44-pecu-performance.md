# Pecu performance verification

Explanation-only turns expose only `ask_user` to the model. The existing execution boundary still rejects account reads and transaction tools in this mode. The restriction lasts for the current turn, including a provider fallback, and clears on success or failure. Mixed and default turns retain their normal tools. Explicit Polymarket turns retain their existing catalog selection.

This applies to Pecu web and X Chat through their shared per-user inference object, on both ChatGPT and OpenRouter. BeeGreat mobile, Android, CLI and iMessage use separate agent paths and are not changed. No SDK, transaction contract, confirmation rule or persistent identity changes are required.

## Repeat the measurements

From `apps/pecu`, run:

```sh
PECU_PROBE_SAMPLES=5 PECU_PROBE_MODE=response bun scripts/probe-fallback.ts
bun scripts/command-inventory.ts > /tmp/pecu-command-inventory.json
bun run typecheck
bun run test
bun run build
```

The probe uses the existing OpenRouter key in the environment or `.dev.vars`. It starts an isolated local Workerd instance with every external tool capability disabled, runs one cold turn and the remaining warm turns, requires the exact answer `OK`, and removes its temporary credential file. It reports provider request bytes, tool count, HTTP response time and total harness time. It does not sign, submit a transaction or write production analytics. Each invocation uses a new conversation. Run the baseline and candidate with the same sample count and model.

The inventory reads Pecu's parser and exposed tool registries. It includes Aero parameter definitions and Aave call schemas. The model-routing regression test compares its tool list with the actual registered catalog. The small subcommand list and natural-language shortcuts still require source review after parser changes. Inventory generation is not execution coverage.

## Evidence from 24 September 2026

Five successful OpenRouter GPT-6 Luna probes per version, with the same prompt and reasoning setting:

| Measurement | Before | After |
| --- | ---: | ---: |
| Tool definitions per request | 138 | 1 |
| First request bytes | 139,757 | 11,891 |
| Cold harness time | 5,887 ms | 2,761 ms |
| Warm median, four samples | 4,942 ms | 3,000 ms |
| Warm maximum | 5,802 ms | 5,399 ms |

The request-body reduction is 91.5%. The observed warm median fell 39.3%. This is a sequential before/after probe, not a randomized experiment or a production latency guarantee. The prompt requests one word and does not measure tool-task quality, classifier time, web delivery or transaction execution. Four warm samples are too few for a stable p95.

The two-day PostHog production snapshot had 14 completed web turns, with median 18,052 ms and p95 42,972 ms. It also had 44 model generations and 43 tool spans. Completed turns are not proof of successful data retrieval: seven Nansen calls and one Polymarket markets call in those spans failed. Older generation timings omit provider wait, so they must not be summed as complete turn latency. There is no production before/after comparison yet.

Six live classifier probes took 281-901 ms. Explanation and live-data prompts reached their expected routes. The wallet-read wording "Please fetch the funds I currently hold" fell back to the full agent twice. This is a missed shortcut in these samples, not a reason to lower the confidence threshold. No routed command was executed.

## Remaining measurements

- Capture representative successful explanations and tool tasks before changing models, reasoning effort or provider routing.
- Measure classifier duration and route per turn before lowering its timeout. Explicit commands and transaction confirmations continue to bypass classification.
- Measure cold initialization with pending transactions separately from normal cold starts. Do not move recovery outside initialization without proving execution-lock and replay behavior.
- Measure session-log collection and telemetry processing before moving them off the reply path. Preserve cursor ordering, turn attribution and failed-request records.

## Full command regression gate

The source inventory currently identifies 21 command verbs, 138 model tools, 24 directly exposed on-chain tool actions, and 30 Aave call definitions. Aave signing additionally has four supported actions. Counts overlap across entry points and do not represent completed tests.

For each command, alias, behavior-changing option, provider and channel, record the recipe, prerequisites, expected result, evidence and pass/fail/blocked outcome. Run every supported command, including transaction execution and independent receipt/state verification. A quote, simulation, unsigned plan or mocked receipt cannot satisfy a live execution row.

Use a dedicated funded wallet and an approved bounded plan naming the chain, asset, amount, recipient or spender, action, and fee limits. Cover cancellation, expiry, duplicates, repeated confirmation, recovery, and supported reversals. This performance change does not authorize live signing. The full command-by-command live pass remains incomplete until every row has evidence; the ordinary test suite cannot replace it.
