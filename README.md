![BeeGreat cover](docs/design/BeeGreat-cover.png)

# BeeGreat

BeeGreat helps you turn a goal into one clear next focus. Mobile and web share the same Clerk identity, Convex data, Bee agent, conversations, and Hive.

## GPT-5.6 in BeeGreat

BeeGreat uses GPT-5.6 in two focused roles:

- **Bee runs on GPT-5.6 Sol.** The Flue agent receives typed input or ElevenLabs transcripts, keeps the conversation and generated `beeui` contract, searches the user's Mind, and delegates goal or power-up work to specialist subagents. It uses low reasoning for responsive everyday interactions.
- **Mind uses GPT-5.6 Luna.** After BeeGreat extracts a saved website, post, or video, Luna returns a strict JSON title, a short summary, and topical labels so the item is immediately useful and searchable.

Bee defaults to `openrouter/openai/gpt-5.6-sol`. A user who connects ChatGPT can instead run the same model through Pi's native Codex Responses transport and BeeGreat's private, stateless Vercel adapter. Convex stores the encrypted credentials and refreshes short-lived tokens; the adapter never persists them or logs request bodies. OpenRouter remains the fallback when the optional experimental ChatGPT connection is unavailable.

Mind follows the same resilient pattern with `gpt-5.6-luna`: it tries the connected ChatGPT path first and falls back to `openai/gpt-5.6-luna` on OpenRouter. Without a connected ChatGPT account, it uses OpenRouter directly.

## How Codex was used

Codex was the main harness for building BeeGreat, mostly through the Codex desktop app:

- **Planning** ran on GPT-5.6 Sol Ultra.
- **Implementation and testing** ran on GPT-5.6 Sol High, using the NPX simulator and computer use to automatically exercise the app.
- **Runtime**: the Codex adapter (`apps/codex-adapter`) lets users power the Bee agent with their own Codex/ChatGPT subscription via Pi's native Codex Responses transport.

The Git history captures how this evolved:

| Commit    | Change                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `b1e11d2` | Introduced Bee as a GPT-5.5 agent on OpenRouter.                                                       |
| `d9f861d` | Added encrypted, per-user ChatGPT authentication and dynamic provider registration.                    |
| `fd2455b` | Upgraded Bee to GPT-5.6 Sol and added the private streaming Codex adapter with an OpenRouter fallback. |
| `e66f881` | Added GPT-5.6 Luna summaries and labels for the Mind bookmark library.                                 |

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

### Use Bee from the CLI

The personal CLI uses the same Clerk identity, Bee, tools, and registered
conversations as the apps. In Clerk, create a public OAuth application named
`BeeGreat CLI`, require PKCE, add `http://127.0.0.1/callback` as its redirect
URI, enable JWT access tokens, and grant `openid profile email offline_access`. Put its public client id
in `packages/agent/.dev.vars` as `BEE_CLERK_CLIENT_ID`, then start Convex and the
CLI:

```sh
bun run backend
bun run bee
bun run bee -- ask "What should I focus on?"
bun run bee -- new
```

The CLI starts its local Bee agent automatically and waits for its health check.
The first launch may take longer while Cloudflare builds the local sandbox
image. Set `BEE_AGENT_AUTOSTART=0` to manage the agent yourself, or configure
`BEE_AGENT_URL` to use a deployed worker. A global launcher outside the
repository must set `BEE_PROJECT_ROOT` to this checkout.

Or launch Convex, the agent, and the interactive CLI together:

```sh
make bee
```

`make bee` securely syncs the existing Convex broker and model-provider
credentials into the ignored local Worker environment before startup. It never
prints secret values.

The first run opens Clerk in your browser and returns through a one-shot local
callback. Tokens refresh automatically and are stored in the macOS Keychain,
with a mode-0600 file fallback when no keychain is available. Use `bun run bee
-- logout` to revoke and remove the local session.

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
| `bun run bee`                              | Interactive Bee CLI                 |
| `make bee`                                 | Convex, agent, and interactive CLI  |
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
apps/cli              Personal Bun CLI for Bee
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
- Runbooks: [ChatGPT auth](docs/11-chatgpt-authentication.md), [Google Health](docs/12-google-health-powerup.md), [Sentry](docs/13-sentry-observability.md), [Imagine/FAL](docs/16-imagine-subagent.md), [X bookmark bot plan](docs/15-x-bookmark-bot-implementation-plan.md)
- [Web/mobile parity evidence](apps/web/PARITY.md)

## Contributing

- Use Bun and Bunx only.
- Read `packages/backend/convex/_generated/ai/guidelines.md` before changing Convex code.
- Treat generated Convex files as generated output.
- Use Conventional Commits.
