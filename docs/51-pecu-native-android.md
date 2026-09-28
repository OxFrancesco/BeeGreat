# Pecu native Android

Pecu's Kotlin client lives in `apps/pecu/apps/android` and has application ID
`app.pecu`. It is separate from BeeGreat's Android app and does not use BeeGreat's
Convex backend. It calls the same public authenticated endpoints as Pecu web.

## Backend and identity

`PecuApi` sends Clerk's default session JWT in `Authorization: Bearer` and the
Pecu origin on writes. The existing TanStack middleware verifies the session;
`identity()` derives the sender from the verified user's linked accounts. The
phone never submits `userId` or `senderId`, wallet credentials or signing keys.

Models mirror `web-contract.ts`, `web-stream.ts`, `progress.ts`,
`transaction-plan-contract.ts`, `stock-contract.ts`, and `portfolio-contract.ts`.
Unknown JSON fields are tolerated for rolling releases. The generated fixture
test validates both TypeScript schemas and Kotlin decoding.

Live `paragraph` events replace the current text when `replace=true`; legacy
paragraphs append. A closed stream without `complete` remains an interrupted
request. Retry keeps its original UUID and thread, including `answerTo` and
`retryOf`. Backgrounding does not send a cancellation or a fresh transaction.
The server remains responsible for locks, deduplication and transaction state.

## Android behavior

Signed-out users see a dedicated login page with no inactive chat composer or
duplicate sign-in sheet. Below 720dp it stacks the mascot and providers; wider
windows place them side by side. Large text can scroll without losing controls.
Google and X choices use the enabled, authenticatable provider configuration from
Clerk. X must use `oauth_x`, not the disabled legacy `oauth_twitter` constant.
Wire errors are translated into retryable user-facing messages.

The login mascot uses Pecu's original 3D render as a bundled 480 by 360 animated
WebP, 72 frames at approximately 24 fps. Android's animated drawable handles
playback without recomposing the page per frame. Decode runs on an IO dispatcher.
Playback loops automatically while visible, with no playback control. It stops when the app backgrounds, including when OAuth opens.
System animation disabling selects the still image. Android 8 uses the still
fallback. The night launch theme matches the dark Compose background.

A live anonymous Clerk probe on 2026-09-26 returned HTTP 422 for `oauth_twitter`
and HTTP 200 with an X authorization redirect for `oauth_x`, using the native
`clerk://app.pecu.callback` URL. This verifies OAuth initiation, not completed
authentication or authenticated backend calls. Google remains `oauth_google`.

The app uses Compose with native Markdown and charts. Below 840dp threads open
in a sheet; larger layouts use a collapsible 272dp rail. A centered chat column
is capped at 840dp. Keyboard insets resize the composer. The UI contains no
scrollbar tracks and retains scrolling. The app follows the system color theme.

Network bodies and SSE are read off the main thread. A cancelled coroutine closes
its OkHttp call. History pages replace one another to bound the rendered window;
returning to latest reloads persisted state. The cache retains at most twelve
thread histories within a 4 MiB payload budget. Account changes clear private
in-memory and disk history.

The client displays persisted preview text and decoded steps. Expired, completed,
failed, cancelled or unknown states cannot confirm. Executing previews can check
status. Linked-wallet previews open the exact web thread for external signing.
The transfer form requires YOLO off before it requests a preview.

## Applied clients and entry points

Android is the new client. Pecu web/X/CLI keep their current behavior because no
backend or shared contract changed. BeeGreat mobile, Android, CLI, voice and
iMessage do not consume this separate Pecu client. Both inference providers remain
server-selected through the same turn endpoint. ChatGPT connect has disconnect;
thread deletion has an explicit irreversible-history confirmation; new threads
remain discoverable through server history. No backend deployment is required.

## Verification boundary

Local builds, lint, protocol tests, HTTP tests and native rendering tests are
available. Native rendering screenshots are synthetic evidence. They do not
prove real sign-in, authenticated synchronization, wallet signing or performance
on a Fold. No funds moved during these tests.

During implementation on 2026-09-26, T3's `device_list` omitted the connected
`R3GL708X7KJ`; `device_open` rejected that ID and failed to boot two listed Android
emulators. Do not bypass the mandated device tooling or claim an installation.

Before release, verify OAuth callbacks on the Fold; web/native history parity;
a read-only reply; interrupted-stream recovery with the same UUID; expiry and
recovery screens; keyboard/fold transitions; TalkBack and large type; signed
release launch and cold-start/frame timings. Transaction execution needs its
own exact action authorization and is not part of UI validation.

Full 1:1 parity still requires native linked-wallet connection/signing, Safe
management, card collection/3D, account editing, full web chart interactions,
and the chat mascot motion/clay inset material. Login animation is implemented.
These are explicit remaining
implementation tasks, not verified or completed features.

