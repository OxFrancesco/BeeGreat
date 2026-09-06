# BeeGreat branch and working-tree audit

Reviewed 2026-09-06. Recommendation: retain the substantive changes, fix two committed regressions, and split the remaining work for review. Do not approve the entire OxAlpha branch or publish Aero 0.1 yet.

## Verified repository state

- One registered worktree, on local `main` at `b32416565712293fa0789775dfb04bc8a402b438`.
- Local `OxAlpha` and `origin/OxAlpha` point to that same commit. The eight commits ahead of GitHub main are already backed up on GitHub through OxAlpha.
- Freshly fetched `origin/main` is `bb70697602ed15de9643cc6e9a79f5ab240cd9e6`. Local main is eight commits ahead and one behind.
- All 24 GitHub PRs are merged. There are no open PRs awaiting review or approval.
- Before this report: 74 modified tracked files, 35 untracked files, no staged files, no stashes. Untracked directories were expanded into individual files for this count.
- Thirty working files exactly match the incoming licensing commit. Fourteen other files touched by that commit also contain local work.
- A Git merge simulation of the two committed tips succeeds without conflicts. Its tree is `0ab72e6c8a898dfb8e393109e79aad94eefd821f`.
- After subtracting that merged baseline, the actual pending work is 79 files, 3,167 added lines and 507 removed lines, plus four binary report assets. This includes the previously untracked files.

Fetching pruned two already-deleted remote tracking refs, `agent/release-hygiene` and `agent/sandbox-cost-guards`. No branch was deleted, no source was changed, and the real Git index was left untouched. This report is the only added source-tree artifact from this audit. Build output is ignored.

## Branch decisions

All rows below refer to both local and corresponding origin branches.

| Branch | Evidence | Recommendation |
| --- | --- | --- |
| `main` | Eight ahead, one behind GitHub main | Preserve work, reconcile licensing, then integrate reviewed groups |
| `OxAlpha` | Same tip as local main | Keep as backup until its eight commits are integrated |
| `agent/fix-imessage-web3-swaps` | Ancestor of origin/main, PR #10 merged | Delete stale branch after approval |
| `agent/stabilize-flue-v2` | Ancestor, PR #11 merged | Delete stale branch after approval |
| `agent/workspace-build-hygiene` | PR #12 merged; only unique commit is `7cd2008`, a merge with the same tree as its first parent | Delete stale branch after approval; do not merge it again |
| `agent/beegreat-cli` | Ancestor, PR #13 merged | Delete stale branch after approval |
| `agent/google-firecrawl-integrations` | Ancestor, PR #14 merged | Delete stale branch after approval |
| `agent/web-realtime-voice-chat` | Ancestor, PR #15 merged | Delete stale branch after approval |
| `agent/web-settings-parity` | Ancestor, PR #16 merged | Delete stale branch after approval |
| `agent/cli-executable` | Ancestor, PR #17 merged | Delete stale branch after approval |
| `agent/sugar-sdk-mainnet` | Ancestor, PR #18 merged | Delete stale branch after approval |
| `agent/platform-automation-web3` | Ancestor, PR #19 merged | Delete stale branch after approval |
| `agent/platform-channel-safety` | Ancestor, PR #20 merged | Delete stale branch after approval |
| `agent/client-channel-parity` | Ancestor, PR #21 merged | Delete stale branch after approval |
| `agent/docs-compliance-launch` | Ancestor, PR #22 merged | Delete stale branch after approval |

The build-hygiene exception matters: a naive ahead/behind count reports one unique commit, but its merge contributes no new file content. The other twelve old agent branches are directly contained in origin/main.

## Committed work missing from GitHub main

These eight commits change 302 files overall. They belong to two review groups, despite sharing one branch.

