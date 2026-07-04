# 03 – Architecture & Infra

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

## Security checklist (project-specific)

- Zod validation on all client inputs and agent tool calls
- Clerk JWT verified in Convex functions; row-level access checks on every query/mutation
- Rate limiting on agent endpoints (voice minutes are expensive)
- Secrets only in env vars; never expose keys in clients
- Honey/score mutations only via server logic, never client-set
