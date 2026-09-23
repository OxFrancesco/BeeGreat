---
title: Liquidity
description: Read pools, epochs and positions, then build deposit, withdraw, stake, unstake and claim transactions.
group: SDK
---

The examples on this page use a `sugar` client created with an `account`, as shown in [Client](/docs/aero/sdk-client#create-a-client).

## Pools

```ts
const pools = await sugar.getPools()
const pool = await sugar.getPoolByAddress('0xPOOL')
```

| Method | Returns |
| --- | --- |
| `getPools()` | Every pool as a `LiquidityPool` with tokens, reserves, prices, TVL, emissions and APR |
| `getPoolsForSwaps()` | A lighter `LiquidityPoolForSwap` list with address, type, token addresses and factory |
| `getPoolByAddress(address)` | One `LiquidityPool`, or `undefined` |
| `getPoolCount()` | The number of pools Sugar reports |

`getPools()` pages through every pool on the chain and prices every token, so it is the slowest read in the SDK. The result is cached for 120 seconds. `getPoolByAddress` loads only that pool and its tokens.

`type` encodes the pool kind. `-1` is a volatile basic pool, `0` is a stable basic pool, and a positive number is a concentrated liquidity (CL, Slipstream) pool whose tick spacing is that number. `isCl` and `isStable` say the same thing as booleans. `symbol` follows the same scheme, with a `vAMM-` prefix for volatile pools, `sAMM-` for stable pools and `CL` plus the tick spacing for CL pools, such as `CL100-WETH/USDC`.

Other useful fields are `lp` (the pool address), `token0`, `token1`, `reserve0`, `reserve1`, `gauge`, `gaugeAlive`, `tvl`, `apr`, `poolFee`, `weeklyEmissions`, `tick`, `sqrtRatio` and `nfpm`, the position manager for CL pools. Reserves, fees and emissions are `Amount` objects with `token`, `amount` (bigint), `decimal`, `price` and `amountInStable`.

## Epochs

Epochs are the weekly voting periods. Each epoch records the votes a pool received and the fees and incentives it paid out.

```ts
const latest = await sugar.getLatestPoolEpochs()
const history = await sugar.getPoolEpochs('0xPOOL', 0, 10)
```

`getLatestPoolEpochs()` returns the latest epoch of each pool that Sugar reports. `getPoolEpochs(lp, offset = 0, limit = 10)` returns one pool's history.

A `LiquidityPoolEpoch` has `ts` and `epochDate`, the pool address `lp` and hydrated `pool`, `votes` and `emissions` as bigint, `fees` and `incentives` as `Amount` lists, and `totalFees` and `totalIncentives` in the stable token.

## Positions

```ts
const mine = await sugar.getPositions()
const theirs = await sugar.getPositions('0xOWNER')
const one = await sugar.getPositionById(123n)
```

`getPositions(owner = account)` returns basic and CL positions, staked and unstaked. Unstaked CL NFTs are read through Sugar's `positionsUnstakedConcentrated`, so a CL position you just minted shows up before you stake it.

| Method | Returns |
| --- | --- |
| `getPositionById(id, owner?, pool?)` | The position with that NFT ID, or `undefined`. Passing the pool avoids a scan of every pool |
| `getPositionsByPool(pool, owner?)` | The owner's positions in one pool |
| `getPositionByPool(pool, owner?)` | The single position in that pool. Throws when the owner has several, so use the NFT ID instead |

A `Position` has `id`, `pool`, `liquidity`, `staked`, `amountToken0`, `amountToken1`, `stakedToken0`, `stakedToken1`, `unstakedEarned0` and `unstakedEarned1` (trading fees owed), `emissionsEarned`, `tickLower`, `tickUpper`, `isCl`, `isInRange` and `isAlm`. Basic pool positions have `id` of `0n`, so select them by pool.

Staked positions earn gauge emissions. Unstaked positions earn trading fees. A position must be unstaked before you withdraw from it or claim its fees.

## Deposits

A deposit takes two steps. Quote the amounts, then build the plan from the quote.

### Basic pools

```ts
import { parseTokenUnits } from '@beegreat/sugar'

const pool = await sugar.getPoolByAddress('0xPOOL')
if (!pool) throw new Error('pool not found')

const quote = await sugar.quoteBasicDeposit(pool, {
  amountToken0: parseTokenUnits(pool.token0, '100'),
})
const plan = await sugar.deposit(quote)
```

Pass exactly one of `amountToken0` and `amountToken1`. The router quotes the other side at the pool's current ratio.

### Concentrated pools

```ts
const quote = await sugar.quoteConcentratedDeposit(pool, {
  amountToken0: parseTokenUnits(pool.token0, '0.1'),
  priceLower: 2200,
  priceUpper: 2800,
})
const plan = await sugar.deposit(quote, 30, 0.01)
```

- Pass exactly one amount. The quote reads the other amount on-chain for your range.
- Give the range as prices (`priceLower`, `priceUpper`) or as ticks (`tickLower`, `tickUpper`), not both. Prices are token1 per token0, and the SDK converts them to the nearest ticks that are multiples of the pool's tick spacing. Ticks you pass must already be multiples of it.
- `initialPrice` is required for a pool that has no price yet and rejected for any other pool.

### Build the deposit

`deposit(quote, deadlineMinutes = 30, slippage = 0.01)` returns an ERC-20 approval for each leg whose allowance is too low, then the deposit itself. CL deposits mint an NFT through the position manager. Basic deposits call `addLiquidity` on the router. Minimum amounts on both sides come from `slippage`, and the transaction expires `deadlineMinutes` after you build it.

Pools list WETH as an ERC-20, so a deposit into a WETH pool spends WETH. To deposit ETH instead, replace that leg with the native token, for example `{ ...pool, token0: BaseChain.eth }` when `token0` is WETH. The plan then sends the ETH as `value` and skips that approval.

### Create a pool

`poolSpec(token0, token1, options)` describes a pool that does not exist yet. Pass `{ tickSpacing }` for a CL pool or `{ stable }` for a basic pool. The tokens must be sorted by contract address, using the wrapped address for the native token. A deposit built from that spec creates the pool. In this example `tokenA` and `tokenB` are two `Token` values already in that order.

```ts
const spec = await sugar.poolSpec(tokenA, tokenB, { stable: false })
const quote = await sugar.quoteBasicDeposit(spec, {
  amountToken0: parseTokenUnits(tokenA, '10'),
  amountToken1: parseTokenUnits(tokenB, '25'),
})
const plan = await sugar.deposit(quote)
```

A new basic pool needs both amounts, which set its starting price. A new CL pool needs `initialPrice` in `quoteConcentratedDeposit`.

## Withdrawals

```ts
import { withdrawalFromPosition } from '@beegreat/sugar'

const position = await sugar.getPositionById(123n)
if (!position) throw new Error('position not found')

const withdrawal = withdrawalFromPosition(position, { fraction: '0.5' })
const plan = await sugar.withdraw(withdrawal)
```

`withdrawalFromPosition(position, options)` turns a position into a withdrawal. `fraction` is above 0 and at most 1, and defaults to 1, everything. `burn: true` also burns the CL NFT and needs a fraction of 1. It throws for a position with no liquidity.

`withdraw(withdrawal, deadlineMinutes = 30, slippage = 0.01, collect = true, unwrapNative = false)` builds the plan.

- Basic pools get an LP token approval to the router when needed, then `removeLiquidity`. With `unwrapNative` and a WETH leg, the router pays out ETH instead.
- CL pools get one position manager transaction that decreases liquidity and, when `collect` is true, collects the tokens and owed fees. `burn` and `unwrapNative` need `collect`. `unwrapNative` throws when the pool has no WETH leg.

## Staking and claims

| Method | Builds | Rules |
| --- | --- | --- |
| `stake(position)` | For CL, an NFT approval to the gauge and the gauge deposit. For basic, an LP approval if needed and a deposit of the full unstaked LP balance | The gauge must be alive. A CL position must have liquidity and not already be staked |
| `unstake(position, amount?)` | A gauge withdrawal | CL positions unstake the whole NFT. Basic positions unstake `amount` (raw LP units) or everything staked |
| `claimEmissions(position)` | A gauge reward claim | The pool must have a gauge |
| `claimFees(position, burn?, unwrapNative?)` | For basic, the pool's fee claim. For CL, a collect call on the position manager | A CL position must be unstaked. `burn` needs zero liquidity, so withdraw first |

`stake`, `unstake` and `claimEmissions` throw `pool <symbol> has no gauge` for a pool without one. Every method here rejects positions managed by an ALM vault with `ALM-managed position; not supported`.

```ts
const position = await sugar.getPositionById(123n)
if (!position) throw new Error('position not found')

const stakePlan = await sugar.stake(position)
const claimPlan = await sugar.claimEmissions(position)
```
