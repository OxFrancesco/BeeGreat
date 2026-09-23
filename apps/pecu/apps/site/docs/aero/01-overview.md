---
title: Overview
description: Aero is a TypeScript SDK, the aero CLI and a terminal UI for Aerodrome on Base and the Velodrome deployments on nine other chains.
group: Start
---

Aero is one package, `@beegreat/sugar`, with three ways in.

| Part | What it does |
| --- | --- |
| SDK | TypeScript client for pools, quotes, swaps, liquidity, veNFTs and tokenized stocks. Returns reads and unsigned transactions. |
| `aero` CLI | Runs the same actions from a terminal. Prints reads as JSON, connects a wallet, shows each plan and asks before it broadcasts. |
| `aero tui` | Full-screen terminal UI with browse screens, guided forms, analytics and signing. |

The SDK is a TypeScript port of the Velodrome Python Sugar SDK. It uses Viem to read chain state from the Sugar contracts and to encode transactions.

> [!WARNING]
> Aero is early beta software built with AI coding agents. Transactions it helps you build are real and cannot be undone. A wrong amount, token, approval or network can lose funds. Review every unsigned plan, start with small amounts, and use a wallet that holds only what you can afford to lose.

## The SDK never signs

Read methods return typed data. Write methods return an ordered list of unsigned transactions shaped `{ from, to, data, value }`, with any approvals before the final action. The SDK has no private key input and never broadcasts anything. You sign and send the list yourself, in order.

Signing lives in the CLI wallet flow. The `aero` CLI and TUI can sign with a browser wallet, a WalletConnect wallet or an encrypted local wallet, and they show a summary and ask before each step. See [Wallets](/docs/aero/wallets) and [Transactions](/docs/aero/transactions).

## Supported chains

Every entry point defaults to Base, chain ID 8453, where Aerodrome runs. The SDK also supports OP Mainnet (10), Unichain (130), Fraxtal (252), Lisk (1135), Soneium (1868), Superseed (5330), Mode (34443), Celo (42220) and Ink (57073).

Some features are narrower. veNFT locks and voting work on Base and OP Mainnet only. Tokenized stocks are Base only. Cross-chain Superswap covers OP Mainnet, Lisk and Unichain. [Chains](/docs/aero/sdk-chains) has the full table.

## Where to go next

| Page | Covers |
| --- | --- |
| [Install](/docs/aero/install) | Adding the package, running the CLI from a clone, the build step |
| [Client](/docs/aero/sdk-client) | `SugarClient`, options, tokens, balances, prices and unit helpers |
| [Swaps](/docs/aero/sdk-swaps) | Quotes, routing, swap plans, slippage and approvals |
| [Liquidity](/docs/aero/sdk-liquidity) | Pools, epochs, positions, deposits, withdrawals, staking and claims |
| [veNFTs](/docs/aero/sdk-venft) | Locks, voting, rewards, rebases, managed veNFTs and pool incentives |
| [Stocks](/docs/aero/sdk-stocks) | Tokenized stock prices, trades and index rebalances from the SDK |
| [Actions](/docs/aero/sdk-actions) | The JSON action interface the CLI and TUI are built on |
| [Chains](/docs/aero/sdk-chains) | Chain IDs, chain classes, Superswap and Supersim |
| [Configuration](/docs/aero/sdk-configuration) | Environment variables, RPC retries, errors and failover |
| [CLI](/docs/aero/cli) | Running the `aero` command |
| [CLI reference](/docs/aero/cli-reference) | Every command and flag |
| [Wallets](/docs/aero/wallets) | Browser, WalletConnect and local wallets |
| [Transactions](/docs/aero/transactions) | Plan review, signing, dry runs and interrupted plans |
| [Stocks and indices](/docs/aero/stocks-and-indices) | Stock trades and saved indices in the CLI and TUI |
| [TUI](/docs/aero/tui) | The terminal UI |
| [Analytics](/docs/aero/analytics) | The TUI analytics screens |
| [ALM](/docs/aero/alm) | The self-hosted liquidity manager behind `aero serve` |
| [Licensing](/docs/aero/licensing) | Which license covers which part of the code |
