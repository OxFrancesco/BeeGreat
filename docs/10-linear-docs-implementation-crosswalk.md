# 10 – Linear, Docs, and Implementation Crosswalk

- Status: reconciliation complete for FRA-460
- Audit date: 2026-07-10
- Implementation baseline: `main` at `1116cf9`

## Outcome

BeeGreat already has a credible core: an authenticated Expo app, a voice-first
Flue agent, native generated UI, a server-enforced three-goal hierarchy, project
and task management, a canonical Convex memory prototype, opt-in power-ups, and
an iMessage text bridge. It does not yet have the complete MVP described by the
product docs. The Hive is a placeholder; honey, achievements, generated project
bees, handles, time tracking, journaling, and calendar/social experiences are not
implemented. The web app is a branded authenticated shell rather than a mobile
feature twin.

The highest-risk mismatch is not missing code but mixed authority. Some docs
describe both a hard three-goal maximum and penalized goals beyond three;
historical SuperMemory references remain in operational diagrams; the existing
`beeui` protocol is implemented but not shared across clients; and several broad
Linear issues mix core BeeGreat work with later personal-agent expansion.

[FRA-451](https://linear.app/francesco-oddo/issue/FRA-451/chart-beegreats-product-direction-and-mvp)
is the planning index that resolves those mismatches. The OpenAI Build Week work
is now a standalone track in
[FRA-421](https://linear.app/francesco-oddo/issue/FRA-421/ship-beegreat-for-the-openai-build-week-challenge),
with its research under FRA-454. It is not part of the BeeGreat product hierarchy
or a dependency of the product map.

## Source-of-truth rules

| Question                                 | Canonical source                                                                                                                           | Rule                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| What behavior exists today?              | Repository `main`, backed by tests                                                                                                         | Code wins for current behavior, even when a doc describes more.                                               |
| What does a product term mean?           | Future `CONTEXT.md` from [FRA-453](https://linear.app/francesco-oddo/issue/FRA-453/define-beegreats-canonical-focus-domain-and-invariants) | Until FRA-453 resolves, terminology conflicts are explicitly open rather than inferred.                       |
| What belongs in MVP or a later phase?    | [FRA-451](https://linear.app/francesco-oddo/issue/FRA-451/chart-beegreats-product-direction-and-mvp), then the final cut in FRA-457        | [07 – MVP Scope & Roadmap](07-mvp-scope-and-roadmap.md) is the current proposal, not an immutable commitment. |
| What is the memory architecture?         | [09 – FRA-423 Memory Architecture](09-fra-423-memory-architecture.md) and the Convex memory implementation                                 | Convex is canonical. Any semantic service may only be a deletable, rebuildable derived index.                 |
| What is the generated-UI contract?       | Current Bee contract plus mobile schema for existing behavior; future versioned contract from FRA-456                                      | The current duplicated contract is evidence, not yet a cross-client standard.                                 |
| What work is open, blocked, or complete? | Linear                                                                                                                                     | Docs explain intent; Linear owns work state and dependency relationships.                                     |
| Where may personal memory data live?     | Authenticated private systems only                                                                                                         | Personal exports, queries, and evaluation corpora never belong in Git or Linear.                              |

## Product-area crosswalk

Status meanings: **implemented** is usable on `main`; **partial** has a real
foundation but misses documented behavior; **planned** exists only in intent or
tracking; **conflicted** needs a product decision before implementation.

| Product area                               | Intended sources                                                                                                    | Linear coverage                                           | Evidence on `main`                                                                                                                                                        | Reconciliation                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product identity and focus                 | [01 – Vision](01-vision-and-goals.md), [02 – Features](02-features.md), [07 – Roadmap](07-mvp-scope-and-roadmap.md) | FRA-398, FRA-453, FRA-459                                 | `goals.MAX_ACTIVE_GOALS` and the agent enforce three active goals.                                                                                                        | **Conflicted.** The docs also price goals beyond three as “brain fatigue.” FRA-453 must choose the invariant; current behavior is a hard maximum.                                                                               |
| Goals → projects → tasks                   | Docs 01, 02, 04, 07                                                                                                 | FRA-398; FRA-453 defines the model                        | Convex tables and authenticated CRUD; native goal/project/task screens; one subtask level; task due dates and project quarter/year targets.                               | **Implemented core, partial detail.** Labels are stored but cannot be authored; archive/completion flows are absent; rename/delete does not apply documented honey/bee consequences.                                            |
| Voice-first home                           | Docs 01, 02, 05, 07                                                                                                 | FRA-398, FRA-459, FRA-461, FRA-452                        | Expo audio capture, ElevenLabs STT/TTS worker routes, Flue streaming conversation, text fallback, speaking preference, activity states, Live Activity, and animated bee.  | **Implemented foundation.** FRA-459 must pick the one proof journey; FRA-461 should validate that journey in the existing app rather than build a duplicate app.                                                                |
| Generated UI and confirmed actions         | [05 – Voice Agent](05-voice-agent.md), docs 02/08                                                                   | FRA-445, FRA-456, FRA-461                                 | Bee emits `text`, `metric`, bar `chart`, `tasks`, `highlight`, and `confirm`; Expo validates/renders them and task rows are interactive.                                  | **Partial.** Agent instructions and Expo duplicate the vocabulary; web has no renderer; iMessage drops `beeui`; confirmation replies are conversational “Yes/No,” not a versioned action envelope. FRA-456 owns the standard.   |
| Hive, honey, and achievements              | Docs 02, [04 – Gamification](04-gamification.md), 07                                                                | FRA-398; otherwise only the Wayfinder MVP/handoff tickets | Project cards show task-completion fill. `postponeCount` exists as an unused schema field. The Hive screen is explanatory placeholder copy.                               | **Planned.** There is no honey ledger, earning/loss settlement, achievement model, score, streak, postponement charge, or server-authoritative Hive summary. This is the largest missing part of the documented three-page MVP. |
| Project and power-up bees                  | Docs 02, 03, 04, 07                                                                                                 | FRA-437 covers a different 3D/visible-agent experiment    | Projects have an unused `beeImageUrl`; the app uses one shared animated WebP; power-up activity has labels, not distinct generated bees.                                  | **Partial foundation.** The FAL/R2 generation pipeline is absent. Keep FRA-437 as an optional comprehension prototype, not as the delivery ticket for project-bee generation.                                                   |
| Personal memory                            | Docs 03, 05, 07, 08, canonical doc 09                                                                               | FRA-423, FRA-455, FRA-458                                 | Owner-scoped Convex capture, inspect, correction, hard deletion, retention, provenance/source links, bounded lexical retrieval, and extensive synthetic tests.            | **Partial product integration.** The prototype is substantial, but Bee never captures or retrieves it and no UI calls it. Private relevance measurement and physical expiry automation remain open.                             |
| Agent orchestration and power-ups          | Docs 03, 05, 07                                                                                                     | FRA-407, FRA-422; FRA-405 is a completed pattern donor    | Bee delegates goals work to a specialist and dynamically loads opt-in power-up subagents. WebTree provides guarded Crossmint wallet tools and profile toggles.            | **Implemented specific capability, missing generic connector contract.** WebTree is orphaned from Linear. FRA-422 should not be marked complete by it; auth/retries/observability/fixtures for general connectors remain open.  |
| Automatic time tracking and focus sessions | Docs 01, 02, 03, 05, 07, 08                                                                                         | Broadly parked in FRA-407/FRA-457; no delivery issue      | No Swift companion, usage-event schema, categorization pipeline, or focus-session model.                                                                                  | **Planned and internally mis-phased.** Docs 02 calls Mac tracking “Must,” while docs 07 puts it in Phase 2 even though MVP success mentions time answers. FRA-459 must decide whether real time data is in the proof flow.      |
| Journal and calendar                       | Docs 02, 03, 05, 07, 08                                                                                             | Only broad phase/handoff coverage                         | Task due dates and project targets are useful calendar inputs. No journal, calendar route, external calendar connector, or agent tools exist.                             | **Planned.** Calendar and journal docs are orphaned from execution tickets. Create slices only after FRA-457 fixes the cut line.                                                                                                |
| Social, handles, and Bee Card              | Docs 01, 02, [06 – Social](06-social.md), 07                                                                        | No dedicated execution issue                              | Clerk auth exists. No handle, friend graph, party, leaderboard, score, moderation, or Bee Card schema/UI exists.                                                          | **Planned post-MVP, with one Phase-1 conflict.** Docs require unique handles at signup “from day one,” but signup has no handle step. FRA-457 must either pull the handle foundation forward or explicitly defer it.            |
| iMessage                                   | Docs 03; generated UI intent in docs 05                                                                             | FRA-445                                                   | Spectrum Cloud bridge, allowlisted identity mapping, shared Bee tools/data, activity reaction, markdown reply, and confetti are implemented.                              | **Implemented text channel; custom UI planned.** FRA-445 should be rewritten around projection/fallback of the FRA-456 contract. The bridge itself is not unfinished work.                                                      |
| Web and iPad                               | Docs 02, 03, 05, 07                                                                                                 | FRA-456 and FRA-457 indirectly                            | TanStack/Clerk/Convex shell, branded landing page, auth guard, and sample routes. Expo declares iPad-capable dependencies but uses phone-oriented portrait configuration. | **Partial shell.** “Feature twin” is not current reality. Web parity and iPad layouts need phased execution tickets after the primary client is chosen.                                                                         |
| Auth, billing, deployment, and operations  | Docs 03, 07, 08                                                                                                     | FRA-452, FRA-457                                          | Clerk protects app/backend/agent access; Cloudflare target and ElevenLabs proxy exist; launch has no billing.                                                             | **Partial.** RevenueCat is intentionally deferred. Provider latency, cost, observability, rate limits, release narrative, and production deployment evidence remain open in FRA-452.                                            |

## Linear issue crosswalk

### Product source and existing execution issues

| Issue                                                                                                                                                            | Actual relationship to docs/code                                                                                                                                                               | Recommended normalization                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FRA-398 – BeeGreat App!](https://linear.app/francesco-oddo/issue/FRA-398/beegreat-app)                                                                          | Historical brainstorm and current product parent. Docs 01–08 are its structured interpretation; much of the core is already implemented.                                                       | Keep as historical source while FRA-451 is open. After the map is handed off, stop using its status as a proxy for product completion and close/archive it or convert the work to a real Linear project.                      |
| [FRA-451 – Chart BeeGreat's product direction and MVP](https://linear.app/francesco-oddo/issue/FRA-451/chart-beegreats-product-direction-and-mvp)                | Canonical Wayfinder map for unresolved decisions and prerequisites.                                                                                                                            | Keep as the index. Detailed answers live on resolved child tickets; the map records only linked decisions.                                                                                                                    |
| [FRA-423 – Memory and bookmark system](https://linear.app/francesco-oddo/issue/FRA-423/design-and-prototype-beegreat-personal-memory-and-bookmark-system)        | Doc 09 plus commit `42f7db3` implement most design/prototype acceptance criteria, but the issue is back in Todo. Private relevance evidence and agent integration are still missing.           | Move to review and rewrite its remaining acceptance around the implemented artifact. Let FRA-455/FRA-458 decide readiness; create later delivery slices for agent/UI integration instead of treating the prototype as absent. |
| [FRA-422 – Connector framework](https://linear.app/francesco-oddo/issue/FRA-422/build-a-connector-framework-for-beegreat-context-and-actions)                    | Overlaps docs 03/05 integrations, FRA-407, and the power-up architecture. WebTree proves dynamic capability loading but is not a read-only context connector or a reusable connector contract. | Keep as a later connector-foundation issue; narrow its first proof after the MVP cut. Do not merge it with WebTree or claim it complete from the power-up work.                                                               |
| [FRA-445 – Custom UI on iMessage](https://linear.app/francesco-oddo/issue/FRA-445/implement-custom-ui-also-on-imessage-httpsgithubcomtime)                       | Empty issue description hides that the text bridge is already complete and only rich/generated UI is missing.                                                                                  | Rewrite after FRA-456 with supported components, fallback semantics, identity/security boundaries, and acceptance tests; make it explicitly downstream of the shared contract.                                                |
| [FRA-437 – 3D character and visible subagents](https://linear.app/francesco-oddo/issue/FRA-437/prototype-beegreats-3d-character-and-visible-subagent-experience) | Related to brand delight and agent comprehension, but not required by docs 07. A reduced-motion-aware 2D animated bee and readable tool/subagent trace already provide baseline evidence.      | Keep in the parking lot as a disposable usability/performance prototype. Do not let it represent the missing FAL project-bee pipeline or block MVP.                                                                           |
| [FRA-407 – Phase 2](https://linear.app/francesco-oddo/issue/FRA-407/phase-2)                                                                                     | Mixes scheduled triage, email/message agents, and action agents. It overlaps FRA-422 and conflicts with BeeGreat's “not a generic productivity suite” anti-goal.                               | Move out of the BeeGreat core hierarchy or convert it into a separate expansion map. Reintroduce only goal-relevant opt-in capabilities after the core retention loop is proven.                                              |
| [FRA-405 – Expanding the BuddyIntels Agent](https://linear.app/francesco-oddo/issue/FRA-405/expanding-the-buddyintels-agent)                                     | Completed work in another agent context, related to FRA-422 as a pattern/reference.                                                                                                            | Keep related, never parent it into BeeGreat or count it as BeeGreat connector delivery.                                                                                                                                       |

### Wayfinder decision path

| Issue                                                                                                                                                | What it resolves                                                                                              | Crosswalk implication                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [FRA-460 – Reconcile sources](https://linear.app/francesco-oddo/issue/FRA-460/reconcile-beegreats-implementation-linear-backlog-and-repository-docs) | This document and its linked Linear resolution.                                                               | Completed first so later choices use one evidence base.                                        |
| [FRA-453 – Canonical domain](https://linear.app/francesco-oddo/issue/FRA-453/define-beegreats-canonical-focus-domain-and-invariants)                 | Meanings/invariants for Goal, Project, Task, Subtask, Highlight, Hive, Bee, Honey, Achievement, and Power-up. | Next decision. It resolves the hard-max/penalty conflict and should create `CONTEXT.md`.       |
| [FRA-459 – MVP proof flow](https://linear.app/francesco-oddo/issue/FRA-459/choose-beegreats-single-mvp-proof-flow-and-success-bar)                   | One user, one end-to-end journey, acceptance criteria, and explicit deferrals.                                | Must use FRA-453 plus this audit; Build Week is not a blocker.                                 |
| [FRA-461 – Interaction prototype](https://linear.app/francesco-oddo/issue/FRA-461/prototype-beegreats-voice-first-mvp-interaction)                   | Voice → agent → UI → confirmed action, including failures and accessibility.                                  | Validate the missing parts against the existing Expo app; do not restart the UI from zero.     |
| [FRA-456 – Shared UI/action contract](https://linear.app/francesco-oddo/issue/FRA-456/decide-beegreats-shared-generative-ui-and-action-contract)     | Versioned schema, streaming, actions, confirmations, fallbacks, and portability.                              | Replaces duplicated agent/mobile conventions and becomes the prerequisite for web/iMessage UI. |
| [FRA-455 – Private memory corpus](https://linear.app/francesco-oddo/issue/FRA-455/provide-the-private-memory-retrieval-evaluation-corpus)            | Private 20-bookmark/10-query input without putting content in Git/Linear.                                     | Human prerequisite for measured retrieval evidence.                                            |
| [FRA-458 – Memory readiness](https://linear.app/francesco-oddo/issue/FRA-458/decide-whether-beegreats-canonical-memory-is-mvp-ready)                 | Privacy, lifecycle, retrieval thresholds, and any derived semantic index.                                     | Separates “prototype exists” from “MVP-ready and integrated.”                                  |
| [FRA-452 – Provider/deployment gates](https://linear.app/francesco-oddo/issue/FRA-452/validate-beegreats-mvp-provider-and-deployment-gates)          | Latency, reliability, auth, privacy, observability, and cost for the selected flow.                           | Prevents provider assumptions from being mistaken for production evidence.                     |
| [FRA-457 – Final handoff and cut line](https://linear.app/francesco-oddo/issue/FRA-457/define-beegreats-implementation-handoff-and-phased-cut-line)  | Dependency-ordered MVP slices, acceptance gates, and Phase 2+ parking lot.                                    | This is where normalized delivery issues should be created with `/to-spec` and `/to-tickets`.  |

### Separate contest track

| Issue                                                                                                                                | Relationship to BeeGreat                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [FRA-421 – OpenAI Build Week](https://linear.app/francesco-oddo/issue/FRA-421/ship-beegreat-for-the-openai-build-week-challenge)     | Standalone contest execution. It may demonstrate a temporary BeeGreat slice but does not define the product roadmap. |
| [FRA-454 – Build Week constraints](https://linear.app/francesco-oddo/issue/FRA-454/verify-openai-build-weeks-submission-constraints) | Research child of FRA-421 only; no blocker or relation in the Wayfinder decision chain.                              |

## Explicit conflicts and stale assumptions

1. **Three goals:** code and much of the prose enforce a hard maximum; docs 01,
   02, and 04 also describe paying honey for goals beyond three. FRA-453 owns the
   decision.
2. **Goal changes:** docs say changing or deleting a goal kills bees and wipes
   goal honey. Code supports rename/delete but has no honey or bee lifecycle.
3. **MVP composition:** docs 02 says Mac time tracking is a Must, while docs 07
   places it in Phase 2 even though MVP success says Bee answers time questions.
4. **Memory:** banners and doc 09 select Convex, but the stack table, diagram,
   and runtime prose in docs 03/05 still present SuperMemory as operational.
5. **Conversation persistence:** docs say every thread is stored in Convex;
   current thread transcripts live with Flue and the local thread index lives in
   SecureStore. The Convex memory prototype is not wired to conversations.
6. **Generated UI:** docs 08 calls the protocol undefined, but a useful v0 exists
   in `bee.md` and `ui-spec.ts`. It is mobile-only and duplicated, so the open
   question should become a versioning/portability decision rather than a blank
   design exercise.
7. **MVP foundations:** docs 07 requires FAL project bees and a unique handle at
   signup. The code has only a nullable image field and no handle model or flow.
8. **Web parity:** docs call TanStack a feature twin; `apps/web` is currently a
   landing/auth/sample shell.
9. **Phase 2 agent expansion:** FRA-407's general email/message suite is broader
   than BeeGreat's focus product and conflicts with the explicit email/productivity
   anti-goal unless reframed as optional, goal-relevant power-ups.
10. **Task detail:** docs promise labels and honey-costing postponement. Labels
    cannot be authored and due-date changes do not update `postponeCount` or any
    ledger.

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

- Server-authoritative honey/Hive/achievement implementation.
- FAL/R2 project-bee generation and power-up bee variants.
- Unique handles at signup.
- Swift time tracking, iOS focus sessions, journal, calendar, and external
  calendars.
- Social foundations, leaderboards, parties, and Bee Card.
- Web parity and iPad-specific layouts.

Do not create all of these as an undifferentiated backlog now. FRA-459 and
FRA-457 must first choose the proof flow and phase boundary, then `/to-spec` and
`/to-tickets` can create only dependency-ordered delivery slices.

## Recommended normalization sequence

1. Resolve FRA-453 and write the agreed vocabulary/invariants to `CONTEXT.md`.
2. Resolve FRA-459 from that domain model and this implementation crosswalk.
3. Use the existing Expo app during FRA-461 to validate the chosen proof loop.
4. Turn the proven loop into the shared contract in FRA-456.
5. Complete the private memory gate in FRA-455 and decide readiness in FRA-458.
6. Validate only the providers needed by the selected loop in FRA-452.
7. Resolve FRA-457 with an MVP cut line, then normalize/reparent the original
   FRA-398 children and generate implementation-ready specs/tickets.
8. Close the map only when every required decision is linked under “Decisions so
   far” and no unresolved question still blocks the handoff.
