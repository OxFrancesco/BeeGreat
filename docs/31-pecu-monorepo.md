# Pecu in BeeGreat

Pecu source lives in `apps/pecu`. The bot, source package, commands, prompts, wallet identifiers, storage keys, and Cloudflare configuration use the Pecu name. BeeGreat is the source repository for future changes here.

The import is a reviewed source snapshot from the private source checkout, including its Stocks and Pecu work. `apps/pecu/SOURCE.json` records the source revision. No private Git history, environment files, credentials, runtime databases, or private test reports were imported. The original checkout remains intact. Publishing this source does not deploy any service or migrate stored conversations or wallets.

## Commands

Run these from the BeeGreat root with Bun 1.4.2 or newer.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Install the shared workspace lockfile and patches |
| `bun run pecu:check` | Bot type checks, tests, and four Worker dry-run bundles |
| `bun run pecu:stocks:check` | Stocks type checks |
| `bun run pecu:stocks:build` | Regenerate the stock catalog and build Stocks |
| `bun run pecu:site:build` | Copy the Pecu homepage and generate pinned Aero CLI docs |
| `bun run pecu:site:check` | Pecu type checks and dry-run bundle |
| `bun run pecu` | Start the bot's local Worker services |
| `bun run pecu:deploy` | Deploy Codex, EVM, Aero, then the bot to the configured personal account |

Check existing listeners before starting development. Stocks uses remote service bindings during local development, so it can reach deployed wallet state. Routine migration checks use offline fixtures and dry-run bundles.

Stocks and Pecu keep their own deployment commands and working directories under `apps/pecu/apps`. Configure their ignored environment files there. Configure bot secrets for the Pecu Workers. No credentials were copied from the original checkout.

## Dependency ownership

The root `package.json` owns the Pecu patches, including compatibility fixes for the current Effect API. Nested lockfiles are excluded. Stocks participates through `apps/pecu/apps/*`.

Pecu deliberately retains its Git-pinned Aero SDK revision and CLI patch. It does not resolve that dependency to the newer `packages/sugar` workspace. Catalog and documentation scripts locate that installed dependency with `import.meta.resolve`, independent of Bun's hoisting layout. Its EVM container pins the reviewed public SDK commit with the same Effect update.

All owned Effect consumers use `4.0.0-rc.115`, the registry's latest v4 release candidate verified on 2026-09-15. Root overrides align OpenCode and the Git-pinned Aero dependency with that runtime and its platform packages. The AWS credential provider pins the browser-compatible web identity version used by the source checkout.

The shared Aero and EVM packages receive the same Effect update, including both standalone repositories and Aero bundled inside evmSDK. The EVM exporter derives the Effect override from the package manifest rather than hardcoding an older beta.

## Feature coverage

This is a source and workspace migration. X Chat, Stocks, and Pecu are included. Bee mobile, Android, web chat, CLI, iMessage, voice, and provider contracts do not change. Existing wallet confirmation and receipt recovery behavior remains covered by Pecu tests. Build results do not prove deployed authentication, live X delivery, container startup, or wallet execution.

## Pecu naming

The bot package is `@beegreat/pecu` in `apps/pecu`. Its gateway and homepage are `@beegreat/pecu-site` in `apps/pecu/apps/site`.

The bot Workers are `pecu`, `pecu-aero`, `pecu-codex`, and `pecu-evm`. Both the Durable Object and Stocks service bindings use `PECU`. The Durable Object class is `PecuDurableObject`, its named instance is `pecu-main`, and Crossmint owners use `userId:pecu-x-SENDER_ID`. SQLite tables, database defaults, stored keys, agent IDs, and the admin Keychain service also use Pecu.

This is a fresh identity, as requested because there are no users. There is no compatibility mapping or data migration from the former names. Existing remote services are not renamed by a source commit. Deployment must provision secrets for the Pecu Workers and register the configured Pecu webhook with X. `SOURCE.json` retains the original repository URL as a historical source record.
