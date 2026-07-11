# 03 – Architecture & Infra

> **Memory decision update (2026-07-10):** FRA-423 selects Convex as the canonical
> memory store, superseding the earlier SuperMemory design for canonical
> persistence. An external semantic index may only be reconsidered later as a
> deletable derived cache. See
> [09 – FRA-423 Memory Architecture](09-fra-423-memory-architecture.md).

## Stack (decided)

| Layer               | Choice                                                     | Notes                                                                                                     |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Mobile/iPad app     | **Expo (SDK 57)**                                          | iPhone + iPad, single app incl. mobile time tracking                                                      |
| Web app             | **TanStack** (Router/Start)                                | "Web twin" — same exact backend shared with mobile                                                        |
| Backend / DB        | **Convex**                                                 | Realtime sync, functions, scheduler; shared by all clients                                                |
| Auth                | **Clerk**                                                  | Authentication only (billing moved to RevenueCat)                                                         |
| Subscriptions/IAP   | **RevenueCat**                                             | Deferred — launch is free-only; wire in when monetization is decided                                      |
| Agent framework     | **Flue** (flueframework.com)                               | TypeScript agent harness (sessions, tools, skills, durable streams); deploys to Cloudflare                |
| AI provider         | **OpenRouter**                                             | Model routing (GPT 5.5 low for simple, Fable 5 for orchestration)                                         |
| Agent hosting       | **Cloudflare** (Workers, Durable Objects)                  | Flue agents run at the edge                                                                               |
| Voice               | **ElevenLabs**                                             | STT (Scribe) + TTS, called from the Flue agent                                                            |
| Image/file storage  | **Cloudflare R2**                                          | Journal photos, Bee Card images, generated bee avatars                                                    |
| GolieBee generation | **FAL** (deferred)                                         | Premade base plus Goal-styled variant; the proof uses one preset GolieBee (see [04](04-gamification.md))  |
| Agent memory        | **Convex canonical memory**                                | Owner-scoped revisions, provenance, retention, and deletion — see [09](09-fra-423-memory-architecture.md) |
| Desktop companion   | **Native Swift (macOS)**                                   | Menu-bar app; Rize.io parity is the bar — see below                                                       |
| iMessage channel    | **Spectrum Cloud** (photon.codes) + `apps/imessage-bridge` | Text Bee from Messages; small Bun bridge hosted on Railway — see below                                    |

## System overview

```
┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐
│ Expo app   │  │ TanStack   │  │ Swift macOS │  │ Integrations     │
│ iOS/iPadOS │  │ web twin   │  │ menu-bar app│  │ GitHub, Health   │
└─────┬──────┘  └─────┬──────┘  └──────┬──────┘  └────────┬─────────┘
      │   Clerk auth  │                │ usage events     │ webhooks/APIs
      └───────┬───────┘                │                  │
              ▼                        ▼                  ▼
        ┌───────────────────────────────────────────────────┐
        │ Convex: plans, highlights, Hive economy, memory,  │
        │ and later journal/social/time-tracking data        │
        └───────────────┬───────────────────────────────────┘
                        │
              ┌─────────▼──────────┐     ┌─────────────┐
              │ Flue agent on      │────▶│ OpenRouter  │
              │ Cloudflare Workers │     │ (LLMs)      │
              │ (gen-UI, Durable   │     └─────────────┘
              │  Objects, R2)      │────▶ Convex canonical memory
              └─────────┬──────────┘────▶ FAL (later bee generation)
                        ▼
                 ElevenLabs (STT/TTS)
```

## Client apps

### Mobile / iPad (Expo)

- Voice agent home, projects page, hive/daily summary page, journal, social
- Screen time on iOS: Apple's Screen Time API (`DeviceActivity` / `FamilyControls`) doesn't expose raw per-app data to third parties. **Decided fallback**: Mac tracking (Swift companion) + in-app focus sessions on iOS — made as seamless and automatic as possible (auto-start suggestions, minimal taps).

### Web (TanStack)

- Feature twin of mobile; same Convex backend, same Clerk auth
- `createFileRoute`, Zod-validated search params (per house conventions)

### Desktop companion (time tracking) — **native Swift macOS app** (decided)

- Goal: parity with **Rize.io** (automatic per-app/per-site tracking, idle detection, categorization)
- Menu-bar app; frontmost-app + window title tracking via Accessibility permission
- Ships usage events to Convex; agent auto-labels them

## First-focus write boundary

The selected MVP proof has one authoritative mutation boundary:

1. Voice or text produces an unpersisted, editable Goal/Project/Task/Highlight preview.
2. Explicit confirmation submits one idempotent command.
3. The backend validates ownership, the seven-Active-Goal limit, and Highlight actionability, then creates all four records atomically.
4. Cancel creates nothing; a retried confirmation returns the original result instead of duplicating work.
5. Voice or tap completes the highlighted Task, expires the Highlight, and records attributed Hive feedback in one server-authoritative operation.

This transaction is the implemented foundation being extended by FRA-463. Existing app capabilities are tracked separately in [10 – Linear, Docs, and Implementation Crosswalk](10-linear-docs-implementation-crosswalk.md).

