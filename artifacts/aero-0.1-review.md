# Aero 0.1 release review

Reviewed 2026-09-05 by Devin. BeeGreat branch `main`, source commit `b324165`.
Scope: `packages/sugar`, its SDK, CLI, TUI, ALM, wallet code, and standalone packaging.

## Integration checkpoint, 2026-09-06

The branch integration preserves the original review below as historical evidence. Source commits `197e824`, `361bf21` and `8b7c4c6` address the audit findings. Swap and liquidity confirmations include resolved asset addresses. ALM config accepts an NFT selector and persists replacements through successful cycles and manual recovery. WalletConnect shares one client and validates current account, chain, method and expiry permissions before sending. The TUI worker now avoids terminating an already closed worker.

The current package typecheck, lint and CLI/worker build pass. The final validation and branch cleanup are recorded in `branch-integration-2026-09-06.md`. Keep `private: true`. Safe execution remains disabled; EOA ALM fork coverage, standalone distribution, dependency advisories and the other release checks below remain separate unfinished release work. Live Notion OAuth, voice-provider sessions and WalletConnect pairing were not exercised.

## Historical verdict

Do not publish yet. The working tree now contains the earlier identity, plan, wallet, pricing and cache fixes, plus the point 4 ALM safeguards described below. Safe keeper execution and setup are disabled for 0.1. EOA ALM execution remains experimental until contract/fork verification covers its multi-transaction lifecycle. Packaging, CLI/TUI lifecycle work and release verification are still open.

This is a source review with offline reproductions, not a contract audit or proof of mainnet safety. No real wallet was unlocked, no blockchain transaction was signed or submitted, and no package was published. No public report was deployed.

## Implementation checkpoint: point 4

Point 4 is implemented with a conservative recovery contract: persist progress, reconcile receipts, and require manual repair after interruption. It does not promise automatic continuation of a partially completed rebalance.

| Finding | Current status |
| --- | --- |
| R01, R02, R03, R07 | Earlier changes bind asset addresses and execution plans, validate mnemonics, and persist transaction outcomes. Package regressions pass. TUI lifecycle verification remains in point 5. |
| R08, R09, R10, R12, R13 | Earlier changes add price anchors, exact NFT lookup, native/WETH separation, cache expiry/invalidation, and bounded route enumeration. Package regressions pass. |
| R04 | Mitigated by excluding Safe execution and permission setup from 0.1. Unrestricted swapper and Permit2 grants were removed. This is not a verified replacement keeper policy. |
| R05 | Durable EOA cycle records, per-phase transaction journals, exclusive local locking, fail-closed state loading, receipt-only reconciliation and explicit manual resolution are implemented. |
| R06 | Rebalance and compounding paths now check TWAP before each submission. Local fallback weights elapsed time, requires full-window coverage, and rejects long sampling gaps. |
| R11, R14, R15, R16 | Still open except for individual fixes already made in the earlier work. Complete the CLI/TUI pass before claiming these findings resolved. |

### What changed in point 4

- Safe execute mode is rejected before wallet unlock in the CLI and before RPC work in the engine, including configurations supplied directly to the engine. `aero alm safe-setup` and role-configuration encoding also fail closed. Dry-run observation remains available.
- Removing local grants does not revoke deployed roles. Safe owners must review and revoke old keeper membership or disable the affected Roles module. The README and built-in ALM guide no longer claim that a compromised keeper cannot take funds.
- `src/alm/chain.ts` integrates tick values over elapsed time, clips the window boundary, rounds negative averages down, retains the predecessor sample and rejects incomplete, stale, unordered or non-finite data. Engine fallback rejects gaps longer than two configured poll intervals.
- Compounding checks the manipulation gate before claiming. Every transaction rechecks it immediately before submission, including actions after approvals. A changed gate leaves the unsent step `ready`, not falsely `submitting`.
- State keys include chain, wallet and pool. Each cycle records its ID, operation, original NFT ID, intended range, timestamp, balance baselines, phase execution IDs and status. A successful rebalance also records the replacement NFT ID. Subsequent reads of the original position use its exact NFT ID.
- The engine refreshes position snapshots in execute mode, clears snapshots after confirmed phases, validates the RPC chain and rejects signer/owner mismatches. A missing replacement NFT or failed restake leaves the cycle unresolved rather than reporting success.
- State and transaction journals use private temporary files, file sync, atomic rename and directory sync. Corrupt safety state blocks execution. A state-file lock spans the entire ALM pass; stale locks are never stolen automatically. Existing legacy cooldown entries remain readable and are inherited when an owner-specific entry is first written.
- Attempts consume rebalance cooldown/daily limits at cycle start. Compound attempts start the 24-hour interval. Partial failures and manual resolution do not erase those limits.
- Restart reconciliation only checks already-known hashes. Even if every known phase confirms, the cycle stays blocked until an operator reviews and resolves it. The block applies to the wallet and chain before looking up positions, so burning the original NFT cannot hide an interrupted cycle.
- `aero alm status` exposes interrupted cycles without needing to find the old NFT. `aero alm recover --id <cycle-id>` reconciles receipts without signing. `aero alm resolve --id <cycle-id> --note <verified-outcome>` requires confirmation, rejects unknown/pending submissions and cancels unsent remainder after manual repair. Generic `executions resume` refuses ALM phase journals.
- File-journal testing caught an additional plan comparison bug: equivalent transactions with different property insertion order compared unequal after reload. Plan construction now produces a canonical field order.
- Receipts must match the submitted hash. A successful replacement or cancellation is not silently accepted as execution of the original plan; it remains unresolved for operator review.

