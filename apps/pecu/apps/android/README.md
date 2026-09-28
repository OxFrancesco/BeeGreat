# Pecu Android

Native Kotlin and Jetpack Compose client for Pecu. Open this folder in Android
Studio. It connects to `https://pecu.app/stocks/api`, using the same Clerk
instance, Cloudflare agent, wallets, conversations and provider routing as web.
There is no replacement backend or embedded chat WebView.

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

## Build and verify

Use JDK 21 and Android SDK 37.1. The Gradle wrapper matches BeeGreat Android.

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
./gradlew :app:assembleRelease
./gradlew :app:assembleBenchmark
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`. The optimized
release APK is unsigned, at `app/build/outputs/apk/release/app-release-unsigned.apk`.
Provide a distribution signing configuration before publishing a release.
`app/build/outputs/apk/benchmark/app-benchmark.apk` is an optimized, locally
signed build for phone testing. It uses the debug certificate, not a store key.

Regenerate cross-language fixtures from the repository root with Bun after a
Pecu wire-contract change:

```sh
bun apps/pecu/apps/android/scripts/generate-fixtures.ts
bun test apps/pecu/tests/android-contract.test.ts
```

The JVM tests decode these same fixtures. Network tests cover auth headers,
request identity, truncated streams, cancellation and no automatic write retry.
Robolectric renders actual Compose layouts at 320dp, 412dp and 900dp, plus dark
mode and a transaction preview. PNGs are written to `app/build/outputs/screenshots`.
These are local rendering tests, not device or production integration evidence.

## Implemented

- Google/X sign-in through Clerk, with the existing server deriving account identity.
- Thread creation, selection, deletion confirmation and paged history.
- Live Markdown, stage labels, questions, copy, retry and interrupted-request recovery.
- Persisted transaction steps, expiry and confirmation controls. The client never reconstructs transaction calls.
- Wallet address/QR, balances by ticker or contract address, transfer review with YOLO off, stock List/Graph, P&L periods and analytics.
- ChatGPT connection and disconnection using existing backend endpoints.
- Phone/foldable layouts, keyboard and safe-area insets, system dark mode, selectable text and accessible controls.

## Release status and remaining parity

Version 0.1.1 replaces the sign-in sheet with a full-screen native login. The
original 3D snail render loops as a bundled animated WebP on Android 9 and newer,
with a still fallback on Android 8. It pauses in the background and during OAuth,
loops without a playback control and follows the system animation setting. No network
request or real-time 3D engine is needed for the mascot. Regenerate the asset with
`python3 scripts/build-login-animation.py` using ffmpeg and libwebp.

X sign-in resolves the enabled `oauth_x` strategy from the same Clerk instance.
The legacy `oauth_twitter` strategy is disabled there. On 2026-09-26 an anonymous
native OAuth-start check reproduced its HTTP 422 rejection, then obtained HTTP
200 and an `x.com` authorization redirect with `oauth_x` and
`clerk://app.pecu.callback`. No account sign-in was completed by that check.

The provider icons are the Google and X assets served by Clerk. Provider names
and marks identify the sign-in options and retain their owners' trademarks.

To record the local native-rendering test, run:

```sh
./gradlew :app:testDebugUnitTest --tests app.pecu.ResponsiveUiTest.animatedMascotDecodesAndCanBePaused -PrecordLogin=true
```

Frames are saved under `app/build/outputs/screenshots/login-recording`. This is
Robolectric rendering evidence, not a physical-device recording.

This is a development build. Phone installation, Google/X OAuth callbacks, live
authenticated replies, folding while typing, TalkBack, release startup and frame
timings still require device verification. Configure Clerk's Android platform
for `app.pecu` and its signing certificate if the existing instance has not done so.

Linked-wallet signing and full Safe/profile management open Pecu web. Native
WalletConnect, card collection/3D viewer, account editing and exact web chart
interactions remain to be ported. The chat mascot uses the original still artwork;
chat mascot motion and the complete inset clay shadow treatment are not yet
reproduced. Login mascot motion is implemented. This build must not be described
as complete 1:1 parity.

## Performance choices

Kotlin/JVM integrates directly with Compose, Android lifecycle and Clerk. Java
or Kotlin/Native would not remove a measured bottleneck here. Network and stream
parsing run off the main thread. Streaming state has its own Compose collector.
Lazy lists use stable message IDs, history loads in pages, and a five-thread
in-memory cache avoids repeatedly parsing recent conversations. No idle chat
polling or auto-retry of transaction requests runs in the background.

Original Inter and JetBrains Mono assets include their OFL notices in the APK.
The official Kotlin and Clerk source references are managed by codeview in the
repository's `resources` folder. See `docs/51-pecu-native-android.md` at the root
for the contract and verification checklist.

Version 0.1.2 adds clay login buttons, automatic mascot playback and compact liquidity position cards with exact amounts in Details. Older replies in the complete position format also become cards.

Version 0.1.3 renders stock allocations as a native dotted graph by default, with
Graph/List controls in chat and the wallet profile. Complete historical stock
replies also render as graphs without a backend update. Their original timestamp
and amounts are preserved; no address or newer balance is inferred from text.
