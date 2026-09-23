---
title: MCP server
description: Serve the command catalog to MCP clients over stdio, with the same schemas, journal and approval checks as the CLI.
group: Integrations
---

## Start the server

```sh
evm mcp
evm mcp --database /absolute/path/to/evm.sqlite
```

`evm mcp` speaks MCP over stdio. It reads the same environment variables as the CLI and accepts `--rpc` and `--database`. Point it at the same database as your CLI or TUI to share plans, workflows and locks. The server identifies itself as `beegreat-evm`, version `0.2.0`.

## Client configuration

Clients that launch stdio servers take a command and its arguments. Use absolute paths, because the client may start the server from another directory:

```json
{
  "mcpServers": {
    "evm": {
      "command": "bun",
      "args": ["/absolute/path/to/evmSDK/src/cli.ts", "mcp", "--database", "/absolute/path/to/evm.sqlite"],
      "env": {
        "EVM_RPC_URLS": "{\"8453\":[\"https://mainnet.base.org\"]}"
      }
    }
  }
}
```

The name of the top-level key depends on your client. Leave out `env` to use the built-in RPC endpoints.

## Tools

The server exposes one tool per catalog command, with the same name, description and input schema. See the [command reference](/docs/evm/commands). `discover`, `tui` and `mcp` are CLI verbs, not tools. The tool list already carries every input schema.

The server's instructions tell the client to discover schemas before acting, prepare transactions and review their fingerprints before execution, reuse operation IDs after an uncertain submission, and pair browser wallets in the TUI.

## Results

Each call returns one text content item holding JSON, and sets `isError` when the command failed:

```json
{"ok":true,"result":{"baseUnits":"2500000","decimal":"2.5","decimals":6}}
```

```json
{"ok":false,"error":{"code":"ApprovalRequired","message":"Review operation PLAN_ID, then pass --approve 0xFINGERPRINT or --yolo.","retryable":false}}
```

Unlike the CLI envelope, MCP results have no `version` or `command` field. Error codes are the same. See [Agent conventions](/docs/evm/conventions#error-codes).

## Approvals

MCP has no `--approve` or `--yolo` flags. `execute`, `workflow-run`, `bridge-run` and `batch-run` require an `approval` argument. `sign-typed-data` returns a preview without one.

```json
{"id":"PLAN_ID","approval":{"_tag":"approved","fingerprint":"0xFINGERPRINT"}}
```

Use `{"_tag":"required"}` to have the tool return `ApprovalRequired` with the fingerprint in its message. Use `{"_tag":"yolo"}` only for a signer you have limited with a policy.

## Signing

The MCP server is never interactive. It cannot pair a wallet, and connected browser, WalletConnect and smart wallets cannot sign through it. They fail with `SignerInteractionRequired`. Pair and sign those wallets in the [TUI](/docs/evm/tui) or an interactive terminal.

Reads, quotes and plans need no signer. For unattended execution, set `EVM_PRIVATE_KEY` and `EVM_POLICY` in the server's environment. See [Wallets](/docs/evm/wallets#unattended-agents).

## Watches

`watch` and `watch-contract` do not stream over MCP. The tool call returns the collected array after the last sample, so it blocks for roughly `count × intervalMs`. Keep both small.