### What is still missing

**ALM support limits and release verification**

1. Safe keeper mode needs a verified on-chain restriction design and adversarial tests for router commands, nested calldata, recipients, token paths, amounts, slippage, mint destinations and NFT scope. It remains disabled; no bypass flag was added.
2. EOA ALM needs fork tests for the full claim/unstake/withdraw/burn/swap/mint/stake cycle and compounding, including ERC20/native legs, multiple NFTs, adverse price movement between transactions, approval effects, reverts and reorgs. Offline tests do not establish deployed contract compatibility or economic safety.
3. Recovery is deliberately manual, not an automatic phase-resume engine. Partial positions must be repaired externally. Unknown submissions without a hash, missing/corrupt journals and stale locks require operator investigation; there is no automatic proof that an unknown transaction did not execute and no command to force-clear that uncertainty.
4. Locks coordinate processes using the same local state location. Multi-host coordination and simultaneous external trading in the managed wallet are unsupported. Balance-delta attribution assumes no unrelated transfers/trades during the cycle. Only the latest cycle per wallet/pool is retained in ALM state; transaction journals remain on disk.
5. Local TWAP is a sampled estimate, not the pool's oracle. Neither it nor simulation removes MEV, RPC trust, reorg or price-movement risk. Longer confirmation/finality policy, disk-failure/process-kill tests and Linux/Windows filesystem behavior still need verification.

**Remaining implementation-plan work**

- Point 5: finish CLI/TUI lifecycle and governance support decisions; verify chain/wallet changes, async teardown, WalletConnect session/account authorization and disposal, paid analytics opt-in, redundant prefetches and the remaining R16 UX defects. The full package lint currently fails on the pre-existing `props.action as SugarTxAction` assertion at `src/tui/screens/action.tsx:195`. This continuation did not change the TUI.
- Point 6: build JavaScript and declarations; define runtime support and SDK/CLI dependency boundaries; pack and install into a clean consumer; verify bins/subpaths, standalone lint/CI and production dependency advisories. Keep `private: true`. Do not publish without a separate instruction.
- Point 7: consolidate permanent regressions and verify Bee consumers of shared SDK contracts. The temporary review scripts are already absent from this working tree. Backend/mobile/web/iMessage end-to-end checks were not rerun during this ALM-only continuation.
- Point 8: keep this status table current after those passes and record fork, packaging, dependency and cross-consumer evidence. This document has been updated through point 4, not through release completion.

### Current verification

- `bun run --cwd packages/sugar test`: **257 pass, 0 fail**, 1,018 assertions across 28 files.
- `bun run --cwd packages/sugar typecheck`: passed.
- `bun run --cwd packages/sugar lint`: one remaining TUI assertion error noted above. No ALM lint errors were reported. Journal/sender lint errors inherited from the earlier changes were fixed while verifying the persistence path.
- Focused Oxlint over `src/alm`, ALM/recovery CLI commands, the guide, sender and execution-journal files: 0 errors across 26 files. `git diff --check` passed.
- New offline ALM coverage includes elapsed-time TWAP, compound gates, uncertain receipt restart, post-withdraw manipulation changes, successful replacement-NFT recording, approval/action guard changes, local lock contention, corrupt state, legacy keys, reverted/pending receipts, manual resolution and identity mismatches.
- CLI help checks for `alm recover` and `alm resolve` passed. `alm safe-setup --safe <test-address>` rejected with the disabled-for-0.1 message before RPC/setup output.
- Tests use isolated temporary state and stubbed signing/RPC boundaries. No real transaction was signed or broadcast, no wallet was unlocked, no package was published, and no public report was deployed.

