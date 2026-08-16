
<!-- codeview:start -->

## Reference codebases (codeview)

The `resources/` folder contains read-only clones of reference codebases.
If you need to implement code specific to one of these codebases, read the relevant
folder to gather information, feedback, patterns, and templates before writing code.

- `resources/codex` — Official OpenAI Codex source — app-server protocol, thread lifecycle, approvals, streaming events, and TypeScript bindings
- `resources/pi` — Official Pi coding agent source — RPC mode, SDK embedding, sessions, extensions, tools, and terminal UI
- `resources/google-health-cli` — Official Google Health API CLI reference for OAuth, Health API discovery, and health data operations
- `resources/sentry-javascript` — Official Sentry JavaScript SDK monorepo for React, Next.js, Node.js, Cloudflare, Vite, source maps, tracing, and logs
- `resources/sentry-react-native` — Official Sentry React Native SDK for Expo configuration, native crash reporting, source maps, tracing, and app lifecycle
- `resources/sugar-sdk` — Velodrome/Aerodrome Sugar SDK and CLI reference for pool, position, rewards, swap, stake, unstake, and voting actions
- `resources/effect` — Official Effect TypeScript monorepo — typed effects, concurrency, CLI, platform, and AI packages
- `resources/flue` — Official Flue framework — runtime, channel/database/sandbox connectors, blueprints, tooling, and examples
- `resources/stagehand` — Browserbase Stagehand — AI browser automation framework (act/extract/observe/agent) built on Playwright
- `resources/chat` — Vercel Chat SDK — cross-platform adapters, identity/event models, state, and examples
- `resources/buddy-imagine-v2` — BuddyImagineV2 reference for FAL image and video generation and editing
- `resources/velodrome-sdk-js` — Official Velodrome/Aerodrome sdk.js — TypeScript Sugar SDK for pools, positions, swaps, staking, rewards, and voting
- `resources/gogcli` — OpenClaw Google Workspace CLI — commands, auth, JSON schema, agent safety profiles, and container deployment
- `resources/firecrawl` — Firecrawl monorepo: TypeScript SDK and API patterns for search, scrape, crawl, map, and structured extraction
- `resources/opencode` — Official OpenCode source — CLI model discovery, run flags, and reasoning variants
- `resources/aerodrome-contracts` — Official Aerodrome protocol contracts — VotingEscrow, Voter, voting rewards, gauges, managed veNFTs, and deployment addresses
- `resources/velodrome-contracts` — Official Velodrome protocol contracts — Optimism VotingEscrow, Voter, voting rewards, gauges, and deployment interfaces
- `resources/buddytg` — Francesco's local-first Telegram CLI — MTProto login, messaging, files, bookmarks, bot notifications, approvals, and secure session handling

<!-- codeview:end -->

## Design system

Before building or styling any UI (mobile screens, web pages, or Bee's `beeui`
generative-UI components), read `docs/design-system.md` — it defines the
tokens, motion, navigation patterns, component recipes, and the generative-UI
vocabulary with its content rules (e.g. machine ids never reach the user).

## Hit every surface

The most common defect in this repo is a change that works on the path you
tested and is missing everywhere else. The CLI, iMessage integration, web app,
and mobile app must ALWAYS be at feature parity. Before calling a change done,
walk this list and say which entries applied:

- **Clients.** Mobile (`apps/mobile`, Expo), web (`apps/web`, TanStack — the
  "web twin"), CLI (`apps/cli`), and iMessage (`apps/imessage-bridge`). A Bee
  behavior reachable from one client is usually reachable from all of them;
  fixing one is not fixing the feature. Shared chat logic lives in
  `packages/chat-sync` and shared tool rendering in
  `packages/tool-presentation` — prefer fixing there over patching one client.
- **Entry points.** A behavior reachable from the chat view is usually also
  reachable from voice (ElevenLabs), settings, deep links, and the Hive/goal
  screens. Fixing one entry point is not fixing the feature.
- **Channel presentation.** `beeui` components render richly on mobile/web but
  iMessage is plain text and the CLI is a terminal. Every generative-UI or
  tool-output change needs an explicit rendering decision per channel, even if
  the decision is "degrade to text here".
- **Providers.** Bee runs on OpenRouter by default and on the user's
  ChatGPT/Codex subscription via `apps/codex-adapter`. Model- or
  transport-shaped features need a decision per provider path, even if the
  decision is "not supported here".
- **Contracts.** Anything crossing the wire is typed in the Convex backend
  (`packages/backend`) or the agent's `beeui` contract (`packages/agent`).
  Change the schema/contract first and the agent, web, mobile, CLI, and
  iMessage all follow; never fork a shape in one client.
- **Reverse states.** If you added a way in, add the way out and the way to
  see it. Snooze needs unsnooze, connect (power-ups, ChatGPT, Telegram) needs
  disconnect, archive needs unarchive. A one-way door is a bug.
- **Deploy targets.** A single feature often spans Convex functions, the
  Cloudflare agent worker (`beegreat-agent`), and the Railway iMessage bridge.
  Shipping one target and not the others leaves production half-migrated —
  follow the `deploy` skill for order and verification.
- **Docs.** Behavior changes a user would notice belong in the numbered docs
  under `docs/`; design/UI vocabulary in `docs/design-system.md`; architectural
  decisions in `docs/adr/`.

## Configuration conventions

The agent worker URL is one concept with four env-var names, each prefix
dictated by its bundler: `BEE_AGENT_URL` (CLI), `AGENT_URL` (iMessage bridge),
`VITE_AGENT_URL` (web), `EXPO_PUBLIC_AGENT_URL` (mobile). CLI, bridge, and web
default to `http://localhost:3583`; mobile deliberately defaults to the
production worker because a device build cannot reach the developer's
localhost. Keep new configuration aligned with this table — do not invent a
fifth name.
