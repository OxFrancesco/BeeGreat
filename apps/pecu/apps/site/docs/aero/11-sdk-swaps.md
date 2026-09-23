---
title: Swaps
description: Get a routed quote, turn it into an unsigned swap plan with a minimum output, and see which approvals the plan includes.
group: SDK
---

## Quote and build a swap

```ts
import { SugarClient, parseTokenUnits, tokenToNumber } from '@beegreat/sugar'

const sugar = new SugarClient(8453, { account: '0xYOUR_ADDRESS' })

const eth = await sugar.getToken('ETH')
const usdc = await sugar.getToken('USDC')
if (!eth || !usdc) throw new Error('token not found')

const quote = await sugar.getQuote(eth, usdc, parseTokenUnits(eth, '0.01'))
if (!quote) throw new Error('no route')

console.log(tokenToNumber(usdc, quote.amountOut))
const plan = await sugar.swapFromQuote(quote, 0.005)
```

`plan` is an ordered list of unsigned transactions. See [Client](/docs/aero/sdk-client#unsigned-transactions) for how to send one.

## Quotes

`getQuote(fromToken, toToken, amountIn, filter?)` returns a `Quote`, or `undefined` when no route works. It needs no account. It throws when `amountIn` is not positive or when a token belongs to a different chain than the client.

A `Quote` has `amountOut`, the expected output before slippage, and `input` with `fromToken`, `toToken`, `amountIn` and `path`. Each hop in `path` is `{ pool, reversed }`.

The optional `filter` is called with each candidate quote. Return `false` to drop a candidate.

### Route discovery

The client loads Sugar's list of swap pools, cached for 120 seconds, and then works through these steps.

1. Keeps pools whose two tokens are each the input, the output or a connector token. Connector tokens are a vetted list per chain, set by `connectorTokenAddresses`.
2. Drops pools that touch a token on the chain's exclusion list (`excludedTokenAddresses`), unless that token is the input or the output.
3. Finds paths of one to three hops. A path can mix basic pools (V2) and concentrated liquidity pools (Slipstream, V3).
4. Keeps at most `quoteMaxPaths` candidates, 3000 by default, preferring the shortest.
5. Simulates every candidate on the quoter contract through Multicall3, `quoteBatchSize` paths per call (64 by default). A batch that fails falls back to one call per path.

Limiting intermediate hops to connector tokens keeps routes away from tokens that quote well but fail on transfer.

### Which quote wins

When both tokens are listed and the oracle can price them, any quote that pays more than twice the oracle's expected output is discarded as a likely honeypot.

From the remaining quotes the client finds the best output. It then returns the route with the fewest hops whose output is within `swapSlippage` (1% by default) of that best output, choosing the higher output between routes of equal length. The quote you get can be slightly below the absolute best in exchange for a shorter route.

## Build the swap

`swapFromQuote(quote, slippage?)` builds the plan from a quote. `swap(fromToken, toToken, amountIn, slippage?)` quotes and builds in one call and throws `No quotes found` when there is no route.

The last transaction calls `execute` on the chain's swapper contract, a universal router, with the route encoded as commands. The output goes to `account`. The minimum output is `applySlippage(quote.amountOut, slippage)`, and the swap reverts on-chain if it would receive less.

### Slippage

`slippage` is a fraction between 0 and 1, so `0.005` means 0.5%. When you leave it out, the client uses the chain's `swapSlippage` setting, which is `0.01` unless you change it with `settings.swapSlippage`, `SUGAR_SWAP_SLIPPAGE_<chainId>` or `SUGAR_SWAP_SLIPPAGE`. Values outside 0 to 1 throw.

### Approvals in the plan

| Input token | Plan |
| --- | --- |
| Native, such as ETH | One transaction. Its `value` is the input amount, which the router wraps |
| ERC-20 | Up to two approvals, then the swap with `value` of `0n` |

For an ERC-20 input the swapper pulls tokens through Permit2, so the plan can contain these two approvals, in this order.

1. `approve(permit2, amountIn)` on the token. Added only when the token's allowance to Permit2 is below the input amount.
2. `approve(token, swapper, amountIn, expiration)` on Permit2, expiring 30 minutes after you build the plan. Added unless the existing Permit2 allowance covers the amount and expires more than 10 minutes from now.

Both approvals are for the exact input amount, never unlimited. When the output is the native token, the plan unwraps WETH at the end so you receive ETH. To remove leftover approvals later, `revokePermit2Allowance(token)` returns the transactions that set both back to zero.

> [!NOTE]
> The Permit2 approval in a plan expires 30 minutes after the plan is built. Send the plan soon after building it, or build a new one.

### Basket swaps

`swapBasketFromQuotes(quotes, slippage?)` joins several quotes into one `execute` call. The [stock actions](/docs/aero/sdk-stocks) use it. Every input must be an ERC-20. Approvals cover the total input per token, and if any leg fails the whole transaction reverts. Here `slippage` must be at least 0 and below 1.

## Lower-level helpers

The steps above are also exported on their own.

| Method or export | Use |
| --- | --- |
| `getPoolsForSwaps()` | The pool list routes are built from |
| `filterPoolsForSwap(pools, from, to)` | Step 1 of route discovery |
| `getPathsForQuote(from, to, pools)` | Steps 2 and 3 |
| `setupPlanner(quote, slippage, account, router)` | Encodes a quote into router commands |
| `RoutePlanner`, `CommandType` | Build router command lists by hand |

## Cross-chain swaps

Swaps between OP Mainnet, Lisk and Unichain go through `Superswap`, described in [Chains](/docs/aero/sdk-chains#superswap).
