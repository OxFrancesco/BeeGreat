
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

<!-- codeview:end -->

## Design system

Before building or styling any UI (mobile screens, web pages, or Bee's `beeui`
generative-UI components), read `docs/design-system.md` — it defines the
tokens, motion, navigation patterns, component recipes, and the generative-UI
vocabulary with its content rules (e.g. machine ids never reach the user).
