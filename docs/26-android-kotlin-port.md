# 26 – Android port in Kotlin

- **Status**: Phase 1 done on device (sign-in, live `goals:list`, add/rename/delete). Phase 0 Flue spike next.
- **Branch**: `Kotlin-Porting`
- **Decisions taken (2026-09-10)**: Android-native only (Kotlin + Jetpack
  Compose). The Expo app keeps iOS. Both live in the monorepo. Target is full
  feature parity with what the Expo app does today.

## Why this is bigger than "same screens in Kotlin"

The Expo app is 36 routes and about 22k lines of TypeScript, but the hard part
is not the screens. It is the three things Android cannot import from the
monorepo:

1. `@flue/sdk`. The chat transport (POST a message, tail an SSE stream with
   offset resume, long-poll fallback, read history) is TypeScript only. It has
   to be reimplemented. Reference: `resources/flue/packages/sdk/src/public/`
   (about 2.1k lines, `send.ts`, `stream.ts`, `read.ts`, `observe.ts`,
   `follow-policy.ts`, `settle.ts`).
2. `packages/tool-presentation` and `packages/chat-sync`. ADR 0003 made
   `beeui.ts` the single parser for Bee's generative UI precisely because four
   drifting copies had already caused bugs. A Kotlin app is a fifth copy by
   construction. The plan below keeps it honest with shared fixtures.
3. Convex's generated `api` object. The Android client calls functions by
   string name (`"goals:list"`) and decodes JSON with kotlinx.serialization.
   The mobile app touches about 100 distinct Convex functions, so every
   argument and result shape must be written as a Kotlin data class by hand.

Everything else has a Kotlin-native equivalent.

## Third-party mapping

| Concern | Expo today | Android | Notes |
| --- | --- | --- | --- |
| Auth | `@clerk/clerk-expo` | `com.clerk:clerk-android-api` v1 | Google OAuth only. Apple Sign-In is iOS-only and stays there. |
| Convex | `convex/react` + `ConvexProviderWithClerk` | `dev.convex:android-convexmobile` + `com.clerk:clerk-convex-kotlin` | `createClerkConvexClient` syncs the Clerk session into `ConvexClientWithAuth`. Subscriptions are `Flow`s. |
| Agent chat | `@flue/sdk` | hand-written Flue client on OkHttp SSE | Must match the SDK's offset/dedup/idempotency semantics. |
| Voice STT/TTS | `fetch` to `/voice/transcribe`, `/voice/speak` | OkHttp + `AudioRecord` + ExoPlayer | Same worker endpoints. |
| Live voice | `WebSocket` + `expo-audio` PCM stream | OkHttp WebSocket + `AudioTrack`/`AudioRecord` | `use-xai-voice-conversation.ts` is the spec. |
| Wallet | `@reown/appkit-react-native` | `com.reown:appkit` (Kotlin) | `viem` is only used for chain constants. Signing goes through the EIP-1193 provider. |
| NFC | `react-native-nfc-manager` | `android.nfc` NDEF | Native Android API. Better than iOS here. |
| Share sheet | `expo-sharing` | `ACTION_SEND text/plain` intent | Already declared for Android in `app.json`. |
| Deep links | `beegreat://`, `https://beegreat.app/tap/*` | intent filters + App Links | Same URLs. |
| Subscriptions | `react-native-purchases`, iOS only | `com.revenuecat.purchases` | See open decision 4. |
| Crash reporting | `@sentry/react-native` | `sentry-android` + Compose integration | |
| Secure storage | `expo-secure-store` | Clerk SDK stores its own tokens; `EncryptedSharedPreferences` for the rest | |
| Preferences | `AsyncStorage` | Jetpack DataStore | |
| Images | `expo-image`, Skia image cache | Coil | |
| Markdown | `react-native-markdown-display` | Markwon or `multiplatform-markdown-renderer` | Decide during Phase 2. |
| Charts | custom bar chart | Compose `Canvas` | One component. |
| QR | `qrcode-generator` | ZXing | |
| Animation | Reanimated 4 + worklets | Compose animation APIs | `constants/motion.ts` becomes a Kotlin object. |
| Sheets | `formSheet` detents | Material 3 `ModalBottomSheet` | |
| Icons | SF Symbols via `expo-symbols` | Material Symbols | Design-system decision, see `docs/design-system.md`. |
| Glass | `expo-glass-effect` | none | Material 3 surfaces. Do not fake it. |
| Lock screen state | `expo-widgets` Live Activity | foreground service + ongoing notification during a voice session | Android 16 Live Updates later, optional. |

