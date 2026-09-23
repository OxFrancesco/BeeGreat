# Pecu design system

Pecu and Pecu Agent use the same amber-minimal theme with Pecu's claymation
material. Keep the original coral-shell snail, soft control shapes, inset
highlights and tactile depth. UI colors and type come from amber-minimal.

## Source of truth

- `theme/amber-minimal.json` is the pinned registry theme from
  https://tweakcn.com/r/themes/amber-minimal.json.
- `theme/theme.css` contains its generated light and dark tokens. Run
  `bun run design:sync` from `apps/pecu` after updating the JSON.
- `theme/clay.css` defines shared clay shadows, radii and focus treatment.
  Derive highlights and shadows from theme colors rather than another palette.
- `theme/aero.css` holds Aero's own palette for the Aero tile on the homepage
  and the docs landing. It is the only second palette and stays inside that
  tile.
- The homepage and Agent import these same files. `/design` reads them during
  the site build, along with this guide and the component source catalog.

Both products currently display the light theme. Dark tokens are available for
explicit dark surfaces; importing them does not enable a full dark-mode UI.

## Color

Use `--background` and `--foreground` for the page, `--card` for raised controls,
`--muted` for quiet surfaces, and `--border` for separators. Use `--primary` with
`--primary-foreground` for the main action and user messages. Links use
`--accent-foreground`; amber itself is too light for text on white.

The snail keeps its original coral shell, butter body and gold coin. These
colors belong to the artwork. Do not reintroduce them as a second UI theme.

The homepage Aero tile uses Aero's colors, not amber. The tile is Aero blue
with white text around a recessed terminal screen that shows the Aero mark.
`theme/aero.css` copies the values from the pinned `@beegreat/sugar` TUI: the
six ribbon colors from `src/tui/logo.tsx`, and the terminal background, text
and primary blue from `src/tui/theme.ts`. `design:check` fails when they
drift. Use the `--aero-*` tokens only inside `.aero`.

Always pair foreground and background tokens. Use readable text to explain
pending, submitted, completed, cancelled and failed states. Color alone must
not carry transaction status. Never invent live indicators or successful results.

## Clay material

The amber-minimal base radius stays unchanged. Pecu's explicit material tokens
provide the larger shapes used by clay controls.

| Token | Use |
| --- | --- |
| `--clay-radius-control` | 14px buttons and controls |
| `--clay-radius-surface` | 22px composer and specimen surfaces |
| `--clay-radius-large` | 30px large clay surfaces |
| `--clay-radius-pill` | Capsule controls |
| `--clay-shadow-sm` | Quiet raised controls |
| `--clay-shadow` | Composer and floating panels |
| `--clay-shadow-primary` | Amber actions and user bubbles |
| `--clay-shadow-inset` | Recessed fields |
| `--clay-focus` | Focus halo around the composer |

Keep highlights at the top left and shading at the bottom right. Shadows create
the clay effect; do not add gradients, glow, glass or multiple competing accents.
Do not flatten the controls when changing a theme token.

## Typography and spacing

Use the theme's Inter sans-serif and JetBrains Mono stacks. Render amounts,
addresses and codes with tabular monospace figures. The wordmark is monospace
in `--accent-foreground`. Headings use sentence case and tight tracking.

| Role | Recipe |
| --- | --- |
| Homepage title | 36–64px, 750 weight, 1.04 line height |
| Section heading | 28–30px, 700 weight |
| Component heading | 19–24px, 650–700 weight |
| Body | 15–16px, 1.55–1.7 line height |
| Supporting text | 13–14px, muted foreground |

Prefer 8, 12, 16, 24 and 32px spacing. Keep primary actions at least 44px tall.
Homepage tool cards form a bento. On desktop, Aero spans seven of twelve
columns and both rows; Stocks and evmSDK stack beside it. Below 1000px Aero
goes full width with its screen beside the copy, and below 760px every tile
stacks. Tiles use 24px padding with the action row pinned to the bottom. The
Aero screen sits 12px inside its tile.
The homepage content is 1120px wide; the Agent conversation is capped at 940px.
The desktop thread rail is 272px. Mobile uses the thread picker.

