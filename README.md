# Bee Great

> "Bee the best version of yourself."

A deliberately constrained, voice-first focus app. Instead of becoming another giant task manager, Bee Great treats three Active Goals as healthy and allows up to a hard maximum of seven. In the current proof, Goals four through seven are allowed without a Brain Fatigue penalty; FRA-463 owns that deferred settlement. Every user has one Hive, every Goal has one GolieBee, and one expiring Highlight identifies what matters now.

Working title history: originally "Highlight", renamed **Bee Great**.

## Repository layout

Bun workspace monorepo:

```
BeeGreat/
├── apps/
│   ├── mobile/            # @beegreat/mobile — Expo SDK 57 (iPhone + iPad), expo-router
│   └── web/               # @beegreat/web — TanStack Start + Clerk shell (future twin)
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

| Command                  | What it runs                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `bun run mobile`         | Convex + Bee agent + Expo **iOS simulator**                    |
| `bun run mobile:chatgpt` | Convex + durable per-user ChatGPT auth + Bee + Expo simulator |
| `bun run mobile:chatgpt:pi` | Local-only fallback using the current machine's Pi login  |
| `bun run mobile:android` | Convex + Bee agent + Expo Android emulator                     |
| `bun run web`            | Vite dev server only (expects backend running)                 |
| `bun run backend`        | `convex dev` only (watches/pushes `packages/backend/convex`)   |
| `bun run agent`          | `flue dev` — Bee voice agent worker on `http://localhost:3583` |
| `bun run dev`            | Every workspace package's `dev` script                         |

Notes:

- `bun run mobile` and `bun run dev` each start their own `convex dev` against the same deployment. Harmless, but for full-stack sessions the cleaner setup is `bun run backend` in one terminal, then `bun run web` / `expo start` in others.
- Mobile scripts use `concurrently` with `-k` (killing one kills both) and `--handle-input` (Expo's interactive keys like `r` still work).
- If Expo complains that **port 8081 is in use**, find the stale Metro process with `lsof -nP -iTCP:8081 -sTCP:LISTEN` and kill it.
- If the iOS simulator times out opening the app (`simctl openurl ... code 60`), it's usually a hung simulator from an old session: `xcrun simctl shutdown <UDID>` (or "Device → Restart") and retry.

### Durable ChatGPT subscription authentication

`bun run mobile:chatgpt` uses a per-user device-authorization flow. After Clerk
sign-in, BeeGreat asks the user to connect ChatGPT, persists only encrypted OAuth
credentials in Convex, refreshes rotating tokens under a serialized lease, and
delivers short-lived access tokens to the Flue Worker through a separately
authenticated, no-store credential broker. See
[Durable ChatGPT authentication](docs/11-chatgpt-authentication.md) for setup,
threat boundaries, operations, and the experimental support caveat.

Required deployment secrets:

- Convex: `CHATGPT_CREDENTIALS_KEY` and `AGENT_CREDENTIAL_BROKER_SECRET`
- Agent Worker: the same `AGENT_CREDENTIAL_BROKER_SECRET`

Generate independent values with `openssl rand -base64 32` and
`openssl rand -hex 32`. Never put either value in an Expo environment variable.

### Local Pi fallback

Bee can use Pi's native `openai-codex` provider instead of OpenRouter during local development:

1. Run `pi`, enter `/login`, and select **OpenAI Codex**. Pi stores and refreshes the OAuth credential in `~/.pi/agent/auth.json`.
2. Run `bun run mobile:chatgpt:pi`.

The launcher refreshes Pi's credential when needed, passes only the short-lived access token to Bee's process, and starts the Flue agent on port 3583 with its Node target. This fallback is intentionally local: personal Pi refresh credentials are never copied into the repository or a Worker secret.

The reusable adapter, security boundary, implementation notes, and BeeGreat case study are published in [Flue-Codex](https://github.com/OxFrancesco/Flue-Codex).

### Environment files (not committed)

| File                          | Contents                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `packages/backend/.env.local` | `CONVEX_DEPLOYMENT` — used by `convex dev`                                            |
| `apps/web/.env.local`         | `VITE_CONVEX_URL`, `VITE_AGENT_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| `packages/agent/.dev.vars`    | Bee provider keys and `CONVEX_URL` (see `.env.example`)                               |
| `apps/mobile/.env`            | `EXPO_PUBLIC_AGENT_URL` — agent worker URL (LAN IP for physical devices)              |

### Conventions

- When working on Convex code, read `packages/backend/convex/_generated/ai/guidelines.md` first.
- Commits follow conventional-commit style (`feat:`, `fix:`, `ref:`, `build:`, `docs:`, ...).
- Scope discipline: check [07 – MVP Scope & Roadmap](docs/07-mvp-scope-and-roadmap.md) before adding features; log scope changes in its decision log.

## Documentation

| Doc                                                                                          | Contents                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [01 – Vision & Goals](docs/01-vision-and-goals.md)                                           | Core concept, product goals, inspirations, naming                               |
| [02 – Features](docs/02-features.md)                                                         | Full feature catalog, prioritized (MoSCoW)                                      |
| [03 – Architecture & Infra](docs/03-architecture.md)                                         | Tech stack, platforms, services, data flow                                      |
| [04 – Gamification](docs/04-gamification.md)                                                 | Hive, honey, honeycomb score, achievements                                      |
| [05 – Voice Agent & Memory](docs/05-voice-agent.md)                                          | Voice-first UX, generative UI, agent memory                                     |
| [06 – Social](docs/06-social.md)                                                             | Leaderboards, parties, Bee Card, handles                                        |
| [07 – MVP Scope & Roadmap](docs/07-mvp-scope-and-roadmap.md)                                 | What ships first, what's explicitly deferred                                    |
| [08 – Open Questions](docs/08-open-questions.md)                                             | Unresolved decisions and research items                                         |
| [09 – FRA-423 Memory Architecture](docs/09-fra-423-memory-architecture.md)                   | Canonical memory schema, privacy, retention, deletion, and retrieval evaluation |
| [10 – Linear/Docs/Implementation Crosswalk](docs/10-linear-docs-implementation-crosswalk.md) | Current implementation evidence, planning decisions, and remaining gaps         |
| [11 – Durable ChatGPT Authentication](docs/11-chatgpt-authentication.md)                     | Device flow, encrypted credentials, refresh leases, deployment and operations    |

## The pitch in one paragraph

You open an empty Hive and tell Bee what you want to accomplish. Bee turns that intention into one editable Goal → Project → Task plan, proposes one time-boxed Highlight, and creates nothing until you confirm. Completing the highlighted Task clears the Highlight and gives immediate GolieBee/Hive feedback: cosmetic Honey plus permanent Honeycomb Score progress. This first-focus loop is the active MVP proof; advanced economy, generated bees, time tracking, integrations, social features, Royal Jelly, and multi-Goal Brain Fatigue remain later work.
