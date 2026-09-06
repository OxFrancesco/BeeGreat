# Web3 powerup: wallets, cross-chain swaps, confirmation gate, and Sugar

The Web3 specialist manages the user's wallets, routes Base ↔ Arbitrum swaps
through Socket V3, and exposes Velodrome/Aerodrome DeFi through the native
TypeScript Sugar SDK (`packages/sugar`).

## Independence and licensing

BeeGreat and its Sugar SDK are independent projects, not affiliated with,
endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance,
Dromos Labs, or Mellow Protocol. Names identify compatibility or source attribution;
third-party licenses still apply. See the [licensing review](../packages/sugar/README.md#licensing-review-2026-09-06)
for unresolved provenance and redistribution checks before release.

New CLI WalletConnect pairings identify BeeGreat's unofficial CLI and link to our
repository without the upstream Sugar logo. Existing pairings may retain cached
metadata until disconnected and paired again.

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

## Developer CLI wallet flow (aero)

### CLI and TUI responsiveness

The CLI reuses one Sugar client for token selection and action execution, so a
symbol lookup does not force execution to scan the same token catalog again.
Public reads such as pools and quotes do not open the local wallet or Keychain.
An explicit wallet or owner also avoids the wallet lookup for position reads.

TUI browse refreshes share a pending request, even when a scan exceeds the
60-second result TTL. The TTL starts when the request succeeds. An obsolete
request cannot delete a newer result or overwrite its disk snapshot. Ctrl+R
invalidates the shared SDK cache before a new scan. Quotes and transaction
plans bypass the result cache.

Token pickers keep keyboard selection aligned with the displayed filter,
including input and Enter received in the same batch. If loading the catalog
fails, Enter retries and opens the picker after recovery. Forms without token
fields do not request a token catalog.

These changes are local to Aero's CLI and TUI. Bee's web, mobile, iMessage,
voice, agent providers, and transaction contracts are unchanged.

### Terminal and wallet commands

The `aero tui` Analytics screen tags every metric with its source:
on-chain Sugar (TVL, epochs, locks), Dune Analytics (`DUNE_API_KEY`,
Hoodie Crew #7907454 and `dex.trades` SQL), and DefiLlama (fees, TVL
history, Slipstream vs v1). Charts use Bayer 8×8 ordered dither plus
braille sub-pixel line charts (2×4 dots per cell), donuts, calendar
heatmaps, waterfalls, and scatter quadrant maps. Reports are cached
per session with a 60s stale-while-revalidate window; `ctrl+r` forces a
cold reload.

TUI browse data (pools, positions, epochs, token catalog) and the analytics report also
persist to disk snapshots under `~/.cache/aero/snapshots` (`AERO_CACHE_DIR`
overrides), so a relaunch renders instantly from the last dataset — badged
with its age — while the live scan refreshes in the background. Snapshots
never feed quotes or transaction building. With a pinned RPC
(`SUGAR_RPC_URI_<chainId>`) the TUI raises scan concurrency to 16 and warms
caches in parallel.
The TUI runs scans, quotes, unsigned plan construction, analytics, and snapshot
I/O in one background worker. React rendering and keyboard input stay on the
main thread. The worker owns the shared caches, forwards RPC progress, and
stops when the TUI exits. If it crashes, pending screens show an error and the
next request starts a new worker. Failed worker requests are not replayed automatically.

The logo follows the renderer's 60 fps clock using elapsed time, so delayed
frames do not stretch the animation. The render loop stops between sweeps.
`bun run --cwd packages/sugar test:performance` measures three live launches
and fails if intro frame gaps exceed 80 ms or their 95th percentile exceeds
34 ms. `bun run --cwd packages/sugar build` emits `dist/cli.js` and the required
`dist/worker.js`. Keep both files together when distributing that build.

This is CLI-local — the agent bridge, Bee chat, and mobile/web clients
are unchanged.

The `packages/sugar` CLI (`sugar-ts`, alias `aero`) has an optional
wallet-connected flow for developers: WalletConnect pairing (the wallet app
signs; no key material reaches the CLI) or a local wallet whose mnemonic is
sealed with scrypt + AES-256-GCM and stored in the macOS Keychain. It shows a
plan summary and asks for confirmation before broadcasting (`--yes`,
`--dry-run`). This is strictly CLI-local: the agent bridge
(`/internal/web3/sugar`) still receives only unsigned plans, the
`validateSugarRequest` boundary is unchanged, and the app confirmation gate
is not bypassed. See `packages/sugar/README.md` for usage.

### Self-hosted ALM daemon (aero serve)

`aero serve` is a CLI-local keeper that auto-rebalances the developer's
concentrated (Slipstream) positions the way Aerodrome's official ALM vaults
do — it reimplements Mellow Protocol's PulseStrategyModule off-chain
(`packages/sugar/src/alm/`): `original` (recenter same width),
`lazy-syncing` / `lazy-ascending` / `lazy-descending` (swap-free adjacent
repositioning), and `expand` (Pulse V2 widening with a reset width limit).
Mellow's production widths per tick spacing are the defaults.

- `aero alm init` scaffolds `~/.config/sugar-ts/alm.json` from the wallet's
  CL positions; `aero alm status` reports tick/range/gate state; `aero serve`
  polls each pool's `slot0` (default 30s) and acts.
- A rebalance runs in phases, each rebuilt from fresh chain state: claim
  emissions → unstake → withdraw+burn → swap to the new interval ratio →
  deposit → stake. Emissions above a threshold are compounded back in
  (claim → swap → `increaseLiquidity`, at most daily).
- Safety rails: dry-run by default (`--execute` to sign), local encrypted
  wallet only (WalletConnect cannot approve unattended), every phase is
  simulated via `eth_simulateV1` before signing (refuses to broadcast when
  the RPC lacks it unless `--allow-unsimulated`), Mellow-style TWAP
  deviation guard via pool `observe()`, per-position cooldown plus a rolling
  daily rebalance cap persisted in `~/.config/sugar-ts/alm-state.json`, and
  optional buddytg Telegram notifications (`"telegram": true`).

Safe keeper execution and `aero alm safe-setup` are disabled for 0.1 pending
on-chain permission verification. Safe observation in dry-run remains available.
The former policy allowed unrestricted router command bytes. This update does
not revoke deployed roles; Safe owners must review and revoke the old keeper
membership or disable the Roles module. The Zodiac reference remains at
`resources/zodiac-roles` for the future restricted executor design.

EOA ALM execution is experimental pending fork tests. Both rebalance and
compound transactions check TWAP immediately before submission, including after
approvals. Local fallback weights elapsed time, requires the full window and
rejects gaps longer than two poll intervals. It remains a sampled estimate.

Cycles persist chain/wallet/pool identity, original and replacement NFT IDs,
intended range, balance baselines and phase journal IDs. Transaction journals
persist hashes and receipt outcomes. Atomic synced writes and an exclusive
state-file lock prevent partial state writes and overlapping local ALM passes.
Corrupt state blocks execution. Rebalance attempts consume cooldown/daily limits
at cycle start; compound attempts start the 24-hour delay. Failed attempts count.

ALM config entries accept `positionId` as a decimal string. `aero alm init
--position-id <id>` selects one NFT when several share a pool. Each pool has one
managed NFT; successful rebalances persist its replacement ID across restarts.
Manual recovery accepts `--position-id <repaired-id>` and verifies a funded NFT
owned by the same wallet in the same pool before updating that identity.

After interruption, known hashes are reconciled but phases are not automatically
replayed. The wallet and chain remain blocked even if the old NFT was burned:

- `aero alm status` shows unresolved cycles before querying positions.
- `aero alm recover --id <cycle-id>` checks receipts without signing.
- After repairing the position manually, `aero alm resolve --id <cycle-id>
  --note <verified-outcome>` asks for confirmation, cancels unsent remainder and
  permits future cycles without resetting attempt limits.

Unknown or pending submissions prevent resolution. A send without a known hash,
missing/corrupt journals or stale locks needs operator investigation, not a blind
retry. Automatic phase continuation, multi-host coordination and concurrent
external trading in the managed wallet are unsupported. The release analysis in
`artifacts/aero-0.1-review.md` lists the outstanding fork and recovery checks.

This is deliberately CLI-only: the agent bridge, `SUGAR_ACTIONS`, and the
app confirmation gate are untouched — Bee's own web3 tools never sign, and
the daemon never crosses the Convex boundary. `aero guide alm` has the
user-facing walkthrough.

Run the focused checks with Bun:

```sh
bun run --cwd packages/sugar test
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

CLI and TUI swap confirmations show both resolved asset addresses before signing.
WalletConnect uses one client per process and checks the current session against
the exact sender, chain and transaction permission before every submission.
Session expiry, deletion and account changes invalidate the local connection.
