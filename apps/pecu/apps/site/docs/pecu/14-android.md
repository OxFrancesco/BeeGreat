---
title: Android
description: The native Android development build connects to the same Pecu account and agent.
group: Use Pecu
---

The native Kotlin Android app is in development. It uses your existing Pecu
account and conversations. Sign in with the same Google or X account as on web.

The current build includes chat, threads, streamed replies, questions, transaction
previews, wallet balances, stock holdings, P&L and ChatGPT connection settings.
Phone and unfolded layouts adapt to the available width.

The login screen has Pecu's animated 3D mascot and Google or X sign-in. The
animation loops automatically with no playback control, pauses when you leave the app and respects
the system animation setting. On older Android versions, it shows a still image.
Version 0.1.1 fixes an X sign-in error caused by selecting the legacy Twitter
provider. The app now uses Pecu's enabled X provider.

Linked-wallet signing and full profile management currently open Pecu web.
Native card viewing, external-wallet signing and complete visual parity are still
in progress. Live sign-in and phone performance have not yet been verified for
this build. There is no published Android store release.

Liquidity positions appear as compact clay cards. Open **Details** for exact
amounts, the position ID and pool address. Longer lists have **Show more positions**
and **Show fewer positions** controls. Approximate read-only amounts use ≈;
transaction approval amounts remain exact. Supported older position replies also
render as cards.

Pecu's shared response guidance favors short answers and keeps detailed figures
in the cards. This backend/web update requires release alongside the native app.

Version 0.1.3 opens stock holdings in **Graph** view. Switch to **List** to see
share quantities and estimated values. Older `/aero stocks` replies also render
as graphs when their complete saved format is recognized. The original date stays
visible; these are historical amounts, not a fresh balance lookup. Missing prices
and balances are marked unavailable. Zero holdings do not occupy the graph.

Version 0.1.4 uses a native Kotlin port of Dither Kit. Stock allocation uses its
interactive donut chart; token flows, trading P&L and outcome probabilities use
bar charts; probability and P&L history use area charts. Tap a chart to inspect a
value or drag horizontally to compare points. The holdings legend selects and
clears a stock. **List** still shows exact quantities.

The reusable library includes area, line, bar, pie, radar, and sparkline charts,
all four dither textures, axes, legends, tooltips, stacking, and optional motion
and bloom. Rendering stays local and uses the same Pecu backend data.

Version 0.1.5 shows transactions as an action with individual approval and
execution steps. Each confirmed or submitted step links to its receipt. Open
**Transaction details** for pool identifiers, contract addresses and the
confirmation reference. Close it to return to the summary.

Review amounts, recipients, spending limits, minimums, fees and warnings stay
visible and exact. A partial failure keeps successful receipts and the complete
recovery message. Completed cards do not repeat full transaction URLs. The
native app and Pecu web use the same saved transaction data and statuses.

Version 0.1.6 extends compact receipt buttons to chat replies for all Base actions,
including transfers, approvals, swaps, liquidity, claims, Aave and Safe execution.
Saved replies receive the same presentation. **Show all transactions** expands
long receipt lists; **Show fewer transactions** collapses them. Copy reply retains
the full original links.

When a confirmation reply exactly repeats the matching card result, it appears
only once. Extra warnings and recovery instructions remain visible. If the
original card is not loaded, its completion reply remains available.

Version 0.1.7 redesigns Wallet with Pecu's clay surfaces and buttons. Balances
appear first. Tap a token for its exact amount and contract address. Read-only
amounts use up to six decimals; small nonzero balances remain visible.

**Receive** opens a centered QR and the full copyable address. **Send** opens
labeled fields and shows the selected token's balance before review. Both panels
can be closed. **Add token** accepts a ticker or contract address and retains
previously added tokens. Unfolded screens use two columns; enlarged text stacks
the controls. Stock holdings and optional trading P&L remain available.

Transfer review preserves the exact amount and checks that the source wallet
has not changed and YOLO is off. Linked-wallet signing still uses Pecu web.

## Thread loading (0.1.8)

Recent conversations warm in the background and render from a bounded local cache. Private, account-scoped snapshots restore messages after restart while fresh history loads. Signing out or switching accounts clears the previous account snapshot. Sending and transaction controls wait for fresh state; saved history is readable during that refresh. Histories expire after 24 hours, with at most 12 retained within a 4 MiB payload budget. First-time uncached conversations still need the network. History decoding and disk work run off the main thread.