## Original review evidence

The findings below preserve the original review and its historical line references. Use the checkpoint above for current status; those references are not current source locations.

- Original package suite: 224 passing tests across 24 files, 950 assertions.
- At the original review checkpoint, package tests, lint, TypeScript checks and `git diff --check` passed after the temporary fixtures were removed. Implementation changes described above came afterward.
- Twelve focused offline checks reproduced the behaviors described below. They assert current behavior, not that the behavior is correct.
- One OpenTUI headless rendering test reproduced a Base plan being handed to the sender with Optimism's chain ID. Wallet, RPC, and sender boundaries were stubbed. No transaction was broadcast.
- Node 24.18.0 could not import `src/index.ts`, failing with `ERR_MODULE_NOT_FOUND` for the extensionless `src/config` import.
- Browser bundling of the complete SDK export entrypoint succeeded. The minified output was 550,914 bytes. This is not the size of a tree-shaken consumer importing only one utility.
- `bun pm pack --dry-run --ignore-scripts` listed 131 files and approximately 1 MB unpacked before the temporary review fixtures existed. It included tests, source, and standalone CI configuration.
- `bun audit --json` reported workspace-wide advisories. The installed Viem 2.33.1 dependency resolves `ws` 8.18.2, which falls within the reported memory-disclosure and memory-exhaustion advisory ranges. Exploitability of those code paths in Aero was not demonstrated.
- Live quotes, contract execution, WalletConnect pairing, native Keychain behavior, cross-chain relay delivery, and a clean external tarball installation were not tested.
- The TUI evidence is a captured character frame, not a desktop screenshot. Existing capture targets contained active user sessions, so they were not recorded.

## Release blockers

### R01. A listed token symbol can resolve to an unlisted namesake

Priority: P1. Security and correctness. Reproduced offline.

`src/cli/tokens.ts:70-72` validates an exact symbol against the listed catalog, but leaves the symbol in the parameters. `src/tokens.ts:54-58` later searches the full catalog. `src/models.ts:323-330` selects the first matching symbol, including unlisted tokens.

The TUI has the same identity problem. `src/tui/screens/action.tsx:148-151` stores a symbol when it is unique in the listed picker, and manually typed symbols bypass the CLI resolver entirely.

Reproduction: a listed USDC at address B passes the CLI resolver; the full catalog contains an unlisted USDC at address A before B; the action resolves A.

Fix: carry the selected chain and contract address through every layer. Preserve a distinct native-token representation. Make ambiguous SDK symbol lookup fail rather than taking the first match. Show the selected address before signing.

### R02. A reviewed plan is not bound to its chain and signer

Priority: P1. Fund safety. Chain-switch path reproduced through OpenTUI.

The TUI's `Plan` type contains no chain or signer binding. `src/tui/screens/action.tsx:205-210` sends the saved steps using the current `app.chain`. `src/tui/app.tsx:25-34,71` permits a chain switch without resetting the action component. The existing plan survives.

The headless test built on chain 8453, changed the app chain to 10, then observed `sendPlan` receiving chain 10 with the old plan. The same screen still displayed the Base quote.

`src/send.ts:144-159` also does not compare each transaction's `from` with the signer address. An offline check confirmed it accepts a different signer. The local signing adapter uses its derived account and ignores the transaction's `from` field.

Fix: an immutable plan envelope must contain chain ID, expected sender, creation time, expiry, and confirmed bounds. Invalidate on chain/account changes. Recheck all bindings immediately before sending. Apply the same contract to CLI, TUI, and ALM.

### R03. An uncertain receipt can lead to duplicate execution

Priority: P1. Fund safety. Reproduced with a stub sender and failing receipt lookup.

`src/send.ts:149-159` keeps hashes in a local array and throws if receipt lookup fails. It does not return structured partial progress. `src/tui/screens/action.tsx:215-218` returns to the original signable plan after any broadcast error.

If submission succeeded but receipt lookup timed out, pressing sign again starts the plan from step one. For a native swap this can repeat the entire swap with a new nonce. The reproduction observed two sends for the same plan after two receipt failures.

