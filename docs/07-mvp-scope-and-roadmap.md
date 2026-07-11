# 07 – MVP Scope & Roadmap

FRA-459 narrows the MVP to one differentiated proof: a first-time user turns a spoken intention into confirmed focus, completes one real Task, and sees their Hive respond. The older three-page roadmap remains in the decision log as product history, not the current proof boundary.

## Core problem (one sentence)

Overcommitted, self-directed makers and knowledge workers need one clear next focus across several meaningful outcomes, not another giant task manager.

## Selected first-focus proof

Start with a new user and an empty Hive:

> Voice → editable Goal/Project/Task/Highlight preview → confirmation → atomic persistence → highlighted Task completion → immediate GolieBee, Hive, Honey, and Honeycomb Score feedback.

Acceptance details:

- Voice-first with text fallback; Bee asks at most one clarification before proposing.
- One editable preview contains the whole plan and one expiring Highlight.
- Explicit confirmation is atomic and idempotent. Cancel creates nothing.
- The Task is completable by voice or tap.
- Completion expires the Highlight and produces immediate, Goal-attributed feedback.
- Use one polished preset GolieBee with deterministic customization.
- Lead the Hive with a 3D honey vessel that visibly fills bottom-to-top from the
  user's global Honey balance.
- Keep exact Honey/score amounts configurable until the economy is validated.
- Treat three Active Goals as healthy and enforce seven as the hard maximum. Goals four through seven remain allowed without a Brain Fatigue penalty in this proof; FRA-463 owns settlement.

## Success bars

- At least **4 of 5** first-time users finish unassisted within five minutes.
- At least **4 of 5** correctly explain Goal versus Highlight.
- An **activated user** confirms their first plan and completes its highlighted Task.
- After at least **25 activated users**, at least **40%** repeat the Highlight → Verified Progress loop on three distinct days during week one.
- Useful spoken response begins within **4 seconds p95**.
- Complete editable preview appears within **8 seconds p95**.
- Confirmed state becomes visible within **2 seconds p95**.

## Required proof resilience

Text fallback, microphone denial, failed transcription, malformed generated UI, lost connectivity, reduced motion, and screen-reader labels must not lose or duplicate confirmed work.

## Implementation status

The proof is **in progress** under FRA-461. The existing Expo/Convex/Flue foundation is being extended rather than replaced. Do not claim the loop is complete until root-level verification covers the atomic write, idempotent retry, voice/tap completion, feedback, accessibility/error states, and visual result. See [10 – Crosswalk](10-linear-docs-implementation-crosswalk.md).

## Explicitly deferred from the proof

- Brain Fatigue settlement/penalties, seven-Goal Genius State, and advanced Goal lifecycle (Goal creation up to the hard maximum of seven remains allowed)
- Royal Jelly sourcing, boosters, PowerBees, abandonment, and Resurrection
- Achievements, ranked badges, shops, and final economy tuning
- FAL/3D/generated GolieBees (the proof uses a preset character)
- Personal-memory retrieval in the loop
- Automatic time tracking, focus sessions, journal, and calendar
- Integrations, social, leaderboards, parties, handles, Bee Card, and billing
- Web/iPad/Android parity and iMessage generated UI

## Later roadmap

### Phase 2 — Awareness & habit

