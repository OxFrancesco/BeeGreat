# Anti-slop Effect integration

The Aero action schema drives CLI flags, TUI fields, and request validation. Token flags stay optional during CLI parsing so Quote and Swap can open the existing token picker. The validated request still requires both tokens. Required amounts remain parser errors. Parser tests cover omitted tokens and explicit references.

Aero read caches and RPC execution use Effect layers. Browser-wallet connection, transaction review, disconnect, timeout, and recovery behavior remain covered by package tests. CLI and TUI keep their existing signing confirmation boundaries.

The landing-page collision tests use the package's pinned Three.js 0.180.0 dependency and checked-in GLB. Run them with `bun run --cwd packages/sugar test`. EVM and Aero both pin React 19.2.3 so the shared terminal renderer uses the same React installation.

## Client integration

- Expo and web use the branch's shared task-update controller for pending locks, failed-save feedback, and retry. Their mascot components use the shared animation names and reduced-motion stills.
- Kotlin mirrors task-update state in `core/contract/TaskUpdates.kt`. Chat task cards and project rows disable repeated toggles while saving and expose failed saves for retry. Coroutine cancellation releases the local lock. The existing interactive Hive, water bottle, health trackers, and Raindrop screens are preserved.
- CLI and iMessage keep plain-text task presentation. Their command and tool results do not acquire a new wire format.
- Voice, settings, deep links, and Hive navigation retain their existing entry points. The web Hive retains its interactive vessel and uses the shared mascot for celebrations.
- OpenRouter and Codex use the existing contracts. No backend schema, authentication, or provider-routing change is needed for this integration.

The source changes belong in BeeGreat, UNOFFICIAL-Aero-SDK, and evmSDK's bundled Aero copy. Merge into the standalone histories, retain their tooling, refresh lockfiles, and record the BeeGreat revision in evmSDK's `SOURCE.json`.
