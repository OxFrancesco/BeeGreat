---
title: veNFTs
description: Read veNFT locks and build lock, vote, reward, rebase and managed veNFT transactions, plus pool incentives on any chain.
group: SDK
---

## Supported chains

veNFTs exist on the two governance deployments, Base (AERO locks) and OP Mainnet (VELO locks). `supportsVeNfts()` returns `true` on those chains. On every other chain the veNFT methods throw `veNFTs are not supported on <chain>` before making any RPC call.

Pool incentives are different. `getPoolRewardContracts` and `incentivizePool` work on every supported chain.

## Read locks

```ts
import { SugarClient } from '@beegreat/sugar'

const sugar = new SugarClient(8453, { account: '0xYOUR_ADDRESS' })

const locks = await sugar.getVeNfts()
const lock = await sugar.getVeNft(123n)
```

`getVeNfts(owner = account)` lists an owner's veNFTs. `getVeNft(id)` reads any veNFT by ID, whoever owns it, and returns `undefined` for an unknown ID.

A `VeNft` has these fields.

| Field | Meaning |
| --- | --- |
| `id`, `owner` | Token ID and current owner |
| `lockedAmount` | Governance tokens locked, as bigint |
| `votingPower`, `governancePower` | Current voting and governance power, as bigint |
| `claimableRebase` | Rebase ready to claim, as bigint |
| `expiresAt`, `votedAt` | Unix timestamps in seconds |
| `votes` | The pools it votes for, as `{ pool, weight }` entries |
| `permanent` | Whether the lock is permanent |
| `delegateId`, `managedId` | The delegate veNFT and the managed veNFT it sits in, as IDs |
| `state` | `normal`, `locked` or `managed` |
| `governanceToken`, `decimals` | The locked token's address and decimals |

`getVeNftContracts()` returns the `voter`, `votingEscrow`, `governanceToken`, `rewardsDistributor` and `veSugar` addresses for the chain.

## Lock lifecycle

Amounts are bigint values in governance token units. AERO and VELO both use 18 decimals.

| Method | Builds |
| --- | --- |
| `createVeNft(amount, lockDurationSeconds)` | A governance token approval when needed, then `createLock` |
| `increaseVeNftAmount(id, amount)` | An approval when needed, then `increaseAmount` |
| `extendVeNftLock(id, lockDurationSeconds)` | `increaseUnlockTime` |
| `withdrawVeNft(id)` | `withdraw` |
| `mergeVeNfts(fromId, intoId)` | `merge`. The two IDs must differ |
| `splitVeNft(id, amount)` | `split` |
| `setVeNftPermanent(id, permanent)` | `lockPermanent` when `true`, `unlockPermanent` when `false` |
| `delegateVeNft(id, delegateId)` | `delegate` |

Every call except the two approvals goes to the VotingEscrow contract. Before building, the SDK checks that IDs and amounts are positive and that durations are positive whole seconds. `delegateId` may be `0n`.

The VotingEscrow rounds the unlock time down to a whole week, and a lock cannot run longer than four years (126,144,000 seconds).

```ts
import { BaseChain, parseTokenUnits } from '@beegreat/sugar'

const oneYear = 365 * 24 * 60 * 60
const plan = await sugar.createVeNft(parseTokenUnits(BaseChain.aero, '100'), oneYear)
```

## Voting

```ts
const plan = await sugar.voteVeNft(123n, [
  { pool: '0xPOOL', weight: 1n },
])
```

| Method | Builds |
| --- | --- |
| `voteVeNft(id, votes)` | `vote` on the Voter |
| `resetVeNftVotes(id)` | `reset`, which removes the veNFT's votes |
| `pokeVeNftVotes(id)` | `poke`, which re-applies the same votes with the current voting power |

`votes` needs at least one entry, each pool at most once, and positive weights. Weights are relative. The Voter splits the veNFT's voting power across the pools in proportion to them.

The SDK does not check timing, but the Voter contract does, and a call at the wrong time reverts on-chain.

- Epochs start every Thursday at 00:00 UTC.
- After a veNFT votes or moves into a managed veNFT, it cannot vote, reset, or move into or out of a managed veNFT again until the next epoch.
- None of these calls, and no `poke`, work during the first hour of an epoch.
- During the last hour only whitelisted veNFTs can vote, and managed deposits are closed.

## Voting rewards

Voters earn the fees and incentives of the pools they vote for.

```ts
const rewards = await sugar.getVeNftRewards(123n)
const claim = await sugar.claimVeNftRewards(123n)
```

`getVeNftRewards(id, pool?)` returns `VeNftReward` entries with `pool`, `token`, `amount`, `feeVotingReward` and `incentiveVotingReward`. Pass a pool address to read one pool.

`claimVeNftRewards(id, pool?)` keeps the rewards with a non-zero amount and builds up to two Voter transactions, `claimBribes` for incentives and `claimFees` for fees. It returns an empty list when there is nothing to claim.

## Rebases

| Method | Returns |
| --- | --- |
| `getVeNftRebase(id)` | The claimable rebase as bigint |
| `claimVeNftRebase(id)` | A `claim` transaction on the RewardsDistributor |
| `claimVeNftRebases(ids)` | One `claimMany` transaction. IDs must be unique and the list not empty |

## Managed veNFTs

| Method | Builds |
| --- | --- |
| `depositVeNftIntoManaged(id, managedId)` | `depositManaged` on the Voter. The two IDs must differ |
| `withdrawVeNftFromManaged(id)` | `withdrawManaged` on the Voter |

Both follow the Voter's epoch rules listed under [Voting](/docs/aero/sdk-venft#voting).

## Pool incentives

Anyone can add an incentive to a pool. Voters for that pool earn it.

```ts
import { BaseChain, parseTokenUnits } from '@beegreat/sugar'

const pool = await sugar.getPoolByAddress('0xPOOL')
if (!pool) throw new Error('pool not found')

const plan = await sugar.incentivizePool(pool, BaseChain.usdc, parseTokenUnits(BaseChain.usdc, '50'))
```

`incentivizePool(pool, token, amount)` finds the pool's incentive reward contract, adds an ERC-20 approval when the allowance is too low, and returns the `notifyRewardAmount` transaction. The pool needs a gauge, the token must be on the client's chain and the amount must be positive. A native token entry resolves to its wrapped contract, so the plan spends WETH, not ETH.

On Base, the reward contract reverts for a token the Voter has not whitelisted unless the token is already a reward for that pool.

`getPoolRewardContracts(pool)` returns the pool's `gauge`, `feeVotingReward` and `incentiveVotingReward` addresses. It reads `gaugeToBribe` on Base and OP Mainnet and `gaugeToIncentive` on the other chains.

## In the CLI

The `aero` CLI and TUI expose `create-venft`. Voting, lock changes, reward and rebase claims and incentives are SDK methods only. See the [CLI reference](/docs/aero/cli-reference).