## Focus-economy write boundary

Convex is the authority for economy policy, clocks, ledgers, and projected balances. Clients submit intent-level commands; the backend validates identity and eligibility, settles accrued Brain Fatigue, records immutable reasoned ledger entries, updates Hive projections, and unlocks Achievements atomically. See [ADR 0001 – Server-authoritative focus economy](adr/0001-server-authoritative-focus-economy.md) and [04 – Gamification](04-gamification.md).

Continuous fatigue retains fractional accrual server-side and materializes only whole Honey. Rolling 24-hour and 168-hour windows use server timestamps. Idempotency records protect Task rewards, quest awards, purchases, lifecycle settlement, and Resurrection refunds. Retroactive Achievement reconciliation walks retained progress in cursor-based scheduled batches, marks each imported event once, and resumes until the owner's full history is covered.

## Backend (Convex)

- Single source of truth for one Hive per user, Goals (healthy threshold three, hard maximum seven), GolieBees, Projects, Tasks, one expiring Highlight, Honey and Royal Jelly ledgers, Honeycomb Score, Achievements, Boosters, and later journal/time/social records
- Realtime subscriptions power live UI everywhere
- Economy rules must be **server-authoritative**: global cosmetic Honey cannot go negative, and permanent Honeycomb Score cannot be purchased or reduced by spending Honey
- FRA-463 defines Brain Fatigue, Genius State, Royal Jelly quests, lifecycle settlement, Achievements, and Boosters as the active economy slice. Exact values live in [04 – Gamification](04-gamification.md), not client code.
- Economy effects caused by a Task completion share its atomic write boundary; unrelated lifecycle and timed settlement commands remain independently idempotent.

## Agent runtime (Flue on Cloudflare)

- Built with **Flue** (`@flue/runtime`): agent defined via `defineAgent(...)` with instructions, tools, and skills; durable streams give session recovery for free
- Voice session: client streams audio → ElevenLabs STT → Flue agent loop (OpenRouter models) → response as text + ElevenLabs TTS + **UI spec** (structured JSON the client renders as cards/charts/lists)
- Deployed to Cloudflare Workers; Durable Objects for per-user session state; R2 for media
- Agent tools: query Convex and propose commands, but user-facing writes that create the first plan require an editable preview and explicit confirmation
- Memory: Convex is the canonical long-term store for user facts, preferences, and Goal context; a future semantic service may only be a deletable, rebuildable derived index

## iMessage bridge (`apps/imessage-bridge`)

- Small always-on Bun process using **spectrum-ts** (Photon's Spectrum Cloud handles the iMessage infrastructure — lines, delivery, blue bubbles)
- Flow: iMessage → Spectrum Cloud (gRPC) → bridge → agent worker (`x-bridge-secret` + `x-bridge-user` headers, verified against the `BRIDGE_SECRET` Worker secret) → reply as native styled text (markdown), 👀 tapback while thinking, confetti effect when the user reports finishing something
- Sender allowlist via `IMESSAGE_USER_MAP` (`address=clerkUserId` pairs); everyone else is ignored
- Conversations live on the `<userId>~imessage` session; tools key data by the bare user id, so iMessage and app share the same goals/tasks
- **Can't run on Cloudflare Workers**: outbound sends use Node gRPC (`@grpc/grpc-js`), which the Workers runtime doesn't support. Needs a long-lived host.

### Hosting on Railway (decided)

1. `railway init` in the repo root (or connect the GitHub repo in the Railway dashboard)
2. New service from the repo with:
   - Root directory: `apps/imessage-bridge` (Railway's Railpack auto-detects Bun)
   - Custom start command: `bun run src/index.ts`
3. Set the service variables from `apps/imessage-bridge/.env.example`: `PROJECT_ID`, `PROJECT_SECRET`, `AGENT_URL` (deployed worker URL), `BRIDGE_SECRET` (same value as the Worker secret), `IMESSAGE_USER_MAP`
4. No public networking needed — the bridge only makes outbound connections (gRPC to Spectrum, HTTPS to the worker). Disable the public domain.
5. One-off greeting (so a new user learns Bee's number): run the service once with `bun run src/index.ts --greet`, or use `railway run bun run src/index.ts --greet` locally.

## Security checklist (project-specific)

- Zod validation on all client inputs and agent tool calls
- Clerk JWT verified in Convex functions; row-level access checks on every query/mutation
- Rate limiting on agent endpoints (voice minutes are expensive)
- Secrets only in env vars; never expose keys in clients
- Honey/score mutations only via server logic, never client-set

## First-proof quality gates

- Useful spoken response starts within **4 seconds p95**.
- The complete editable preview appears within **8 seconds p95**.
- Confirmed changes become visible within **2 seconds p95**.
- Text fallback, microphone denial, failed transcription, malformed generated UI, lost connectivity, reduced motion, and screen readers must not lose or duplicate confirmed work.

These gates and the product success bars remain required, but founder-directed user testing is scheduled for the final validation phase after the economy slice is integrated.