- **Swift macOS menu-bar companion** (time tracking, Rize-level) → real screen-time answers from the agent
- Auto-labeling of tracked time
- iOS focus-session fallback (seamless/automatic as possible)
- Journal (voice-to-text, editable, photos)
- Achievements v1 + GitHub integration (event details TBD)
- **Calendar view**: month/week lens over task due dates + project target dates, with external calendar connections (Google Calendar first, read-only; see [02 – Features §10](02-features.md#10-calendar-view-should--planned))
- **PowerBees**: a distinct specialist character per enabled Power-up

### Phase 3 — Social

- Friends + friends leaderboard (unanimous-consent reset), all-time + monthly global leaderboards
- Parties: same-Goal and free-for-all modes, with scoring/buy-in redesigned around Honeycomb Score and cosmetic Honey
- Bee Card sharing (R2-rendered image + deep link)

### Phase 4 — Expansion

- TanStack web twin (could move earlier if dev speed is fine — same backend makes it cheap)
- Apple Health / Google Health integrations + health goals
- iPad-optimized layouts
- Monetization: RevenueCat subscription tiers (free/paid split decided here)

## Explicitly out of scope (for now)

| Item                                                                  | Why deferred                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Full task-manager parity (recurring tasks, dependencies, gantt, etc.) | Anti-goal — the app is deliberately constrained            |
| Android at launch                                                     | Focus on iOS/iPadOS + web first (Expo keeps the door open) |
| OpenClaw workflow / Linear/Notion companion variants                  | Standalone app decided                                     |
| "Land dies" dark-stake mechanics                                      | Replaced by bee/hive framing                               |
| In-app networking features beyond the Bee Card                        | Card is enough for v1 of networking                        |

## Scope decision log

| Date       | Request                                                        | Source                                | Decision                                                                                      | Rationale                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-29 | All braindump features at once                                 | Founder braindump                     | Split into 4 phases                                                                           | Ship the 3 named pages first                                                                                                                                                                                              |
| 2026-07-04 | Handles at signup despite social being Phase 3                 | Docs review                           | Approved                                                                                      | Retrofit cost too high                                                                                                                                                                                                    |
| 2026-07-04 | Desktop tracking: Electron vs Swift                            | Founder Q&A                           | **Swift macOS app**                                                                           | Reliable Accessibility APIs, lighter, App Store option                                                                                                                                                                    |
| 2026-07-04 | Voice provider                                                 | Founder Q&A                           | **ElevenLabs** (STT+TTS)                                                                      | Quality; replaces "verify Cloudflare voice" question                                                                                                                                                                      |
| 2026-07-04 | Agent framework                                                | Founder Q&A                           | **Flue**                                                                                      | Confirmed real (flueframework.com, Astro team); fits Cloudflare deploy                                                                                                                                                    |
| 2026-07-04 | Billing                                                        | Founder Q&A                           | **RevenueCat**, deferred; launch free-only                                                    | Apple IAP compliance; decide tiers later                                                                                                                                                                                  |
| 2026-07-04 | Memory layer                                                   | Founder Q&A                           | **SuperMemory**                                                                               | Start simple, swap only if it underdelivers                                                                                                                                                                               |
| 2026-07-04 | Bee avatars                                                    | Founder Q&A                           | **FAL** generation, one bee per project                                                       | Goal-styled bees (e.g. coach bee) are the stake mechanic                                                                                                                                                                  |
| 2026-07-04 | Honey formula & party rules                                    | Founder delegation                    | v1 designed in docs 04/06                                                                     | Balance to be tuned in beta                                                                                                                                                                                               |
| 2026-07-05 | Calendar view of due/target dates                              | Founder request                       | Added as planned feature (Phase 2)                                                            | Due dates + project targets now exist                                                                                                                                                                                     |
| 2026-07-05 | External calendars (Google Calendar etc.) in the calendar view | Founder correction                    | Approved — read-only display first, write-back later                                          | Seeing real availability around goals beats a BeeGreat-only view; anti-goal narrowed to "not a full calendar client"                                                                                                      |
| 2026-07-07 | A bee design per power-up                                      | Founder request                       | Added as planned feature (Phase 2)                                                            | Power-up system now exists (WebTree first); reuses the FAL bee pipeline so each power-up feels distinct                                                                                                                   |
| 2026-07-10 | Canonical memory storage                                       | FRA-423 canonical acceptance criteria | **Convex canonical; Git only for non-personal schema/templates/tests**                        | Inspectable revisions, provenance, owner-scoped access, and hard deletion require one authoritative store; the 2026-07-04 SuperMemory choice is retained as superseded history in [09](09-fra-423-memory-architecture.md) |
| 2026-07-10 | Canonical focus domain                                         | FRA-453                               | **Healthy three Active Goals; hard max seven; one GolieBee per Goal; one expiring Highlight** | Replaces the earlier hard-three cap, Project bees, and ambiguous Highlight slots while preserving deliberate focus pressure                                                                                               |
| 2026-07-10 | Focus economy boundaries                                       | FRA-453                               | **Global cosmetic Honey; permanent Honeycomb Score; separate Royal Jelly for advantages**     | Spending cosmetics must not erase verified progress or become pay-to-win; Royal Jelly acquisition remains undecided                                                                                                       |
| 2026-07-11 | Single MVP proof                                               | FRA-459                               | **Voice → editable plan → confirmation → first Task completion → Hive feedback**              | Proves BeeGreat's differentiated activation/retention loop before adding time tracking, social, generated bees, or the advanced economy                                                                                   |
| 2026-07-11 | Hive hero                                                      | Founder request                       | **3D honey vessel is the first Hive object and fills like a jar**                             | Makes the global cosmetic Honey balance tangible without changing permanent Honeycomb Score                                                                                                                               |