## References

- Kotlin source via codeview, cache revision `06003680c56d09dffcf82b3817372c5aaea66b50`.
- Clerk Android source via codeview, cache revision `7c2b4308ecc9281aa90cb98d12b8b12ad85f1269`.
- [Compose performance](https://developer.android.com/develop/ui/compose/performance/bestpractices).
- [Clerk Android](https://clerk.com/docs/android/reference/native-mobile/overview).
- [Robolectric Java setup](https://robolectric.org/getting-started/).

## Clay controls and liquidity positions

Login uses Pecu's amber and neutral clay material with opposing inset shadows and
a short press response. The mascot loops while the login is visible; system
reduced motion and background lifecycle still stop playback.

`position-contract.ts` adds an optional position snapshot to replies, sourced
from validated Aero read results and persisted in both SQLite implementations.
Android and both Pecu web chat entry points show three compact cards initially,
with Show more/Show fewer and reversible Details disclosures. Exact token amounts,
position IDs and pool addresses remain selectable in Details. Read-only summaries
mark truncation with ≈ and show tiny nonzero balances as <0.000001. Transaction
previews retain exact amounts. Old replies matching the complete historical
position format also render as cards; surrounding prose or malformed rows remain
untouched. The shared fixture verifies Kotlin and web parsing and formatting.

The main Pecu prompt asks for one to three short sentences, decision-relevant
numbers and no repeated card data. Text-only Aero output shows at most three
compact rows; b/verbose retains the exact saved result. These changes apply to
Pecu's native Android/web clients and its shared agent provider paths. BeeGreat's
separate Expo, CLI and iMessage clients do not consume Pecu's reply contract.

Validation artifacts are native Robolectric renderings, not a Fold device run.
The T3 emulator fails to boot and the physical Fold is not listed. Backend/web
source changes must be integrated with the newer main checkout before production
release; do not deploy this older branch over its active deployment.

## Historical stock graphs, version 0.1.3

A saved `/aero stocks` reply can predate structured `holdings` and contain only
`text` and `preview`. This was verified against the affected live saved reply.
Android previously rendered that text verbatim; even structured holdings defaulted
to a list of balances and optional bars.

Android now defaults to a native allocation graph with explicit Graph/List
controls, using Pecu's clay surface and dither chart palette. It uses only positive
owned positions and their estimated USDC value. Missing balances and prices remain
unavailable; tiny positive values are shown as <0.01 USDC, not zero. The same card
is used in chat and the wallet profile. Rendering needs no WebView or extra API call.

A conservative read-only parser recognizes complete historical stock replies.
It retains their timestamp, never invents a token address, and leaves surrounding
prose, malformed amounts and duplicate symbols as text. Typed structured holdings
remain preferred. Both Pecu web chat surfaces use the same TypeScript parser and
existing graph. The historical reply fixture is shared with Kotlin tests.

The screenshot regression first failed because no graph node existed, then passed
with Graph/List/Graph interaction checks. Native renderings cover folded-width,
unfolded-width, large font and unavailable data. T3 still lists no Fold and its
Android emulator cannot boot, so these checks do not prove physical-device behavior.
The Android fix uses the current backend; web changes require their own release.

## Dither Kit Kotlin module

Pecu 0.1.4 adds `apps/pecu/apps/android/dither`, an independent Android library
module ported from Dither Kit 0.1.0, commit
`1e7faee9aa252e499651e6736ed65f7a07d9a6bd`. Its README maps every upstream component
and lists intentional native differences. `SOURCE.json` records upstream file
hashes and `NOTICE.md` ships inside the AAR and APK.

The app uses the module for stock allocations in both chat and account sheets,
flow/P&L/probability comparisons, and price/P&L history. No backend schema or
provider changes are required. Saved stock replies keep the existing conservative
parser and timestamp; holdings arithmetic stays in BigDecimal before chart-only
fraction conversion. Exact transaction previews are untouched.

Surface decisions: native Pecu Android uses the new library. Pecu web retains its
existing Dither Kit implementation. BeeGreat Expo and web are separate clients and
do not consume Pecu's native module. CLI and iMessage remain text renderers. Both
agent providers use the same unchanged structured response contract. This task
has no backend deployment target.

Native graphics tests cover all six families, each fill texture, signed bars,
stacking, selection, scrub boundaries, accessibility navigation, empty data,
large text, reduced motion, replay, and standalone pixel components. Upstream
TypeScript generates geometry, random and alpha vectors for Kotlin parity tests.
The bounded renderer timing test is a host microbenchmark, not device performance
proof. T3 currently lists emulators only and cannot boot its Android emulator;
installation and on-phone behavior remain unverified.

## Transaction presentation, 0.1.5

`TransactionCard.kt` replaces the flattened preview with exact amount groups,
pool identity, persisted execution steps and reversible technical details.
`PreviewPresentation.kt` mirrors the web presentation rules. Both read
`apps/pecu/tests/fixtures/presentation/stake.json` in regression tests. Known pool
identifiers move into details; unknown values, constraints, recipients, spenders,
fees and warnings remain visible before confirmation. Unknown fees are retained
in details after a terminal state. Step values already contain their asset unit.

Receipt deduplication compares exact hashes and retains additional receipts,
including partial failures. Recovery text stays complete. Two known staking step
titles have shorter display labels; other titles are unchanged. Native text is
selectable and details are composed only when expanded. Parsing is remembered;
expiry has one lifecycle-aware deadline instead of a one-second polling loop.

All Pecu Android preview entry points use this component. Both Pecu web chat
surfaces use the updated shared PreviewCard/TransactionPlan. The same persisted
contract serves both providers without a backend change. CLI and iMessage keep
their complete plain-text fallback; BeeGreat's separate Expo app is unaffected.
No calls, confirmation codes or transaction execution semantics change.

Validation includes native chat, cover and unfolded layouts, 320dp large text,
exact tiny amounts, expiry, executing and partial-failure states. Web fixtures
cover 15 preview examples across six states at 320px and 900px. These use synthetic
data and do not execute transactions. T3 still cannot boot its emulator and does
not list the Fold; device installation and hardware performance are unverified.

## Receipt replies, 0.1.6

Receipt presentation now lives at the shared rich-text boundary: native
`RichText` and web `MessageResponse`. Complete standalone Basescan transaction
links become compact clay actions; inline raw URLs get short labels. Meaningful
Markdown labels, surrounding prose, warnings and exact destinations survive.
Unknown URLs, code, images and partial streaming hashes remain unchanged.
The same ReceiptLinks component serves plan steps and standalone preview receipts.

Native history now mirrors web's suppression of exact repeated confirm results.
Both clients keep extra warnings, questions, analytics, holdings and recovery
actions. The original preview must be loaded before its repeated result can hide.
Receipt presentation never changes stored replies or Copy reply. No backend or
provider changes are needed; CLI/iMessage retain full text. Both web chat entry
points and native live/history/analytics rich-text paths use the shared renderer.

The shared receipts.json fixtures cover 17 action outcomes plus Markdown, code,
malformed destinations, inline links, duplicates and long receipt lists. Tests
also cover exact link opening, reversible disclosure, paging without the original
card and repeated results in the native chat. This remains local fixture evidence,
not a signed transaction, phone installation or device performance measurement.

## Wallet clay layout, 0.1.7

The native wallet now uses the existing Pecu clay material for balance rows,
Receive/Send controls and optional panels. Balances lead; the QR appears only
inside Receive. Tap a token for its exact quantity and contract address. Compact
read-only amounts stop at six decimals and preserve nonzero dust. The complete
wallet address remains copyable in the header and selectable inside Receive.

Unfolded widths use two columns. Narrow screens and enlarged text use stacked
controls, with normal touch and keyboard scrolling. QR encoding runs off the main
thread only while Receive is open. Static surfaces add no render loop. Token
formatting is remembered; no new dependency or backend request was introduced.

Send retains exact input and shows the selected token balance. Review also sends
the existing reviewWallet contract so the server rejects a changed source wallet
or YOLO mode before a transfer can proceed. Linked-wallet signing remains on web.
Adding another custom token now retains the earlier token references.

This is a native wallet-sheet update. Pecu web already has clay wallet controls;
its behavior and both chat entry points are unchanged. BeeGreat Expo, CLI,
iMessage, voice and provider routing are unaffected. Existing account, portfolio,
P&L and review contracts remain shared. No deployment target changed.

Validation covers native dark/light layouts at 412dp, unfolded at 900dp, 320dp
with 160% text, reversible Receive/token/P&L controls, exact QR decoding, retained
custom tokens, invalid transfer inputs and the source-wallet guard on the HTTP
wire. These are Robolectric and mock-server fixtures. T3 lists only emulators
and cannot boot beegreat-android; phone installation and hardware performance
remain unverified. No wallet transaction was submitted.

## Thread loading (0.1.8)

Recent conversations warm in the background and render from a bounded local cache. Private, account-scoped snapshots restore messages after restart while fresh history loads. Signing out or switching accounts clears the previous account snapshot. Sending and transaction controls wait for fresh state; saved history is readable during that refresh. Histories expire after 24 hours, with at most 12 retained within a 4 MiB payload budget. First-time uncached conversations still need the network. History decoding and disk work run off the main thread.
