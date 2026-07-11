# 08 – Open Questions & Research Items

Updated 2026-07-11 after FRA-453, FRA-459, and the FRA-463 economy decisions. The 2026-07-04 decisions remain below as a historical log; entries that conflict with the canonical domain are explicitly superseded rather than rewritten.

## Still open

### Product

- [ ] **Free vs paid split**: launch is free-only; decide RevenueCat tiers later (voice minutes? integrations? social?) → Phase 4
- [ ] **GitHub achievements**: which events count (commits, PRs, streaks?) and OAuth app vs GitHub App → decide in Phase 2
- [ ] **Post-launch economy tuning**: validate the FRA-463 baseline during the final user-testing phase before changing reward values, fatigue rates, caps, or Booster prices
- [ ] **Future Royal Jelly sales**: the baseline earns Royal Jelly through balanced weekly progress; decide later whether purchasing it is acceptable without letting advantages directly buy Goal completion, Achievement ranks, Honey, or Honeycomb Score
- [ ] **Memorial and Resurrection UX**: choose a playful/emotional tone for GhostyBees and explain the half-Honey Resurrection refund clearly
- [ ] **Competitive score periods**: determine whether all-time/monthly/friends views remain the right framing now that Honeycomb Score is separate from spendable Honey

### Technical

- [ ] **iOS focus-session automation**: user wants the fallback "as seamless and automatic as possible" — research: motion/location triggers, Live Activities, App Intents, Shortcuts automation to auto-start/stop sessions
- [ ] **Shared generative UI/action protocol**: turn the existing Expo/agent vocabulary into a versioned cross-client schema with editable previews, idempotent confirmations, accessible fallback, and streaming semantics (FRA-456)
- [ ] **ElevenLabs streaming latency**: validate mic → Scribe STT → agent → TTS round-trip feels conversational; check per-minute costs at scale
- [ ] **Flue maturity check**: it's a 1.0 beta — validate Durable Objects/Workers deploy path and Convex tool integration with a spike before committing MVP timeline
- [ ] **FAL bee pipeline**: pick the model, craft the base-bee + style prompt, ensure consistent art style across generations
- [ ] **Swift companion distribution**: Direct download + Sparkle updates vs Mac App Store (Accessibility API usage may complicate MAS review)

### Business

- [ ] App Store review: screen-time-adjacent apps face extra scrutiny; plan the review narrative
- [ ] Cost model: voice + LLM + FAL per DAU; set target gross margin before pricing
- [ ] Name check: trademark/App Store availability for "Bee Great"

## Decision log (resolved 2026-07-04)

| Question               | Decision                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal slot semantics    | Goal = macro-project (e.g. "get healthier") with projects + tasks; changeable, but changing wipes its honey                                               |
| Honey formula          | Delegated → v1 economy designed in [04](04-gamification.md); balanced "not too hard, not too easy"                                                        |
| Stake mechanic         | Lose honey on missed project/task; **bee dies on goal change/delete**; one FAL-generated bee per project, styled to the goal (e.g. coach bee for fitness) |
| Leaderboard resets     | All-time: never; monthly: each month; friends: unanimous consent                                                                                          |
| Party rules            | Delegated → "Honey Wars" v1 in [06](06-social.md); simple honey-race with optional pot                                                                    |
| Handle policy          | Renames allowed; no reserved names                                                                                                                        |
| Monetization           | Free version first; decide split later                                                                                                                    |
| Desktop tracking       | **Native Swift macOS menu-bar app** (not Electron)                                                                                                        |
| iOS screen time        | Fallback: Mac tracking + seamless in-app focus sessions                                                                                                   |
| Voice provider         | **ElevenLabs** (STT + TTS)                                                                                                                                |
| Generative UI protocol | Approved; schema definition still open (above)                                                                                                            |
| Memory layer           | **SuperMemory** (2026-07-04 decision; superseded for canonical persistence by FRA-423 on 2026-07-10 — see [09](09-fra-423-memory-architecture.md))        |
| "Flue"                 | Real — **Flue agent framework** (flueframework.com, Astro team); main agent framework                                                                     |
| Expo version           | SDK 57 (latest)                                                                                                                                           |
| Billing                | **RevenueCat** instead of Clerk Billing                                                                                                                   |
| GitHub integration     | Deferred (details above)                                                                                                                                  |
| Health                 | Apple Health + Google Health (Health Connect) APIs                                                                                                        |

## Decision log (resolved 2026-07-10–11)

| Question           | Decision                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active Goal limits | Three is healthy; seven is the hard maximum. Activation ranks four through seven accrue 1/2/1/1 Honey per day until the seven-Goal Hive qualifies for Genius State.                                                |
| Goal character     | One permanent **GolieBee per Goal**, not per Project.                                                                                                                                                              |
| Highlight          | One current, time-boxed pointer to actionable work; defaults to the end of the user's local day and owns no work.                                                                                                  |
| Goal completion    | Explicitly confirmed by the user; completing the plan never auto-completes the outcome.                                                                                                                            |
| Hive economy       | Honey is global, non-negative, spendable cosmetics; Honeycomb Score permanently records verified progress; Royal Jelly is earned by a rolling weekly fixed-roster progress quest and powers advantages.            |
| First MVP proof    | A new user speaks an outcome, edits and confirms one Goal/Project/Task/Highlight plan, completes the highlighted Task, and sees immediate GolieBee/Hive feedback.                                                  |
| MVP character art  | One polished preset GolieBee with deterministic customization; generated FAL/3D art is deferred.                                                                                                                   |
| MVP evidence       | 4/5 complete unassisted in five minutes, 4/5 understand Goal vs Highlight, and after 25 activations at least 40% repeat the loop on three days in week one.                                                        |
| Economy rewards    | A Task's first server-confirmed completion awards +5 Honey/+1 Score, capped at eight rewarded Tasks per rolling 24 hours; every input channel follows the same rule.                                               |
| Genius State       | Uses an inclusive rolling 168-hour window; the seventh qualifying event activates Genius before its reward is calculated.                                                                                          |
| Royal Jelly uses   | Resurrection costs 3; Focus Shield costs 1, protects one Goal for 24 hours, and is limited to one active Shield per Hive.                                                                                          |
| Goal lifecycle     | Explicit completion gives no Honey; abandonment removes the Goal's available net contribution; Resurrection refunds floor(half removed); privacy deletion anonymizes economy history without changing Hive totals. |
| Starter badges     | Goal Task thresholds 1/5/25, completed-Goal thresholds 1/2/3, and first Genius State are separate retroactive badges worth +5 Score each.                                                                          |
| Validation timing  | Founder-directed user testing and success-bar measurement move to the final phase after the economy is integrated.                                                                                                 |

### Superseded entries in the 2026-07-04 table

- “Goal slot semantics,” “Stake mechanic,” and “Bee avatars” describe the old hard-three/Project-bee model. FRA-453 replaces them with the canonical definitions above.
- “Honey formula” remains historical research input only; it combines currency and score in ways the canonical economy now forbids.
- “Generative UI protocol” is no longer a blank design question: a mobile v0 exists, and FRA-456 owns its versioned cross-client evolution.
