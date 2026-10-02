# Pecu Code Mode

Implemented on 2 October 2026. Deployment versions and live verification are tracked in the private evidence report linked below.

Pecu now uses `run_tools` as its normal model-facing tool across task families, including single reads and transaction proposals. It uses the installed `@opencode-ai/codemode` interpreter, pinned to the same beta as OpenCode. This follows Francesco's decision to use the pattern generally, even where individual interactions do not get faster.

The [earlier benchmark](55-pecu-codemode-benchmark.md) measured a 5.1x median improvement on large aggregations. Simple tasks showed small or negative changes. That experiment used a separate model loop; it does not establish an overall production speedup for this implementation.

## Execution

`apps/pecu/src/cloudflare/code-mode.ts` builds its catalog from the existing tool registrations. Input validation and capability handlers are shared with direct calls. No provider upgrade, transaction implementation, wallet identity, or storage migration is part of this change.

- The context hook exposes only the current skills' catalog. Research uses its existing role-specific catalog and read budget.
- Each host call rechecks the active session, verified turn and selected skills. Explanation-only turns have no Code Mode tool. A script cannot discover or invoke an unloaded tool.
- `ask_user`, `load_skills`, `aero_liquidity`, `research_findings` and `research_report` remain direct. They change available tools, stop the turn, or submit its result. They are unavailable inside scripts.
- Existing transaction proposals and YOLO rules remain in the capability handlers. Code Mode cannot approve a preview or enable YOLO. Writes should be awaited sequentially; independent reads may use `Promise.all` or `Promise.allSettled`.
- Plain JavaScript only. No imports, filesystem, fetch, timers, credentials, or persistent script variables. Tools return strings; JSON output must be parsed before field access. The instructions describe the chain metric and DEX result shapes and tell the model to reuse fetched values.
- Each script permits 24 tool calls, a 120-second interpreter deadline, 24 KB of retained result/log output, and 24,000 input characters. Interpreter diagnostics and formatting add overhead. Already admitted host calls settle before control returns; the deadline cannot roll back a transaction or forcibly cancel a provider request.
- On script failure, completed outputs are included within the remaining output budget, prioritizing the latest calls. Clipped results are marked. The agent is instructed to check state before repeating a write.

We use a Pecu-owned adapter instead of simply enabling OpenCode's native `execute`. The pinned native adapter has no configured execution limits, and filtering the outer tool list alone does not scope its nested catalog to Pecu's skills.

Nested calls publish the existing progress-stage contract and persist names, status, timing and output sizes for analytics. Analytics exclude script source, arguments and returned text. A stream reconciliation fix uses text ordinals instead of indexes into mixed text/reasoning content, avoiding a repeated reply prefix observed during the live runs. An absent analytics cursor no longer causes an undefined storage write.

## Verification

Run from `apps/pecu`:

```sh
bun scripts/probe-codemode.ts /private/tmp/pecu-codemode-check
bun scripts/probe-codemode.ts /private/tmp/pecu-codemode-live --live
bun run typecheck
bun run test
bun run build
```

The probe starts actual Workerd, SQLite Durable Objects, OpenCode sessions and Pecu registrations. Scripted cases supply provider SSE to force edge cases. Live cases use OpenRouter. Both use fixture wallet/chain services and have no signing capability. Evidence includes provider messages, tool results, progress stages and redacted analytics. The live fixture ends on 29 September 2026; the oracle counts only available daily values in the requested range.

The 14 scripted cases cover parallel reads, missing skills, invalid input, skill loading, partial failure, call/output limits, blocked fetch/imports/control tools, a proposal followed by an error, research-role isolation, explanation-only restrictions and attempts to call a hidden tool directly. The three live cases cover a wallet lookup, a one-read calculation over daily TVL and a transfer preview. The existing regression suite and four Worker dry-run builds also apply.

These are runtime integration checks, not a deployed wallet or real transaction test. The live ChatGPT subscription path and visible web/Android chat have not been exercised for this change.

## Channels and release scope

| Path | Decision |
| --- | --- |
| Pecu web, Android and X Chat | Same server-side model execution and reply behavior. Web/Android already consume generic progress stages; X Chat receives the final text. No new client contract. |
| OpenRouter and ChatGPT | Same registry/context hooks. Live OpenRouter verified; subscription routing has existing regression coverage, but no new live subscription run. |
| Scheduled runs and research | Same runtime; retain task grants and research role/budget checks. |
| Commands and CLI | Explicit commands continue through their existing handlers, without model-generated scripts. |
| BeeGreat Expo, web twin, iMessage and Bee agent | Separate runtime, outside this Pecu change. |
| Deployment | Deploy the Codex proxy before the Pecu main Worker, then publish the updated documentation through `pecu-app`. No Convex, container image, SDK mirror or client deployment is required by this change. |

Private evidence report: https://documents.buddytools.org/pecu-codemode-implementation-20261002/
