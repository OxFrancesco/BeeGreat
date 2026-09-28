# Pecu command verification

24 September 2026. Outcome: blocked. Production was tested without deploying the local performance patch. No transaction was signed or submitted.

The maintenance skill now requires every exposed command, alias, option and tool action, including complete on-chain execution lifecycles. This run does not meet that completion bar. The [coverage matrix](verification-coverage.json) accounts for all 138 model tools, 21 command verbs and 30 underlying Aave calls, and records the remaining gaps.

## What needs fixing first

1. **Agent memory resets.** A seven-tool public-wallet request, a three-tool EVM read request, and a single `evm_decode` request in a fresh thread all failed with the Durable Object memory-limit error. Cloudflare confirmed `UserInference` exceeded memory. A fresh conversation did not resolve it. Measure memory during catalog construction, session creation and tool execution before changing limits or attributing the cause to conversation length.
2. **Allowance timeouts.** Two `/allowance USDC` requests failed. Cloudflare recorded `allowance` and `token` CLI timeouts at the 90-second sandbox limit, with observed durations around 90–102 seconds. An earlier token read succeeded, and approval/revoke previews eventually succeeded. Isolate sandbox startup, concurrent CLI execution and RPC waits. Parallel allowance/metadata requests are a hypothesis, not a proven cause.
3. **Aave error warnings are read from the wrong place.** The live API returned `data.warnings` with `INSUFFICIENT_BALANCE` or `EXCEEDS_BORROWING_POWER`. Pecu checks top-level `warnings`. The real `AaveService.propose` continued from the error-bearing simulation into `prepare_action`; Aave rejected preparation. Nothing was signed. Existing tests place warnings at the top level, so they miss this live schema mismatch. Add the captured response shape to regression fixtures and stop before preparation on nested error warnings.
4. **Polymarket results disappear in formatting.** `holders` and `rewards` returned records but the web replies showed only pagination/source text. `market_by_token` showed only its source line. `clob_market` exposed `r`, `t` and `fd` instead of useful labels. The generic formatter's field allowlist does not cover these response shapes. API success is not a successful user answer.
5. **Nansen coverage is blocked by exhausted credits.** Token information, flow intelligence and several individual market-data tools returned results. Explicit public-wallet balances and P&L returned empty data. Portfolio and market-search commands then reported exhausted credits. `token_flows` completed as a tool but reported unavailable flow values; the raw mapping still needs investigation.

Other observations: the default Polymarket events page showed no markets because presentation filters closed markets from a historical page. Event-detail dates and order-book last-trade values also deserve provider consistency checks before being treated as reliable summaries.

## Evidence obtained

| Check | Result | What it proves |
| --- | --- | --- |
| Polymarket integration | 52 endpoint responses, no API/schema failures, applicable pagination checked | Production integration can read the sampled public inputs |
| Polymarket web commands | All 52 endpoints returned; four confirmed presentation failures | Explicit command routing and web rendering, with the failures above |
| Polymarket research | Explicit research command returned sourced market-implied odds | Independent Exa research path passed; does not prove model-tool invocation |
| Aave integration | 26 calls covering 24 distinct read tools returned | Live service responses, including empty or partial-coverage results |
| Aave model path | `aave_schema`, `aave_skill`, public-wallet `aave_call` passed | PostHog confirmed each invocation without a tool error |
| Aero isolated CLI | 10 passed, zero failures/skips/flaky results | Dedicated test-wallet read suite; not production Worker parity |
| General web commands | Help, wallet, balances, token, holdings, quotes, Aero reads, deposit status and validation exercised | Current signed-in web path only |
| Transaction previews | Swap, exact approval and revoke previews produced and cancelled | Preview/cancellation only, no execution proof |
| Confirmation validation | Unknown codes rejected; self-transfer rejected; confirming a cancelled revoke rejected; repeated cancellation remained inert | Negative paths only |

[Read integration results](polymarket-read-results.json). Browser evidence remains in the [main command thread](https://pecu.app/agent?t=b9c0e467), [public analytics thread](https://pecu.app/agent?t=5cf2908c) and [Polymarket command thread](https://pecu.app/agent?t=ba2f3859). They require the existing account.

External analytics used public fixture data. The private account wallet was not supplied to Nansen or Aave. The three cancelled previews were a 0.000001 ETH to USDC swap on Base, a 0.001 USDC allowance to the discovered Aave Base pool, and an allowance reset to zero for that same spender. YOLO stayed off.

## What remains blocked

- Full on-chain execution, independent receipts, resulting balances/allowances, cleanup and interrupted-execution recovery. There is no approved capital/gas budget or completed user signing handoff.
- Remaining Nansen tools, pending credits.
- Reliable model-tool coverage, pending the reproduced memory failure. Nine model tools have confirmed successful invocation; six rows fail execution or useful output; the other 123 rows remain blocked under the strict full-verification criterion. Many blocked rows have successful direct-command or standalone integration evidence, recorded separately in the matrix.
- Safe operations need a test Safe, explicit independent owners and thresholds, applicable modules and a registered passkey where required. Lending exits need positions; swaps and lending entries need suitable balances/collateral. Public Aave quote preparation was rejected, and three state-dependent Aave reads lack returned position/order/transaction identifiers.
- Whop account creation and actual deposits require setup and user handoff. No funding account was created.
- Exhaustive aliases/options, X Chat delivery and both inference-provider paths are not proven. Pecu still needs its own maintained verification skill and detailed feature/option matrix; the Aero skill covers the SDK only.

The earlier 450-test suite, type checks, four Worker builds and site build passed for the local performance patch. Those checks did not detect the live failures above. No command-wide p50/p95 or production speedup is claimed. Retained evidence is under `/private/tmp/pecu-full-verification` and the isolated Aero run `20260924-152401-reads`.

Product fixes were not made during this verification pass. The invoked maintenance skill explicitly limits edits to verification materials and requires reporting product regressions rather than changing product behavior during the audit.

After explicit user approval, the already-cancelled revoke code was tested. Confirmation returned “This proposal is cancelled and cannot be executed.” Repeated cancellation returned “This proposal is already cancelled.” The earlier automatic-review blocker is resolved for this test. No code is included in this report.
