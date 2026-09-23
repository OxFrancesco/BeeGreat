---
title: Overview
description: evmSDK is a Bun toolkit for reading contracts, planning transactions and executing them on Ethereum, Base and other EVM chains, built for agents first.
group: Start
---

evmSDK is the `@beegreat/evm` package. It gives agents and people one command catalog for EVM chains. Every command takes JSON, returns JSON, and publishes its input and output schema through `evm discover`, so an agent can build a call without guessing field names.

## Four interfaces

The CLI, terminal UI, MCP server and SDK decode the same input schemas, call the same services and write to the same kind of SQLite journal. When they share a journal file, a plan prepared in one interface can be reviewed and executed in another.

| Interface | Start it | Use it for |
| --- | --- | --- |
| `evm` CLI | `evm <command> --input '<json>'` | Scripts and agents. One JSON result per call, NDJSON for watches. |
| Terminal UI | `evm tui` | Keyboard forms for every command, wallet pairing and plan review. |
| MCP server | `evm mcp` | MCP clients over stdio. One tool per command. |
| Effect SDK | `import { dispatch, runtimeLayer } from '@beegreat/evm'` | TypeScript programs that run commands or compose the services directly. |

## What it covers

- Contract reads, balances, tokens, blocks, transactions, logs, ABI discovery and calldata decoding. See [Reads](/docs/evm/reads).
- Transaction plans with simulation, fee estimates, exact approval, persisted signing, status, replacement and recovery. See [Transactions](/docs/evm/transactions).
- Browser wallets, WalletConnect, Crossmint smart wallets and unattended keys. See [Wallets](/docs/evm/wallets).
- Local spending policies, multi-step workflows and EIP-5792 wallet batches. See [Policies and workflows](/docs/evm/policies-and-workflows).
- Socket V3 swaps and bridges with destination settlement checks. See [Swaps and bridging](/docs/evm/swaps-and-bridging).
- Safe organization wallets with owner approvals, budgets, scoped roles, passkey owners and sponsored gas. See [Safe wallets](/docs/evm/safe).
- Block watches, contract read watches and durable event monitors. See [Monitoring](/docs/evm/monitoring).
- Aero, ERC-4626 vault and Aave-compatible lending plans, plus indexed portfolio reads. See [Protocols and portfolio](/docs/evm/protocols).

## When it signs

Most commands never sign. Reads return data. Plan commands simulate a transaction and store it unsigned in the journal. Only these commands can produce a signature or send a transaction:

| Command | What it can do |
| --- | --- |
| `execute` | Sign and broadcast one stored plan |
| `workflow-run` | Execute the steps of a stored workflow in order |
| `bridge-run` | Execute a stored Socket approval and route |
| `batch-run` | Send a stored EIP-5792 batch to the connected wallet |
| `sign-typed-data` | Sign EIP-712 data without broadcasting |
| `safe-sponsored-sign` | Sign a sponsored Safe operation with the local key without broadcasting |
| `safe-sponsored-submit` | Send a signed sponsored Safe operation to the bundler |

The first five need `--approve` with the exact fingerprint you reviewed, or `--yolo`. The two sponsored Safe commands need the reviewed fingerprint in their input. `--yolo` skips the toolkit's approval check for one invocation. It does not skip simulation, chain, account, expiry or policy checks, and a browser wallet or passkey still asks its owner.

Signatures come from a browser wallet or WalletConnect in an interactive terminal, a Crossmint smart wallet through a hosted page, or, for unattended agents, a key in `EVM_PRIVATE_KEY` or an SDK signer. Keys are never command arguments and are never written to the journal.

> [!WARNING]
> `execute`, `workflow-run`, `bridge-run`, `batch-run` and `safe-sponsored-submit` send real transactions. A passing simulation does not prove a transaction is safe or that it will succeed. Start with reads, check every address and amount in the plan, and sign from a wallet that holds only what you can afford to lose.

## Supported chains

Built-in RPC endpoints cover Ethereum (1), Base (8453), Sepolia (11155111), Base Sepolia (84532), Arbitrum One (42161), OP Mainnet (10), Polygon (137), BNB Smart Chain (56) and a local Anvil node (31337). Any other chain ID works once you configure an RPC URL. Every endpoint is checked with `eth_chainId` before use, and a mismatch fails the command. See [Configuration](/docs/evm/configuration#rpc-selection).

Some features cover fewer chains:

| Feature | Chains |
| --- | --- |
| Crossmint smart wallets | 1, 8453, 84532, 11155111, 42161, 10, 137 |
| OP Stack L1 data fee estimate | 8453, 84532, 10, 11155420 |
| Indexed portfolio through Blockscout | 1, 8453, 10, 42161 |
| Safe wallets | Chains with the official Safe 1.4.1 deployment and the pinned module deployments |
| Aero | Chains the Aero SDK supports. Outside Base and OP Mainnet you also need an RPC URL. |

## How Pecu uses it

Pecu builds its generic EVM reads and unsigned plans with the `evm` CLI inside a sandbox. The sandbox holds only an RPC URL, runs one allow-listed read or plan command per request, and cannot sign. `execute`, wallet commands and recovery commands are not on its allow list. Pecu validates each returned plan, asks you to confirm it, and signs with your own smart wallet. See [Pecu](/docs/pecu).
