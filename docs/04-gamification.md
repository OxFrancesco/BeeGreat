# 04 – Gamification: Hive, Honey, Bees & Achievements

The bee theme is the emotional core of the app. Bees are collaborative and hard-working — "Bee the best version of yourself."

## Core loop

1. Pick up to **3 goals** (a goal is a macro-project, e.g. "get healthier"), each with projects and tasks
2. Each **project gets its own bee** (see below)
3. Work on projects → your **honeycomb fills with honey**
4. Neglect, overcommit, or abandon → you **lose honey** (or a bee)
5. Honey feeds your **honeycomb score** — the public number on leaderboards and your Bee Card

## Bees (decided)

- **One bee per project**, generated at project creation:
  - Premade base bee + **FAL image model**, styled relative to the goal/project
  - Example: goal "I want to get fit" → a **coach bee** (whistle, headband); "ship my app" → a builder bee, etc.
  - Generated once, stored in R2, shown on the project page and in the hive
- Bees are the stake:
  - **Changing or deleting a goal kills its bees** — permanent, shown in a "memorial" so it stings
  - Changing a goal also **wipes all honey earned from it**

## Honey economy v1 (designed per delegation — tune with real data)

Currency: **honey drops**. All values server-authoritative.

### Earning

| Event | Honey |
|---|---|
| Complete a task | +5 |
| Complete a subtask | +2 |
| Complete a task **on or before its due date** | +5 bonus (total +10) |
| Complete a project | +50 |
| Complete a goal | +200 |
| Daily focus: ≥2h auto-tracked time labeled as work on an active goal | +10/day |
| Focus session completed (in-app, iOS fallback) | +1 per 15 min, max +8/day |
| Streak bonus: activity on a goal N days in a row | +N/day, capped at +7 |
| Achievement unlocked | +10 to +50 depending on tier |

### Losing

| Event | Honey |
|---|---|
| Postpone / change a due date | **−10 per postponement** (doubles per repeat on the same task: −10, −20, −40…) |
| Miss a due date entirely (no reschedule) | −25 |
| Miss a project deadline | −75 |
| Each active goal beyond 3 ("brain fatigue") | −15/day per extra goal |
| Change or delete a goal | **all honey from that goal wiped + its bees die** |
| 7 days of zero activity on an active goal | −5/day until touched (bees are hungry) |

### Balance targets (why these numbers)

- A focused day (2-3 tasks + tracked focus time + streak) ≈ **+30 to +50/day** — steady, satisfying
- One postponement ≈ one lost task reward — it stings but is recoverable
- Chronic postponing compounds (doubling) — the mechanic that actually enforces commitment
- Goal completion (+200) is a jackpot moment; goal abandonment is a total loss — asymmetric on purpose
- Numbers are v1; instrument everything and rebalance after beta

## Honeycomb score & leaderboards (decided)

- **All-time leaderboard**: never resets — lifetime honey earned (losses subtract)
- **Monthly leaderboard**: resets on the 1st of each month — keeps things contestable
- **Friends leaderboard**: can be reset only if **every friend in the group agrees**
- Score must be server-computed (anti-cheat) — see [03 – Architecture](03-architecture.md)

## Achievements

- Tied to streaks, goal completion, focus sessions
- **Integration-based achievements**: e.g. GitHub connected → "committed X times" (details deferred)
- Health achievements via Apple Health / Google Health when a highlight is health-related
- Surfaced in the journal and on the Bee Card

## Design principles

- Penalties should sting but never feel punitive enough to cause app abandonment (Forest's lesson: losing a tree hurts *just enough*)
- The one exception is goal abandonment — that is *supposed* to hurt (bee death + honey wipe), because choosing your 3 goals carefully is the whole product
- The hive visual doubles as the **daily summary page** — progress readable at a glance
- Keep the metaphor consistent: goals = combs, projects = bees, work = foraging, score = honey stored
