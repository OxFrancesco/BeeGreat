# Bee Great

> "Bee the best version of yourself."

A deliberately constrained, voice-first focus app. Instead of becoming another giant task manager, Bee Great limits your active attention to a few things that matter now (up to 3 goals), keeps everything else out of view, and wraps your progress in a bee/hive gamification layer.

Working title history: originally "Highlight", renamed **Bee Great**.

## Repository layout

Bun workspace monorepo:

```
BeeGreat/
├── apps/
│   ├── mobile/            # @beegreat/mobile — Expo SDK 57 (iPhone + iPad), expo-router
│   └── web/               # @beegreat/web — TanStack Start + Clerk (web twin)
├── packages/
│   ├── backend/           # @beegreat/backend — shared Convex backend (schema + functions)
│   └── agent/             # @beegreat/agent — Flue voice agent worker (Cloudflare target)
└── docs/                  # product & architecture planning docs
```

- **One backend, all clients**: Convex functions live only in `packages/backend`. Apps import the generated API via `@beegreat/backend/convex/_generated/api`. When wiring a new client, point it at the same `CONVEX_URL` — never duplicate backend code into an app.
- **One lockfile**: the root `bun.lock` owns all dependencies. If a scaffolder drops a `package-lock.json`/`bun.lock` inside `apps/*`, delete it and run `bun install` at the root.
- **Package names are scoped** (`@beegreat/*`) so workspace linking works — don't rename a package to plain `beegreat` (it collides with the root package and silently breaks linking).

## Development

All commands run from the repo root:

| Command | What it runs |
|---|---|
| `bun run mobile` | `convex dev` + Expo **iOS simulator** |
| `bun run mobile:android` | `convex dev` + Expo Android emulator |
| `bun run web` | Vite dev server only (expects backend running) |
| `bun run backend` | `convex dev` only (watches/pushes `packages/backend/convex`) |
| `bun run agent` | `flue dev` — Bee voice agent worker on `http://localhost:3583` |
| `bun run dev` | `convex dev` + web dev server together |

Notes:

- `bun run mobile` and `bun run dev` each start their own `convex dev` against the same deployment. Harmless, but for full-stack sessions the cleaner setup is `bun run backend` in one terminal, then `bun run web` / `expo start` in others.
- Mobile scripts use `concurrently` with `-k` (killing one kills both) and `--handle-input` (Expo's interactive keys like `r` still work).
- If Expo complains that **port 8081 is in use**, find the stale Metro process with `lsof -nP -iTCP:8081 -sTCP:LISTEN` and kill it.
- If the iOS simulator times out opening the app (`simctl openurl ... code 60`), it's usually a hung simulator from an old session: `xcrun simctl shutdown <UDID>` (or "Device → Restart") and retry.

### Environment files (not committed)

| File | Contents |
|---|---|
| `packages/backend/.env.local` | `CONVEX_DEPLOYMENT` — used by `convex dev` |
| `apps/web/.env.local` | `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` (+ Clerk keys per template docs) |
| `packages/agent/.dev.vars` | `ELEVENLABS_API_KEY`, `OPENROUTER_API_KEY`, `CONVEX_URL` (see `.env.example`) |
| `apps/mobile/.env` | `EXPO_PUBLIC_AGENT_URL` — agent worker URL (LAN IP for physical devices) |

### Conventions

- When working on Convex code, read `packages/backend/convex/_generated/ai/guidelines.md` first.
- Commits follow conventional-commit style (`feat:`, `fix:`, `ref:`, `build:`, `docs:`, ...).
- Scope discipline: check [07 – MVP Scope & Roadmap](docs/07-mvp-scope-and-roadmap.md) before adding features; log scope changes in its decision log.

## Documentation

| Doc | Contents |
|-----|----------|
| [01 – Vision & Goals](docs/01-vision-and-goals.md) | Core concept, product goals, inspirations, naming |
| [02 – Features](docs/02-features.md) | Full feature catalog, prioritized (MoSCoW) |
| [03 – Architecture & Infra](docs/03-architecture.md) | Tech stack, platforms, services, data flow |
| [04 – Gamification](docs/04-gamification.md) | Hive, honey, honeycomb score, achievements |
| [05 – Voice Agent & Memory](docs/05-voice-agent.md) | Voice-first UX, generative UI, agent memory |
| [06 – Social](docs/06-social.md) | Leaderboards, parties, Bee Card, handles |
| [07 – MVP Scope & Roadmap](docs/07-mvp-scope-and-roadmap.md) | What ships first, what's explicitly deferred |
| [08 – Open Questions](docs/08-open-questions.md) | Unresolved decisions and research items |

## The pitch in one paragraph

You open the app and talk to it. The agent knows your goals, spawns UI on demand (charts of your screen time, task lists, summaries), and auto-labels how you spend your time. You can hold at most 3 active goals; staying focused fills your honeycomb with honey, overcommitting or postponing deadlines drains it. Friends can join parties and compete on goals, and your Bee Card (unique handle + honeycomb score + socials) is shareable for networking.
