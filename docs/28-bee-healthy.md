# Bee Healthy

Mood, Water, Journal, and Streaks are separate tabs, in that order. Android hides the main shell navigation during the section and the journal editor. Streaks appear only in the Streaks tab. Tracker screens retain their controls and relevant history without repeated streak panels.

## Bottle

`assets/water-3d/water-bottle.blend` is the editable Blender source. `water-bottle.glb` contains the bottle shell, fill and surface meshes. The original faceted bottle uses Bee's brown edges, wax details, a six-sided honey cap and a small Bee mark. Water fills to the actual logged amount divided by the existing 2,000 ml goal. Overflow remains in the numeric readout.

Generate assets with `blender --background --factory-startup --python tools/bee-3d/build_water_bottle.py`. Build the embedded offline viewer with `bun run --cwd packages/hive-3d build --bottle`. Android, Expo and web share the viewer. Horizontal drag rotates it, vertical gestures scroll the page, arrow keys rotate, and Home or a double click resets. There is no auto-spin. A transparent rendered preview is the fallback when WebGL is unavailable.

## Streak rules

The authenticated `healthJournal:overview` query calculates all clients' streaks from the same saved records.

- Mood counts any saved mood. A difficult day counts equally.
- Water counts days with at least 2,000 ml. Removing water below the goal removes that day from the streak.
- Journal counts a non-empty title, body or attached photo. Empty drafts do not count. Multiple entries on a day count once. Unmigrated legacy notes count; deleted migrated notes do not reappear.

A current streak ends today or yesterday, so it stays active until the current day is missed. Local calendar keys determine consecutive days, including leap years and daylight-saving changes. Browsing an older date shows the streak as of that date.

Best runs cover the displayed history period, up to 365 days. The journal read is capped at 500 entries and 2 MB. If it reaches the cap, the partially read boundary day is excluded from the known period. The UI exposes unavailable journal history in each date's accessibility label and adds `+` when a streak reaches the history boundary. It never presents a truncated result as an all-time record.

Android's journal now imports existing legacy notes through the same idempotent migration used by Expo. Calendar selection queries that day's entries directly, and search queries the backend instead of searching only the latest loaded entries. Failed queries no longer look like an empty journal.

## Client and deployment coverage

Android, Expo and web have the same four tabs and share the bottle and backend overview. CLI and iMessage have no Healthy navigation or 3D renderer; their existing health and journal writes feed the same records. Agent and voice providers, wire mutation contracts, NFC actions and reminders remain compatible. No provider-specific change is required.

The read-only overview was deployed to the existing `quirky-hyena-231` development deployment used by the physical Fold app. Backend tests cover owner isolation, empty drafts, date gaps, today's grace, undo, deletion and legacy notes. The native APK, Android lint, web build and Expo TypeScript checks are verified separately. Physical iOS validation and web publishing are not part of the Fold installation.


## Hexagonal streak calendar

The fourth tab shows a month of pointy-top honeycomb cells. Rows follow calendar weeks, starting Monday, with alternating horizontal offsets. Dates expose their tracker values through accessibility labels. Previous and next buttons browse months, and future days remain muted.

Each day has three concentric hexagonal rings, from outside inward. Mood is green and closes for any logged mood. Water is blue and fills toward 2,000 ml. Journal is honey and closes for saved text or a photo. Incomplete rings keep a faint track. Today has a primary-color hexagon outline. There is no selected-day date or detail section below the calendar. Three counts above the calendar show consecutive-day streaks through today, or through the end of a browsed past month.

The shared authenticated overview includes every elapsed day of its month, including empty days. Android, Expo, and web use the same contract. The Goals card uses the existing voxel doctor bee, with a coat and stethoscope, beside the daily summary.

CLI and iMessage retain their text-based health tools. This changes screen presentation and adds a read-only calendar field; it does not change agent tools, provider behavior, or logging mutations.
