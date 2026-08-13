# Web3 powerup: wallets, cross-chain swaps, confirmation gate, and Sugar

The Web3 specialist manages the user's wallets, routes Base ↔ Arbitrum swaps
through Socket V3, and exposes Velodrome/Aerodrome DeFi through the native
TypeScript Sugar SDK (`packages/sugar`).

## Wallets

- **Bee smart wallet** (Crossmint): created idempotently per user, owned by
  `userId:<clerk id>` with a server admin signer. Production creates the same
  EVM smart-wallet address on Base and Arbitrum; staging uses Base Sepolia.
  Each chain instance is cached in the `wallets` table (`kind: 'crossmint'`).
- **Linked EOA**: the user's own external wallet, connected with Reown
  AppKit/WalletConnect and verified by a short-lived signed challenge
  (`wallets.beginEoaLink` → `wallets.linkEoa`). Convex stores only the verified
  public address (`kind: 'eoa'`, chain `evm`); session material stays on the
  user's device and BeeGreat never receives a private key.

## Confirmation gate (server-side)

Anything that moves funds is two-phase via the `web3Actions` table:

1. The agent calls a `prepare_*` tool (`prepareSendTokens`,
   `prepareSocketSwap`, `prepareSugarExecution`, or linked-wallet execution), which validates, builds
   the plan server-side, and stores a `pending` action. Nothing is signed.
   Every confirmation lives for the full 10-minute action TTL; Socket quotes
   only live ~60s, so if the quote is stale at execution time the executor
   re-fetches a fresh route and `refreshSocketRoute` refuses any route that
   guarantees less than the confirmed minimum output.
2. Bee renders a `confirm` component with payload
   `{"web3ActionId":"<actionId>"}`. A signed-in app calls
   `web3Actions.confirm`; the trusted iMessage bridge can submit the same
   action-bound decision only after an exact yes/no reply to the latest Web3
   confirmation. The bridge renders the canonical Convex summary/status and
   submits that summary with the action id, preventing model copy from being
   used to disguise or substitute a different pending action. Both paths share
   ownership, expiry, entitlement, and one-time pending checks before
   `web3.executeConfirmedAction` is scheduled.
3. The agent polls `check_web3_action` for status, hashes, and explorer links.
   Socket actions remain `in_progress` after the source transaction and only
   become `executed` when Socket reports destination completion. Refunds are
   surfaced separately.

Every pending action has a scheduled expiry mutation; expiry is therefore a
durable state transition rather than a read-time illusion. Execution,
submission, and settlement timestamps provide low-cardinality stage timing.
Terminal transitions wake the originating Bee conversation and, when that
origin is iMessage, enqueue a lease-based outbound delivery.

Ordinary agent chat can never move funds: the agent has no confirm/execute path.
The iMessage exception lives outside the agent loop and is bound to the exact
action id and server-owned summary in the latest rendered confirmation, so
prompt injection cannot select, disguise, or execute arbitrary calldata.

Linked EOAs use a client-signer branch of the same gate. Bee prepares an
allowlisted Sugar plan pinned to the verified address and chain. The signed-in
web/mobile client claims that exact pending action, switches the connected
wallet to the required chain, submits each transaction in order, and records
the returned hashes in Convex. EOA actions are never eligible for YOLO mode,
the Crossmint server signer, or iMessage confirmation; each transaction stays
visible in the user's wallet approval UI. A submitted hash is not success:
web/mobile record it as `submitted`, wait for a successful receipt, and only
then record that step as `success`. The action settles after the final action
receipt, so a reverted or rejected later step cannot be reported as complete.

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

When Socket requires ERC-20 approval, the approval calldata and exact quoted
route calldata are prepared as one ordered Crossmint `calls[]` batch. Its
operation id is persisted before approval; a scheduled reconciler resumes a
pending Crossmint operation after timeout or restart. Only successful origin
settlement starts Socket destination polling, which continues independently to
`COMPLETED`, `REFUNDED`, `FAILED`, or `EXPIRED`.

Power-up entitlement loading retains the last verified definition snapshot
during a transient Convex failure. A successful empty entitlement result still
removes the specialist on the next turn, so availability does not flap while
user disablement remains immediate.

## Action coverage

Wallet tools: `get_wallets`, `create_wallet`, `get_wallet_balance`,
`get_wallet_activity`, `fund_wallet` (staging USDXM faucet only),
`quote_cross_chain_swap`, `prepare_cross_chain_swap`, `prepare_send_tokens`,
`prepare_sugar_execution`, `prepare_linked_wallet_execution`,
`check_web3_action`.