Fix: persist submitted hashes and phase status before waiting. Treat receipt failures as unknown execution state, reconcile before retrying, and never replay completed or unresolved steps automatically. Disabling the sign button alone does not solve restart recovery.

### R04. Safe keeper permissions do not enforce the advertised spending restriction

Priority: P1. Security boundary. Permission construction verified; no live exploit attempted.

`src/alm/roles.ts:268-276` grants `allowFunction` for the swapper's `execute(bytes,bytes[])`. It does not constrain the encoded commands, recipient, token routes, amounts, or output minimum. Other role conditions pin NFPM recipients and approval spenders, but do not constrain this nested command interpreter.

The local and upstream planner definitions contain caller-specified recipients and commands such as swaps and sweep. The tests verify selector and approval restrictions, not recipient restrictions inside arbitrary swapper command bytes.

The README claim that a leaked keeper cannot move funds out is not established by these permissions.

Fix: remove unrestricted swapper access or put a narrowly scoped executor in front of it that validates every permitted operation and recipient. Verify the actual deployed router semantics and run adversarial fork tests. Remove the absolute safety claim until verified.

### R05. ALM has no durable recovery between destructive rebalance phases

Priority: P1 if ALM execution ships. Static execution-path finding.

`src/alm/engine.ts:312-407` claims, unstakes, withdraws and burns, swaps, deposits, and stakes in separate transactions. A failure after withdrawal leaves funds outside the position. The next pass begins by locating the old position again, rather than resuming from a persisted phase and balance record.

`src/alm/engine.ts:187-192` records the rebalance only after the full cycle succeeds. `src/alm/state.ts:27-48` resets caps to empty when state is unreadable and writes state non-atomically. No process lock prevents two daemons or overlapping cron jobs from operating on the same owner and position. State keys contain chain and pool, not wallet and NFT identity.

Fix: journal intent, NFT IDs, phase, submitted hashes, and balance ownership before each submission; reconcile on restart; use atomic writes and an execution lock; fail closed on corrupted safety state. Count attempts and partial executions according to an explicit policy.

### R06. Compounding bypasses the rebalance manipulation guard

Priority: P1 if auto-compounding ships. Reproduced offline.

`src/alm/engine.ts:157-160` calls `maybeCompound` and returns before the TWAP check at lines 174-179. `executeCompound` can then swap claimed emissions and modify the position.

An in-range staked-position fixture entered compound execution with zero TWAP oracle reads. The fixture deliberately stopped before transaction construction.

The local TWAP fallback also averages sample values rather than weighting elapsed time, `src/alm/chain.ts:50-58`. Irregular polling therefore changes the meaning of its manipulation threshold.

Fix: enforce a shared manipulation gate for every automated swap/deposit path, including compounding. Use elapsed-time weighting and adequate window coverage for local fallback data, or wait for a usable on-chain TWAP.

### R07. Wallet restore does not validate BIP-39

Priority: P1 for the restore feature. Reproduced without saving a wallet.

Both `src/cli/wallet-commands.ts:28-36` and `src/tui/screens/wallet.tsx:100-105` use successful `mnemonicToAccount` derivation as mnemonic validation. The installed implementation derived an address from twelve repetitions of `notaword`.

A typo can be accepted as a successful restore into a different account. The code also needs an explicit decision about BIP-39 passphrases and derivation paths, rather than implying every external wallet can be restored by words alone.

Fix: validate the word list and checksum before deriving or replacing anything. Show the derived address for confirmation. Keep encryption-password handling distinct from BIP-39 passphrases.

## Functional issues to fix before declaring support

### R08. Price reads require hidden anchor tokens

Priority: P1 for advertised analytics and quote guards. Reproduced offline.

`src/prices.ts:17-56` does not add pricing anchors. `src/models.ts:41-55` requires the stable token in the caller's input and uses the native token's rate. A single-token `getPrices([AERO])` call fails because the stable token is absent; omitting native while including stable can produce zero prices.

`src/tui/analytics/load.ts:45` uses the single-token form, then `loadOnchain` silently drops ve statistics on failure. The action-layer sanity filter passes just the swap pair to `getPrices`, so many pairs silently lose that filter too.

Fix: query required anchors internally, return only requested tokens, and distinguish unavailable pricing from zero prices. Apply the safety policy consistently to direct SDK swaps, action handlers, and ALM.