| Commit | Change | Decision |
| --- | --- | --- |
| `216c7d7` | Sugar charts, analytics cache, browse UI | Keep with Sugar group |
| `8f34ac8` | Boundary parsing across clients, agent and shared packages, 184 files | Hold for web voice regression below |
| `f1a4070` | Backend Effect v4 and boundary migration, 89 files | Hold for Notion OAuth regression below |
| `3de086f` | CLI fuzzy token finder | Keep with Sugar group |
| `4880252` | TUI disk snapshots and refresh behavior | Keep with Sugar group and subsequent worker fixes |
| `e3dcb48` | TUI cursor and batched input fixes | Keep with Sugar group and subsequent picker regression fix |
| `1e5ee38` | Generated Convex API includes jsonValue | Keep with backend migration, not a separate feature |
| `b324165` | Token catalog deduplication and stable picker keys | Keep with Sugar group |

`bb70697`, the GitHub-only commit, preserves licensing and attribution. Retain it as the canonical licensing change. Do not recommit the thirty identical local copies as new work. Incorporate the additional edits in the fourteen overlapping files after establishing that baseline.

## Standards

Two confirmed P1 regressions block approval of the broad boundary migrations.

1. `apps/web/src/features/bee/use-realtime-voice.ts:51` makes `ping_timestamp` required through `z.unknown()`. The installed Zod rejects a normal event such as `{ "type": "response.created" }` when the field is absent. The handler at line 415 silently drops failed parses. Mobile already makes the field optional. Make it optional on web and verify response, transcript, audio and error events. This violates the client parity rule in AGENTS.md.
2. `packages/backend/convex/beennectorOAuth.ts:200` and line 208 reject null refresh tokens and workspace names. The parser then discards the entire successful response, including its valid access token. Calling the real exchange function with a mocked HTTP 200 reproduced `http_200` failures for either null field; omission succeeds. Accept and normalize the nullable fields documented in the [Notion token contract](https://developers.notion.com/reference/create-a-token), including relevant nullable user metadata.

Standards findings: two. Both can break existing user flows and should be fixed before the broad refactors merge.

## Spec

The uncommitted Sugar work was compared with `artifacts/aero-0.1-review.md` and the FRA-541 report. Three confirmed requirements remain partial or open.

1. R01 says to show the selected address before signing. `packages/sugar/src/send.ts:63` still summarizes swap assets by symbol. The TUI at `src/tui/screens/action.tsx:365` displays transaction targets, which can be routers, rather than both asset addresses. Add the resolved assets to the shared confirmation summary before marking this requirement complete.
2. R09 requires explicit ALM position identity. `src/alm/engine.ts:240` still starts with pool-only selection, and `src/alm/config.ts:16` has no NFT selector. Multiple NFTs now fail safely, but the requested NFT ID cannot be supplied through ALM configuration. Add selection or document and enforce one NFT per wallet and pool.
3. R15 calls for one managed WalletConnect client and exact account/chain permission checks. `src/walletconnect.ts:101` still initializes per submission. Lines 44–55 flatten chain-specific accounts, line 76 requests unused signing methods, and lines 102–108 only check that the session exists. The licensing commit changes branding, not this lifecycle.

The journal and ALM changes implement the documented conservative recovery design: atomic persistence, blocking unknown submissions, receipt reconciliation, manual resolution and disabled Safe execution. No additional confirmed replay defect was found in the reviewed changes. EOA ALM fork verification, packaging and other explicitly open items in the release review remain outstanding. Those are release limits, not reasons to discard the safety fixes.

Spec findings: three. The missing asset addresses are the most immediate gap in the normal transaction confirmation flow.

## Pending work to preserve and split

| Group | Main files | Decision |
| --- | --- | --- |
| SDK correctness | `actions.ts`, `client.ts`, `models.ts`, `positions.ts`, `prices.ts`, `transactions.ts`, `helpers.ts`, `quotes.ts`, `cache.ts`, `internal/*`, `wallet.ts`, related tests, `bun.lock` | Keep and commit together with matching documentation. These fix asset binding, native/WETH behavior, NFT selection, pricing anchors, mnemonic validation, cache expiry and route limits |
| Execution recovery | `send.ts`, `execution-journal.ts`, `cli/execution-commands.ts`, `cli/run-action.ts`, CLI root and TUI callers, related tests | Keep API changes and callers together. Complete the shared asset confirmation summary before approval |
| ALM safeguards | `alm/chain.ts`, `engine.ts`, `state.ts`, `recovery.ts`, `roles.ts`, `simulate.ts`, CLI ALM commands, guide, tests and docs | Keep after execution recovery. Keep Safe execution disabled and EOA support experimental; resolve NFT selection scope |
| TUI performance and input | `tui/worker*.ts`, `sugar-runtime.ts`, `sugar.ts`, `logo.tsx`, dialogs, screens, CLI token input, `scripts/build-cli.ts`, `scripts/tui-performance.ts`, package scripts and tests | Keep after SDK/execution changes. This completes the earlier five Sugar commits; build CLI and worker together |
| Review evidence | `artifacts/aero-0.1-review.md`, `reports/fra-541/**` | Preserve as a separate documentation/evidence change. Four media files total about 1.9 MB; decide storage separately from source approval |
| Scratch preview | `packages/sugar/_preview.tsx` | Discard candidate. A 20-second standalone logo experiment with no package-script reference |
| Verification guidance | Additional eight lines in `AGENTS.md` | Keep with Sugar validation changes |

These are hunk-level boundaries. `README.md`, the numbered Sugar document, CLI guide, package scripts, CLI root and the action screen contain overlapping groups. Do not stage whole shared files into an arbitrary first commit. Typecheck each extracted group after its prerequisites.

## Recommended integration order

1. Preserve a durable snapshot of all pending files before changing branches or the index. The audit made an isolated-index snapshot without changing the real index; do not rely on an unreferenced Git tree as a permanent backup.
2. Start an isolated integration branch from fresh origin/main, preserving `bb70697` and all notices. Do not force-push local main over GitHub main, and do not run a blind pull over the dirty checkout.
3. Prepare the broad boundary migration group with both regression fixes and `1e5ee38`. Prepare the five Sugar commits in their original relative order as a separate group. Check their extraction against the licensing baseline and any shared dependencies.
4. Apply the residual SDK correctness, execution recovery, ALM and TUI groups in the dependency order above. Retain the tests and user-facing scope documentation with each group.
5. Re-run focused checks on each actual candidate branch. Test real web voice and Notion connect/reconnect before approving the migration group. Test the supported transaction paths on a fork before approving an Aero release. Current dirty-checkout tests are not proof that every extracted commit works alone.
6. Merge reviewed groups, then synchronize main without rewriting published history. Remove OxAlpha only after its changes are included. Delete the thirteen stale agent branches and the scratch preview after cleanup approval.

## Verification and limits

| Check | Result |
| --- | --- |
| Sugar package tests | 286 passed, 35 files |
| Backend Vitest suite | 315 passed, 51 files |
| Focused CLI, iMessage, chat sync and tool presentation tests | 111 passed |
| Focused agent tests, with its package preload | 58 passed |
| Web tests | 37 passed, 13 files |
| Codex adapter tests | 5 passed |
| Total tests in successful runs | 812 passed |
| Sugar, backend, web and mobile TypeScript checks | Passed |
| Sugar lint | Passed |
| Sugar CLI and worker build | Passed, both output files produced |
| Working diff whitespace check | Passed |
| Merge simulation for committed main tips | No conflicts |

Tests ran against the current checkout, including dirty Sugar dependencies. The two migration regressions were separately reproduced and are not caught by those passing suites. The initial root-directory agent invocation lacked its Cloudflare preload; the corrected package-directory run passed. Performance timings from the earlier FRA-541 report were not remeasured in this audit.

Client coverage: mobile/web types, web tests, focused CLI/iMessage/shared tests and source comparisons. Entry points: voice has a confirmed regression; settings OAuth has a confirmed regression. Provider coverage: Codex adapter tests and focused agent tests passed; live OpenRouter/Codex sessions were not exercised. Contracts: shared Sugar changes affect backend consumers, and the generated API belongs with its backend module. Reverse states: execution and ALM recovery were reviewed; WalletConnect lifecycle remains incomplete. Deploy targets: no Convex, Worker, Railway or app deployment was performed. Docs: retain the changed numbered Sugar document, README, guide and review evidence with their owning groups.

No real wallet was unlocked and no transaction was signed or broadcast. No source commits, PR approvals, merges, branch deletions or package publications were performed.
