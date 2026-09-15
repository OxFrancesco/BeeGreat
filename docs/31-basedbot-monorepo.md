# BasedBot in BeeGreat

BasedBot source lives in `apps/basedbot`. Its X Chat worker, Aero service, Codex container, EVM sandbox, Stocks web app, and Pecu gateway retain their existing names and deployment configuration. BeeGreat is the source repository for future changes here.

The import is a reviewed source snapshot from the private BasedBot checkout, including its Stocks and Pecu work. `apps/basedbot/SOURCE.json` records the source revision. No private Git history, environment files, credentials, runtime databases, or private test reports were imported. The original checkout remains intact. Publishing this source does not deploy any service or migrate stored conversations or wallets.

## Commands

Run these from the BeeGreat root with Bun 1.4.2 or newer.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Install the shared workspace lockfile and patches |
| `bun run basedbot:check` | Bot type checks, tests, and four Worker dry-run bundles |
| `bun run basedbot:stocks:check` | Stocks type checks |
| `bun run basedbot:stocks:build` | Regenerate the stock catalog and build Stocks |
| `bun run basedbot:pecu:build` | Copy the Pecu homepage and generate pinned Aero CLI docs |
| `bun run basedbot:pecu:check` | Pecu type checks and dry-run bundle |
| `bun run basedbot` | Start the bot's local Worker services |
| `bun run basedbot:deploy` | Deploy Codex, EVM, Aero, then the bot to the configured personal account |

Check existing listeners before starting development. Stocks uses remote service bindings during local development, so it can reach deployed wallet state. Routine migration checks use offline fixtures and dry-run bundles.

Stocks and Pecu keep their own deployment commands and working directories under `apps/basedbot/apps`. Configure their ignored environment files there. Configure bot secrets for its existing Workers. No credentials were copied from the original checkout.

## Dependency ownership

The root `package.json` owns the BasedBot patches, including compatibility fixes for the current Effect API. Nested lockfiles are excluded. Stocks participates through `apps/basedbot/apps/*`.

BasedBot deliberately retains its Git-pinned Aero SDK revision and CLI patch. It does not resolve that dependency to the newer `packages/sugar` workspace. Catalog and documentation scripts locate that installed dependency with `import.meta.resolve`, independent of Bun's hoisting layout. Its EVM container pins the reviewed public SDK commit with the same Effect update.

All owned Effect consumers use `4.0.0-rc.115`, the registry's latest v4 release candidate verified on 2026-09-15. Root overrides align OpenCode and the Git-pinned Aero dependency with that runtime and its platform packages. The AWS credential provider pins the browser-compatible web identity version used by the source checkout.

The shared Aero and EVM packages receive the same Effect update, including both standalone repositories and Aero bundled inside evmSDK. The EVM exporter derives the Effect override from the package manifest rather than hardcoding an older beta.

## Feature coverage

This is a source and workspace migration. X Chat, Stocks, and Pecu are included. Bee mobile, Android, web chat, CLI, iMessage, voice, and provider contracts do not change. Existing wallet confirmation and receipt recovery behavior remains covered by BasedBot tests. Build results do not prove deployed authentication, live X delivery, container startup, or wallet execution.