## Port, replace, or drop

### Port (1:1 behavior)

- Sign-in (Google only), auth-gated shell, Sentry user context.
- Tabs: Bee chat (`(tabs)/index`), Goals, Hive, Mind, Mic.
- Goals, projects, tasks, reminders, comb cells, task rows, add rows.
- First-focus preview card, confirmation, highlight completion (all
  server-authoritative; the client only submits commands).
- Hive currency bar and achievements.
- Mind: bookmark list, bookmark detail, add sheet, URL normalization
  (`bookmark-url.ts`), share intent entry.
- Bee-healthy: mood tracker, hydration tracker, journal screen, calendar,
  entry card, entry editor with local drafts (`bee-healthy-drafts.ts`,
  `journal-editor-storage.ts`), journal share.
- Chat: conversation list, message bubbles, reasoning toggle, tool activity,
  attachments (image picker), prompt input, suggestions, shimmer, listening
  island, threads sheet.
- beeui cards: `text`, `metric`, `chart` (`bar`), `tasks`, `highlight`,
  `first_focus`, `confirm`, `image`, `bookmark`, `devin`, plus the blocking
  `question` card. Unknown types render nothing; an invalid known component
  drops the whole block (ADR 0003).
- Voice: push-to-talk, orb, live conversation sheet, audio operation queue.
- Profile, public profile, account deletion flow, preferences.
- Connections: beennectors settings (OAuth via Chrome Custom Tabs), ChatGPT
  auth gate, Telegram auth, iMessage settings, Google Health power-up.
- Agent jobs sheet, Devin card.
- Web3: wallet settings, wallet QR, wallet connect/disconnect, Web3 confirm
  card, EOA signing via AppKit.
- NFC actions: list, type picker, execution screen, reminder actions, tag
  write/read, `tap/[publicId]` deep link.
- Pure logic with existing tests: `account-deletion-state`, `auth-redirect`,
  `bee-healthy`, `first-focus-confirmation`, `journal-share`, `nfc-tags`,
  `subscription-state`, `tool-labels`, `ui-spec`, `xai-audio`.

### Replace with an Android-native equivalent

- Live Activity while Bee listens or speaks becomes a foreground service with
  an ongoing notification. Same states (`listening`, `thinking`, `speaking`).
- `formSheet` presentations become bottom sheets.
- Skia-drawn shapes (hex avatar, hex buttons, honey vessel, GolieBee, voice
  orb) become Compose `Canvas` and `graphicsLayer` work.
- Screenshot harness becomes Compose previews plus screenshot tests. Keep the
  fixture ideas from `screenshot-harness/fixtures.ts`.

### Drop (iOS-only, no Android meaning)

- Apple Sign-In and `appleSignInRevocation` handling on the client.
- `expo-widgets` target, app-group entitlement, `ITSAppUsesNonExemptEncryption`.
- `expo-glass-effect`, SF Symbol names.
- Every `*.web.tsx` variant.
- The iOS-only `SubscriptionGate` wrapper (see decision 4 before dropping
  billing itself).

### Stays on the server, nothing to port

Economy rules, first-focus transactions, Web3 execution and confirmation
binding, memory, beennector OAuth exchange, Devin, bookmark crawling. The
Android app submits the same intent-level commands the Expo app does.

## Repository layout

