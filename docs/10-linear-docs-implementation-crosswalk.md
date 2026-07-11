# 10 – Linear, Docs, and Implementation Crosswalk

- Status: reconciliation complete for FRA-460; FRA-453 and FRA-459 resolved; first-focus baseline implemented; FRA-463 economy implementation active
- Audit date: 2026-07-11
- Planning baseline: `f3179aa` (first-focus Hive loop); FRA-463 implementation verification pending on the active branch

## Outcome

BeeGreat already has a credible core: an authenticated Expo app, a voice-first
Flue agent, native generated UI, a server-enforced hierarchy, project and task
management, a canonical Convex memory prototype, opt-in power-ups, and an
iMessage text bridge. FRA-453 now supplies the canonical product language, and
FRA-459 selects one MVP proof rather than treating every historical Must as a
launch dependency.

The chosen proof is implemented as the product foundation: voice → editable
Goal/Project/Task/Highlight preview → confirmation → atomic persistence → first
Task completion → immediate GolieBee/Hive/Honey/Honeycomb Score feedback. This
slice has automated and simulator evidence; founder-directed user testing is
deferred to the final validation phase.

The active mismatch is now the resolved FRA-463 focus economy versus runtime
coverage: continuous Brain Fatigue, Genius State, Royal Jelly quests, Goal
lifecycle settlement, starter Achievements, and Boosters are specified and under
implementation. The existing `beeui` protocol is useful mobile evidence but is
not yet the shared, versioned confirmation contract.

