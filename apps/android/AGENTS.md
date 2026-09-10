# BeeGreat Android (Kotlin + Jetpack Compose)

Native Android twin of `apps/mobile`. Plan and port/drop decisions live in
`docs/26-android-kotlin-port.md`. Read `docs/design-system.md` before styling.

## Build

Gradle needs JDK 17 to 21. The Homebrew default JDK 26 is too new, so pass
`JAVA_HOME` explicitly:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
./gradlew :app:assembleDebug            # build
./gradlew :app:installDebug             # install on the connected device
./gradlew test                          # JVM unit tests (all modules)
./gradlew :core:convex:testDebugUnitTest
```

Runtime configuration comes from `local.properties` (gitignored), then Gradle
properties. Keys: `CLERK_PUBLISHABLE_KEY`, `CONVEX_URL`, `AGENT_URL`,
`SENTRY_DSN`, `REOWN_PROJECT_ID`. Copy the values from
`apps/mobile/.env` (`EXPO_PUBLIC_*`). `AGENT_URL` defaults to the production
worker, same as mobile.

`compileSdk` is 37.1 because the 2026.08 Compose BOM requires it. The SDK
platform installs through the Homebrew command line tools into
`/opt/homebrew/share/android-commandlinetools/platforms`; copy the folder
into `~/Library/Android/sdk/platforms` if Gradle cannot find it.

## Emulator

An AVD named `beegreat-android` (Pixel 6, API 36 Google APIs) exists. The
system image lives in the Homebrew SDK root:

```sh
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
  /opt/homebrew/share/android-commandlinetools/emulator/emulator -avd beegreat-android
```

## Modules

- `app`: entry point, `AppContainer` (manual DI), auth gate, tab shell, screens.
- `core/design`: tokens (`BeeColors`, `Spacing`, `Motion`, `BeeTypography`),
  `BeeTheme`, hex geometry, shared components (`BeeCard`, `HexButton`,
  `AddRow`, `CombCell`, `ScreenHeader`).
- `core/convex`: `createBeeConvexClient` and `ClerkConvexAuthProvider`,
  `ConvexInt`/`ConvexDouble` serializers, repositories and models per feature.

## Auth gotcha

Do not switch back to `clerk-convex-kotlin`. It requests Clerk's default
session token; the backend validates the `convex` JWT template
(`auth.config.ts`, `applicationID: 'convex'`), so Convex rejects the default
token and the socket reconnects every second while queries never emit.
`ClerkConvexAuthProvider` asks for `GetTokenOptions(template = "convex")`.
Debug builds log `convex socket:` and `convex auth:` under the `BeeGreat` tag;
a CONNECTED/CONNECTING loop there means the token is being rejected.

## Conventions

- Convex function names are strings (`"goals:list"`). Every argument and
  result shape is a `@Serializable` data class next to its repository. Numbers
  from Convex use `ConvexInt` or `ConvexDouble`, never plain `Int`.
- Numbers going *to* Convex must be `Double` (`threadId.n`). The client
  encodes Kotlin `Int`/`Long` as `$integer` (int64) and every backend
  validator is `v.number()` (float64), so a bare `Int` argument fails
  validation.
- Screens are split into a stateful entry (`GoalsScreen`) that owns the
  ViewModel and a stateless view (`GoalsScreenView`) with a `@Preview`.
- ViewModels are created with `viewModel { }` from `LocalAppContainer`.
- No Apple sign-in, no Live Activity, no glass effect. See the drop list in
  `docs/26-android-kotlin-port.md`.
