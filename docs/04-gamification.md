# 04 – Gamification: Hive, Honey, Bees & Achievements

The bee theme is the emotional core of the app. Bees are collaborative and hard-working — “Bee the best version of yourself.” Canonical terms and invariants live in [`CONTEXT.md`](../CONTEXT.md).

## Canonical world

- Every user has exactly one **Hive**.
- **Bee** is the user's personal voice agent and coordinator.
- Every Goal has exactly one **GolieBee**. Renaming or clarifying the Goal preserves it; replacing the intended outcome creates a new Goal and GolieBee.
- A completed Goal sends its GolieBee to the **Hall of Fame**. A parked Goal puts it to sleep. An abandoned Goal transforms it into a **GhostyBee** in the Memorial. Deletion is true erasure.
- An active Power-up temporarily summons a specialist **PowerBee**. Power-ups and PowerBees are outside the first MVP proof.

The current app uses one polished preset GolieBee with deterministic customization. FAL-generated Goal characters, 3D characters, and unique PowerBee art remain later visual work.

## First-focus feedback loop

1. The user confirms one proposed Goal, Project, Task, and time-boxed Highlight.
2. Completing the highlighted Task is a Verified Progress Event.
3. The Highlight clears immediately.
4. The Goal's GolieBee and the user's Hive visibly react.
5. The backend attributes the resulting cosmetic Honey and permanent Honeycomb Score progress to that Goal.

FRA-463 fixes the first server-authoritative economy baseline below. The values remain configurable product parameters, but clients never calculate or submit balances. Founder-directed user testing is deferred to the final validation phase.

## Honey

**Honey** is one global, spendable, non-negative cosmetic balance belonging to the Hive.

- Progress gains and focus-economy losses are attributed to the Goal that caused them in the permanent Honey Ledger.
- Cosmetic purchases debit the global balance without allocating the spend to a Goal. Spending therefore does not rewrite a Goal's attributed earnings or fatigue history.
- Honey can unlock expressive Hive and bee customization only.
- Honey cannot buy Goal completion, verified progress, Achievement ranks, Honeycomb Score, Brain Fatigue relief, or gameplay advantages.
- Loss stops at zero; there is no Honey debt.
- The balance is unbounded. The 100-Honey vessel is only a visual fill threshold: at 100 or more it remains full and displays the exact balance and overflow.

The Hive screen presents that balance first as a tactile 3D honey vessel, filled from bottom to top like a honey jar.

## Verified Task rewards

The first server-confirmed completion of a Task belonging to an Active Goal records a Verified Progress Event, regardless of whether it came from a Highlight, the normal app flow, voice, or an agent.

- An eligible completion awards **+5 Honey** to its Goal and **+1 Honeycomb Score**.
- A Hive can receive that completion reward for at most **eight Tasks in any rolling 24-hour window**.
- A ninth completion is still recorded as verified progress and may qualify its Goal for Genius State or a Royal Jelly Quest, but awards neither Honey nor Score.
- A Task is rewardable only on its first lifetime transition to completed. Replays, retries, duplicate commands, and complete → reopen → complete cycles never reward it again.
- Explicitly completing a Goal awards no extra Honey. The applicable completed-Goal Achievement is the only completion reward.

The backend uses its own clock, enforces the rolling window across the whole Hive, and commits the progress event, ledgers, balances, and any Achievement unlocks atomically.

## Honeycomb Score

**Honeycomb Score** is the non-spendable record of verified progress and Achievements across the user's BeeGreat history.

- Spending Honey never reduces it.
- Brain Fatigue never reduces it.
- Abandoning or resurrecting a Goal does not erase historical score.
- Future competition and Bee Cards use Honeycomb Score, not the user's spendable Honey balance.

The Score baseline is +1 per rewarded Task completion and +5 per unlocked starter Achievement. Competitive periods remain a later product decision, and every social projection must use server-computed Score.

## Active Goals and Brain Fatigue

- **Three Active Goals** is the healthy focus threshold.
- **Seven Active Goals** is the hard maximum.
- Brain Fatigue is assigned by activation order. Parking or otherwise leaving Active status ends that Goal's accrual; reactivation places it at the newest activation rank.
- Each over-threshold Goal accrues its own continuous drain:

| Activation rank | Honey drain per 24 hours |
| --------------- | -----------------------: |
| 1–3             |                        0 |
| 4               |                        1 |
| 5               |                        2 |
| 6               |                        1 |
| 7, unqualified  |                        1 |
| 7, Genius State |                        0 |

- The backend accrues `rate × elapsed server milliseconds`, retains fractional Honey as carry, and materializes only whole-Honey ledger debits by flooring cumulative accrual.
- It settles accrued fatigue before another economy or Goal-lifecycle change and also through a daily sweep.
- A debit is capped by the live global balance. Any whole-unit debit that cannot be collected at zero is discarded immediately and never becomes debt or arrears.
- At zero Honey, an affected GolieBee becomes Exhausted and cannot produce new Honey until the fatigue clears or Genius State is earned.
- Exhaustion suppresses only the Honey portion of a new reward. The Verified Progress Event, its eligible Score, and qualification progress remain intact.