### R09. Exact CL position selection breaks when the pool has multiple NFTs

Priority: P1 for position actions. Reproduced offline.

`src/actions.ts:130-145` takes the `getPositionByPool` shortcut whenever a pool is supplied, then checks the requested NFT ID against that one result. `src/positions.ts:80-92` discards all but the first matching position.

The TUI always presets both pool and ID, `src/tui/screens/browse.tsx:291-301`. An action for the second NFT in the pool fails with `position not found`; the same ID without the pool succeeds in the reproduction. ALM's pool-only identity is also ambiguous when multiple NFTs exist.

Fix: exact NFT IDs must take precedence. Add a targeted position-ID lookup and require explicit position identity for ALM. Pool-only lookup must reject ambiguity or expose all matches.

### R10. Native and wrapped-native assets are conflated

Priority: P1 for liquidity support. Reproduced offline.

`src/transactions.ts:264-266` treats WETH itself as a native leg. A deposit explicitly built with WETH produced `addLiquidityETH` and nonzero transaction value rather than spending WETH. Basic withdrawals unwrap the wrapped-native leg regardless of the optional unwrap flag.

`src/models.ts:259-260` compares the pseudo-address `ETH` with token contract addresses. It rejects ETH/USDC in wrapped-address canonical order and accepts USDC/ETH in the opposite order on Base.

Fix: distinguish native ETH from ERC-20 WETH throughout the model. Make wrapping/unwrapping explicit, order by normalized contract addresses, and keep entered amounts and price orientation aligned with the reordered tokens.

### R11. Governance CLI has a way in but not a usable lifecycle

Priority: P2, or narrow the stated 0.1 scope.

The SDK has lock reads, voting, claims, extensions, and withdrawal. The shared CLI/TUI actions expose only lock creation. A user can lock AERO/VELO but cannot inspect or manage that lock through the same application.

Fix: ship at least lock listing/detail, state, eligible withdrawal, voting, and claims, or label governance creation as experimental and explain the required external management path. Generate command/support documentation from the actual contract, which now has 13 actions and 8 transaction actions, not 12 and 7.

## Efficiency and operational behavior

### R12. Long-lived clients keep mutable pool data indefinitely

Priority: P1 for freshness-sensitive operations, P2 for browsing. Reproduced offline.

`src/internal/caches.ts:9-22,32-44` caches successes indefinitely. The store TTL in `src/cache.ts:30-37` is checked when a client acquires its cache object, not on later reads through that client. A client continued to return old pool data after its configured TTL; a newly constructed client saw the updated fixture.

The per-client locator cache also contains the raw pool tuple. Repeated addressed reads therefore reuse pool state, not just a locator.

Fix: separate immutable topology from mutable ticks/reserves/gauge state; expire mutable entries on access; expose explicit refresh/invalidation; invalidate relevant state after confirmation. Bind shared-cache identity to contract overrides as well as chain/RPC.

### R13. Route limits do not bound route generation

Priority: P2. Reproduced offline.

`src/helpers.ts:186-220` materializes every path up to three hops. `src/quotes.ts:52-58,70-72` applies the candidate limit afterward.

A synthetic graph with 120 pools produced 64,000 candidate paths before any quote budget was applied, approximately 15-16 ms on this machine. This is a scaling measurement, not a claim that current mainnet quotes always take that time or are already CPU-bound.

Fix: bounded shortest-first enumeration, per-pair pruning, and allocation limits before building the full path array. Preserve explicit quality/latency tradeoffs between SDK and TUI.

### R14. Startup does work the user did not request

Priority: P2. Static call-path finding.

`src/tui/sugar.ts:205-237` warms tokens, swap pools, hydrated pools, epochs, positions, Dune, and DefiLlama from the home screen. `src/tui/analytics/dune.ts:396-403` starts two SQL executions whenever Dune loads with a key. These can consume paid query credits even if Analytics is never opened.

Cold addressed pool reads discover a global catalog when no locator is available. ALM creates new clients repeatedly without a shared locator store, multiplying this work across phases.

Fix: load analytics on demand, make paid query execution explicit, reuse verified locators, and cancel obsolete chain/screen work. Put operation-wide deadlines and concurrency limits above individual domain calls.

### R15. WalletConnect repeatedly initializes clients and loses account detail

Priority: P2. Static call-path finding.

`src/walletconnect.ts:35-41,94-108` initializes a new SignClient for every transaction. There is no managed singleton/disposal lifecycle for repeated TUI sends.

