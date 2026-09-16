# Thread switching

The web agent keeps its workspace mounted when the `t` search parameter changes. Only the conversation scroll container resets. Account identity remains the workspace key, so changing accounts discards cached history and drafts.

Thread history stays in memory for the current workspace. Switching to a cached thread renders it immediately and refreshes it in the background. The first six recent threads preload after the initial account response. Hover, focus, and touch also preload a thread. An uncached conversation shows a loading message inside the existing layout until its history arrives. New threads start empty immediately.

The sidebar and wallet stay visible during history requests. Messages, YOLO state, pending replies, retries, errors, and drafts belong to their thread. A late response updates only its originating thread. Requests started before sign-out or superseded by another reload cannot overwrite current state. Deleting history invalidates the cached thread and outstanding reads.

## Verification

Run from `apps/pecu/apps/stocks`:

```sh
bun test ./tests/thread-switching.test.tsx ./tests/message-rendering.test.tsx
bun run typecheck
bun run build
```

For browser checks, ensure port 5198 is unused, then run:

```sh
bunx --no-install vite --config tests/browser/vite.config.ts
```

Open `http://127.0.0.1:5198/agent`. This fixture renders the real agent route with synthetic account data and a 1.5 second delay on history reads. It cannot submit messages or transactions. Verify cached switches, fresh threads, draft restoration through Back, sidebar collapse, and the mobile thread dialog.

The September 16 audit reproduced a roughly 1.1 second sidebar disappearance in production, plus replacement of the header and composer. The local cached switch displayed the destination conversation in 52 ms and retained all three DOM nodes without a loading or welcome-screen flash. This measurement uses fixture data, not production API latency.

The change applies to Pecu's desktop and mobile web layouts and the account hook shared with Stocks. BeeGreat's native apps, CLI, iMessage, voice, provider protocols, and backend contracts have no equivalent Pecu web thread navigation to change. No backend deployment is required for this fix. The browser verification does not establish that the fix has been deployed.
