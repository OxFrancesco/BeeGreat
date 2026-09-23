---
title: Configuration
description: Environment variables, CLI flags, RPC selection, built-in endpoints and the files the toolkit writes.
group: Reference
---

The CLI, TUI and MCP server read the same environment variables and flags. The SDK reads neither. Pass the same settings to `runtimeLayer` instead. See [Effect SDK](/docs/evm/sdk#runtime-options).

## Environment variables

| Variable | Meaning | Default |
| --- | --- | --- |
| `EVM_DATABASE` | Journal path. Wallet connections go in a `wallets` directory next to it. | `~/.local/share/bee-evm/operations.sqlite` |
| `EVM_RPC_URL` | One RPC URL used for every chain the command touches | Built-in endpoints |
| `EVM_RPC_URLS` | JSON object mapping chain IDs to arrays of RPC URLs | None |
| `EVM_PRIVATE_KEY` | `0x`-prefixed 32-byte key for unattended signing | None |
| `EVM_POLICY` | Policy name bound to every plan and enforced at signing | None |
| `EVM_ETHERSCAN_API_KEY` | Key for verified ABI discovery through the Etherscan V2 API | None |
| `WALLETCONNECT_PROJECT_ID` | Your own WalletConnect project ID | A built-in public project ID |
| `EVM_SMART_WALLET_URL` | Hosted smart-wallet page. HTTPS, or HTTP on `localhost` and `127.0.0.1`. | `https://beegreat.app/evm-wallet` |
| `SOCKET_API_KEY` | Socket API key. Switches to the dedicated endpoint. | None |
| `SOCKET_API_URL` | Socket endpoint override | `https://public-backend.socket.tech` |
| `SOCKET_AFFILIATE` | Value for Socket's `affiliate` header | None |
| `EVM_SAFE_RELAY_CHAIN_ID` | Chain for sponsored Safe execution | None |
| `EVM_SAFE_BUNDLER_URL` | ERC-4337 bundler URL for that chain | None |
| `EVM_SAFE_PAYMASTER_URL` | Paymaster URL for that chain | None |
| `EVM_SAFE_SPONSORSHIP_POLICY_ID` | Optional paymaster sponsorship policy ID | None |

Sponsored Safe execution is configured only when `EVM_SAFE_RELAY_CHAIN_ID`, `EVM_SAFE_BUNDLER_URL` and `EVM_SAFE_PAYMASTER_URL` are all set. An invalid `EVM_PRIVATE_KEY` or malformed `EVM_RPC_URLS` fails every command except `discover` with `InvalidInput`.

## Flags

| Flag | Applies to | Meaning |
| --- | --- | --- |
| `--input <json>` | Catalog commands | Inline JSON input |
| `--file <path>` | Catalog commands | JSON input from a file |
| `--stdin` | Catalog commands | JSON input from standard input |
| `--rpc <url>` | All | Overrides `EVM_RPC_URL` |
| `--database <path>` | All | Overrides `EVM_DATABASE` |
| `--approve <fingerprint>` | `execute`, `workflow-run`, `bridge-run`, `batch-run`, `sign-typed-data` | Exact approval |
| `--yolo` | The same five commands | Autonomous approval for this invocation |
| `--browser` | `wallet connect` | Browser wallet |
| `--smart` | `wallet connect` | Crossmint smart wallet |
| `--chain <id>` | `wallet connect` | Chain ID, default `8453` |
| `--name <name>` | `wallet connect`, `wallet select`, `wallet disconnect` | Connection name, default `main` |
| `--help`, `-h` | All | Prints the `discover` document |

Unknown flags fail with `InvalidInput`.

## RPC selection

For each chain a command touches, the toolkit picks the first URL from this list:

1. `--rpc` or `EVM_RPC_URL`.
2. The first URL for that chain in `EVM_RPC_URLS`.
3. The built-in endpoint for that chain.

The other URLs for that chain in `EVM_RPC_URLS` become fallbacks. Every candidate is checked with `eth_chainId`. A candidate that reports a different chain fails the command with `ChainMismatch`. Candidates that do not respond are skipped, and if none respond the command fails with `RpcError`. Each request times out after 15 seconds and is not retried on the same endpoint.

`EVM_RPC_URL` applies to every chain. If you set it to a Base endpoint and then read Ethereum, the command fails with `ChainMismatch`. To work across chains, use `EVM_RPC_URLS`:

```sh
export EVM_RPC_URLS='{"8453":["https://YOUR_BASE_RPC_URL","https://mainnet.base.org"],"1":["https://ethereum-rpc.publicnode.com"]}'
```

Error messages replace RPC URLs with `[RPC endpoint]`, so keys embedded in a URL do not leak into output.

## Built-in endpoints

| Chain | ID | RPC |
| --- | --- | --- |
| Ethereum | 1 | `https://ethereum-rpc.publicnode.com` |
| Base | 8453 | `https://mainnet.base.org` |
| Sepolia | 11155111 | `https://ethereum-sepolia-rpc.publicnode.com` |
| Base Sepolia | 84532 | `https://sepolia.base.org` |
| Arbitrum One | 42161 | `https://arbitrum-one-rpc.publicnode.com` |
| OP Mainnet | 10 | `https://optimism-rpc.publicnode.com` |
| Polygon | 137 | `https://polygon-bor-rpc.publicnode.com` |
| BNB Smart Chain | 56 | `https://bsc-rpc.publicnode.com` |
| Anvil | 31337 | `http://127.0.0.1:8545` |

Public endpoints can rate-limit or lag. Historical reads need an archive endpoint, and asset simulation needs `eth_simulateV1` support. Check what an endpoint supports with `capabilities`.

## Files

| Path | Contents | Mode |
| --- | --- | --- |
| `~/.local/share/bee-evm/` | Journal directory | `0700` |
| `operations.sqlite` | Operations, locks, saved aliases, policies, workflows, bridges, batches, monitors and signatures | `0600` |
| `wallets/accounts.json` | Named wallet connections and the selected one | `0600` |
| `wallets/walletconnect` | WalletConnect session storage | Inside the `0700` wallets directory |

The journal holds signed transactions that can still be broadcast. Keep it out of source control and backups you share, and preserve it after an uncertain submission. See [Recovery](/docs/evm/recovery).

The journal uses SQLite with full synchronous writes and a five-second busy timeout, so several processes can share one file.
