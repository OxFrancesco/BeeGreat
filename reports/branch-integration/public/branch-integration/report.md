# BeeGreat branch integration

2026-09-06. Retained the substantive work, fixed the audit findings, and preserved upstream licensing without rewriting published history.

Source is pushed to `main`. Removed OxAlpha and thirteen obsolete agent branches locally and on GitHub, then removed the temporary local integration branch. Only main remains.

## Changes

- `74b00a2` reconciles local main with the incoming licensing commit. A verified bundle preserves every original branch and pending file.
- `197e824` fixes web voice event parsing and nullable Notion OAuth responses.
- `361bf21` binds asset identity and hardens pricing anchors, NFT lookup, cache freshness and route limits.
- `8b7c4c6` integrates durable transaction recovery, ALM safeguards, wallet validation, WalletConnect permissions and TUI workers. These callers share execution and lifecycle contracts, so they remain in one coordinated commit.
- ALM follows a configured NFT through replacements and manual recovery. Recovery verifies the repaired NFT belongs to the same wallet and pool before resuming management.
- Swap, deposit and withdrawal confirmations include asset addresses. Native ETH retains its native identity.
- The worker close handler no longer terminates an already closed worker. The regression test covers termination, rejected pending work and restart.
- `2249724` fixes reopening a token picker with its saved full contract address, with a headless regression and live Ghostty verification.
- The unused `_preview.tsx` experiment was removed after backup. Existing review documents and FRA-541 media were preserved.

## Verification

| Check | Result |
| --- | --- |
| Sugar tests | 295 passed across isolated file runs |
| Backend tests | 316 passed |
| Web tests | 44 passed |
| CLI, iMessage, chat sync, tool presentation and Codex adapter | 116 passed |
| Agent tests | 58 passed |
| Total | 829 passed across completed runs |
| Sugar, backend, web and mobile types | Passed |
| Sugar lint and CLI/worker build | Passed |
| Three-run TUI frame gate | p95 26 to 27 ms, maximum 37 to 69 ms |
| Live Ghostty picker | Navigation, filtering and selected USDC address verified |
| Secret scan | Two token-contract test fixtures flagged; both reviewed as public addresses |

The combined Sugar run passed 294 tests before the final picker regression was added. Later combined runs intermittently crashed Bun 1.3.14 during forced worker termination, including after the duplicate termination call was removed. All 295 tests passed in isolated file runs; one wall-clock RPC deadline test needed a dedicated rerun after machine contention. The native crash remains a verification limitation. Timing checks also failed under concurrent load, then three dedicated runs passed the unchanged 34 ms p95 and 80 ms maximum thresholds.

## Coverage and remaining release work

Shared SDK changes reach Bee consumers through the same package. Mobile/web types and shared, CLI, iMessage and agent tests pass. The voice parser change applies to web and matches mobile's optional timestamp behavior. OAuth parsing is shared in Convex. Rich channel rendering and OpenRouter/Codex transports keep their existing contracts; the added pool address fields are additive. Execution recovery and WalletConnect disconnect paths were reviewed.

This integrates source. It does not deploy Convex, the Bee agent Worker, Railway or mobile/web apps. Live Notion authorization, voice sessions and WalletConnect pairing remain unverified. No wallet was unlocked or transaction signed. Aero stays private, Safe execution stays disabled, and experimental EOA ALM still needs fork tests. Standalone packaging, dependency advisories and remaining release-review items are recorded in `aero-0.1-review.md`.

The completion report and picker recording are hosted at https://reports.buddytools.org/branch-integration/.
