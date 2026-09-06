# BeeGreat Convex functions

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

This directory contains the shared schema and server functions used by every BeeGreat client.

From the repository root:

```sh
bun run --cwd packages/backend dev
bun run --cwd packages/backend typecheck
bun run --cwd packages/backend test:run
```

Read `_generated/ai/guidelines.md` before editing Convex code. Do not edit `_generated/` directly, duplicate functions inside an app, or place private credentials in client environment variables.

See the root [architecture guide](../../../docs/03-architecture.md) for service boundaries.
