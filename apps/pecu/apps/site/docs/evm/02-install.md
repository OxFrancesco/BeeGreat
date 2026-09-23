---
title: Install
description: Clone the standalone repository, install it with Bun, and run discover to confirm the CLI works.
group: Start
---

## Requirements

- Bun. The repository pins `bun@1.4.2` in `packageManager`, and its CI runs that version.
- Git.
- Foundry's `forge` and `anvil`, only if you run the end-to-end test suite.

The package is marked private and is not published to npm. Run it from a checkout of [OxFrancesco/evmSDK](https://github.com/OxFrancesco/evmSDK).

## Clone and install

```sh
git clone https://github.com/OxFrancesco/evmSDK.git
cd evmSDK
bun install --frozen-lockfile
bun run cli discover
```

The toolkit sits at the repository root. Its Aero dependency lives in `packages/sugar` and installs as a Bun workspace, so you do not need a separate Aero checkout.

## Run the CLI

These three commands are equivalent inside the checkout:

```sh
bun run cli discover
bun src/cli.ts discover
bun dist/cli.js discover
```

The last one needs a build first. These docs write every command as `evm <command>`. To use that form in your shell, point an alias at the checkout:

```sh
alias evm="bun /absolute/path/to/evmSDK/src/cli.ts"
```

Running with no command, or with `--help` or `-h`, prints the same document as `discover`.

## Build

```sh
bun run build
bun dist/cli.js discover
```

`build` bundles `src/cli.ts` and `src/index.ts` into `dist/` for the Bun target. Dependencies stay external, so run `dist/cli.js` inside a checkout where `bun install` has already run.

## Check the install

`discover` needs no network, key or database. It prints one JSON document:

| Field | Contents |
| --- | --- |
| `commands` | Every command with `name`, `description`, `inputSchema` and `outputSchema` as JSON Schema draft 2020-12 |
| `errorSchema` | The error object and every error code |
| `streamingOutputs` | The per-line schemas for `watch` and `watch-contract` |
| `conventions` | Input, execution, quantity, output, exit code, signing and MCP rules |

The document is large. Filter it to the command you need, for example with `jq`:

```sh
evm discover | jq '.commands[] | select(.name == "transfer") | .inputSchema'
```

## Local files

The first command that needs state creates the journal at `~/.local/share/bee-evm/operations.sqlite`. The directory is created with mode `0700` and the file with mode `0600`. Wallet connections are stored in a `wallets` directory next to the journal. Set `EVM_DATABASE` or pass `--database` to move both. See [Configuration](/docs/evm/configuration#files).

## Run the checks

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run test:e2e
bun run test:aero
```

`test:e2e` starts a local Anvil node, compiles the fixtures with `forge`, and signs with random keys. It calls `dist/cli.js`, so build first. It writes its evidence to `artifacts/e2e.json`, which Git ignores. `test:aero` runs the bundled Aero SDK tests.