Sugar read tools: `sugar_pools`, `sugar_positions`, `sugar_epochs_latest`,
`sugar_epochs`, `sugar_quote`.

Sugar unsigned-plan builders (default the linked EOA): `sugar_swap`,
`sugar_deposit`, `sugar_withdraw`, `sugar_stake`, `sugar_unstake`,
`sugar_claim_emissions`, `sugar_claim_fees`. Plans are
`{transactions, ...context}` JSON — an ordered `{from,to,data,value}` list
plus quote context (swap: quoted/minimum output and price impact; deposit
and withdraw: quoted token amounts; position actions: the position id and
pool). The bridge has no private-key input, and the prepare_* confirmation
summary includes the quoted outcome so the user sees the expected result
before signing.

`prepare_sugar_execution` accepts only the seven transaction actions
(`SUGAR_TX_ACTIONS` in `packages/sugar/src/contracts.ts`), rebuilds the plan
server-side with the chain pinned to Base (8453) and the wallet pinned to the
smart wallet, so the agent can never inject raw calldata. Execution is mainnet
only — Aerodrome has no public testnet deployment.

Immediately before signing, the executor rebuilds the semantic Sugar intent
and re-checks the output/deposit/withdrawal/veNFT bounds captured by the user's
confirmation. Its prerequisite approvals and final action are submitted as one
ordered Crossmint `calls[]` transaction. This makes the intent all-or-nothing,
uses one durable Crossmint operation id, and avoids stale quotes or allowances
between separate approval transactions. State-dependent lifecycle actions
(deposit, stake, withdraw, swap-back) remain separate semantic intents.

Cold Convex action isolates persist the verified Sugar pool offset in
`sugarPoolLocators`. Each SDK client checks `all(1, offset)` on-chain before
using it and invalidates a stale row, so common position actions avoid a full
Aerodrome pool-catalog scan without trusting derived data.

`prepare_linked_wallet_execution` applies the same server-side allowlist but
pins the plan to the verified EOA and selected supported Sugar chain. The
client then submits it through WalletConnect after explicit confirmation.

Sugar reads support Optimism (`10`), Base (`8453`), Unichain (`130`), Lisk
(`1135`), Mode (`34443`), Fraxtal (`252`), Ink (`57073`), Soneium (`1868`),
Superseed (`5330`), and Celo (`42220`).

Creating a new Aerodrome pool uses the `deposit` action without a `pool`
address. Pass `token0`, `token1`, and `pool_type`; new basic pools require both
seed amounts, while CL pools also require tick spacing and their range/initial
price inputs. Smart-wallet execution uses the action-bound app/iMessage gate;
linked-wallet execution stays app-only and requires wallet approval.

## Runtime layout

The Flue powerup (`packages/agent/src/shared/powerups/web3.ts`) talks to two
authenticated HTTP routes on the Convex deployment, both guarded by
`AGENT_CREDENTIAL_BROKER_SECRET`:

- `POST /internal/web3/sugar` — allowlisted Sugar reads and unsigned plans.
- `POST /internal/web3/wallet` — wallet ops (`op` field, see
  `WEB3_WALLET_OPS` in `packages/backend/convex/http.ts`), including pending
  linked-wallet plan preparation and action status.

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

Create a public Reown project id at `https://dashboard.reown.com`, allow the
BeeGreat web/mobile domains, and configure it as `VITE_REOWN_PROJECT_ID` for
the web app and `EXPO_PUBLIC_REOWN_PROJECT_ID` in EAS environments. These ids
are intentionally public; no Reown secret belongs in either client.

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

### Atomic Base mainnet verification (2026-08-08)

The Francesco Oddo Crossmint wallet completed and unwound the WETH/AERO
lifecycle under the $5 cap. Approval-dependent operations were verified as
single smart-wallet transactions:

- deposit, 2 calls: `0x7e1fcd2e603cce71db23dd5e873a4e9adc21edb4d71a35135ad10a287e8232a9`;
- stake, 2 calls: `0x178f254a3a0a27316fee1e431f9329f78ec0f79af336d41b1a7b32ee3f2b791d`;
- withdraw, 2 calls: `0x0c17f199ecbd9079dec427ff9718319bfa15621537a615cb48b8f0a3710bc6fb`;
- AERO-to-ETH cleanup, 3 calls: `0x02d355689c7a2aa28907222571da8e49b1d07ff29ce872fcb786d40bb2a8a81f`.

The final audit found zero liquid AERO, WETH, LP liquidity, staked LP, and
relevant allowances. Net ETH spent was `0.000005496705892972`; existing veNFT
`#130435` remained locked with `2.281406549154201269 AERO`.
