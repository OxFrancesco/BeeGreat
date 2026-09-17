# Thread switching and large histories

The authenticated workspace stays mounted when `/agent?t=...` changes. Cached history renders immediately. A cold thread loads inside the conversation area while the sidebar, header, and composer stay mounted. Each thread keeps its own drafts, YOLO state, pending request, errors, and retry controls.

## Landing thread

Opening `/agent` without `t` lands on the most recently updated thread once the summary page has loaded, replacing the URL so the back button is not polluted. The unnamed original conversation is only shown first when it is the latest. Choosing it from the sidebar afterwards is respected; the redirect runs once per signed-in mount.

## ChatGPT connection resume

A reply that asks the user to connect ChatGPT opens the connection dialog. When the sign-in completes in that dialog, the dialog closes and the workspace regenerates the latest turn if it is that connect reply, so the original question is answered without retyping it. The inline `Connect ChatGPT` button hides as soon as any profile view reports the account as connected. Connection state is shared through `src/lib/inference-navigation.ts`, not refetched per message.

## Bounded reads and rendering

The web client requests 40 turns at a time, using `Earlier messages`, `Later messages`, and `Latest`. It replaces the current page instead of accumulating every visited page. The thread sidebar requests 40 indexed summaries per page and keeps the selected thread visible if it is outside that page. Message rows use measured TanStack Virtual windows with two rows of overscan. The small sidebar page renders all of its buttons so keyboard navigation remains available.

The history cache retains at most 12 populated histories, with a 4 MiB serialized-payload budget. It evicts the least recently used inactive pages. The active page remains readable even if that single page exceeds the byte budget. This is a payload budget, not a JavaScript heap limit. Pending and retry controls survive history eviction; user drafts are not discarded. Hover, focus, and touch prefetch at most two concurrent reads. Switching cancels obsolete reads. There is no eager loop over every sidebar thread.

Cached selection revalidates its current page in the background. Message polling applies only to the latest page. Sending from an older page returns to the latest page. Historical question choices and retry buttons cannot act as if they were the latest turn. Superseded requests and responses from before sign-out cannot replace current state.

## Storage and rollout

`basedbot_web_threads` stores one summary per owner, indexed by account, update time, and owner. SQLite insert/delete triggers maintain the title, count, and timestamps for new turns and full-thread deletion. Reply updates and transport retries do not increment counts. Existing histories receive an idempotent, account-scoped backfill on their first summary read. That one-time backfill still scans the account's existing turns; subsequent page reads use the index. Million-turn migration latency has not been measured.

`/threads` and `/messages` accept validated seek cursors and derive ownership from the authenticated identity. Message cursors use creation time and SQLite rowid, preserving order when timestamps tie or a retry changes the message ID. No offset scans or per-thread title queries are used during normal listing. Empty pages retain a reverse cursor so deletion during browsing does not strand the reader.

Deploy the Pecu `basedbot` Worker before the `aero-stocks` web Worker. The old `/state` response remains available with its 100-turn history limit and first summary page. The new client uses `/state?paged=1` and separate summary requests. Existing Durable Object names, storage keys, migration tags, and histories remain in place.

## Verification

From `apps/pecu`:

```sh
bun run typecheck
bun test ./tests/web-agent.test.ts ./tests/web-history.test.ts ./tests/history-workerd.test.ts
```

From `apps/pecu/apps/stocks`:

```sh
bun run typecheck
bun test ./tests/thread-switching.test.tsx ./tests/thread-cache.test.ts ./tests/message-rendering.test.tsx
bun run build
bunx vite --config tests/browser/vite.config.ts
```

The database fixture contains 1,000 threads and 100,000 stored turns. It checks complete cursor traversal, equal timestamps, account isolation, idempotent backfill, indexed plans, retries, and deletion. The Workerd test runs migration and triggers in actual Durable Object SQLite.

The browser fixture at `http://127.0.0.1:5198/agent` models 1,000 threads and 10,000 messages per thread with 600 ms read latency. It renders the actual route and simulates a 15-second pending reply locally. It never sends messages or transactions to an external service. Verify cached switches, older/newer message and thread pages, draft restoration, sidebar collapse, and the mobile dialog. Browser fixtures establish UI behavior, not production load capacity.

## Applicable clients

This change covers Pecu desktop/mobile web, the Stocks chat, their authenticated API routes, and the Pecu Worker storage contract. BeeGreat native mobile, Android, CLI, iMessage, voice, Hive, model providers, and channel rendering do not consume these Pecu web-history endpoints. Their behavior is unchanged. Both backend and web deployment are required for this follow-up.

## Mascot

Chat avatars use the existing transparent 3D assets without a painted tile or shadow. Their box is 72 px on desktop and 60 px on mobile, 50% larger than the previous 48 px and 40 px. The thinking state retains the alpha WebM/HEVC animation and transparent reduced-motion poster.

The 3D scene's `Studio · seamless ivory` floor is hidden in the final exports. Merely removing the CSS tile left a rectangular shadow in the old image and video pixels. `scripts/render-mascot-alpha.py` renders the original idle/thinking scenes as RGBA with that floor disabled. Both 72-frame loops have zero alpha along all four canvas edges. Encode the sequence as VP9 `yuva420p` with `auto-alt-ref=0` for Chrome and HEVC VideoToolbox with `alpha_quality=0.9`, `bgra`, and the `hvc1` tag for Safari. WebP posters retain the same alpha channel. The browser uses the poster for reduced motion.

Only the latest agent reply has a mascot. Older messages and older history pages do not render one. While a new reply is pending, the thinking row owns the single visible mascot. Older replies use the full content width.
