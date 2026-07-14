# BeeGreat Convex functions

This directory contains the shared schema and server functions used by every BeeGreat client.

From the repository root:

```sh
bun run --cwd packages/backend dev
bun run --cwd packages/backend typecheck
bun run --cwd packages/backend test:run
```

Read `_generated/ai/guidelines.md` before editing Convex code. Do not edit `_generated/` directly, duplicate functions inside an app, or place private credentials in client environment variables.

See the root [architecture guide](../../../docs/03-architecture.md) for service boundaries.
