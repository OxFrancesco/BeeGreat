# Aero CLI/TUI performance and reliability

FRA-541 · 6 September 2026 · BeeGreat / packages/sugar

Implemented in the local checkout. The installed `aero` command resolves to this package and uses the changes immediately.

## What changed

| Problem reproduced | Result |
| --- | --- |
| Filtering after moving the cursor selected WETH while ETH was highlighted | Keyboard selection resets with the filter |
| Typing USDC and pressing Enter in one input batch selected ETH | Submission uses the current query, including before React renders |
| A failed token scan left the picker saying it was still scanning | Enter retries and opens the picker when the scan succeeds |
| Repeated refreshes started two overlapping scans | Pending requests share one scan, including after the result TTL |
| An old failed scan removed a newer cached result | Only the current request can update or remove its cache entry |
| Ctrl+R could return the same cached SDK pool data | Explicit refresh invalidates the SDK cache |
| Identical quote requests reused a result for 60 seconds | Quotes and transaction plans bypass the result cache |
| Public pool reads failed when the Keychain was unavailable | Public reads skip wallet access |
| Token resolution and execution used separate Sugar clients | Both stages reuse the same client and token cache |
| Background pool decoding paused the intro for 188 to 371 ms | Scans, quotes, plan construction, analytics, and snapshot I/O run in a dedicated worker |
| A 25 Hz timer drove the logo independently of the 30 fps renderer | Animation uses the renderer's 60 fps clock and elapsed time |

Forms without token fields also skip catalog loading. Completed browse results expire 60 seconds after success, rather than 60 seconds after starting a slow scan.

## Animation follow-up

The first completion report did not measure animation smoothness. A subsequent check found the stalls, so that completion claim was premature for animation performance. CPU profiling pointed to ABI decoding, address checksum calculations, and the address cache during background scans.

The worker keeps one shared SDK cache and forwards RPC progress to loading indicators. Cancelling a screen detaches its updates while a shared read can finish. Worker failures reject pending requests; the next user request starts a new worker. Exiting the TUI terminates it. Signing and broadcast stay in the existing wallet flow.

| Three live launches per version | Before | After |
| --- | --- | --- |
| Median time to the home menu | 439 ms | 468 ms |
| Worst intro frame gap across the runs | 371 ms | 33 ms |
| 95th percentile frame gap, range across runs | 188 to 371 ms | 26 to 28 ms |

These are process-to-terminal-output measurements on this Mac, not a guarantee of every display frame. Ghostty was also checked visually. The [normal-speed recording](animation.mp4) retains 60 fps; the older token-picker clip below runs at 6x speed.

`bun run --cwd packages/sugar test:performance` repeats the live launch check and fails for intro gaps over 80 ms or a 95th percentile above 34 ms. The animation releases its render loop between sweeps and when motion is disabled.

## Verification

- 286 tests passed across 35 files. Seven follow-up tests cover real worker decoding of 10,000 tokens, cache reuse and refresh, RPC progress, cancellation, worker termination and recovery, startup failure, elapsed-time animation, and disabling motion.
- Typecheck and lint passed. Lint emits an existing module-type warning from the repository lint plugin.
- Bun built the CLI and data worker. The built TUI launched from the home directory, with a worst measured intro frame gap of 31 ms.
- Live Base catalog read returned 2,671 listed tokens in 3,645 ms. Reusing the cached catalog took 1 ms and made no additional RPC read. This measures the scan cost, not a before/after end-to-end speedup.
- Live CLI quote of 0.001 ETH to USDC succeeded in 11,842 ms with no broadcast.
- Verified the installed `aero tui` command from the home directory in Ghostty. Reproduced the navigation and filter sequence against the live token catalog and confirmed native ETH appeared in the Swap form.
- CAP recorded the real Ghostty window. The attached clip plays at 6× speed.
- The follow-up CAP recording covers the startup animation, Pools, refresh and back navigation, and the Swap token picker. Its playback stays at normal speed.
- A live quote through the new TUI worker returned 2.501257 USDC for 0.001 ETH in 6,384 ms. During that request, a 16 ms UI-thread heartbeat had a worst gap of 30 ms. No transaction was broadcast.

Build with `bun run --cwd packages/sugar build`. Distribute `dist/cli.js` and `dist/worker.js` together, with the package dependencies. The installed source-linked `aero` command already uses the fix.

## Scope and limits

CLI and TUI entry points apply. Mobile, web, iMessage, voice, model providers, public contracts, and backend deploy targets do not change. The typed worker protocol is private to the TUI. Existing signing and broadcast behavior is preserved. No financial transaction was sent.

The checkout already contained extensive work, including changes to these files. Those edits were preserved. This task did not commit or push the combined worktree, publish a package, or deploy the agent/backend.

Apple Terminal could not run even `bun -e 'console.log("bun-check")'`, reporting a Bun startup error. That environment problem remains separate from Aero; Ghostty and the test terminal both ran Aero successfully.

The report is hosted on the personal Cloudflare account under the existing protected reports hostname.
