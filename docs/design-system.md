# BeeGreat Design System

The single reference for how BeeGreat looks, moves, and speaks — across the
mobile app (Expo / React Native), the web twin, and Bee's generative UI
(`beeui`). When code and this document disagree, fix one of them; the tokens
below are extracted from the real sources listed in [Source of truth](#source-of-truth).

---

## 1. Identity

**Creative North Star: "The Calm Hive."** BeeGreat is a focused personal-agent
app: one clear next focus, carried by Bee and the Hive. The interface is
restrained by default — quiet neutral surfaces, earthy brown actions, and warm
honey used sparingly as the signature accent. Bee (the pixel bee), honeycomb
geometry, and wax-cell texture are identity details, not decoration on every
surface.

### The house rules

- **The One Honey Rule.** One honey-accented element leads a region. Competing
  honey controls erase hierarchy.
- **The Quiet Type Rule.** Hierarchy comes from weight, spacing, and placement —
  never tiny uppercase labels or oversized fluid headings.
- **The Earned Lift Rule.** Persistent content sits flat on the canvas with
  hairline borders. Shadows are reserved for temporary layers (menus, sheets,
  floating voice state).
- **Ids are plumbing.** Machine identifiers (Convex ids, Devin session ids,
  request ids) never reach the user — not spoken, not rendered. They live only
  in structured machine fields, and the client scrubs strays
  (`scrubIdentifiers` in `@beegreat/tool-presentation`).
- **Voice first.** Every agent reply must work read aloud: short spoken
  sentences carry the insight; visual density belongs in generated UI cards.

---

## 2. Color

### Core palette (mobile: `apps/mobile/src/constants/theme.ts`, web: `apps/web/src/styles/app.css`)

| Token (mobile / web)                        | Light     | Dark      | Use |
| ------------------------------------------- | --------- | --------- | --- |
| `text` / `--ink`                             | `#202020` | `#eeeeee` | Primary text |
| `textSecondary` / `--ink-soft`               | `#646464` | `#b4b4b4` | Supporting copy, metadata |
| `background` / `--canvas`                    | `#f9f9f9` | `#111111` | Page background |
| `card` / `--surface`                         | `#fcfcfc` | `#191919` | Cards, inputs |
| `backgroundElement` / `--surface-muted`      | `#efefef` | `#222222` | Chips, tracks, quiet fills |
| `backgroundSelected` / `--surface-selected`  | `#e8e8e8` | `#2a2a2a` | Selected states |
| `border` / `--line`                          | `#d8d8d8` | `#201e18` / `#35312c` | Hairline boundaries |
| `primary` / `--brown`                        | `#644a40` | `#ffe0c2` | Primary actions ("Hive Brown") |
| `primaryForeground` / `--brown-ink`          | `#ffffff` | `#081a1b` / `#241810` | Text on primary |
| `secondary` / `--honey`                      | `#ffdfb5` | `#393028` | Honey fills: user bubbles, highlights |
| `secondaryForeground` / `--honey-ink`        | `#582d1d` | `#ffe0c2` | Text on honey |
| `destructive` / `--danger`                   | `#e54d2e` / `#c94b2c` | `#e54d2e` / `#f07858` | Destructive, errors |
| — / `--honey-strong`                         | `#f5bd62` | `#dcae67` | Focus rings, hover accents (web) |
| — / `--success`                              | `#35694a` | `#8fc9a2` | Success (web) |

Roles: **Hive Brown** = decisive actions, rare enough to signal commitment.
**Warm Honey** = progress, voice, selection, and the user's own words. Neutrals
carry everything else.

### Signature accent palettes

- **Comb / wax cell** (Mind honeycomb, `bookmark-item.tsx`): fill
  `#FFEBC4 → #FCC968` (failed: `#FBE0D6 → #F3B39E`), wall `#E39A2E`, inner wall
  `rgba(255,250,235,0.85)`, rim shadow `rgba(126,74,5,0.28)`, text `#582D1D`.
- **Honey tile** (icon marks on cards, section chips): fill `#FFF0C2`, ink
  `#6D4B0D`.
- **Moods** (`lib/bee-healthy.ts`): awful `#D96F5C`/`#F8DDD7`, bad
  `#C98B48`/`#F6E5D1`, okay `#D9A63E`/`#F8EDCE`, good `#75A469`/`#E1EDDD`,
  great `#449487`/`#D9ECE8` (strong / soft pairs).
- **Water** (hydration): fill bar `#55BEE2`; bottle palette in
  `hydration-tracker.tsx` (light `#75CBD4`/`#2F8795`, dark `#4BA5B2`/`#205D69`,
  outline `#705044` / `#F1D0B0`).
- **Devin power-up**: `#D85238` mark, `#F2765A` tints. Power-up cards may carry
  their brand accent, but only inside their own card.
- **Tab tint** (native tabs): `DynamicColorIOS({ light: '#482401', dark: '#FAB52A' })`.

---

## 3. Typography

### Faces (`Fonts` in `constants/theme.ts`)

| Role     | iOS               | Web fallback stack |
| -------- | ----------------- | ------------------ |
| Display  | `ui-rounded`      | `SF Pro Rounded, Arial Rounded MT Bold, system-ui` |
| Body     | `system-ui`       | `Inter, ui-sans-serif, -apple-system` |
| Mono     | `ui-monospace`    | `SFMono-Regular, Consolas` |

Rounded headings carry BeeGreat's warmth; body copy stays familiar and compact.

### Mobile scale (`ThemedText` types)

| Type        | Size / line height | Weight | Use |
| ----------- | ------------------ | ------ | --- |
| `title`     | 48 / 52            | 600    | Rare hero titles |
| `subtitle`  | 32 / 44            | 600    | Root-screen large titles |
| `default`   | 16 / 24            | 500    | Body |
| `small`     | 14 / 20            | 500    | Metadata, captions |
| `smallBold` | 14 / 20            | 700    | Labels, card titles |
| `code`      | 12, mono           | 500    | Technical text |

Screen-local styles may add intermediate sizes (e.g. 22/28 section headers,
17/26 chat body). Numbers that update in place always use
`fontVariant: ['tabular-nums']`. Large numbers get compact formatting (1.4M, 38k).

---

## 4. Space, shape, and elevation

### Spacing (`Spacing`, mobile)

`half: 2 · one: 4 · two: 8 · three: 16 · four: 24 · five: 32 · six: 64`

Prefer flex `gap` over margins; padding over margin. Web maps to
`xs 4 / sm 8 / md 16 / lg 24 / xl 32 / section 64`.

### Layout

- One working column, **`MaxContentWidth = 800`**, centered.
- Screens open with a `ScrollView` (`contentInsetAdjustmentBehavior="automatic"`),
  padding on `contentContainerStyle` (`paddingHorizontal: Spacing.three`).
- Respect both safe-area edges; never hand-roll insets when the stack/tabs
  already provide them.

### Radii

| Radius | Use |
| ------ | --- |
| 11–14  | Icon marks, small tiles, chips with content |
| 16 (`Spacing.three`) | Cards, inputs, editors — the default |
| 18     | Web cards |
| 999    | Pills: capsule buttons, label chips, progress tracks |

Every rounded rect that isn't a capsule uses `borderCurve: 'continuous'`.

### Elevation

Flat by default: `borderWidth: StyleSheet.hairlineWidth` + `border` color
explains structure. Shadows only for floating layers, via the CSS `boxShadow`
style prop (never legacy RN shadow/elevation props). Web ambient shadow:
`--shadow-soft`.

---

## 5. Motion (`constants/motion.ts`)

| Token | Value |
| ----- | ----- |
| `pressIn` 100ms · `pressOut` 160ms · `exit` 150ms · `enter` 200ms · `progress` 240ms | All state transitions live in 100–240ms |
| Easing `out` | `bezier(0.23, 1, 0.32, 1)` |
| Easing `inOut` | `bezier(0.77, 0, 0.175, 1)` |
| Press scale | `0.97` (with `opacity ~0.72`) — no bounce choreography |
| Enter scale | `0.94` |

Patterns: Reanimated `FadeInDown.duration(180)` for arriving elements,
`FadeOut.duration(140)` for leaving; generated-UI cards stagger with
`FadeInDown.delay(index * 80).springify().damping(18)`. **Always** check
`useReducedMotion()` and fall back to plain fades or final values. Ambient
loops (water waves) run linear and slow (3.6–5.2s) and respect
`ReduceMotion.System`.

Haptics (iOS only, guard with `process.env.EXPO_OS === 'ios'`): selection for
picking options and links, light impact for incrementing actions, success
notification for completed saves.

---

## 6. Iconography and assets

- **SF Symbols first** (`SymbolView` / `expo-image` `sf:` source) with Material
  (`md`) equivalents on Android and a text `fallback` prop for web.
- Recurring symbols: `chevron.left/right` navigation, `arrow.up.right` external
  link, `plus.circle` create, `pencil` update, `trash` delete, `checkmark.circle`
  done, `magnifyingglass` search, `bookmark` Mind, `scope` goals,
  `cloud.fill` Devin, `sparkles` generic agent work, `bolt.fill` power-ups.
- Brand assets (shared by mobile and web from `apps/mobile/assets`): pixel Bee
  (`bee.webp`, `FloatingBee`), bee doctor (Bee Healthy), mood bees, tab icons
  (`bee.png`, `honeycomb.png`, `hive.png`, `mic-honey.png`).
- Hexagons are drawn (Skia `makeHexPath`), pointy-top, tessellated edge to edge.

---

## 7. Navigation

- **Main shell**: `NativeTabs` (liquid glass on iOS 26) — Bee · Goals · Hive ·
  Mind, plus the mic trigger split into its own pill (`role="search"`,
  `disabled`, tabPress → mic bus). `minimizeBehavior="onScrollDown"`.
- **Section takeover pattern** (e.g. Bee Healthy): a self-contained flow pushes
  onto the **root stack**, collapsing the main tab bar, and mounts its own
  `NativeTabs` for its sub-sections (Mood · Water · Journal). Each screen shows
  a compact `SectionHeader` (back chevron → `router.dismiss()`, title, date).
- **In-tab drill-down**: nested `Stack`s with `headerShown: false` and the
  shared `ScreenHeader` (large title on roots; back-arrow row on children).
- **Temporary layers**: `formSheet` presentation with detents
  (`sheetAllowedDetents`), grabber visible, `contentStyle: { height: '100%' }`.

---

## 8. Core components

- **Card**: `card` background, hairline `border`, radius 16, continuous curve,
  padding `Spacing.three`, internal `gap: Spacing.two`. Pressable cards dim to
  `opacity 0.72` + `scale 0.98–0.99`.
- **List row card**: icon/glyph (52–58px) · title + one-line metadata ·
  `chevron.right` 14px in `textSecondary`.
- **Primary button**: pill (radius 999), `primary` fill, `primaryForeground`
  label, min height 44. Disabled = `backgroundElement` fill + `textSecondary`
  label. Loading = spinner replaces the label, never alongside.
- **Quiet button**: `card` fill, hairline border, pill.
- **Label chip**: pill, `backgroundElement` fill, `small` text in
  `textSecondary`, padding 8×3.
- **Icon mark**: 34px rounded-11 honey tile (`#FFF0C2` + `#6D4B0D` icon);
  power-ups use their brand color.
- **Inline feedback (undo bar)**: min-height 44 row, `backgroundElement` fill,
  radius 14, message left / action right, auto-dismisses in 5s, announced to
  VoiceOver.
- **Text input / editor**: `card` or `background` fill, hairline border,
  radius 16, generous inset (`Spacing.three`), honey selection color
  (`#D89B21`), placeholder in `textSecondary`.
- **Progress**: thin capsule tracks (3–12px) in `backgroundElement` with the
  domain accent as fill (water `#55BEE2`, generic `primary`).
- **Week pulse**: 7 columns — narrow weekday letter, 30px mood orb (soft mood
  fill, 2px border; today ringed `#E4A72C`), water bar underneath.

Accessibility floor: 44px minimum targets, complete `accessibilityRole`/state,
live regions for async status, `selectable` on data users may copy,
`accessibilityLabel`s that read naturally.

---

## 9. Chat surface

- **User message**: honey bubble (`secondary` fill, `secondaryForeground`
  text), right-aligned, radius 16 with a 4px bottom-right notch, "You" label.
- **Assistant message**: full-width flow next to a 36px `FloatingBee` avatar —
  no bubble. Body renders as **markdown** (17/26): honey-underlined links,
  `backgroundElement` code blocks, honey-ruled blockquotes, GFM tables/lists.
  Mobile: `components/agent/markdown.tsx`; web: AI Elements `MessageResponse`
  (Streamdown) under `.assistant-markdown`.
- **Tool activity**: collapsed pill row ("Searched your Mind ✓") with SF symbol,
  expandable for detail. Human copy lives in `@beegreat/tool-presentation`
  (`getToolCopy`) — running/done/failed strings per tool, power-up badge when
  relevant. Never show raw tool names, payloads, or ids in the collapsed row.
- **Reasoning**: collapsible "Bee is reasoning" disclosure while streaming.

---

## 10. Generative UI (`beeui`)

Bee appends at most **one** fenced ```beeui``` block of JSON per reply:
`{ "components": [ … ] }`. The client validates with zod
(mobile `lib/ui-spec.ts`, web `features/bee/bee-ui.ts`), **scrubs machine ids
from every user-visible string**, drops malformed blocks silently, and renders
native cards below the reply with staggered entrances. The prompt contract
lives in `packages/agent/src/agents/bee.md` — keep all three in sync.

### Component vocabulary

| Type | Shape | Use when |
| ---- | ----- | -------- |
| `text` | `{body}` | A short written note that doesn't fit speech |
| `metric` | `{label, value, delta?}` | One key number |
| `chart` | `{kind:"bar", title, unit?, data:[{label, value}]}` | Comparisons over categories/days |
| `tasks` | `{title, items:[{id, title, done, due?}]}` | Task lists; rows overlay **live Convex state** and toggle on tap |
| `highlight` | `{title, body}` | The dense summary card — honey fill, no border |
| `image` | `{url, alt, title?}` | Generated media — full preview with Copy and Download/Save actions |
| `bookmark` | `{title, url, note?}` | Referencing saved Mind items — never a `highlight`, never a raw URL dump |
| `devin` | `{title, status, statusDetail?, sessionId, sessionUrl, summary?, pullRequests[]}` | Devin cloud-task status; live-updates from Convex; session id is machine-only |
| `first_focus` | `{requestId, goalTitle, projectTitle, taskTitle}` | Editable, uncommitted first-focus preview; app owns the atomic write |
| `confirm` | `{summary, action, payload?}` | Before destructive/costly actions; renders Yes/No that reply into the chat |
| `question` | `{questions:[{header, question, options?:[{label, description?}]}]}` | Pause an unfinished request for 1–3 essential answers; option lists have 2–3 choices and custom typed answers remain available |

### Card anatomy rules

- All generated cards share the base card recipe (§8); `highlight` swaps to the
  honey fill; power-up cards (`devin`) may use their brand accent border.
- Interactive cards reply **through the conversation** (`onReply`) or deep-link
  (`Linking.openURL`) — they never mutate silently, except live task toggles
  which write through the same Convex mutation the Goals screens use.
- `question` card: one quiet card containing short prompts separated by hairlines;
  option rows are 44px targets on muted surfaces, the selected choice gets the
  region's single honey accent, and the footer always makes the custom typed
  answer path explicit. A choice is sent as a normal reply so the unfinished
  request resumes in the same conversation.
- `bookmark` card: one row — site favicon (22px, rounded 6) · single-line
  title · `↗` — with the one-sentence note (or the host as fallback) below;
  the whole card opens the URL. No label chips, no kind badges.
- `image` card: full-width edge-to-edge cover preview on a quiet surface, optional title,
  then 44px Copy and Download/Save actions. Copy targets the image pixels when the
  platform allows it and otherwise copies the exact URL with truthful feedback.
- Numbers in cards use tabular figures; hosts/URLs display without `www.`.

### Content contract (agent side)

- Spoken layer: 1–3 conversational sentences, no lists/URLs/emoji; the insight,
  not the data dump.
- Everything visual and dense goes in the one `beeui` block; never narrate it
  ("see the chart below" is fine).
- Real data only — every id, title, count comes from a specialist/tool reply.
- Ids never appear in user-readable strings (see §1); wallet addresses the user
  genuinely needs are shown truncated (first + last four).

---

## 11. Do / Don't

**Do**

- Reuse Bee, Hive, honeycomb, voice, and mood assets everywhere; keep web and
  mobile visually indistinguishable in character.
- Keep the current action and its status visible without explanatory prose.
- Honor reduced motion; keep transitions 100–240ms.
- Provide typed recovery for every voice path.

**Don't**

- Build dense SaaS dashboards, nested card grids, or decorative metrics.
- Use gradients-on-white, glassmorphism (outside system liquid glass),
  side accent stripes, gradient text, or uppercase-label hierarchy.
- Add marketing copy or buzzwords that delay the task.
- Show machine ids, raw tool payloads, or unformatted JSON to the user — ever.

---

## Source of truth

| Area | File |
| ---- | ---- |
| Mobile tokens (color/font/spacing/width) | `apps/mobile/src/constants/theme.ts` |
| Motion tokens | `apps/mobile/src/constants/motion.ts` |
| Text scale | `apps/mobile/src/components/themed-text.tsx` |
| Web tokens | `apps/web/src/styles/app.css` (`:root`) |
| Web shadcn/AI Elements token bridge | `apps/web/src/styles/app.css` (`--background` etc. → hive tokens, `@theme inline`) |
| Web chat primitives (vendored AI Elements) | `apps/web/src/components/ai-elements/`, shadcn base in `apps/web/src/components/ui/` |
| Web palette front-matter | `DESIGN.md` |
| beeui schema (mobile) | `apps/mobile/src/lib/ui-spec.ts` |
| beeui schema (web) | `apps/web/src/features/bee/bee-ui.ts` |
| beeui renderers | `apps/mobile/src/components/agent/generated-ui.tsx`, `apps/web/src/features/bee/generated-ui.tsx` |
| Agent prompt contract | `packages/agent/src/agents/bee.md` |
| Tool copy + id scrubbing | `packages/tool-presentation/src/` |
| Chat markdown | `apps/mobile/src/components/agent/markdown.tsx`, `.assistant-markdown` in `app.css` |
| Mood/water/comb palettes | `apps/mobile/src/lib/bee-healthy.ts`, `.../hydration-tracker.tsx`, `.../mind/bookmark-item.tsx` |

**Adding a beeui component checklist**: zod schema in both apps → scrub case →
renderer in both apps (+ web CSS) → document in `bee.md` → row in §10 → test in
`bee-ui.test.ts`.
