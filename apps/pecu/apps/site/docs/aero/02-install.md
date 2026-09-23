---
title: Install
description: Add @beegreat/sugar to a Bun project from GitHub, or clone the repository and run the aero CLI from source.
group: Start
---

## Requirements

- Bun. The package pins `bun@1.4.2` in its `packageManager` field, and the CLI entry point runs on Bun.
- An RPC endpoint for each chain you use. Every chain has a public default, but public endpoints rate-limit the pool scans and quote batches Aero makes. Set `SUGAR_RPC_URI_<chainId>` to your own endpoint, as described in [Configuration](/docs/aero/sdk-configuration).

The package is not published to npm. Install it from the standalone repository, [OxFrancesco/UNOFFICIAL-Aero-SDK](https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK). It ships TypeScript source, since its `exports` point at `src/*.ts` files, so load it with Bun or a bundler that compiles TypeScript.

## Add the SDK to a project

```sh
bun add github:OxFrancesco/UNOFFICIAL-Aero-SDK
```

The package name is `@beegreat/sugar`.

```ts
import { SugarClient } from '@beegreat/sugar'
```

It has three entry points.

| Import path | Contents |
| --- | --- |
| `@beegreat/sugar` | `SugarClient`, chain classes, actions, helpers and types |
| `@beegreat/sugar/cli` | Headless helpers `runSugarCli` and `parseSugarCliArgs` |
| `@beegreat/sugar/contracts` | The `SUGAR_ACTIONS` and `SUGAR_TX_ACTIONS` lists and their type guards |

The install also links two binaries, `aero` and `sugar-ts`. Both run the same entry point. Run them through Bun from your project folder:

```sh
bun run aero --help
```

## Run the CLI from a clone

```sh
git clone https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK.git
cd UNOFFICIAL-Aero-SDK
bun install
bun run cli -- --help
```

`bun run cli` executes `src/cli.ts` directly, so there is no build step. Put CLI arguments after `--`. The [CLI](/docs/aero/cli) page covers the commands.

Run the checks from the clone:

```sh
bun test
bun run typecheck
bun run lint
```

## Build a bundled CLI

```sh
bun run build
```

`scripts/build-cli.ts` bundles `src/cli.ts` and the TUI worker into `dist/cli.js` and `dist/worker.js`, targeting Bun. Keep the two files in the same folder, because the TUI starts `worker.js` from next to `cli.js`. Dependencies stay external, so run the bundle where the package's dependencies are installed. Pass a folder to write the files somewhere else:

```sh
bun run build ./out
bun ./out/cli.js --help
```

## First read

A quote is a read. It needs no wallet and uses Base by default.

```sh
bun run aero quote --from-token ETH --to-token USDC --amount 0.01 --use-decimals
```

From a clone, use `bun run cli -- quote` with the same flags. If the command fails with `was rate limited`, the public RPC throttled the request. Set `SUGAR_RPC_URI_8453` and run it again.

The same kind of read from the SDK prints the AERO price in USDC:

```ts
import { BaseChain, SugarClient } from '@beegreat/sugar'

const sugar = new SugarClient(8453)
const [aero] = await sugar.getPrices([BaseChain.aero])
console.log(aero?.price)
```
