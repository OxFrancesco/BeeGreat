# 04 – Gamification: Hive, Honey, Bees & Achievements

The bee theme is the emotional core of the app. Bees are collaborative and hard-working — “Bee the best version of yourself.” Canonical terms and invariants live in [`CONTEXT.md`](../CONTEXT.md).

## Canonical world

- Every user has exactly one **Hive**.
- **Bee** is the user's personal voice agent and coordinator.
- Every Goal has exactly one **GolieBee**. Renaming or clarifying the Goal preserves it; replacing the intended outcome creates a new Goal and GolieBee.
- A completed Goal sends its GolieBee to the **Hall of Fame**. A parked Goal puts it to sleep. An abandoned Goal transforms it into a **GhostyBee** in the Memorial. Deletion is true erasure.
- An active Power-up temporarily summons a specialist **PowerBee**. Power-ups and PowerBees are outside the first MVP proof.

The proof uses one polished preset GolieBee with deterministic customization. FAL-generated Goal characters, 3D characters, and unique PowerBee art are deferred until the loop itself is proven.

## First-focus feedback loop

1. The user confirms one proposed Goal, Project, Task, and time-boxed Highlight.
2. Completing the highlighted Task is a Verified Progress Event.
3. The Highlight clears immediately.
4. The Goal's GolieBee and the user's Hive visibly react.
5. The backend attributes the resulting cosmetic Honey and permanent Honeycomb Score progress to that Goal.

The proof requires understandable feedback, not a final economy. Exact amounts remain configurable while the focus economy is designed and tested.

## Honey

**Honey** is one global, spendable, non-negative cosmetic balance belonging to the Hive.

- Every gain and loss is attributed to the Goal that caused it in the permanent Honey Ledger.
- Honey can unlock expressive Hive and bee customization only.
- Honey cannot buy Goal completion, verified progress, Achievement ranks, Honeycomb Score, Brain Fatigue relief, or gameplay advantages.
- Loss stops at zero; there is no Honey debt.

The Hive screen presents that balance first as a tactile 3D honey vessel, filled
from bottom to top like a honey jar. The MVP vessel displays progress toward a
provisional 100-Honey visual capacity; this is presentation, not a second balance
or a spending rule. Full-vessel overflow and later vessel upgrades remain economy
and cosmetic decisions.

## Honeycomb Score

**Honeycomb Score** is the non-spendable record of verified progress and Achievements across the user's BeeGreat history.

- Spending Honey never reduces it.
- Brain Fatigue never reduces it.
- Abandoning or resurrecting a Goal does not erase historical score.
- Future competition and Bee Cards use Honeycomb Score, not the user's spendable Honey balance.

The score formula and competitive periods remain later product decisions. It must be server-computed before any social comparison ships.

## Active Goals and Brain Fatigue

- **Three Active Goals** is the healthy focus threshold.
- **Seven Active Goals** is the hard maximum.
- Goals four through seven are allowed. In the intended economy, Goals four through six cause Goal-scoped Brain Fatigue following a bell-shaped curve, and a seventh Goal keeps the six-Goal penalty until Genius State is earned.
- **Genius State** requires at least one Verified Progress Event on every one of seven Active Goals within a rolling seven-day window. While maintained, Brain Fatigue disappears completely.
- At zero Honey, an affected GolieBee becomes Exhausted and cannot produce new Honey until the fatigue clears or Genius State is earned.

The current first-focus proof enforces the hard maximum of seven and treats three as the healthy threshold, but it does **not** apply Brain Fatigue or settle any associated Honey penalty for Goals four through seven. FRA-463 owns the precise bell curve, event weighting, and settlement schedule.

## Royal Jelly and Resurrection

**Royal Jelly** is a separate gameplay currency for boosters, Resurrection, and other in-game advantages. It cannot directly unlock Goal completion, Achievement ranks, or Honeycomb Score.

- How Royal Jelly is earned or purchased is intentionally undecided.
- Resurrection returns the original Abandoned Goal directly to Active and turns its GhostyBee back into a GolieBee.
- It refunds half the Honey actually removed at abandonment while preserving the original ledger and Achievements.
- Resurrection can immediately affect Brain Fatigue like any other Goal activation.

Royal Jelly, boosters, abandonment, and Resurrection are explicitly deferred from the first MVP proof.

## Achievements

- Achievements are permanent, one-time recognition of meaningful milestones.
- Ranked series use a separate permanent badge at each threshold; a higher rank never replaces a lower one.
- A **GolieBee Achievement** belongs to one Goal's GolieBee.
- A **Hive Achievement** belongs to the user's overall BeeGreat journey.

Achievements are deferred from the first-focus proof.

## Design principles

- Progress feedback should feel immediate and celebratory without becoming pay-to-win.
- Cosmetic expression uses Honey; gameplay advantages use Royal Jelly; permanent progress uses Honeycomb Score.
- Penalties may slow future Honey production but never erase verified history or create debt.
- Keep the metaphor consistent: the Hive belongs to the user, a GolieBee belongs to a Goal, and work produces verified progress.

## Historical economy proposal (superseded, retained for context)

On 2026-07-04, before FRA-453 established the canonical domain, the project delegated a numerical “Honey economy v1.” It proposed a bee per Project, treated lifetime Honey as competitive score, wiped Goal Honey on changes, and used a flat per-Goal penalty beyond three. Those assumptions are superseded; the values below are research inputs only, not current requirements.

| Historical event                       |                Proposed Honey |
| -------------------------------------- | ----------------------------: |
| Complete a task                        |                            +5 |
| Complete a subtask                     |                            +2 |
| Complete a task on/before its due date |                      +5 bonus |
| Complete a project                     |                           +50 |
| Complete a goal                        |                          +200 |
| Daily tracked focus                    |                       +10/day |
| Focus session                          | +1 per 15 minutes, max +8/day |
| Postpone a due date                    |      −10, doubling per repeat |
| Miss a task/project deadline           |                     −25 / −75 |
| Seven days of no Goal activity         |                        −5/day |

These values have not been validated. Any future economy specification must start from the canonical Honey/Honeycomb Score/Royal Jelly separation above rather than tuning this table in place.