**Genius State** uses an inclusive rolling **168-hour** window over the Hive's current seven Active Goals. Each must have at least one Verified Progress Event in the window. The seventh qualifying event activates Genius State before that event's reward is applied, so an otherwise eligible Task earns its full +5 Honey. Qualification is reevaluated as events age out or the Active Goal set changes; losing it restores the rank-seven drain.

Brain Fatigue changes only Honey. It never reduces Honeycomb Score, removes a Verified Progress Event, or changes an Achievement.

## Royal Jelly and Resurrection

**Royal Jelly** is a separate, non-negative gameplay currency for Boosters, Resurrection, and other in-game advantages. It cannot directly unlock Goal completion, Achievement ranks, Honey, or Honeycomb Score.

- A Royal Jelly Quest snapshots the Hive's Active Goals when its rolling seven-day quest begins. Each snapshotted Goal needs at least one Verified Progress Event before the window ends.
- Parking a Goal does not shrink the current roster, and Goals activated after the snapshot join the next quest instead.
- Completing the roster awards **+1 Royal Jelly**, with at most one quest award in any rolling 168-hour window.
- Royal Jelly is earned through this quest in the baseline; purchasing it is not part of FRA-463.
- Resurrection returns the original Abandoned Goal directly to Active and turns its GhostyBee back into a GolieBee.
- Resurrection costs **3 Royal Jelly**. If the Hive already has seven Active Goals, the request fails before Royal Jelly is charged.
- It refunds `floor(Honey actually removed at abandonment ÷ 2)` once for that abandonment. The refund is attributed to the restored Goal.
- The original ledger and Achievements remain intact.
- Resurrection can immediately affect Brain Fatigue like any other Goal activation.

Abandoning a Goal removes `min(current Hive balance, max(0, Goal-attributed Honey earnings − Goal-attributed Brain Fatigue))`. Global cosmetic spending is deliberately not assigned back to Goals. The actual removal is recorded for the later Resurrection refund; no abandonment or Resurrection changes historical Honeycomb Score.

## Power-ups, PowerBees, and Boosters

- A retained **Power-up** can summon and dismiss its **PowerBee** freely. Summoning a capability the user already retains does not cost Royal Jelly.
- A **Booster** is a temporary gameplay effect purchased with Royal Jelly; it may be represented by a temporary PowerBee but does not become a retained Power-up.
- The first Booster is **Focus Shield**: it costs **1 Royal Jelly**, protects one Active Goal from Brain Fatigue for 24 continuous hours, and allows at most one active Shield per Hive.
- Focus Shield cannot stack and receives no refund when dismissed, when its Goal stops being Active, or when the effect is otherwise unused.

## Achievements

- Achievements are permanent, one-time recognition of meaningful milestones. Every starter badge awards **+5 Honeycomb Score** exactly once.
- Ranked series use a separate permanent badge at each threshold; a higher rank never replaces a lower one.
- GolieBee Task badges unlock separately when one Goal reaches **1**, **5**, and **25** first-lifetime Task completions.
- Hive completed-Goal badges unlock separately when the user explicitly completes **1**, **2**, and **3** Goals.
- The first Genius State unlocks one Hive badge.
- Existing verified history is backfilled in bounded resumable batches: every already-earned badge and its +5 Score is granted retroactively and idempotently. Historical first-Genius detection requires seven Goals that can be proven simultaneously Active from retained lifecycle timestamps; ambiguous legacy intervals do not award the badge. Live Genius State always uses the current seven Active Goals.

Deleting a Goal for privacy removes its content, GolieBee identity, and GolieBee badges. Its economy records are anonymized so no Goal identity remains, while the Hive's existing Honey, Honeycomb Score, ledger totals, and Hive Achievements remain unchanged. A fixed weekly quest roster replaces the deleted Goal reference with an anonymous slot that preserves whether that slot had already been satisfied; deletion never shrinks the roster or manufactures quest progress.

## Server authority and abuse resistance

- Clients submit commands and display projections; they never submit Honey, Score, Royal Jelly, fatigue, or Achievement totals.
- Every rewarded Task completion, quest award, purchase, abandonment, Resurrection, and badge unlock has an idempotency boundary.
- The permanent ledgers record the reason, Goal attribution when applicable, delta, and resulting balance for audit and deterministic backfill.
- Server time governs all rolling windows, Booster expiry, fatigue accrual, and settlement.
- Balances are non-negative at every write boundary. There is no Honey or Royal Jelly debt.

## Design principles

- Progress feedback should feel immediate and celebratory without becoming pay-to-win.
- Cosmetic expression uses Honey; gameplay advantages use Royal Jelly; permanent progress uses Honeycomb Score.
- Penalties may drain or suppress Honey but never erase verified history or create debt.
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

These values were never validated and are not current requirements. Future tuning starts from the FRA-463 baseline above rather than changing this historical table in place; user testing is scheduled for the final validation phase.
