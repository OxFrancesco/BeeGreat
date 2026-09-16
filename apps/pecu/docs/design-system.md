# Pecu design system

Pecu's look comes from one object: the snail rendered in
`output/blender/pecu-mascot-v2`. Coral shell, butter body, an engraved gold
coin. The renders carry their own colour; the page around them uses the
shadcn "amber-minimal" theme (`https://tweakcn.com/r/themes/amber-minimal.json`)
so the coin's gold is the only accent the UI repeats. The homepage
(`apps/pecu/apps/site/site`) is the reference implementation. Reuse its
`:root` block instead of copying values around.

## Colour

Token names and values are the theme's light palette, unchanged, so a
shadcn/Tailwind app can `bunx shadcn@latest add` the same JSON and match.

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | Page. White, so the transparent mascot clips need no matching backdrop. |
| `--foreground` | `oklch(0.2686 0 0)` | Body text, headings |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / `oklch(0.2686 0 0)` | Tiles, buttons |
| `--primary` / `--primary-foreground` | `oklch(0.7686 0.1647 70.0804)` / `oklch(0 0 0)` | Primary action, "you" bubble, selection |
| `--secondary` | `oklch(0.967 0.0029 264.5419)` | Code chips, button hover |
| `--muted` / `--muted-foreground` | `oklch(0.9846 0.0017 247.8389)` / `oklch(0.551 0.0234 264.3637)` | Neutral tile tint, secondary text |
| `--accent` / `--accent-foreground` | `oklch(0.9869 0.0214 95.2774)` / `oklch(0.4732 0.1247 46.2007)` | Amber tile tint, links, wordmark, text on amber tints |
| `--border` | `oklch(0.9276 0.0058 264.5313)` | Card and button borders |
| `--ring` | `oklch(0.7686 0.1647 70.0804)` | Focus ring |
| `--chart-1` to `--chart-5` | amber to brown ramp | Diagram fills: ribbons, basket bars |
| `--dark`, `--dark-card`, `--dark-foreground`, `--dark-muted-foreground`, `--dark-border` | the theme's dark-mode background, card, foreground, muted-foreground and border | The one dark tile and the terminal block |

Contrast. `--foreground` and `--muted-foreground` on white, `--accent` and
`--muted` pass AA for body text. `--primary-foreground` (black) on `--primary`
is above 10:1. `--accent-foreground` is the link colour because `--primary`
itself is too light for text on white. Never put light amber text on white.

The coral, butter and gold of the snail stay inside the renders. Flat UI does
not reuse them; the theme's amber ramp stands in for the coin.

## Surfaces

Hide horizontal and vertical scrollbars throughout Pecu, including pages, thread lists, dialogs, textareas, tables, and code blocks. Preserve native scrolling and keyboard access. Do not add custom scrollbar tracks or disable overflow to hide a scrollbar.

Thread selection updates immediately with a flat background. Do not animate its position or fade the selected state. Keep keyboard focus rings inside row controls so the scrolling list cannot clip them.

The agent header shows the same shortened wallet address on desktop and mobile, with no status dot. The adjacent copy button copies the full address. Hover or keyboard focus for one second reveals a locally generated wallet QR code. Clicking or tapping copies and opens the QR code immediately. Escape, outside interaction, or the close button dismisses it.

Cards are the theme's recipe: `--card` background, 1px `--border`,
`--shadow-xs`. Hover lifts 3px and moves to `--shadow-md`. Tints are flat
(`--accent`, `--muted`); no gradients. The dark tile uses `--dark` with
`--dark-border` and `--shadow-lg`.

Radii follow shadcn v4: `--radius: 0.375rem`, `--radius-sm` is 2px less,
`--radius-lg` 4px more, `--radius-xl` 8px more. Buttons and chips use
`--radius`, cards and bubbles `--radius-xl`.

Shadows are the theme's `--shadow-xs`, `--shadow-sm`, `--shadow-md`,
`--shadow-lg` (neutral black at 5 to 10%). No inset shadows.

## Type

`--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
sans-serif` and `--font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular",
Menlo, Consolas, monospace`, the theme's families with system fallbacks. No
webfont request; the page renders with whatever is installed.

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Hero title (h1) | `clamp(36px, 5.2vw, 64px)`, line-height 1.04 | 750 | `-0.035em` |
| Section h2 | 30px | 700 | `-0.03em` |
| Tile h3 | 24px | 700 | `-0.02em` |
| Body | 16px / 1.7 | 400 | 0 |
| Small | 14px | 500 | 0 |
| Code | `0.9em` monospace | 400 | 0 |

Headings are sentence case. Amounts and addresses are monospace. The wordmark
is monospace in `--accent-foreground`.

## Motion

The desktop agent sidebar slides over 200ms with `cubic-bezier(.77, 0, .175, 1)`.
The conversation and toggle animate their own positions with transforms. Text
never scales. Width reflows once when the available column changes, rather than
running layout on every animation frame. Rapid toggles retarget the movement.
Keyboard activation and reduced motion switch immediately. Collapsed threads
are inert and hidden from accessibility services; closing from a focused thread
returns focus to the sidebar toggle. The mobile thread picker stays immediate.

