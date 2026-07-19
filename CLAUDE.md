
<!-- codeview:start -->

## Reference codebases (codeview)

The `resources/` folder contains read-only clones of reference codebases.
If you need to implement code specific to one of these codebases, read the relevant
folder to gather information, feedback, patterns, and templates before writing code.

- `resources/codex` — Official Codex implementation — app-server protocol, generated schemas, authentication, and client examples
- `resources/pi` — Pi agent stack used by Flue — native ChatGPT subscription OAuth, Codex provider, credential storage, and model runtime
- `resources/google-health-cli` — Official Google Health API CLI reference for OAuth, Health API discovery, and health data operations
- `resources/sentry-javascript` — Official Sentry JavaScript SDK monorepo for React, Next.js, Node.js, Cloudflare, Vite, source maps, tracing, and logs
- `resources/sentry-react-native` — Official Sentry React Native SDK for Expo configuration, native crash reporting, source maps, tracing, and app lifecycle
- `resources/sugar-sdk` — Velodrome/Aerodrome Sugar SDK and CLI reference for pool, position, rewards, swap, stake, unstake, and voting actions
- `resources/effect` — Effect TypeScript library — functional effect system, concurrency, streams, schema
- `resources/flue` — Official Flue framework — runtime, channel/database/sandbox connectors, blueprints, tooling, and examples
- `resources/stagehand` — Browserbase Stagehand — AI browser automation framework (act/extract/observe/agent) built on Playwright
- `resources/chat` — Vercel Chat SDK — cross-platform adapters, identity/event models, state, and examples

<!-- codeview:end -->

## Design system

Before building or styling any UI (mobile screens, web pages, or Bee's `beeui`
generative-UI components), read `docs/design-system.md` — it defines the
tokens, motion, navigation patterns, component recipes, and the generative-UI
vocabulary with its content rules (e.g. machine ids never reach the user).