`accountsToRecord` collapses chain-specific account entries into one address plus a list of chains. Requested account/chain permissions and session updates are not validated before the request. Optional namespaces request signing methods the CLI does not use. Pairing metadata points at the upstream Velodrome SDK rather than this product.

Fix: one scoped client per process, session lifecycle listeners, exact chain/account authorization checks, cancellation, minimal requested methods, and correct product metadata.

### R16. Smaller UI and analytics correctness defects

Priority: P2.

- `src/cli/token-prompt.ts:118-121` handles plain `j` and `k` as a beep, preventing those letters from entering token search.
- `src/tui/analytics/dune.ts:274-286` can label a current calendar-week total as a 24-hour or rolling-seven-day metric. Its SQL week truncation and the Thursday epoch grouping need explicit alignment.
- The two Dune SQL failures are converted into empty datasets. Missing data needs a visible status rather than an apparently complete report.
- `src/tui/screens/action.tsx:141-151` scans the entire catalog for duplicate symbols for every token while opening the picker, making that construction quadratic.
- CLI wallet input decodes raw UTF-8 bytes as individual characters; TUI masked input and CLI input need consistent Unicode and paste tests.
- WalletScreen performs synchronous wallet/Keychain reads during rendering. Load wallet state through a single stateful service instead.
- The TUI's `Deposit more` action creates a new CL position through `mint`; it is not an increase-liquidity operation on the selected NFT. Rename it or implement the intended behavior.

## npm distribution readiness

The current version string is already `0.1.0`; release readiness is the missing work.

1. Decide whether the SDK supports Node and browser consumers and whether the CLI requires Bun. State minimum runtime versions explicitly. Bun-first development does not require publishing a Bun-only SDK.
2. Build SDK JavaScript and declarations. Export compiled files with working import paths. Test the packed package outside the monorepo under each supported runtime.
3. Keep `private: true` until publication is explicitly approved. Choose the public package names, license metadata, repository/bugs links, and release policy beforehand.
4. Separate the lightweight SDK dependency graph from the React/OpenTUI/WalletConnect CLI dependencies. Separate package names are one option; separate installation dependencies matter more than export names alone.
5. Add a publish-file allowlist. Exclude tests, fixtures, CI files, and internal scripts that are not part of the public API.
6. Make standalone lint self-contained. Its current command references `../../.oxlintrc.json`, and oxlint is not declared in the package.
7. Make standalone CI reproducible. The subtree mirror does not include the monorepo lockfile; its CI uses an unpinned Bun version and non-frozen installation. Add package-level release verification, packed-consumer tests, and an OS/runtime matrix.
8. Resolve dependency advisories without weakening security policy. Viem 2.33.1 currently installs ws 8.18.2. The audit reports GHSA-58qx-3vcg-4xpx and GHSA-96hv-2xvq-fx4p for that version. A workspace-wide advisory count is not an Aero-specific risk count.
9. Verify each chain's deployed contract capabilities and reject unsupported features before building approvals. Do not equate a configured chain ID with all features being operational.
10. Gate the release on RPC/fork integration tests for native/ERC-20 swaps, basic/CL liquidity, multiple NFTs per pool, governance lifecycle, approval sequencing, stale-plan rejection, and unknown-receipt recovery.

## Recommended implementation order

1. Asset identity, immutable plan envelopes, signer/chain checks, and unknown-receipt recovery.
2. Mnemonic validation, price anchors, NFT-ID lookup, and native/WETH liquidity semantics.
3. Mutable-cache freshness and transaction-driven invalidation.
4. Exclude ALM execution/Safe mode from supported 0.1, or complete their permission, journaling, and manipulation-guard work before shipping.
5. Complete or narrow the CLI/TUI capability contract, then address measured performance and paid-query behavior.
6. Build and test standalone artifacts. Review dependency upgrades and publication settings. Publish only after a separate explicit decision.

## Scope across BeeGreat

No Bee clients or provider transports were changed. Shared SDK/action findings can affect Bee's web, mobile, CLI, and iMessage consumers and must be fixed centrally. The Aero TUI, local-wallet sender, WalletConnect lifecycle, and standalone ALM findings apply to this package's own execution paths. OpenRouter/Codex behavior, voice, Hive, deployments, and app-level rendering were not re-audited. Changes to the shared action contract later need corresponding agent/backend/client verification.