Stock selection, trade-panel changes and chat scroll-to-latest are immediate.
Thinking text uses a gentle opacity pulse, with static text under reduced motion.
Landing-page videos respond to live reduced-motion changes and document visibility.
The snail pauses outside the viewport; an interrupted hero reveal keeps its poster.


Conversation loading uses the transparent coral-and-gold 3D spinner generated by `scripts/render-conversation-loader.py`. Center its 112px square in the conversation viewport, excluding the header and composer. Keep the workspace mounted and show it only while uncached history loads. Reduced motion shows the still frame. Loading errors replace the spinner with the existing error and retry controls.

Tokens: `--ease-out: cubic-bezier(.23, 1, .32, 1)`,
`--ease-in-out: cubic-bezier(.77, 0, .175, 1)`, `--fast: 160ms`,
`--tile: 480ms`, `--stagger: 60ms`.

Bento arrival. An `IntersectionObserver` adds `.arriving` at 12% visibility.
Tiles translate 22px and scale from .98 over `--tile` with `--ease-out`, each
delayed `calc(var(--i) * var(--stagger))`. Each tile's diagram has its own
arrival keyframe (bubbles pop, ribbons streak, bars grow, lines fade in). Only
`transform` and `opacity` animate.

Hover. Gated by `(hover: hover) and (pointer: fine)`. Tile lifts 3px over
240ms. One micro-motion per tile, never more.

Reduced motion. Videos are replaced by their poster. Arrival keeps the opacity
fade and drops the movement. Hover lifts are removed.

## Mascot

Clips live in `pecu-assets/mascot/`. Both ship with transparency, so the page
background shows through and no backdrop colour has to match the render.

- The reveal (1280x720, 8s) is the hero. It runs edge to edge
  (`width: 100vw; margin-left: calc(50% - 50vw)`) in a 16:7 box with
  `object-fit: cover` at `object-position: center 58%`, which trims the empty
  top of the render and part of the floor shadow. Under 760px it drops to 16:9
  with `object-fit: contain`. It plays once, holds the last frame, and has no
  replay control. The visible `<h1>` is the tagline under it.
- Idle (960x720, 3s) loops on the dark agent tile.
- Each clip ships twice: VP9 WebM with alpha for Chrome and Firefox and HEVC
  with alpha tagged `hvc1` for Safari. `bento.js` picks the source with one
  rule for both clips; `<source>` order cannot be trusted because Safari
  claims VP9 support but drops the alpha. Posters are WebP with alpha taken
  from the frame sequence (`0192.png` for the reveal, `0001.png` for idle),
  not the delivery PNGs, which have the ivory floor baked in. Autoplay
  refusal, reduced motion, a missing alpha codec and decode errors all fall
  back to the poster.
- Re-encode from `output/blender/pecu-mascot-v2/frames/<state>/` with
  `hevc_videotoolbox -alpha_quality 0.8 -q:v 60 -tag:v hvc1 -pix_fmt bgra` for
  HEVC and `libvpx-vp9 -pix_fmt yuva420p -crf 30 -b:v 0 -auto-alt-ref 0` for
  WebM. The 8s reveal is 570 KB as WebM and 930 KB as HEVC.
- Crossfade between states over 180ms when swapping clips in an app.

Never place the snail on `--primary` or `--accent`. The body disappears.

## Icons

The favicon is the "side-eye" profile icon from
`output/blender/pecu-mascot-v2/delivery/icons/01-side-eye.png`, exported as
`favicon.ico` (16, 32, 48), `favicon-32.png`, `icon-192.png`, `icon-512.png`
with 22% rounded corners cut to transparency, and a square
`apple-touch-icon.png` (180) since iOS masks its own corners. The worker
serves `/favicon.ico` and `/apple-touch-icon.png` from `pecu-assets/`.

## Voice

Plain words, short sentences. Say what the tool does and where it runs. No
"seamless", "powerful", "unlock". Amounts in human units. Commands in code.
The non-affiliation notice from `packages/sugar/README.md` appears in the
footer of every page that mentions Aerodrome.

## Homepage tool cards

Aero, Aero Stocks and evmSDK share equal grid columns, 24px padding,
180px illustration areas and aligned heading tops. Their copy columns grow
to keep all action rows at the same bottom inset. Primary links are 184 by
48px, with a 20px gap before secondary links. Tool cards and their buttons
do not lift on hover, so their alignment stays fixed. Below 1100px all three
cards stack at the same width, capped at 440px. Below 380px, buttons use
148px width and card padding drops to 20px.

## AI connection in the profile

Use the existing agent theme and button components. Keep one definition list for
ChatGPT connection, model, reasoning, OpenCode, and the last provider response.
Connect, Cancel sign-in, Refresh, and Disconnect use 44px minimum targets. Show
a plain inline confirmation before disconnecting. Connection errors and expired
sign-in attempts must leave a usable retry action. Show device sign-in codes only
while that user is connecting. Never show credentials, account IDs, raw provider
errors, invented quotas, or a successful-response badge presented as live health.