## Components

Use existing shadcn components under `apps/stocks/src/components/ui` and
AI Elements under `components/ai-elements`. Keep appearance in the component
or shared CSS recipe. Page code arranges components and supplies their data.

Primary actions use amber, dark text and the primary clay shadow. Secondary
actions use card surfaces and the small clay shadow. Quiet actions have no
shadow. Disabled and loading states must stay readable and prevent duplicate
submission. Inputs keep labels and visible focus treatment.

Assistant replies flow on the page beside the snail. User messages use amber
bubbles with dark text. The composer is a raised clay surface. Copy actions
report success only after the clipboard write resolves and remain usable on
touch devices. Thread selection changes immediately, with no sliding highlight.

Transaction cards use the amount-led clay layout selected from concept 05.
Pay, estimated receive and spending limits lead; minimum received, destination,
network and fees remain readable below. Full addresses wrap and can be copied.
Never round away precision or invent a fee, quote, total or execution step.
Unknown contract and liquidity fields remain visible as label/value rows.

Basket trades use the ledger direction from concept 08, with each minimum beside
its own trade and shared fee information shown once. Approval cards use a recessed
amount and explain the spending permission. Aave's supplied continuation instruction
remains visible; concept 07 does not authorize inventing or automatically executing
a second step. The existing backend owns confirmation and execution.

Cards adapt to their container, including a narrow desktop chat pane. Below 380px
of card content width, metadata and actions stack. On mobile the mascot sits above
transaction cards so their content can use the conversation width. Primary actions
are at least 48px tall. Long values wrap without truncation. Confirmation codes
remain available in a disclosure.

Pending cards offer an action-specific Confirm and Cancel. Submission disables
both; submitted cards offer only Check transaction. Completed cards link to verified
receipts and distinguish original estimates from actual receipt data. Failed cards
retain the status-check warning. Expired/cancelled cards never expose Confirm.
The `/design` swap, approval and basket examples render the actual React component
at build time with fictional fixtures; their controls only change local page state.

Typing a slash opens command completion above the composer. Arrow keys move
through options, Enter or Tab accepts, and Escape dismisses. Preserve listbox
semantics and the custom text path.

## Connection and wallet controls

The wallet shows one shortened address with a copy control. Copy uses the full
address. The locally generated QR panel opens on hover or focus after one second,
or immediately on tap, and closes with Escape, outside interaction or Close.

The address itself is the P&L control. Hover or keyboard focus opens a 296px
preview card after 400ms: total, realized and unrealized amounts, the three
largest movers and the Nansen source line. Clicking or tapping the address, or
the card's expand control, opens the full P&L page at `#pnl`. The page covers
the viewport with a 940px column: back control, 7D/30D/90D/1Y periods, the
total, a realized/unrealized split, signed bars for the eight largest movers
and every token in a table. Below 600px the table keeps Token and Total and
moves the realized and unrealized amounts under the total. Back, Escape and
browser Back close it and return focus to the address without reopening the
card. Basescan moved from the address to the page header. Amounts carry a `+`
or `-` sign, and losses also use the loss color. Tokens without a Nansen price
stay visible as Unavailable, and their missing values are left out of the
totals with a note.

ChatGPT connection opens the same panel from the profile or `/agent#chatgpt`.
Use the current connection controls only, with a 400px maximum panel width and
24px side padding. The device code and copy button share an inset field. Continue
uses the amber clay action; Cancel stays quiet. Do not expose credentials, raw
provider errors or invented quotas. Sign-in starts only on user action. Closing
returns to the conversation, and failures retain a retry action.

## Profile and Safes

`/profile` uses the Agent frame: the 272px rail on desktop and a navigation
dialog below 900px. The rail lists Chat, Overview, then each organization's
Safes. The active link is a raised card; organization names are muted 12px
labels. Content is a 940px column.

The overview leads with the Pecu wallet card: address with copy and Basescan,
then a recessed stat strip of balances. Organizations follow as clay cards with
their Safes in a recessed list. With no organizations, one card explains what an
organization is and offers New organization.

