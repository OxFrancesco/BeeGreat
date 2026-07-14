# BeeGreat

BeeGreat helps you turn a goal into one clear next focus. Mobile and web share the same Clerk identity, Convex data, Bee agent, conversations, and Hive.

## Quick start

You need [Bun](https://bun.sh), a Convex deployment, a Clerk application, and model/voice credentials for the Bee agent.

```sh
bun install
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/agent/.env.example packages/agent/.dev.vars
```

Fill in the copied files with values from the same Clerk and Convex projects.

Run mobile with one command:

```sh
bun run mobile
```

Run web in three terminals:

```sh
bun run backend
bun run agent
bun run web
```

## Environment

| Service         | Template                                                                 | Notes                                             |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Mobile          | [`apps/mobile/.env.example`](apps/mobile/.env.example)                   | Public Clerk, Convex, agent, and Sentry values    |
| Web             | [`apps/web/.env.example`](apps/web/.env.example)                         | Shared Clerk/Convex values plus the Bee agent URL |
| Bee agent       | [`packages/agent/.env.example`](packages/agent/.env.example)             | Provider keys and private service credentials     |
| Codex adapter   | [`apps/codex-adapter/.env.example`](apps/codex-adapter/.env.example)     | Optional ChatGPT adapter                          |
| iMessage bridge | [`apps/imessage-bridge/.env.example`](apps/imessage-bridge/.env.example) | Optional bridge service                           |

Never expose broker secrets, Clerk secret keys, or provider keys through `VITE_*` or `EXPO_PUBLIC_*` variables.

## Common commands

| Command                                    | Purpose                             |
| ------------------------------------------ | ----------------------------------- |
| `bun run mobile`                           | Convex, Bee agent, and iOS app      |
| `bun run mobile:android`                   | Convex, Bee agent, and Android app  |
| `bun run web`                              | Web dev server                      |
| `bun run docs`                             | BeeDocs dev server                  |
| `bun run docs:deploy`                      | Build and deploy BeeDocs            |
| `bun run backend`                          | Convex dev server                   |
| `bun run agent`                            | Flue Bee agent on port 3583         |
| `bun run --cwd apps/web build`             | Web production build and type check |
| `bun run --cwd apps/web test`              | Web tests                           |
| `bun run --cwd packages/backend typecheck` | Convex type check                   |
| `bun run --cwd packages/backend test:run`  | Convex tests                        |

## Architecture

```text
apps/mobile           Expo client
apps/web              TanStack Start client
apps/beedocs          Astro documentation site
apps/codex-adapter    ChatGPT authentication adapter
apps/imessage-bridge  Optional messaging bridge
packages/backend      Shared Convex schema and functions
packages/agent        Shared Flue Bee agent
packages/observability
packages/sugar        Web3 Sugar SDK and CLI
packages/tool-presentation
```

Both clients call `packages/backend` directly and stream from the same authenticated Bee agent. Do not duplicate Convex functions or agent behavior inside a client.

## Documentation

- [Product context](PRODUCT.md) and [domain language](CONTEXT.md)
- [Design system](DESIGN.md) and [asset guide](docs/design/DESIGN_SYSTEM.md)
- [Architecture](docs/03-architecture.md) and [memory](docs/09-fra-423-memory-architecture.md)
- [Economy](docs/04-gamification.md) and [voice agent](docs/05-voice-agent.md)
- Runbooks: [ChatGPT auth](docs/11-chatgpt-authentication.md), [Google Health](docs/12-google-health-powerup.md), [Sentry](docs/13-sentry-observability.md)
- [Web/mobile parity evidence](apps/web/PARITY.md)

## Contributing

- Use Bun and Bunx only.
- Read `packages/backend/convex/_generated/ai/guidelines.md` before changing Convex code.
- Treat generated Convex files as generated output.
- Use Conventional Commits.
