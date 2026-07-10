# 03 – Architecture & Infra

> **Memory decision update (2026-07-10):** FRA-423 selects Convex as the canonical
> memory store. The SuperMemory references below record the earlier 2026-07-04
> design and are superseded for canonical persistence; an external semantic index
> may only be reconsidered later as a deletable derived cache. See
> [09 – FRA-423 Memory Architecture](09-fra-423-memory-architecture.md).

## Stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Mobile/iPad app | **Expo (SDK 57)** | iPhone + iPad, single app incl. mobile time tracking |
| Web app | **TanStack** (Router/Start) | "Web twin" — same exact backend shared with mobile |
| Backend / DB | **Convex** | Realtime sync, functions, scheduler; shared by all clients |
| Auth | **Clerk** | Authentication only (billing moved to RevenueCat) |
| Subscriptions/IAP | **RevenueCat** | Deferred — launch is free-only; wire in when monetization is decided |
| Agent framework | **Flue** (flueframework.com) | TypeScript agent harness (sessions, tools, skills, durable streams); deploys to Cloudflare |
| AI provider | **OpenRouter** | Model routing (GPT 5.5 low for simple, Fable 5 for orchestration) |
| Agent hosting | **Cloudflare** (Workers, Durable Objects) | Flue agents run at the edge |
| Voice | **ElevenLabs** | STT (Scribe) + TTS, called from the Flue agent |
| Image/file storage | **Cloudflare R2** | Journal photos, Bee Card images, generated bee avatars |
| Bee avatar generation | **FAL** | Premade base bee + FAL image model, styled per project/goal (see [04](04-gamification.md)) |
| Agent memory | **SuperMemory** | Persistent memory layer across threads — see [05](05-voice-agent.md) |
| Desktop companion | **Native Swift (macOS)** | Menu-bar app; Rize.io parity is the bar — see below |
| iMessage channel | **Spectrum Cloud** (photon.codes) + `apps/imessage-bridge` | Text Bee from Messages; small Bun bridge hosted on Railway — see below |

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
        │ Convex: goals, projects, tasks, journal, honey,   │
        │ scores, leaderboards, parties, time-tracking data │
        └───────────────┬───────────────────────────────────┘
                        │
              ┌─────────▼──────────┐     ┌─────────────┐
              │ Flue agent on      │────▶│ OpenRouter  │
              │ Cloudflare Workers │     │ (LLMs)      │
              │ (gen-UI, Durable   │     └─────────────┘
              │  Objects, R2)      │────▶ SuperMemory (memory layer)
              └─────────┬──────────┘────▶ FAL (bee avatar generation)
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

## Backend (Convex)

- Single source of truth for: users, goals (max 3 enforced server-side), projects, tasks, honey ledger, achievements, journal entries, time-tracking events, friends, parties, leaderboards
- Realtime subscriptions power live UI everywhere
- Cron/scheduler: daily honey settlement, streak checks, leaderboard rollups
- Honey rules must be **server-authoritative** (anti-cheat, since scores are competitive)

## Agent runtime (Flue on Cloudflare)

- Built with **Flue** (`@flue/runtime`): agent defined via `defineAgent(...)` with instructions, tools, and skills; durable streams give session recovery for free
- Voice session: client streams audio → ElevenLabs STT → Flue agent loop (OpenRouter models) → response as text + ElevenLabs TTS + **UI spec** (structured JSON the client renders as cards/charts/lists)
- Deployed to Cloudflare Workers; Durable Objects for per-user session state; R2 for media
- Agent tools: query Convex (time data, tasks, goals), write mutations (create task, log journal), fetch integrations, generate bee avatars via FAL
- Memory: every thread stored; **SuperMemory** for long-term memory (user profile, final goal, preferences)

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
