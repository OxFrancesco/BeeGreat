# BeeGreat screenshot harness

This harness routes through BeeGreat's real Expo Router tree and renders the
shipping screens, native tab bar, cards, safe areas, and responsive layouts.
A typed fixture context replaces only the Clerk/Convex/Flue data adapters with
deterministic fictional state. It does not contain a parallel promotional UI.
It is enabled only when both conditions are true:

1. React Native is running a development bundle (`__DEV__`), and
2. `EXPO_PUBLIC_BEEGREAT_SCREENSHOT_HARNESS=1` was present when Metro started.

An App Store/release bundle can therefore never activate this fixture, even if
someone supplies the public environment variable.

The fixture root bypasses Clerk, Convex, Flue, RevenueCat, and StoreKit. The
BeeGreat Pro screen is intentionally **not mocked**. Its screenshot must
come from the normal app with RevenueCat connected to StoreKit so the visible
price is Apple's live localized price.

Raw captures contain only the real in-app UI. If listing headlines are added,
apply them as a separate post-processing overlay without redrawing, resizing,
or substituting any in-app screen.

## Clean-device prerequisites

- Use a dedicated simulator with no personal Apple ID, notifications, clipboard
  history, or signed-in BeeGreat account.
- Install a current universal BeeGreat development build. The iPad image must
  be a real iPad layout; never stretch an iPhone capture.
- Boot only the simulator being captured.
- Keep the simulator in light appearance and portrait orientation. The capture
  script normalizes the status bar to 9:41 and 100% battery.
- Start from the repository root and use Bun/Bunx for every project command.

Target sets:

| Set | Recommended simulator | Required PNG |
| --- | --- | --- |
| `iphone-69` | iPhone 17 Pro Max | 1320 × 2868 |
| `ipad-13` | iPad Pro 13-inch | 2064 × 2752 |

Find the current UDIDs with:

```sh
xcrun simctl list devices available
```

The current local iOS 26.5 targets discovered on 2026-07-16 are:

```text
iPhone 17 Pro Max: 1DC420C3-6436-434D-A6F5-D7DA3669A308
iPad Pro 13-inch (M5): 43D5C086-4B85-4B59-953D-5F1F20D992A9
```

## Capture the five deterministic fixture scenes

Start the dev-client Metro bundle in one terminal:

```sh
bun run --cwd apps/mobile screenshots:start
```

Capture each device in another terminal:

```sh
bun run --cwd apps/mobile screenshots:capture -- \
  --mode fixture \
  --set iphone-69 \
  --udid 1DC420C3-6436-434D-A6F5-D7DA3669A308

bun run --cwd apps/mobile screenshots:capture -- \
  --mode fixture \
  --set ipad-13 \
  --udid 43D5C086-4B85-4B59-953D-5F1F20D992A9
```

Before every image, the runner terminates and relaunches `com.beegreat.app`,
checks that `simctl` confirmed that exact bundle, opens a deep link, waits for
the routed shipping screen with bounded readiness polling, and checks a
shot-specific BeeGreat accessibility handshake. The runner handles only the
exact iOS “Open in BeeGreat?” confirmation, then round-trips through Home and
re-foregrounds BeeGreat to clear any “Back to another app” status-bar
breadcrumb. If another app, Expo warning UI, or the regular signed-in
experience is foregrounded, capture stops before a PNG can be written. It also
rejects email addresses, common personal mail domains, wallet addresses, and
OAuth/verification codes found in the accessibility tree.

To repeat one fixture while adjusting layout:

```sh
bun run --cwd apps/mobile screenshots:capture -- \
  --mode fixture \
  --set iphone-69 \
  --shot goals-plan \
  --udid 1DC420C3-6436-434D-A6F5-D7DA3669A308
```

## Capture the real subscription paywall

Stop the screenshot-only Metro process and start the normal app. Sign in with a
dedicated sandbox/review account that has no active BeeGreat Pro entitlement.
RevenueCat must have loaded the
`com.beegreat.app.pro.monthly` StoreKit product.

Run:

```sh
bun run --cwd apps/mobile screenshots:capture -- \
  --mode live-paywall \
  --set iphone-69 \
  --udid 1DC420C3-6436-434D-A6F5-D7DA3669A308

bun run --cwd apps/mobile screenshots:capture -- \
  --mode live-paywall \
  --set ipad-13 \
  --udid 43D5C086-4B85-4B59-953D-5F1F20D992A9
```

This mode is read-only. It relaunches `com.beegreat.app`, does not tap Subscribe
or Restore, and requires a BeeGreat-specific paywall handshake plus BeeGreat
Pro, Monthly subscription, Restore Purchases, Terms of Use, Privacy Policy, and
a non-empty localized `Subscribe for … / month` label. It refuses
placeholder/unavailable prices.
The iPhone capture is also copied to the separate subscription-review filename.

## Outputs and validation

Default generated paths are:

```text
release/app-store/screenshots/raw/iphone-69/
release/app-store/screenshots/raw/ipad-13/
release/app-store/screenshots/subscription-review/
```

Every image is checked with `sips` for the exact target dimensions. Each set is
then checked with `asc screenshots validate` using `IPHONE_69` or
`IPAD_PRO_3GEN_129`.

The fixture uses the production screen components but remains a development
bundle with fictional data. Before upload, compare every image at 100% with the
exact release build and verify that navigation, labels, safe areas, and visual
states still match. The real paywall capture remains dependent on a configured
RevenueCat public key, StoreKit product mapping, and clean sandbox account.
