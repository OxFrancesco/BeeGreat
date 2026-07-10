# 07 – MVP Scope & Roadmap

The braindump explicitly names the first three things to build. This doc locks that in and defers everything else, so the core doesn't drown in the (great) extra ideas.

## Core problem (one sentence)

People spread attention across too many things; Bee Great forces you to focus on at most 3 goals and shows you — via automatic tracking and a personal agent — whether your time actually goes to them.

## Success criteria for MVP

- A user can set up to 3 goals, break them into projects/tasks, and complete work
- The voice agent answers questions about the user's goals/tasks/time and renders useful UI
- The hive/honey loop visibly reacts to progress and postponement
- Retention signal: users return daily to check the hive / talk to the agent

## Phase 1 — MVP (the three pages from the braindump)

1. **Voice agent home**: agent on top → Dynamic Island pill → auto-generated cards, text, task lists below
2. **Project page**: projects with tasks, subtasks, labels, tree view, to-do list
3. **Hive / daily summary page**: highlight slots, honey filling the hive, honey gain/loss rules (incl. due-date postponement penalty)

Plus the invisible foundations:

- Expo app + Convex backend + Clerk auth (**free-only at launch** — no billing; RevenueCat wired in later)
- **Flue agent** on Cloudflare + OpenRouter + **ElevenLabs** voice, text input fallback from day one
- Thread persistence + **Convex canonical memory** (FRA-423; explicitly
  supersedes the earlier SuperMemory choice—see [09](09-fra-423-memory-architecture.md))
- Bee-per-project generation via **FAL** (base bee + goal-styled variant)
- Unique handle at signup (cheap now, painful to retrofit); renames allowed, no reserved names

## Phase 2 — Awareness & habit

- **Swift macOS menu-bar companion** (time tracking, Rize-level) → real screen-time answers from the agent
- Auto-labeling of tracked time
- iOS focus-session fallback (seamless/automatic as possible)
- Journal (voice-to-text, editable, photos)
- Achievements v1 + GitHub integration (event details TBD)
- **Calendar view**: month/week lens over task due dates + project target dates, with external calendar connections (Google Calendar first, read-only; see [02 – Features §10](02-features.md#10-calendar-view-should--planned))
- **Power-up bees**: a distinct FAL-generated bee design per power-up (e.g. a WebTree bee), so each power-up the user enables has its own visual identity alongside the project bees

## Phase 3 — Social

- Friends + friends leaderboard (unanimous-consent reset), all-time + monthly global leaderboards
- Parties: "Honey Wars" (same-goal and free-for-all modes, honey pot buy-in)
- Bee Card sharing (R2-rendered image + deep link)

## Phase 4 — Expansion

- TanStack web twin (could move earlier if dev speed is fine — same backend makes it cheap)
- Apple Health / Google Health integrations + health goals
- iPad-optimized layouts
- Monetization: RevenueCat subscription tiers (free/paid split decided here)

## Explicitly out of scope (for now)

| Item | Why deferred |
|---|---|
| Full task-manager parity (recurring tasks, dependencies, gantt, etc.) | Anti-goal — the app is deliberately constrained |
| Android at launch | Focus on iOS/iPadOS + web first (Expo keeps the door open) |
| OpenClaw workflow / Linear/Notion companion variants | Standalone app decided |
| "Land dies" dark-stake mechanics | Replaced by bee/hive framing |
| In-app networking features beyond the Bee Card | Card is enough for v1 of networking |

## Scope decision log

| Date | Request | Source | Decision | Rationale |
|------|---------|--------|----------|-----------|
| 2026-06-29 | All braindump features at once | Founder braindump | Split into 4 phases | Ship the 3 named pages first |
| 2026-07-04 | Handles at signup despite social being Phase 3 | Docs review | Approved | Retrofit cost too high |
| 2026-07-04 | Desktop tracking: Electron vs Swift | Founder Q&A | **Swift macOS app** | Reliable Accessibility APIs, lighter, App Store option |
| 2026-07-04 | Voice provider | Founder Q&A | **ElevenLabs** (STT+TTS) | Quality; replaces "verify Cloudflare voice" question |
| 2026-07-04 | Agent framework | Founder Q&A | **Flue** | Confirmed real (flueframework.com, Astro team); fits Cloudflare deploy |
| 2026-07-04 | Billing | Founder Q&A | **RevenueCat**, deferred; launch free-only | Apple IAP compliance; decide tiers later |
| 2026-07-04 | Memory layer | Founder Q&A | **SuperMemory** | Start simple, swap only if it underdelivers |
| 2026-07-04 | Bee avatars | Founder Q&A | **FAL** generation, one bee per project | Goal-styled bees (e.g. coach bee) are the stake mechanic |
| 2026-07-04 | Honey formula & party rules | Founder delegation | v1 designed in docs 04/06 | Balance to be tuned in beta |
| 2026-07-05 | Calendar view of due/target dates | Founder request | Added as planned feature (Phase 2) | Due dates + project targets now exist |
| 2026-07-05 | External calendars (Google Calendar etc.) in the calendar view | Founder correction | Approved — read-only display first, write-back later | Seeing real availability around goals beats a BeeGreat-only view; anti-goal narrowed to "not a full calendar client" |
| 2026-07-07 | A bee design per power-up | Founder request | Added as planned feature (Phase 2) | Power-up system now exists (WebTree first); reuses the FAL bee pipeline so each power-up feels distinct |
| 2026-07-10 | Canonical memory storage | FRA-423 canonical acceptance criteria | **Convex canonical; Git only for non-personal schema/templates/tests** | Inspectable revisions, provenance, owner-scoped access, and hard deletion require one authoritative store; the 2026-07-04 SuperMemory choice is retained as superseded history in [09](09-fra-423-memory-architecture.md) |
