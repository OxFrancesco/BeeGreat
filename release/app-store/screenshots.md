# Screenshot production plan

Produce two complete portrait sets from the exact release candidate:

| Set | Canvas | Directory |
| --- | --- | --- |
| iPhone 6.9-inch | 1320 × 2868 px | `iphone-69/` |
| iPad 13-inch | 2064 × 2752 px | `ipad-13/` |

The iPad images must come from a real iPad layout in a universal build. Do not
stretch, crop, or place an iPhone capture inside an iPad canvas.

## Deterministic filenames and shot list

Use the same sequence for each device set:

| # | Filename suffix | Overlay headline | Required in-app state |
| --- | --- | --- | --- |
| 01 | `01-bee-focus` | Turn goals into your next step | Bee conversation with a realistic request and an editable Goal, Project, Tasks, and Highlight preview. |
| 02 | `02-goals-plan` | Know exactly what to do next | Goals detail with one Project, a short Task list, and a clearly marked next Highlight. |
| 03 | `03-hive-progress` | Make focused progress visible | Hive showing Honey, Honeycomb Score, the vessel, and earned progress after a completed Task. |
| 04 | `04-voice-with-bee` | Talk it through with Bee | Voice-ready Bee screen with a short, readable assistant response and no permission dialog. |
| 05 | `05-mind-bookmarks` | Keep useful ideas close | Mind with fictional saved resources, concise summaries, and topic labels. |
| 06 | `06-beegreat-pro` | One plan. Full BeeGreat access. | Paywall showing BeeGreat Pro Monthly, Apple's live localized monthly price, Subscribe, Restore Purchases, Terms, and Privacy. |

Final names are therefore:

```text
iphone-69/01-bee-focus-1320x2868.png
iphone-69/02-goals-plan-1320x2868.png
iphone-69/03-hive-progress-1320x2868.png
iphone-69/04-voice-with-bee-1320x2868.png
iphone-69/05-mind-bookmarks-1320x2868.png
iphone-69/06-beegreat-pro-1320x2868.png

ipad-13/01-bee-focus-2064x2752.png
ipad-13/02-goals-plan-2064x2752.png
ipad-13/03-hive-progress-2064x2752.png
ipad-13/04-voice-with-bee-2064x2752.png
ipad-13/05-mind-bookmarks-2064x2752.png
ipad-13/06-beegreat-pro-2064x2752.png
```

## Capture rules

- Use fictional, internally created demo content. Do not show real names,
  health records, wallet addresses, email addresses, OAuth codes, workspace
  data, credentials, or notifications.
- Show the product in use in every image. Marketing overlays may support the
  UI, but must not replace or misrepresent it.
- Use the same fictional story across the sequence: one believable Goal, one
  Project, a small number of Tasks, and the resulting Hive progress.
- Keep the release build's real status bar, safe areas, fonts, and localized
  price. Remove debug menus, developer URLs, test banners, cursors, and
  permission dialogs.
- Keep overlay copy inside generous safe margins and verify legibility at the
  App Store's thumbnail size.
- Do not show third-party logos or content unless the use is accurate and the
  necessary trademark/content rights are documented.
- Capture on clean devices with no personal accounts. Reset the seeded review
  account between failed takes so every state remains internally consistent.
- Inspect each exported PNG at 100% for stretching, color-profile shifts,
  transparency, seams, clipped text, and accidental personal data.

## Subscription review screenshot

The subscription product needs its own review screenshot, separate from the
store listing set:

```text
subscription-review/beegreat-pro-monthly-1320x2868.png
```

Use a raw iPhone paywall capture without a device frame or marketing overlay.
The screenshot must make the product name, one-month period, Apple's live
localized price, Subscribe action, Restore Purchases, Terms, and Privacy
visible. Do not hard-code `$6.99` into the UI capture if the sandbox storefront
returns another localized price.