```
apps/android/
  settings.gradle.kts, gradle/libs.versions.toml
  app/                     entry, navigation graph, DI wiring, deep links
  core/design/             tokens, typography, motion, hex shapes, theme
  core/contract/           beeui parser, chat-sync merge + TranscriptSyncQueue,
                           shared-fixture tests (pure Kotlin/JVM)
  core/flue/               Flue client: send, stream (SSE + long-poll), read
  core/convex/             ConvexClient wrapper, function names, data classes
  core/voice/              audio capture/playback, realtime WebSocket
  feature/bee/             chat tab, cards, threads, prompt input
  feature/goals/           goals, projects, tasks, reminders, first-focus
  feature/hive/
  feature/mind/
  feature/healthy/
  feature/voice/           mic tab, orb, live conversation, foreground service
  feature/connections/     beennectors, chatgpt, telegram, imessage, health
  feature/web3/
  feature/nfc/
  feature/profile/         profile, public profile, account deletion, jobs
```

Package name: `com.beegreat.app`, the same one `app.json` declares for
Android. That means the Expo Android build is retired the day this ships.
Confirm nobody depends on an Expo Android APK (see decision 6).

## Keeping the fifth client honest

`AGENTS.md` says the CLI, iMessage, web, and mobile must stay at parity and
that shared logic should be fixed in `packages/chat-sync` and
`packages/tool-presentation`. Android cannot import them. Two mechanisms
replace the import:

1. **Shared fixtures.** Add `packages/tool-presentation/fixtures/*.json` and
   `packages/chat-sync/fixtures/*.json`: inputs and expected outputs for fence
   extraction, identifier scrubbing, follow-up derivation, and message
   merging. `bun test` asserts the TypeScript against them; JUnit asserts the
   Kotlin against the same files. Drift fails both builds.
2. **Generated types.** Zod 4 exposes `z.toJSONSchema`. Emit the beeui
   component schema and the Convex validator shapes the app uses to JSON
   Schema, generate Kotlin data classes from it in CI, and check the output
   in. A contract change without regenerating fails the Android build.

Add Android to the "Clients" bullet in `AGENTS.md` and to every "hit every
surface" checklist once Phase 1 lands.

## Phases

Each phase ends with the listed check, not with "it compiles".

### Phase 0. Spike the three risks (go/no-go)

- Clerk Android v1 Google sign-in, then `createClerkConvexClient` and a live
  subscription to `goals:list` against the dev deployment.
- Kotlin Flue client: send one message to the production worker, tail the SSE
  stream from the returned offset, reconnect once mid-stream without
  duplicating events. Compare against `@flue/sdk` behavior on the same
  conversation.
- Reown AppKit Kotlin: connect a wallet, request `personal_sign`.
- Check: all three work on a physical device. If Flue reconnection semantics
  turn out to be undocumented, this is where we stop and ask Flue.

### Phase 1. Foundation

Gradle project, version catalog, Compose BOM, Kotlin 2.2, min SDK 26 (Clerk
needs 24, Reown 23). Design tokens from `docs/design-system.md`. Auth gate,
Convex client, Sentry, navigation shell with the five tabs and the sheet
routes as empty screens. Deep-link and share-intent plumbing.
Check: sign in, see an empty Goals tab backed by a live `goals:list`.

### Phase 2. Bee chat

Flue client module, chat-sync port with fixtures, beeui parser with fixtures,
all 11 card renderers plus `question`, prompt input with image attachments,
reasoning and tool activity, threads sheet, transcript mirroring into Convex.
Check: a first-focus flow started from text produces the same preview card
and confirms through the same Convex mutation as iOS.

### Phase 3. Goals, first-focus, Hive

Goals/projects/tasks CRUD, reminders, comb cells, first-focus preview and
confirmation cards, highlight completion, currency bar, achievements.
Check: completing a highlighted task on Android is visible on web within the
2-second gate from `docs/03-architecture.md`.

### Phase 4. Mind and Bee-healthy

Bookmarks with share-intent add, detail view, mood/water/journal trackers,
journal editor with drafts and calendar, journal share.
Check: a bookmark shared from Chrome lands in Convex and shows on iOS.