[FRA-451](https://linear.app/francesco-oddo/issue/FRA-451/chart-beegreats-product-direction-and-mvp)
is the planning index that resolves those mismatches. The OpenAI Build Week work
is now a standalone track in
[FRA-421](https://linear.app/francesco-oddo/issue/FRA-421/ship-beegreat-for-the-openai-build-week-challenge),
with its research under FRA-454. It is not part of the BeeGreat product hierarchy
or a dependency of the product map.

## Source-of-truth rules

| Question                                 | Canonical source                                                                                                                                                  | Rule                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| What behavior exists today?              | Repository `main`, backed by tests                                                                                                                                | Code wins for current behavior, even when a doc describes more.                                            |
| What does a product term mean?           | Root [`CONTEXT.md`](../CONTEXT.md), resolved by [FRA-453](https://linear.app/francesco-oddo/issue/FRA-453/define-beegreats-canonical-focus-domain-and-invariants) | It is canonical for Goal, Highlight, Hive characters, lifecycle, and economy language.                     |
| What belongs in MVP or a later phase?    | Resolved [FRA-459](https://linear.app/francesco-oddo/issue/FRA-459/choose-beegreats-single-mvp-proof-flow-and-success-bar), indexed by FRA-451                    | [07 – MVP Scope & Roadmap](07-mvp-scope-and-roadmap.md) records the selected proof and explicit deferrals. |
| What is the memory architecture?         | [09 – FRA-423 Memory Architecture](09-fra-423-memory-architecture.md) and the Convex memory implementation                                                        | Convex is canonical. Any semantic service may only be a deletable, rebuildable derived index.              |
| What is the generated-UI contract?       | Current Bee contract plus mobile schema for existing behavior; future versioned contract from FRA-456                                                             | The current duplicated contract is evidence, not yet a cross-client standard.                              |
| What work is open, blocked, or complete? | Linear                                                                                                                                                            | Docs explain intent; Linear owns work state and dependency relationships.                                  |
| Where may personal memory data live?     | Authenticated private systems only                                                                                                                                | Personal exports, queries, and evaluation corpora never belong in Git or Linear.                           |

## Product-area crosswalk

Status meanings: **implemented** is usable on `main`; **partial** has a real
foundation but misses documented behavior; **planned** exists only in intent or
tracking; **conflicted** needs a product decision before implementation.

| Product area                               | Intended sources                                                                                                  | Linear coverage                                            | Evidence on `main`                                                                                                                                                               | Reconciliation                                                                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product identity and focus                 | [`CONTEXT.md`](../CONTEXT.md), [01 – Vision](01-vision-and-goals.md), [07 – Roadmap](07-mvp-scope-and-roadmap.md) | FRA-398; FRA-453/FRA-459 resolved; FRA-463 active          | `main` treats three Active Goals as healthy, enforces seven as the hard maximum, and models one expiring Highlight; the FRA-463 branch is adding Brain Fatigue and Genius State. | **Canonical decisions complete; economy implementation active.** The 1/2/1/1 curve and inclusive 168-hour Genius window are fixed in docs 04; user validation waits for the final phase.                                       |
| Goals → projects → tasks                   | `CONTEXT.md`, docs 01, 02, 04, 07                                                                                 | FRA-398; FRA-453 resolved; lifecycle in FRA-463            | Convex tables and authenticated CRUD; native Goal/Project/Task screens; one Subtask level; Task due dates and Project quarter/year targets.                                      | **Implemented hierarchy, lifecycle extension active.** Explicit completion, Park/Abandon/Delete/Resurrection, Hall of Fame, Memorial, and their economy settlement are in the FRA-463 slice.                                   |
| Voice-first home                           | Docs 01, 02, 05, 07                                                                                               | FRA-398; FRA-459 resolved; FRA-461 in review; FRA-452 open | Expo audio capture, ElevenLabs STT/TTS worker routes, Flue streaming conversation, text fallback, speaking preference, activity states, Live Activity, and animated Bee.         | **First-focus baseline implemented.** Provider, latency, and founder-directed usability evidence remain for the final validation phase.                                                                                        |
| Generated UI and confirmed actions         | [05 – Voice Agent](05-voice-agent.md), docs 02/08                                                                 | FRA-445, FRA-456, FRA-461                                  | Bee emits the editable first-focus preview; Expo validates/renders it, submits atomic/idempotent confirmation, and supports interactive completion feedback.                     | **First-focus contract implemented; shared standard partial.** FRA-456 still owns versioning, portability, streaming, and web/iMessage fallback semantics.                                                                     |
| Hive, Honey, and Honeycomb Score           | `CONTEXT.md`, docs 02, [04 – Gamification](04-gamification.md), 07                                                | FRA-453 resolved; FRA-461 baseline; FRA-463 active         | `main` has the attributed +5 Honey/+1 Score first-focus reward and Hive vessel; the complete ledgers, fatigue, Royal Jelly, lifecycle, and Achievement model are active work.    | **Economy specified; implementation active.** FRA-463 fixes rewards, caps, rates, rolling windows, prices, deletion semantics, and abuse boundaries while preserving cosmetic Honey versus permanent Score.                    |
| GolieBees and PowerBees                    | `CONTEXT.md`, docs 02, 03, 04, 07                                                                                 | FRA-453 resolved; FRA-437 is a separate 3D experiment      | Projects retain a legacy unused `beeImageUrl`; the app uses one shared animated WebP; Power-up activity has labels, not distinct PowerBees.                                      | **Canonical model decided; implementation gap.** One GolieBee belongs to each Goal. The proof uses a preset; FAL/3D generation and distinct PowerBees are deferred.                                                            |
| Personal memory                            | Docs 03, 05, 07, 08, canonical doc 09                                                                             | FRA-423, FRA-455, FRA-458                                  | Owner-scoped Convex capture, inspect, correction, hard deletion, retention, provenance/source links, bounded lexical retrieval, and extensive synthetic tests.                   | **Partial product integration.** The prototype is substantial, but Bee never captures or retrieves it and no UI calls it. Private relevance measurement and physical expiry automation remain open.                            |
| Agent orchestration and power-ups          | Docs 03, 05, 07                                                                                                   | FRA-407, FRA-422; FRA-405 is a completed pattern donor     | Bee delegates goals work to a specialist and dynamically loads opt-in power-up subagents. WebTree provides guarded Crossmint wallet tools and profile toggles.                   | **Implemented specific capability, missing generic connector contract.** WebTree is orphaned from Linear. FRA-422 should not be marked complete by it; auth/retries/observability/fixtures for general connectors remain open. |
| Automatic time tracking and focus sessions | Docs 01, 02, 03, 05, 07, 08                                                                                       | Deferred by FRA-459; no delivery issue                     | No Swift companion, usage-event schema, categorization pipeline, or focus-session model.                                                                                         | **Explicitly deferred from the first proof.** Create a delivery slice only after the first-focus loop is validated.                                                                                                            |
| Journal and calendar                       | Docs 02, 03, 05, 07, 08                                                                                           | Only broad phase/handoff coverage                          | Task due dates and project targets are useful calendar inputs. No journal, calendar route, external calendar connector, or agent tools exist.                                    | **Planned.** Calendar and journal docs are orphaned from execution tickets. Create slices only after FRA-457 fixes the cut line.                                                                                               |
| Social, handles, and Bee Card              | Docs 01, 02, [06 – Social](06-social.md), 07                                                                      | Explicitly deferred by FRA-459; no delivery issue          | Clerk auth exists. No handle, friend graph, party, leaderboard, score, moderation, or Bee Card schema/UI exists.                                                                 | **Planned post-proof.** The earlier “handles at signup” requirement is superseded for the proof. Future competition must use Honeycomb Score rather than spendable Honey.                                                      |
| iMessage                                   | Docs 03; generated UI intent in docs 05                                                                           | FRA-445                                                    | Spectrum Cloud bridge, allowlisted identity mapping, shared Bee tools/data, activity reaction, markdown reply, and confetti are implemented.                                     | **Implemented text channel; custom UI planned.** FRA-445 should be rewritten around projection/fallback of the FRA-456 contract. The bridge itself is not unfinished work.                                                     |
| Web and iPad                               | Docs 02, 03, 05, 07                                                                                               | FRA-456 and FRA-457 indirectly                             | TanStack/Clerk/Convex shell, branded landing page, auth guard, and sample routes. Expo declares iPad-capable dependencies but uses phone-oriented portrait configuration.        | **Partial shell.** “Feature twin” is not current reality. Web parity and iPad layouts need phased execution tickets after the primary client is chosen.                                                                        |
| Auth, billing, deployment, and operations  | Docs 03, 07, 08                                                                                                   | FRA-452, FRA-457                                           | Clerk protects app/backend/agent access; Cloudflare target and ElevenLabs proxy exist; launch has no billing.                                                                    | **Partial.** RevenueCat is intentionally deferred. Provider latency, cost, observability, rate limits, release narrative, and production deployment evidence remain open in FRA-452.                                           |

## Linear issue crosswalk

### Product source and existing execution issues

| Issue                                                                                                                                                            | Actual relationship to docs/code                                                                                                                                                               | Recommended normalization                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FRA-398 – BeeGreat App!](https://linear.app/francesco-oddo/issue/FRA-398/beegreat-app)                                                                          | Historical brainstorm and current product parent. Docs 01–08 are its structured interpretation; much of the core is already implemented.                                                       | Keep as historical source while FRA-451 is open. After the map is handed off, stop using its status as a proxy for product completion and close/archive it or convert the work to a real Linear project.                      |
| [FRA-451 – Chart BeeGreat's product direction and MVP](https://linear.app/francesco-oddo/issue/FRA-451/chart-beegreats-product-direction-and-mvp)                | Canonical Wayfinder map for unresolved decisions and prerequisites.                                                                                                                            | Keep as the index. Detailed answers live on resolved child tickets; the map records only linked decisions.                                                                                                                    |
| [FRA-423 – Memory and bookmark system](https://linear.app/francesco-oddo/issue/FRA-423/design-and-prototype-beegreat-personal-memory-and-bookmark-system)        | Doc 09 plus commit `42f7db3` implement most design/prototype acceptance criteria, but the issue is back in Todo. Private relevance evidence and agent integration are still missing.           | Move to review and rewrite its remaining acceptance around the implemented artifact. Let FRA-455/FRA-458 decide readiness; create later delivery slices for agent/UI integration instead of treating the prototype as absent. |
| [FRA-422 – Connector framework](https://linear.app/francesco-oddo/issue/FRA-422/build-a-connector-framework-for-beegreat-context-and-actions)                    | Overlaps docs 03/05 integrations, FRA-407, and the power-up architecture. WebTree proves dynamic capability loading but is not a read-only context connector or a reusable connector contract. | Keep as a later connector-foundation issue; narrow its first proof after the MVP cut. Do not merge it with WebTree or claim it complete from the power-up work.                                                               |
| [FRA-445 – Custom UI on iMessage](https://linear.app/francesco-oddo/issue/FRA-445/implement-custom-ui-also-on-imessage-httpsgithubcomtime)                       | Empty issue description hides that the text bridge is already complete and only rich/generated UI is missing.                                                                                  | Rewrite after FRA-456 with supported components, fallback semantics, identity/security boundaries, and acceptance tests; make it explicitly downstream of the shared contract.                                                |
| [FRA-437 – 3D character and visible subagents](https://linear.app/francesco-oddo/issue/FRA-437/prototype-beegreats-3d-character-and-visible-subagent-experience) | Related to brand delight and agent comprehension, but not required by docs 07. A reduced-motion-aware 2D animated bee and readable tool/subagent trace already provide baseline evidence.      | Keep in the parking lot as a disposable usability/performance prototype. Do not let it represent the deferred FAL GolieBee pipeline or block MVP.                                                                             |
| [FRA-407 – Phase 2](https://linear.app/francesco-oddo/issue/FRA-407/phase-2)                                                                                     | Mixes scheduled triage, email/message agents, and action agents. It overlaps FRA-422 and conflicts with BeeGreat's “not a generic productivity suite” anti-goal.                               | Move out of the BeeGreat core hierarchy or convert it into a separate expansion map. Reintroduce only goal-relevant opt-in capabilities after the core retention loop is proven.                                              |
| [FRA-405 – Expanding the BuddyIntels Agent](https://linear.app/francesco-oddo/issue/FRA-405/expanding-the-buddyintels-agent)                                     | Completed work in another agent context, related to FRA-422 as a pattern/reference.                                                                                                            | Keep related, never parent it into BeeGreat or count it as BeeGreat connector delivery.                                                                                                                                       |

### Wayfinder decision path

| Issue                                                                                                                                                | What it resolves                                                                                         | Crosswalk implication                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [FRA-460 – Reconcile sources](https://linear.app/francesco-oddo/issue/FRA-460/reconcile-beegreats-implementation-linear-backlog-and-repository-docs) | This document and its linked Linear resolution.                                                          | Completed first so later choices use one evidence base.                                                                                                      |
| [FRA-453 – Canonical domain](https://linear.app/francesco-oddo/issue/FRA-453/define-beegreats-canonical-focus-domain-and-invariants)                 | Resolved: canonical terms/invariants for focus hierarchy, Hive characters, Goal lifecycle, and economy.  | Complete in root `CONTEXT.md`; current docs now consume that language.                                                                                       |
| [FRA-459 – MVP proof flow](https://linear.app/francesco-oddo/issue/FRA-459/choose-beegreats-single-mvp-proof-flow-and-success-bar)                   | Resolved: first-focus journey, latency/accessibility gates, success bars, and explicit deferrals.        | Complete as a product decision; FRA-461 delivered the implementation baseline and remains in review pending final-phase user evidence.                       |
| [FRA-463 – Focus economy](https://linear.app/francesco-oddo/issue/FRA-463/specify-beegreats-focus-economy-and-royal-jelly-mechanics)                 | Exact Honey, Honeycomb Score, Brain Fatigue, Royal Jelly, lifecycle, Achievement, and Booster mechanics. | Product decisions are complete in docs 04; server-authoritative implementation is active. User testing is explicitly deferred to the final validation phase. |
| [FRA-461 – Interaction prototype](https://linear.app/francesco-oddo/issue/FRA-461/prototype-beegreats-voice-first-mvp-interaction)                   | Voice → agent → UI → confirmed action, including failures and accessibility.                             | Implementation baseline is in review; automated/simulator evidence exists, and founder-directed user testing is deferred to the final validation phase.      |
| [FRA-456 – Shared UI/action contract](https://linear.app/francesco-oddo/issue/FRA-456/decide-beegreats-shared-generative-ui-and-action-contract)     | Versioned schema, streaming, actions, confirmations, fallbacks, and portability.                         | Replaces duplicated agent/mobile conventions and becomes the prerequisite for web/iMessage UI.                                                               |
| [FRA-455 – Private memory corpus](https://linear.app/francesco-oddo/issue/FRA-455/provide-the-private-memory-retrieval-evaluation-corpus)            | Private 20-bookmark/10-query input without putting content in Git/Linear.                                | Human prerequisite for measured retrieval evidence.                                                                                                          |
| [FRA-458 – Memory readiness](https://linear.app/francesco-oddo/issue/FRA-458/decide-whether-beegreats-canonical-memory-is-mvp-ready)                 | Privacy, lifecycle, retrieval thresholds, and any derived semantic index.                                | Separates “prototype exists” from “MVP-ready and integrated.”                                                                                                |
| [FRA-452 – Provider/deployment gates](https://linear.app/francesco-oddo/issue/FRA-452/validate-beegreats-mvp-provider-and-deployment-gates)          | Latency, reliability, auth, privacy, observability, and cost for the selected flow.                      | Prevents provider assumptions from being mistaken for production evidence.                                                                                   |
| [FRA-457 – Final handoff and cut line](https://linear.app/francesco-oddo/issue/FRA-457/define-beegreats-implementation-handoff-and-phased-cut-line)  | Dependency-ordered MVP slices, acceptance gates, and Phase 2+ parking lot.                               | This is where normalized delivery issues should be created with `/to-spec` and `/to-tickets`.                                                                |

### Separate contest track

| Issue                                                                                                                                | Relationship to BeeGreat                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [FRA-421 – OpenAI Build Week](https://linear.app/francesco-oddo/issue/FRA-421/ship-beegreat-for-the-openai-build-week-challenge)     | Standalone contest execution. It may demonstrate a temporary BeeGreat slice but does not define the product roadmap. |
| [FRA-454 – Build Week constraints](https://linear.app/francesco-oddo/issue/FRA-454/verify-openai-build-weeks-submission-constraints) | Research child of FRA-421 only; no blocker or relation in the Wayfinder decision chain.                              |

## Resolved decisions and current implementation gaps

1. **Active Goals:** three is healthy and seven is the hard maximum. FRA-463 fixes
   the continuous 1/2/1/1 daily fatigue curve at activation ranks four through
   seven and the inclusive 168-hour Genius State; runtime settlement is active work.
2. **Goal character:** one GolieBee belongs to each Goal. Legacy schema/UI still
   contains Project-level bee assumptions.
3. **Highlight:** one expiring pointer targets actionable work. The first-focus
   baseline implements canonical creation, actionability, completion clearing,
   and default expiry behavior.
4. **Economy:** Honey is global cosmetic currency; Honeycomb Score is permanent
   verified progress; Royal Jelly is earned gameplay currency. Exact Task rewards,
   fatigue, weekly quests, lifecycle settlement, badges, and Booster prices are
   resolved in docs 04 and being implemented under FRA-463.
5. **MVP composition:** the first-focus baseline remains narrow, but the founder
   moved the economy/lifecycle slice ahead of user testing. Time tracking,
   generated bees, handles/social, memory retrieval, and platform parity remain deferred.
6. **First-focus transaction:** editable preview, atomic/idempotent confirmation,
   completion feedback, and resilient fallback have automated and simulator
   evidence; founder-directed usability measurement remains for the final phase.
7. **Memory:** Convex is canonical, but Bee does not yet capture or retrieve the
   memory prototype in the selected loop.
8. **Generated UI:** a useful mobile v0 exists; FRA-456 still owns versioning,
   portability, confirmation envelopes, and web/iMessage fallbacks.
9. **Web parity:** TanStack remains a branded auth/sample shell and is explicitly
   deferred from the proof.
10. **Task detail:** labels cannot be authored and due-date changes do not update
    `postponeCount` or a ledger; these are not proof blockers.

## Orphans to normalize after the product decisions

### Implemented without a matching Linear delivery record

- The power-up registry and WebTree wallet capability.
- Conversation thread selection, voice speaking preferences, and the global Bee
  Live Activity.
- The complete iMessage text bridge (FRA-445 records only the unimplemented rich
  UI extension).

These should be represented by concise completed delivery/history issues or a
release note, not retroactively folded into unrelated open issues.

### Documented without a delivery issue

- FAL/R2 GolieBee generation and PowerBee variants.
- Unique handles at signup.
- Swift time tracking, iOS focus sessions, journal, calendar, and external
  calendars.
- Social foundations, leaderboards, parties, and Bee Card.
- Web parity and iPad-specific layouts.

Do not create all of these as an undifferentiated backlog. FRA-459 deliberately
parks them outside the first-focus foundation; FRA-463 is the explicit exception
for the active economy slice. Later handoff work can create dependency-ordered
delivery slices after final validation.

## Recommended normalization sequence

1. **Complete:** resolve FRA-453 and record the canonical model in `CONTEXT.md`.
2. **Complete:** resolve FRA-459 with one proof flow, evidence bar, and deferrals.
3. **Complete baseline:** implement and automate-check the first-focus loop in FRA-461.
4. **In progress:** implement the resolved FRA-463 server-authoritative economy,
   lifecycle, starter badges, and Booster baseline.
5. Run founder-directed user testing and success-bar measurement in the final validation phase.
6. Turn the integrated loop into the shared contract in FRA-456.
7. Complete the private memory gate in FRA-455 and decide readiness in FRA-458.
8. Validate only the providers needed by the selected loop in FRA-452.
9. Resolve FRA-457 with measured evidence and create only the next necessary
   implementation slices.
