# 02 – Features

Full catalog from the braindump, organized and prioritized with MoSCoW. Build order lives in [07 – MVP Scope & Roadmap](07-mvp-scope-and-roadmap.md).

Feature bullets describe intended product behavior, not verified runtime status. The first-focus baseline is implemented and the FRA-463 focus economy is active work; use [10 – Linear, Docs, and Implementation Crosswalk](10-linear-docs-implementation-crosswalk.md) for evidence on `main`. User testing is deferred to the final validation phase.

## 1. First-focus loop (Must — implemented baseline)

The first end-to-end proof begins with a new user and an empty Hive:

1. The user speaks an intended outcome, with text available as a fallback.
2. Bee asks at most one clarifying question when the outcome is too vague.
3. Bee presents one editable preview containing a Goal, Project, Task, and expiring Highlight.
4. Explicit confirmation creates the complete plan atomically; cancel creates nothing and retry cannot duplicate it.
5. The highlighted Task can be completed by voice or tap.
6. Completion clears the Highlight and immediately updates the GolieBee, Hive, attributed Honey, and Honeycomb Score.

The loop uses a polished preset GolieBee with deterministic customization. Generated artwork remains deferred; the exact economy baseline is now specified in FRA-463.

## 2. Goals, projects & tasks (Must)

- Three Active Goals is healthy; seven is the server-enforced hard maximum. Activation ranks four through seven accrue the FRA-463 Brain Fatigue rates unless Genius State removes them.
- A Goal is a meaningful outcome containing finite Projects; Projects organize Tasks; Tasks may have one Subtask level.
- Every Goal gets exactly one **GolieBee**. Editing wording preserves it; replacing the outcome creates a new Goal.
- Project page: tasks, subtasks, labels, tree view, to-do list — "all the usual shenanigans"
- Goal completion is explicit: finishing every Project/Task is evidence, but the user confirms that the outcome was achieved.
- Park, abandon, delete, and Royal-Jelly-powered Resurrection are distinct lifecycle actions. Their economy behavior is specified in FRA-463 and is part of the active implementation slice.

## 3. Daily summary / Hive page (Must)

- The user's one active Highlight and its expiry
- Visual metaphor: you're **filling your hive with honey** as you make progress
- Immediate GolieBee/Hive feedback for completing the first highlighted Task
- Honey and Honeycomb Score mechanics detailed in [04 – Gamification](04-gamification.md)

## 4. Automatic time tracking (Later)

- Cross-device screen time: iPhone, iPad, Mac
- Desktop companion: **native Swift macOS menu-bar app** with Rize.io-level tracking (decided)
- iOS/iPadOS: seamless in-app focus sessions as fallback (Apple doesn't expose raw per-app screen time)
- Auto-categorization of app/site usage into work / leisure / doomscrolling

## 5. Journal (Should)

- Voice-to-text journal, always manually editable
- Photo uploads
- Can surface achievements (e.g. "connected GitHub, committed X times today")

## 6. Achievements (Must at economy depth)

- Starter GolieBee Task badges at 1/5/25 completions, Hive completed-Goal badges at 1/2/3, and a first-Genius-State badge
- Every starter badge is permanent, separate from other ranks, retroactive, and worth +5 Honeycomb Score once
- GitHub connection: commit counts as achievements
- Health goals via Apple Health / Google Health (a highlight can be "improve my health")

## 7. Gamification: Hive, Honey, Honeycomb Score (Must at proof depth)

See [04 – Gamification](04-gamification.md). Summary:

- **Honey** is the global, non-negative, spendable cosmetic currency of one Hive.
- **Honeycomb Score** permanently records verified progress and Achievements; spending Honey never reduces it.
- Brain Fatigue drains 1/2/1/1 Honey per day at activation ranks 4/5/6/7, continuously in server time; Genius State removes the drain.
- The first lifetime completion of an eligible Task awards +5 Honey and +1 Honeycomb Score, capped at eight rewarded Tasks per rolling 24 hours.
- **Royal Jelly** is earned through a fixed-roster rolling weekly progress quest and powers temporary Boosters and Resurrection.
- Retained Power-ups summon their PowerBees freely; Boosters such as Focus Shield are temporary Royal Jelly effects.

## 8. Bee Greater with Friends (Should — post-MVP)

See [06 – Social](06-social.md).

- Global leaderboard + friends leaderboard
- **Parties**: multiple friends join together on the same goal or different goals and "fight" each other
- **Bee Card**: shareable card with unique handle, Honeycomb Score, socials — usable for networking

## 9. Integrations (Could — staged)

| Integration                          | Purpose                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| GitHub                               | Commit-based achievements, work evidence in journal                       |
| Apple Health                         | Health-related goals/highlights                                           |
| Google Health API                    | Same, Android                                                             |
| Device screen time                   | Time tracking + auto-labeling                                             |
| Google Calendar (then Apple/Outlook) | External events in the [calendar view](#10-calendar-view-should--planned) |

## 10. Calendar view (Should — planned)

A time-based lens over the user's schedule, combining BeeGreat data with connected external calendars.

- Month/week view plotting **task due dates** and **project target dates** (quarter/year markers)
- **External calendar connections**: Google Calendar first, then Apple Calendar / Outlook — external events render alongside BeeGreat work so the user sees real availability around their goals
- Start read-only (subscribe/display); calendar write-back (e.g. blocking focus time for a task) is a later step
- Overdue Tasks and any future economy consequences visible at a glance (ties into [04 – Gamification](04-gamification.md))
- Agent-aware: "what's due this week?" or "when do I have time for this task?" can answer with (or deep-link into) the calendar view
- Candidate entry points: a tab on the Goals page or a `beeui` component the agent renders

## 11. Platforms (context, not a feature)

- Mobile + iPad app (Expo)
- **Web app twin** (TanStack) sharing the exact same backend
- Native Swift desktop companion for time tracking

## Explicitly NOT features (anti-goals)

- A full-blown task manager with unlimited projects/lists
- Anything that displaces the user's single current Highlight with an unlimited default work list
- Email clients and generic productivity suite features (the [calendar view](#10-calendar-view-should--planned) displays connected calendars around your goals, but BeeGreat is not trying to replace a full calendar app)

## Historical notes

Earlier versions of this catalog called Mac tracking an MVP Must, assigned generated bees to Projects, and treated three Active Goals as a hard cap. Those requirements are retained in Git history and superseded by FRA-453 (canonical domain) and FRA-459 (MVP proof flow); they are not current implementation targets.