A Safe page shows the organization link, the Safe name with a rename control and
the address. Receive opens the QR popover; New transaction is the amber action.
The stat strip shows required approvals and balances once. Transactions, Owners
and Settings use the recessed segmented control from the P&L periods, with the
pending count on Transactions.

Each pending transaction is a large clay card: title, who proposed it and when,
the plain-language summary, then approval beads, one per required approval,
filled amber as owners approve. Below, a recessed list names every owner with
Approved on Base, Signed or Waiting. The status line says how many approvals are
missing, and whether executing from an owner wallet completes them. Actions only
appear when the viewer can take them: Sign with the connected wallet, Approve or
Execute with the Pecu wallet, Execute with the connected wallet, Reject and
Remove from queue. A Pecu confirmation waiting on a transaction shows as an amber
tint row with Review, which opens the transaction card in a dialog. History is a
plain list with Executed links, Replaced and No longer pending.

Forms live in 480px dialogs: labelled recessed inputs, native selects, hints in
muted 13px text, the amber submit and a quiet Cancel. Connect wallet lists
EIP-6963 wallets with their own icons. Never show wallet or Pecu internals such
as proposal hashes or nonces in normal text.

## Motion

Use 160ms for control feedback, 180ms for mascot state crossfades and 200ms for
the desktop sidebar. The sidebar uses `cubic-bezier(.77, 0, .175, 1)`; general
entrances use `cubic-bezier(.23, 1, .32, 1)`. Animate transform and opacity.
Text must not scale. Thread selection and stock selection stay immediate.
The P&L card enters in 160ms with a 4px drop. The P&L page enters in 240ms
with a 12px rise and leaves in 160ms. Both use the entrance curve.

The Aero mark in `pecu-assets/aero-mark.js` is a canvas port of the TUI's
`AeroMark`. It keeps the half-block grid, 40ms frames, three-frame stagger,
cubic ease-out intro and the sweep every six seconds. The intro starts once
a third of the screen is visible. Pointer hover plays the sweep early. Playback
stops outside the viewport and while the document is hidden. Reduced motion
draws the finished mark with no intro or sweep.

Approval beads fill in 160ms. Profile tabs and navigation change immediately.

Clay controls lift at most 2px on pointer hover and depress 1px on press.
Respect reduced motion: remove movement and automatic video playback, use
posters and immediate state changes. Pause mascot playback outside the viewport
and when the document is hidden. Keep reduced-motion changes responsive.

## Assets and icons

Use the original transparent files in `pecu-assets/mascot/`. Idle and reveal
ship as VP9 WebM and HEVC with alpha, plus WebP posters. Safari uses HEVC tagged
`hvc1`; playback or decode failure falls back to the poster. Use the same codec
selection logic as the homepage. Never place the snail on an amber background.

The reveal plays once and holds its final frame. Idle may loop where an active
mascot is useful. The conversation loader is centered in the conversation, not
the whole page, and has a static reduced-motion frame. Loading errors replace
it with a retry action. Keep settled chat avatars static.

The side-eye snail is the favicon and app icon. UI controls use Lucide icons
with `currentColor`. Preserve the original artwork and third-party brand marks.

## Docs

`/docs` uses the homepage stylesheet plus `pecu-assets/docs.css`. The header
holds the wordmark, a recessed product switch for Pecu, Aero and evmSDK, and
search. Wide screens use three columns: a 248px page rail, a 760px article and
a 216px outline. Below 1180px the outline becomes an "On this page" disclosure
in the article. Below 900px the page rail moves into a drawer that also holds
the product switch.

The current page uses the amber tint with accent text. Outline highlighting
follows scroll position and changes immediately. Code blocks are recessed
`--dark` terminal surfaces. Shiki's CSS-variables theme maps tokens to amber
tints on that surface, so highlighting stays inside the theme. Copy reports
success only after the clipboard write resolves. Warning callouts use the
amber tint, like the homepage notice; notes and tips use `--muted`.