### Phase 5. Voice

Push-to-talk (record, `/voice/transcribe`, `/voice/speak`), orb states,
listening island, realtime conversation over WebSocket, foreground service
notification replacing the Live Activity.
Check: 4-second p95 to first spoken response, measured on device.

### Phase 6. Connections, power-ups, jobs

Beennector OAuth through Custom Tabs and the `connect-callback` redirect,
ChatGPT auth gate, Telegram, iMessage settings, Google Health, agent jobs,
Devin card. Every connect has its disconnect.
Check: connect and disconnect one beennector, confirm state on web.

### Phase 7. Web3, NFC, public profile

AppKit connect/disconnect, wallet settings, QR, Web3 confirm card with the
same action-binding rules as iMessage (`docs/03-architecture.md`), NFC
write/read/execute/undo, `tap/[publicId]` link, public profile.
Check: a linked-EOA action approved on Android executes once.

### Phase 8. Release

Subscription decision applied, account deletion, Play Console listing,
Gradle release signing, CI (GitHub Actions: build, unit tests, fixture
parity, screenshot tests), Sentry release tagging. Update `AGENTS.md`,
`docs/03-architecture.md` stack table, and the `deploy` skill.

## Decisions taken during Phase 1 (2026-09-10)

- Toolchain: AGP 9.3.1, Kotlin 2.4.10, Gradle 9.6.1, Compose BOM 2026.08.00,
  Clerk Android 1.1.5, Convex mobile 0.8.0. compileSdk 37.1 (the BOM requires
  37), minSdk 26, JDK 21 to run Gradle.
- Clerk to Convex: our own `ClerkConvexAuthProvider`, not
  `clerk-convex-kotlin`. The library fetches the default session token; the
  backend validates the `convex` JWT template, so Convex closed the socket on
  every connect. Verified on device: after the fix `goals:list` emits.
- DI: none. `AppContainer` in `BeeGreatApplication` holds the Convex client
  and repositories; screens get it through `LocalAppContainer`. Revisit if a
  third scope shows up.
- Navigation: Navigation Compose 2.9 with `@Serializable` routes.
- Convex numbers: `ConvexInt`/`ConvexDouble` serializers accept `3`, `3.0`,
  and the `{"$integer": ...}` envelope. Plain `Int` fields are a bug.
- Tab icons: the Expo PNG tab assets (bee, honeycomb, hive, honey mic) at
  mdpi/xhdpi/xxhdpi. Mind uses a Material bookmark.
- The animated `bee.webp` cannot be decoded by `painterResource`; the sign-in
  hero uses the static PNG until Coil lands in Phase 2.

## Open decisions

1. **DI**: settled, see above.
2. **Navigation**: settled, see above.
3. **Markdown renderer**: Markwon (mature, View-based, needs interop) or a
   Compose-native renderer. Decide in Phase 2 with real Bee output.
4. **Subscriptions on Android**: the Expo app gates only iOS, so Android is
   free today. "Parity" with today's Android behavior means no gate. Ship
   free in v1 and add Play Billing through RevenueCat when monetization is
   decided (matches `docs/03-architecture.md`, "Deferred").
5. **Live Activity replacement**: ongoing notification in v1. Android 16
   Live Updates as a follow-up.
6. **Expo Android build**: confirm it has never shipped and can be retired,
   so `com.beegreat.app` on Play belongs to the Kotlin app.
7. **Screenshot testing**: Compose Preview Screenshot Testing (Google,
   experimental) or Paparazzi. Decide in Phase 1.

## What the MCP Kotlin SDK is and is not

`resources/mcp-kotlin-sdk` is the library for writing MCP clients and servers
in Kotlin. It does not help build an Android app and nothing in this plan
uses it. Reference clones that would help are `convex-mobile` (Android
client), `clerk-android`, `clerk-convex-kotlin`, and Reown's
`WalletConnectKotlinV2`, plus an indexed copy of the Compose and Android
platform docs. Add them with `codeview add` before Phase 0.
