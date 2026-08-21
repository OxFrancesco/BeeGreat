# `@beegreat/sugar`

> ⚠️ **Vibecoded & early beta — use at your own risk.** This SDK and the
> `aero` CLI were vibecoded with AI agents and are in early beta. Expect
> rough edges and breaking changes. Always review unsigned plans
> (`--dry-run`) before signing, start with small amounts, and never risk
> funds you cannot afford to lose.

Native TypeScript port of Velodrome/Aerodrome's Sugar SDK. It uses Viem for
RPC reads and ABI encoding and never signs or broadcasts transactions.

## Standalone repository

This package is developed in the BeeGreat monorepo (`packages/sugar`) and
mirrored to [OxFrancesco/aerodrome-sdk-ts](https://github.com/OxFrancesco/aerodrome-sdk-ts)
(MIT). The monorepo is the source of truth; mirror after landing changes with
`bun run sugar:mirror` from the monorepo root. Standalone usage:

```sh
bun add github:OxFrancesco/aerodrome-sdk-ts   # as a dependency
# or work in a clone:
bun install && bun test && bun run typecheck
bun run cli -- pools --chain=8453 --pool-type=cl --limit=5
```

## Client API

```ts
import { SugarClient, parseTokenUnits } from '@beegreat/sugar'

const sugar = new SugarClient(8453, {
  account: '0xYourPublicWalletAddress',
})

const eth = await sugar.getToken('ETH')
const usdc = await sugar.getToken('USDC')
if (!eth || !usdc) throw new Error('token unavailable')

const quote = await sugar.getQuote(eth, usdc, parseTokenUnits(eth, '0.01'))
const unsignedTransactions = quote
  ? await sugar.swapFromQuote(quote)
  : []
```

`SugarClient` ports the Python chain surface:

- token, balance, pool, oracle-price, epoch, and position reads;
- mixed V2/V3 path discovery, quotes, and swaps;
- pool specs and basic/concentrated deposit quotes;
- deposit, withdrawal, stake, unstake, fee, and emission builders;
- native veNFT reads, lock lifecycle, voting, managed delegation, rebases, and voting-reward claims;
- pool voting-reward discovery and incentive funding;
- bridge fees, ICA reads, bridge transaction builders, and allowances.

Every transaction result is `{ from, to, data, value }`. `value` and other
on-chain integers are `bigint` in the SDK and decimal strings after JSON
serialization.

## veNFTs and voting rewards

Native veNFT management is available on the two governance-root deployments:
Optimism (Velodrome) and Base (Aerodrome). Superchain leaf deployments support
pool gauges and voting incentives, but do not expose a local VotingEscrow; veNFT
methods reject locally on those chains instead of returning unusable calldata.

```ts
const sugar = new SugarClient(8453, { account: wallet })

const locks = await sugar.getVeNfts()
const pools = await sugar.getPools()
if (!locks[0] || !pools[0]) throw new Error('veNFT or pool unavailable')
const create = await sugar.createVeNft(amount, 4 * 365 * 24 * 60 * 60)
const vote = await sugar.voteVeNft(locks[0].id, [
  { pool: pools[0].lp, weight: 1n },
])
const rewards = await sugar.getVeNftRewards(locks[0].id)
const claims = await sugar.claimVeNftRewards(locks[0].id)
const rebase = await sugar.claimVeNftRebase(locks[0].id)
```

The lifecycle surface also includes `getVeNft`, `increaseVeNftAmount`,
`extendVeNftLock`, `withdrawVeNft`, `mergeVeNfts`, `splitVeNft`,
`setVeNftPermanent`, `delegateVeNft`, `resetVeNftVotes`, `pokeVeNftVotes`,
`depositVeNftIntoManaged`, `withdrawVeNftFromManaged`, and batched rebase claims.

Pool incentive funding is chain-agnostic. `incentivizePool(pool, token, amount)`
resolves the correct BribeVotingReward/IncentiveVotingReward contract for the
chain, adds an ERC-20 approval only when required, and returns the unsigned
`notifyRewardAmount` transaction. Existing `stake`, `unstake`,
`claimEmissions`, and `claimFees` methods continue to manage LP rewards.

## CLI-compatible action seam

The Web3 power-up uses the same twelve action names as the former Python CLI:

```ts
import { executeSugarActionJson } from '@beegreat/sugar'

const output = await executeSugarActionJson('pools', {
  chain: 8453,
  pool_type: 'cl',
  limit: 10,
})
```

Supported actions are `deposit`, `positions`, `pools`, `epochs_latest`,
`epochs`, `withdraw`, `stake`, `unstake`, `claim_emissions`, `claim_fees`,
`quote`, and `swap`.

The same actions are available from the Bun CLI:

```sh
bun run --cwd packages/sugar cli -- pools --chain 1135 --limit 1
bun run --cwd packages/sugar cli -- quote --chain 1135 \
  --from-token ETH --to-token USDT --amount 0.001 --use-decimals
```

The `sugar-ts` package bin exposes that entrypoint to workspace consumers
(`aero` is an alias). The SDK layer only returns JSON reads and unsigned
transactions; signing lives exclusively in the CLI wallet flow below.

### Analytics TUI (`aero tui`)

`aero tui` → **Analytics** is a [Dune Analytics](https://dune.com) dashboard
for Aerodrome ve(3,3) mechanics. Charts are a terminal port of
[dither-kit](https://www.tripwire.sh/dither-kit) (Bayer 8×8 ordered
dither: gradient, hatched, dotted, solid).

| Tab | What it shows |
| --- | --- |
| Health | E/R, net income, voter revenue, Slipstream vs v1 fees, TVL mix, volume/TVL |
| Flywheel | RPV per 10k ve, bribe ROI, epoch scorecard, hold vs LP vs lock+vote |
| Trade | Base DEX share, Slipstream vs legacy volume, ranked pools |
| Token | Lock rate, real yield, P/S and P/F |
| Arena | Side-by-side vs Uniswap / Pancake on the same chain |

On-chain reads use the same Sugar client as the rest of the TUI.
Each number is tagged with its source:

- **Sugar** — live on-chain TVL, pools, epochs, ve locks
- **Dune Analytics** — [Hoodie Crew RPV #7907454](https://dune.com/queries/7907454)
  and `dex.trades` SQL (weekly volume, Base share)
- **DefiLlama** — fees, TVL history, Slipstream vs v1, mcap / P/S

Set `DUNE_API_KEY` (or `SUGAR_DUNE_API_KEY`) from
[dune.com/settings/api](https://dune.com/settings/api). Without a key the
screen still shows the live on-chain snapshot. `aero guide analytics` is
the walkthrough.

### Wallet-connected CLI (aero)

The interactive CLI is built on `effect/unstable/cli`: every action is a
typed subcommand with described flags (`aero <command> --help`), any command
can be filled in interactively with `--wizard`, shell completions are
generated with `aero --completions zsh|bash|fish`, and `aero guide <topic>`
prints in-terminal walkthroughs (getting-started, wallet, swap, liquidity,
staking, rewards, venft, alm, chains, completions).

The CLI can connect a wallet and broadcast the plans it builds:

```sh
aero wallet connect      # WalletConnect: QR pairing with an extension/mobile wallet
aero wallet create       # new local wallet; mnemonic sealed with scrypt + AES-256-GCM
aero wallet restore      # import an existing mnemonic into the encrypted store
aero wallet status       # active wallet and source
aero wallet disconnect   # drop the WalletConnect session
aero wallet remove       # delete the local encrypted wallet (confirmed)

aero swap --from-token ETH --to-token USDC --amount 0.1 --use-decimals
```

Every command defaults `--chain` to Base (8453, Aerodrome). Transaction
actions (`swap`, `deposit`, `withdraw`, `stake`, `unstake`, `claim-emissions`,
`claim-fees`, `create-venft`) fill `--wallet` from the active wallet, print a
human summary, and ask for confirmation before broadcasting each step
(approvals first, receipts awaited). `--yes` skips the prompt; `--dry-run`
always prints the unsigned plan. Without a wallet the CLI prints unsigned
JSON.

Wallet security: WalletConnect wallets sign in-app, so no key material ever
reaches the CLI. Local wallets keep the mnemonic sealed with scrypt +
AES-256-GCM; the ciphertext lives in the macOS Keychain (generic password,
iCloud Keychain syncable) with a `0600` file fallback elsewhere, and the
plaintext mnemonic is shown once at creation and never written to disk.
Environment: `WALLETCONNECT_PROJECT_ID` (optional override of the built-in
public Reown project id), `SUGAR_WALLET_PASSPHRASE` (non-interactive local
signing), `SUGAR_WALLET_DIR` / `SUGAR_WALLET_NO_KEYCHAIN` (storage overrides).

### Self-hosted ALM (aero serve)

`aero serve` watches the configured concentrated positions and rebalances
them like Aerodrome's ALM vaults — the strategy layer (`src/alm/`) is an
off-chain reimplementation of Mellow's PulseStrategyModule (`original`,
`lazy-syncing`, `lazy-ascending`, `lazy-descending`, and the Pulse V2
`expand`), with Mellow's production widths as defaults.

```sh
aero alm init            # scaffold ~/.config/sugar-ts/alm.json from your CL positions
aero serve               # dry-run daemon: logs/notifies what it WOULD do
aero serve --execute     # unlock the local wallet and rebalance for real
aero serve --once        # single pass, for cron
aero alm status          # tick, range, and gate status per managed position
```

Safety: dry-run is the default; `--execute` requires the local encrypted
wallet (WalletConnect cannot approve unattended); every phase is simulated
via `eth_simulateV1` before signing (an RPC without it blocks broadcasting
unless `--allow-unsimulated`); rebalances pass a Mellow-style TWAP deviation
guard, a per-position cooldown, and a rolling daily cap persisted in
`alm-state.json`; `"telegram": true` sends buddytg push notifications.
`AERO_ALM_CONFIG` overrides the config path. See `aero guide alm`.

**Safe mode** (`aero alm safe-setup --safe 0x...`): keep the positions in a
Safe and let a low-privilege keeper key rebalance through a Zodiac Roles
Modifier v2 (`src/alm/roles.ts`). The generated Transaction Builder batch
deploys the Roles proxy, enables it as a module, assigns the keeper, and
scopes the role so mint/collect recipients are pinned to the Safe
(EqualToAvatar), the NFT can only be approved to the pool gauges, ERC20
approvals only go to the NFPM/Permit2, and ether/delegatecall are forbidden.
`aero serve` picks up the `safe` section in `alm.json` and executes via
`execTransactionWithRole`; a leaked keeper key cannot move funds out.
Safe mode is ERC20-only (no native legs) and disables auto-compounding.

## Chain clients

`OPChain`, `BaseChain`, `LiskChain`, `UniChain`, `ModeChain`, `FraxtalChain`,
`InkChain`, `SoneiumChain`, `SuperseedChain`, and `CeloChain` mirror the
Python chain-specific classes. `getChain`, token-based factories, async-name
aliases, and Lisk/Uni Supersim clients are exported as well.

## Superswap

`Superswap` ports the OP/Lisk/Uni cross-chain quote and unsigned transaction
flow. If a destination ICA relay is required, the returned result includes
`swapData`; pass the commitment transaction hash to `result.relayArgs(...)`
and then to a `SuperswapRelayer`.

## Configuration

The defaults and environment names match the Python SDK. Per-chain overrides
use names such as `SUGAR_RPC_URI_8453`, `SUGAR_SWAP_SLIPPAGE_8453`, and
`SUGAR_CONNECTOR_TOKENS_ADDRS_8453`; un-suffixed global values are also
accepted. Constructor options take precedence over environment values.

Supported chain IDs: 10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220,
and 57073. Local Supersim settings are available for Uni (130, port 4446) and
Lisk (1135, port 4445).

### RPC resilience

Sugar keeps its public interface Promise-based while using Effect internally
for RPC deadlines, retry classification, and bounded read concurrency. The
SDK-owned HTTP transport disables Viem retries so one policy owns all attempts.
By default, idempotent reads receive up to three retries with 150ms exponential
backoff inside a 120-second total deadline. Numeric and HTTP-date `Retry-After`
headers are honored without extending that deadline. Multi-stage reads share one
budget across pagination count/pages and quote multicall/fallback work; exhausted
rate limits and transport failures are not amplified through the quote fallback.

Callers can tune this with plain TypeScript options (no Effect types cross the
SDK interface):

```ts
const sugar = new SugarClient(8453, {
  onRpcEvent: (event) => telemetry.record(event),
  rpcPolicy: {
    maxRetries: 2,
    baseDelayMs: 250,
    deadlineMs: 60_000,
  },
})
```

`onRpcEvent` is optional and silent by default. It reports operation/phase,
duration, aggregate attempts, and pagination item/page counts without wallet
addresses or calldata. Pass the same callback in the options to
`createSugarFailoverTransport(rpcUrls, { onRpcEvent })` to record whether a
backup RPC endpoint was used; endpoint URLs are not included.

Expected RPC failures reject with `SugarRpcError`, whose `code` is one of
`RPC_TIMEOUT`, `RPC_RATE_LIMITED`, `RPC_UNAVAILABLE`, or `RPC_READ_FAILED`.
The original Viem error remains available as `cause`.

Addressed pool and position reads can avoid a cold global pool scan by
providing a durable `poolLocatorStore`. A stored offset is never trusted
blindly: every new client verifies it with `Sugar.all(1, offset)` and deletes
it before falling back to discovery when the pool no longer matches.

```ts
const sugar = new SugarClient(8453, {
  poolLocatorStore: {
    get: (key) => database.poolOffsets.get(key),
    set: (key, locator) => database.poolOffsets.set(key, locator),
    delete: (key) => database.poolOffsets.delete(key),
  },
})
```

The store is an optimization only. Store errors fall back to verified on-chain
reads and cannot make Sugar unavailable.

When injecting a custom `transport` or `publicClient`, configure its own retry
count to zero if Sugar should remain the sole retry owner. Effect can interrupt
its wait and sibling retry fibers at the deadline, but the underlying transport
may continue until its own timeout. An injected client is responsible for
physically aborting its network request when it supports cancellation.

## Headless verification

```sh
bun run --cwd packages/sugar test:headless
```

This runs the TypeScript CLI end to end against Lisk by default: a pool read,
an ETH-to-USDT quote, and unsigned swap construction. It never broadcasts.
Override `SUGAR_HEADLESS_CHAIN_ID`, `SUGAR_HEADLESS_RPC_URL`, token names,
amount, or public wallet address as needed. The upstream SDK does not ship a
public testnet deployment; its supported test environment is local Supersim,
so point `SUGAR_HEADLESS_RPC_URL` at the appropriate fork when it is running.
