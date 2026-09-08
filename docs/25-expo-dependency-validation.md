# Expo SDK 57 dependency validation

The mobile app uses Expo 57.0.21 and React Native 0.86.3. The SDK installer aligns the remaining Expo packages, Reanimated, Worklets, Screens and Keyboard Controller. `expo-asset` is a direct dependency because `expo-audio` requires it.

Bun uses a hoisted installation through the root `bunfig.toml`. The previous isolated graph resolved several native packages to multiple physical installations and retained a second React Native version through an Expo peer dependency. React is 19.2.3 across mobile, web, the Codex adapter and Sugar. OpenTUI React 0.5.1 accepts React >=19.2.0. This removes Sugar's second React version from the mobile dependency graph.

## Directory metadata exceptions

Expo Doctor's native package and version checks remain enabled. Only these two packages are excluded from the React Native Directory metadata check:

- `react-native-nfc-manager` is pinned to 4.0.0-beta.7. Its maintainer documents v4 as the new-architecture implementation. The installed package contains a TurboModule spec and codegen configuration. Directory's package-level warning does not distinguish this implementation from v3. [Upstream version notes](https://github.com/revtel/react-native-nfc-manager#version-notes).
- `@solana-mobile/mobile-wallet-adapter-protocol` is an upstream Solana Mobile package reached through the wallet dependencies. It is absent from Directory's catalog. The package includes an Android implementation and documents React Native integration. Excluding missing catalog metadata does not certify device compatibility. [Upstream package](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/js/packages/mobile-wallet-adapter-protocol).

Keep warnings for other unknown packages enabled. Do not add `expo.install.exclude` or disable the duplicate dependency check to make diagnostics pass.

## Validation

Run `bunx expo-doctor`, `bunx expo install --check --bun`, `bunx tsc --noEmit` and `bun run lint` from `apps/mobile`. Export both native bundles with `bunx expo export --platform ios --platform android`. Run Sugar's tests, type check, lint and build after changing its React dependency.

The September 9 verification passed all 21 Expo Doctor checks with the two metadata exceptions above. SDK version validation, mobile types and lint passed. Both iOS and Android exports passed after removing stale workspace dependency links and installing the frozen lockfile with the hoisted layout. Backend, agent, web, CLI, bridge, sites and Sugar type checks passed. Web, agent, Codex adapter and Sugar builds passed. Sugar lint and all 333 tests passed.

These checks cover dependency resolution, types and JavaScript bundles. Installed-device NFC, wallet handoff and audio behavior remain native release checks. This project uses Continuous Native Generation; it has no checked-in `ios` or `android` project to regenerate.