The docs landing reuses the homepage tiles: the dark Pecu tile with the still
snail, the Aero tile with its palette and mark, and the muted evmSDK tile. They
rise in once with the homepage stagger. Search opens instantly from the header,
`/` or Cmd/Ctrl+K, with no animation, because keyboard-opened panels must not
wait. The drawer slides in 200ms on the sidebar curve and fades under reduced
motion. Previous and next cards lift 2px on pointer hover.

## Copy and accessibility

Use plain words and human token amounts. Do not show machine IDs, raw JSON,
calldata or framework names in ordinary replies. Keep source paths in the design
reference, where they help developers locate components.

Keep visible focus rings, accessible names for icon buttons, labelled fields,
and live regions for asynchronous feedback. Primary controls need 44px targets.
Hide scrollbars while preserving wheel, touch, keyboard and trackpad scrolling.
No custom scrollbar tracks. Tables can scroll inside their own container; the
page must not overflow horizontally.

The non-affiliation notice from `packages/sugar/README.md` belongs on pages that
mention Aerodrome. Preserve third-party licenses and notices.

## Keeping the design aligned

Run `bun run --cwd apps/pecu design:check`. It checks the generated theme against
the pinned JSON, confirms that both apps import the shared theme and clay files,
compares `theme/aero.css` with the pinned Aero TUI, and runs `@shadcn/lint`
through Oxlint on the React source.

The shadcn rules reject raw palette colors and inline color, shadow and font
changes. The CSS check rejects new literal colors and local theme overrides in
the homepage, Agent and design-reference styles. Clay effects are explicitly
allowed through `theme/clay.css`. Asset masks and dark artwork details have
narrow documented exceptions.

The linter cannot judge composition or prove visual consistency. Check the
homepage, Agent, connection dialogs and `/design` on desktop and mobile after
changes. Test focus, disabled states, reduced motion and local sample controls.

To change the upstream theme, update the pinned JSON deliberately, regenerate,
review the token diff, and run the checks. Builds never fetch a moving theme URL.
The component file catalog refreshes automatically; new visual patterns also
need a specimen in `apps/site/scripts/build-design.ts`.

Dither chart internals and `stock-holdings.tsx` are exempt from the inline-style
rule because chart geometry and series colors come from data. Raw Tailwind color
and arbitrary color checks still apply there. Aero Stocks' standalone blue
workspace is outside this Pecu homepage/Agent theme change.

## Nansen analytics

Use `NansenChart` for typed flow, P&L and portfolio snapshots. Dither bars retain a zero baseline and negative values. Allocation pies use priced positive assets, with exact accessible rows below. Realized/unrealized and wallet/DeFi controls change local views without API calls. Do not animate financial amounts or add bloom. Keep missing values distinct from zero, disclose partial results, and retain the Nansen source link and retrieval time. Wallet balances and DeFi assets must not be summed. Interactive examples: `/nansen-showcase` on pecu.app.

## Polymarket cards

Use `PolymarketCard` for typed Polymarket snapshots, and `AnalyticsCard` wherever a
reply can hold either source. Cards share the Nansen card shell: title, one muted
meta line, content, then the source link and retrieval time. Odds are percentages
with a primary bar on a muted track; order book prices are cents per share, and
sizes are shares. Bids use a light primary fill and asks a muted fill, always under
Bids and Asks headings. Price history and trader P&L use the dotted Dither area
chart with no bloom. Signed P&L uses `+`/`-` and the loss color. Lists show six to
eight rows with Show all. Empty reads say so instead of drawing an empty chart.
Interactive examples: `/polymarket-showcase` on pecu.app.

### Card collection

The shared account menu opens My cards in the existing dialog. Show owned Blender card artwork with transparent surroundings, the card name, and copy count only above one. A newly granted card opens the dialog with a short fade and upward movement; reduced motion disables that entrance. Keep loading, retry, exhausted-drop, and connect-X states in the same dialog. The card is an actual 3D model with drag rotation, zoom, turn-over and reset controls. Arrow keys turn it, plus/minus zoom, and Home resets. There is no automatic spin. Closing it clears the cards hash and disposes the viewer. Cards persist after X disconnects.
