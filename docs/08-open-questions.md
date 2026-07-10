# 08 – Open Questions & Research Items

Updated 2026-07-04 after founder Q&A. Resolved items moved to the [decision log](#decision-log-resolved-2026-07-04) below; details propagated into docs 02-07.

## Still open

### Product

- [ ] **Free vs paid split**: launch is free-only; decide RevenueCat tiers later (voice minutes? integrations? social?) → Phase 4
- [ ] **GitHub achievements**: which events count (commits, PRs, streaks?) and OAuth app vs GitHub App → decide in Phase 2
- [ ] **Honey balance validation**: v1 numbers in [04](04-gamification.md) are designed, not tested — instrument and rebalance in beta
- [ ] **Bee memorial UX**: how grim vs playful should dead bees be? Needs design exploration

### Technical

- [ ] **iOS focus-session automation**: user wants the fallback "as seamless and automatic as possible" — research: motion/location triggers, Live Activities, App Intents, Shortcuts automation to auto-start/stop sessions
- [ ] **Generative UI protocol**: define the JSON UI-spec schema shared by Expo and TanStack renderers (approved concept, schema TBD)
- [ ] **ElevenLabs streaming latency**: validate mic → Scribe STT → agent → TTS round-trip feels conversational; check per-minute costs at scale
- [ ] **Flue maturity check**: it's a 1.0 beta — validate Durable Objects/Workers deploy path and Convex tool integration with a spike before committing MVP timeline
- [ ] **FAL bee pipeline**: pick the model, craft the base-bee + style prompt, ensure consistent art style across generations
- [ ] **Swift companion distribution**: Direct download + Sparkle updates vs Mac App Store (Accessibility API usage may complicate MAS review)

### Business

- [ ] App Store review: screen-time-adjacent apps face extra scrutiny; plan the review narrative
- [ ] Cost model: voice + LLM + FAL per DAU; set target gross margin before pricing
- [ ] Name check: trademark/App Store availability for "Bee Great"

## Decision log (resolved 2026-07-04)

| Question | Decision |
|---|---|
| Goal slot semantics | Goal = macro-project (e.g. "get healthier") with projects + tasks; changeable, but changing wipes its honey |
| Honey formula | Delegated → v1 economy designed in [04](04-gamification.md); balanced "not too hard, not too easy" |
| Stake mechanic | Lose honey on missed project/task; **bee dies on goal change/delete**; one FAL-generated bee per project, styled to the goal (e.g. coach bee for fitness) |
| Leaderboard resets | All-time: never; monthly: each month; friends: unanimous consent |
| Party rules | Delegated → "Honey Wars" v1 in [06](06-social.md); simple honey-race with optional pot |
| Handle policy | Renames allowed; no reserved names |
| Monetization | Free version first; decide split later |
| Desktop tracking | **Native Swift macOS menu-bar app** (not Electron) |
| iOS screen time | Fallback: Mac tracking + seamless in-app focus sessions |
| Voice provider | **ElevenLabs** (STT + TTS) |
| Generative UI protocol | Approved; schema definition still open (above) |
| Memory layer | **SuperMemory** (2026-07-04 decision; superseded for canonical persistence by FRA-423 on 2026-07-10 — see [09](09-fra-423-memory-architecture.md)) |
| "Flue" | Real — **Flue agent framework** (flueframework.com, Astro team); main agent framework |
| Expo version | SDK 57 (latest) |
| Billing | **RevenueCat** instead of Clerk Billing |
| GitHub integration | Deferred (details above) |
| Health | Apple Health + Google Health (Health Connect) APIs |
