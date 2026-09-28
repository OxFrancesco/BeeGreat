# Pecu performance

24 September 2026. Implemented and tested locally. Pecu production has not been redeployed.

Explanation-only turns were sending 138 tool definitions even though only clarification was allowed. They now send only `ask_user`. Normal tool requests regain the full catalog. Provider fallback keeps the restriction until the explanation ends, and errors clear it for the next turn.

## Measured result

Five successful OpenRouter GPT-6 Luna probes per version, using the same one-word prompt. Each run starts a new conversation, with one cold turn and four warm turns. Wallet and external tool capabilities are disabled.

| Measurement | Before | After |
| --- | ---: | ---: |
| Tool definitions | 138 | 1 |
| First request body | 139,757 bytes | 11,891 bytes |
| Cold harness time | 5,887 ms | 2,761 ms |
| Warm median | 4,942 ms | 3,000 ms |
| Warm maximum | 5,802 ms | 5,399 ms |

Request bytes fell 91.5%. The observed warm median fell 39.3%. These sequential synthetic runs do not prove a production speedup or a stable p95. They exclude classifier time, web delivery, real tool-task quality and on-chain execution.

[Before samples](before.jsonl) · [After samples](after.jsonl)

## Production baseline

A two-day PostHog snapshot contained 14 completed web turns: median 18.1 seconds and p95 43.0 seconds. There were 44 model generations and 43 tool spans. Successful Polymarket reads took 0.08–0.52 seconds. Seven Nansen spans and one Polymarket markets span failed, so completed turns cannot all be treated as successful answers. Older generation timings cover streaming only.

Six live classifier probes took 281-901 ms. Explanation and live-data prompts routed as expected. One wallet-read phrasing fell back to the full agent twice. Keep the confidence threshold until routing quality has broader coverage. [Classifier samples](classifier.jsonl).

## Checks

- 450 tests passed, including Workerd SQLite, streaming and X Chat WASM integration tests.
- Pecu type checking and all four Worker build checks passed.
- Documentation site build passed.
- Tests cover both provider paths, fallback during an explanation, error cleanup, restored tools, session isolation and the existing transaction controls.
- Applies to shared Pecu web and X Chat inference. BeeGreat mobile, Android, CLI and iMessage use separate paths. No SDK changes.

## Regression coverage still open

[Follow-up command verification: failures and blockers](verification.html).

The [source inventory](command-inventory.json) lists 21 command verbs, 138 model tools, 24 direct on-chain tool actions, 30 Aave call definitions and four supported Aave signing actions. These counts overlap and are not execution results. Each command, alias, option, provider and channel still needs a recorded live result.

No transaction was prepared, signed or submitted. Full on-chain coverage requires a dedicated funded wallet and an approved plan specifying actions, assets, amounts, recipients or spenders, and fee limits. Mocked receipts and quotes do not count as execution coverage.

Classifier timeout, startup recovery and telemetry scheduling remain unchanged. Measure their contribution before changing them. The reusable maintenance skill already requires complete command and on-chain coverage, explicit blocked results, and comparable successful-run measurements.
