# Web3 powerup: wallets, cross-chain swaps, confirmation gate, and Sugar

The Web3 specialist manages the user's wallets, routes Base ↔ Arbitrum swaps
through Socket V3, and exposes Velodrome/Aerodrome DeFi through the native
TypeScript Sugar SDK (`packages/sugar`).

## Wallets

- **Bee smart wallet** (Crossmint): created idempotently per user, owned by
  `userId:<clerk id>` with a server admin signer. Production creates the same
  EVM smart-wallet address on Base and Arbitrum; staging uses Base Sepolia.
  Each chain instance is cached in the `wallets` table (`kind: 'crossmint'`).
- **Linked EOA**: the user's own external address, linked from the profile
  screen (`wallets.linkEoa`, stored with `kind: 'eoa'`, chain `evm`). BeeGreat
  never holds its keys; Sugar builds unsigned plans against it for the user to
  sign in their own wallet app.

## Confirmation gate (server-side)

Anything that moves funds is two-phase via the `web3Actions` table:

1. The agent calls a `prepare_*` tool (`prepareSendTokens`,
   `prepareSocketSwap`, or `prepareSugarExecution`), which validates, builds
   the plan server-side, and stores a `pending` action. Nothing is signed.
   Every confirmation lives for the full 10-minute action TTL; Socket quotes
   only live ~60s, so if the quote is stale at execution time the executor
   re-fetches a fresh route and `refreshSocketRoute` refuses any route that
   guarantees less than the confirmed minimum output.
2. Bee renders a `confirm` component with payload
   `{"web3ActionId":"<actionId>"}`. The signed-in app calls
   `web3Actions.confirm` — the only path to execution — which schedules
   `web3.executeConfirmedAction` to sign with the Crossmint server signer.
3. The agent polls `check_web3_action` for status, hashes, and explorer links.
   Socket actions remain `in_progress` after the source transaction and only
   become `executed` when Socket reports destination completion. Refunds are
   surfaced separately.

A chat "yes" can never move funds: the agent has no confirm/execute path, so
prompt injection cannot spend from the wallet.

## Base ↔ Arbitrum with Socket

`quote_cross_chain_swap` previews a route without storing or signing anything.
`prepare_cross_chain_swap` fetches a fresh executable quote and places it behind
the same confirmation gate. The first production slice supports ETH and USDC
in both directions.

For the important “only Base USDC” case, request Base/USDC → Arbitrum/ETH:

- Crossmint gas sponsorship pays for the Base USDC approval and Socket source
  transaction, so the user does not need Base ETH.
- Socket swaps and bridges the USDC into native ETH at the destination, so the
  Arbitrum wallet arrives with ETH it can use for future gas.
- For a USDC destination, the quote requests Socket `refuel` so a small native
  gas balance is included when the selected route supports it.

Socket calldata is never rebuilt: the executor submits the exact V3
`txData.object`. ERC-20 approval is limited to Socket's quoted amount and
spender. The backend validates chain IDs, token addresses, expiry, wallet
address, and EVM transaction shape before an action can be confirmed.

## Action coverage

Wallet tools: `get_wallets`, `create_wallet`, `get_wallet_balance`,
`get_wallet_activity`, `fund_wallet` (staging USDXM faucet only),
`quote_cross_chain_swap`, `prepare_cross_chain_swap`, `prepare_send_tokens`,
`prepare_sugar_execution`, `check_web3_action`.

Sugar read tools: `sugar_pools`, `sugar_positions`, `sugar_epochs_latest`,
`sugar_epochs`, `sugar_quote`.

Sugar unsigned-plan builders (default the linked EOA): `sugar_swap`,
`sugar_deposit`, `sugar_withdraw`, `sugar_stake`, `sugar_unstake`,
`sugar_claim_emissions`, `sugar_claim_fees`. Plans are ordered
`{from,to,data,value}` JSON; the bridge has no private-key input.

`prepare_sugar_execution` accepts only the seven transaction actions
(`SUGAR_TX_ACTIONS` in `packages/sugar/src/contracts.ts`), rebuilds the plan
server-side with the chain pinned to Base (8453) and the wallet pinned to the
smart wallet, so the agent can never inject raw calldata. Execution is mainnet
only — Aerodrome has no public testnet deployment.

Sugar reads support Optimism (`10`), Base (`8453`), Unichain (`130`), Lisk
(`1135`), Mode (`34443`), Fraxtal (`252`), Ink (`57073`), Soneium (`1868`),
Superseed (`5330`), and Celo (`42220`).

## Runtime layout

The Flue powerup (`packages/agent/src/shared/powerups/web3.ts`) talks to two
authenticated HTTP routes on the Convex deployment, both guarded by
`AGENT_CREDENTIAL_BROKER_SECRET`:

- `POST /internal/web3/sugar` — allowlisted Sugar reads and unsigned plans.
- `POST /internal/web3/wallet` — wallet ops (`op` field, see
  `WEB3_WALLET_OPS` in `packages/backend/convex/http.ts`).

All Convex functions behind the bridge are `internal*`; none are public. The
Node actions live in `packages/backend/convex/web3.ts`, the confirmation
state machine in `web3Actions.ts`, and the DB surface in `wallets.ts`. Every
entry point re-checks the `web3` powerup entitlement server-side.

## Deploy and configure

```sh
bunx convex env set CROSSMINT_API_KEY        # sk_production_* for mainnet
bunx convex env set CROSSMINT_SIGNER_SECRET  # long random; NEVER rotate
bunx convex env set SOCKET_API_KEY           # Socket dedicated V3 API key
bunx convex env set AGENT_CREDENTIAL_BROKER_SECRET
```

In the Crossmint console, enable gas sponsorship for both Base and Arbitrum and
allow the Socket approval/router calls used by this powerup. Sponsorship is the
mechanism that makes a source wallet containing only USDC usable; it must be
configured before production rollout. Keep the Socket key server-side.

Per-chain Sugar RPC overrides use the standard names (`SUGAR_RPC_URI_8453`,
…) if needed.

Run the focused checks with Bun:

```sh
bun test packages/sugar
bun run --cwd packages/backend test
bun run --cwd packages/sugar typecheck
bun run --cwd packages/backend typecheck
bun run --cwd packages/agent build
```
