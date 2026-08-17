---
name: Web3 Powerup
description: Use when working on BeeGreat's Web3 powerup — the agent's wallet/DeFi tools, the Convex HTTP bridge, the confirmation gate, Crossmint smart wallets, Socket cross-chain swaps, or the Sugar (Velodrome/Aerodrome) SDK. Contains the tool→op→function wiring map, env var requirements per deployment, security invariants that must not be broken, and the focused verification commands.
metadata:
    version: "1.0"
---

# Web3 Powerup Skill

## Architecture at a glance

```
packages/agent/src/shared/powerups/web3.ts   (Flue tools, valibot schemas)
packages/agent/src/shared/powerups/web3-skills.ts (Flue Agent Skills: lazy playbooks
        the web3 subagent activates at runtime — aerodrome-liquidity, cross-chain-swap)
        │  POST + Bearer AGENT_CREDENTIAL_BROKER_SECRET
        ▼
packages/backend/convex/http.ts              (/internal/web3/sugar, /internal/web3/wallet)
        ▼
packages/backend/convex/web3.ts              (Node actions: Crossmint, Socket, Sugar exec)
packages/backend/convex/web3Actions.ts       (confirmation-gate state machine)
packages/backend/convex/wallets.ts           (wallet cache + EOA link challenge)
packages/backend/convex/socketSwap.ts        (Socket V3 quote/status, Effect retry)
packages/sugar/                              (native Sugar SDK; boundary validation in src/index.ts)
```

Primary doc: `docs/14-sugar-web3-powerup.md`. Effect versions are split on
purpose: `packages/backend` follows the house pattern in
`packages/backend/convex/scraperEffect.ts` (effect **v3.21.4**), while
`packages/sugar` is Effect-first on effect **v4** (4.0.0-beta line):
Effect.fn generator domain modules, Schema.TaggedError (`SugarRpcError`),
effect/Cache read caches, and a promise adapter (`src/internal/interop.ts`
`runSugar`) at the public API edge so backend consumption is unchanged. The
`aero` CLI is built on `effect/unstable/cli` (typed subcommands, `--wizard`,
`--completions`, `aero guide`).

## Tool → op → internal function map

Wallet bridge (`/internal/web3/wallet`, ops allowlist `WEB3_WALLET_OPS` in http.ts):

| Agent tool | op | Internal function |
|---|---|---|
| `get_wallets` | `wallets` | `wallets.getWalletsForAgent` |
| `create_wallet` | `create_wallet` | `web3.getOrCreateWallet` |
| `get_wallet_balance` | `balances` | `web3.getBalances` |
| `get_wallet_activity` | `activity` | `web3.getActivity` |
| `fund_wallet` | `fund` | `web3.fundWallet` (staging only) |
| `prepare_send_tokens` | `prepare_send` | `web3.prepareSendTokens` |
| `quote_cross_chain_swap` | `quote_socket_swap` | `web3.quoteSocketSwap` |
| `prepare_cross_chain_swap` | `prepare_socket_swap` | `web3.prepareSocketSwap` |
| `prepare_sugar_execution` | `prepare_execution` | `web3.prepareSugarExecution` |
| `prepare_linked_wallet_execution` | `prepare_eoa_execution` | `web3.prepareEoaSugarExecution` |
| `check_web3_action` | `action_status` | `web3Actions.getForUser` |

Sugar bridge (`/internal/web3/sugar` → `web3.runSugar`): the 12 `sugar_*` tools map
1:1 onto `SUGAR_ACTIONS` (`packages/sugar/src/contracts.ts`). Execution paths accept
only the 7 `SUGAR_TX_ACTIONS`. Parameter kinds are validated in
`validateSugarRequest` (`packages/sugar/src/index.ts`); note `fraction` is declared
`decimal_string` but numbers are explicitly coerced there — not a bug.

## Security invariants (do not break)

- Every Convex function behind the bridge is `internal*`; agent identity is the
  broker secret. The agent can NEVER confirm or execute: prepare tools only create
  a `pending` row in `web3Actions`; a signed-in app (or the action-id-bound
  iMessage bridge) confirms.
- `prepareSugarExecution` / `prepareEoaSugarExecution` overwrite `chain` and
  `wallet` server-side — never let agent-supplied values through.
- Every entry point calls `requireWeb3` / `requirePowerup(ctx, userId, 'web3')`
  including the read-only `wallets` and `action_status` ops. Keep it that way.
- EOA actions are never eligible for YOLO auto-confirm or iMessage confirmation
  (`web3Actions.create` guards `payload.kind !== 'execute_eoa_plan'`).
- Socket calldata is never rebuilt — the executor submits the exact quoted
  `txData.object`; `refreshSocketRoute` refuses routes below the confirmed minimum.
- Sugar accepts public 0x addresses only; `validateParameter` rejects
  private-key-shaped strings.

## Environment

Backend (Convex, `bunx convex env set ...`): `CROSSMINT_API_KEY` (prefix picks the
network: `sk_production_*` = Base/Arbitrum mainnet, `sk_staging_*` = Base Sepolia),
`CROSSMINT_SIGNER_SECRET` (NEVER rotate), `SOCKET_API_KEY` (without it Socket
silently falls back to the rate-limited public endpoint — required with a
production Crossmint key), `SUGAR_RPC_URI_8453`, `AGENT_CREDENTIAL_BROKER_SECRET`.

Agent worker: `CONVEX_URL`, `CONVEX_SITE_URL` (required when the deployment is not
`*.convex.cloud`), `AGENT_CREDENTIAL_BROKER_SECRET` (must equal the Convex value;
beware the `?? BRIDGE_SECRET` fallback in `bee.ts` masking a missing value).

Check a deployment with `bunx convex env list` (add `--prod` for production) from
`packages/backend`.

## Effect conventions here

- `packages/backend`: effect v3.21.4 API only. Errors: `Data.TaggedError`.
  Retries: the `Schedule.identity + addDelay(Retry-After) +
  intersect(exponential) + intersect(recurs)` composition (see
  `socketSwap.ts` `socketFetch` and `scraperEffect.ts` `providerAttempt`).
- `packages/sugar`: effect v4 (4.0.0-beta line). Errors:
  `Schema.TaggedError` (`SugarRpcError`). Retries: v4
  `Effect.retry({ while, schedule })` with `Schedule.exponential + upTo +
  modifyDelay(Retry-After)` in `src/internal/rpc-executor.ts`. Read caches:
  `effect/Cache` via `src/internal/caches.ts`. The two effect versions never
  mix — sugar's promise edge (`runSugar`) is the boundary.
- Only idempotent reads retry (Socket quote/status, Sugar RPC reads). Transaction
  submission never retries automatically.
- Do NOT convert Convex scheduler polling (`pollSocketSwapStatus`) to
  `Effect.repeat` — it intentionally uses `ctx.scheduler.runAfter`.
- `packages/agent` has no effect dependency on purpose; keep plain fetch there.

## Verify changes

```sh
bun test packages/sugar
bun run --cwd packages/sugar lint
bun run --cwd packages/backend test -- run convex/socketSwap.test.ts convex/web3Actions.test.ts convex/web3.test.ts convex/channelActions.test.ts
bun run --cwd packages/sugar typecheck
bun run --cwd packages/backend typecheck
bun run --cwd packages/agent build
```
