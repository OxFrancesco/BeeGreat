---
title: Client
description: Create a SugarClient for a chain, read tokens, balances and prices, and understand the unsigned transactions it returns.
group: SDK
---

## Create a client

```ts
import { SugarClient } from '@beegreat/sugar'

const sugar = new SugarClient(8453, {
  account: '0xYOUR_ADDRESS',
})
```

The first argument is a supported chain ID. Any other ID throws `Unsupported chain ID`. `createSugarClient(chainId, options)` is the same as `new SugarClient(chainId, options)`. Classes with the chain built in, such as `BaseChain`, are covered in [Chains](/docs/aero/sdk-chains).

`account` is the public address that will sign and pay for the transactions you build. Reads that need an owner, such as `getPositions` and `getVeNfts`, default to it. Every transaction builder needs it and throws `This operation requires an account address` without it. Reads such as quotes, pools and prices work without an account. The client never accepts a private key.

## Options

| Option | Type | Purpose |
| --- | --- | --- |
| `account` | `Address` | Sender of every built transaction and the default owner for reads |
| `rpcUrl` | `string` | RPC endpoint. Wins over `SUGAR_RPC_URI_<chainId>` and the built-in default |
| `transport` | Viem `Transport` | Custom transport. Wins over `rpcUrl` for requests |
| `publicClient` | Viem `PublicClient` | Custom client. Wins over `transport` |
| `env` | object | Where settings are read from. Defaults to `process.env` |
| `settings` | `Partial<ChainSettings>` | Per-field overrides for addresses, slippage, batch sizes and limits |
| `rpcPolicy` | object | Retry count, backoff and deadline for reads |
| `onRpcEvent` | function | Optional callback for RPC telemetry |
| `cacheStore` | `SugarCacheStore` | Shares token and pool caches across clients |
| `poolLocatorStore` | `SugarPoolLocatorStore` | Durable cache that speeds up reads of one pool by address |

[Configuration](/docs/aero/sdk-configuration) covers precedence, environment variables, the retry policy and both stores.

After construction, `sugar.settings` holds the resolved `ChainSettings`, `sugar.account` the checksummed account, and `sugar.publicClient` the Viem client in use.

## Tokens

A `Token` has `chainId`, `chainName`, `tokenAddress`, `symbol`, `decimals`, `listed` and `emerging`. The native token is different. Its `tokenAddress` is its symbol, `ETH` on most chains, and `wrappedTokenAddress` holds the wrapped contract such as WETH.

```ts
const eth = await sugar.getToken('ETH')
const usdc = await sugar.getToken('USDC')
const other = await sugar.getToken('0xTOKEN')
```

`getToken` accepts a symbol or a contract address and returns `undefined` when nothing matches. Symbols match without regard to case, and the native token wins over an ERC-20 with the same symbol. A symbol shared by several contracts throws `Ambiguous token symbol`, so pass the address instead.

`getAllTokens(listedOnly = false)` returns the chain's token catalog with the native token first. Both methods page through Sugar's token list once and cache it for 120 seconds.

Common tokens are also available as constants, with no RPC read:

```ts
import { BaseChain, KNOWN_TOKENS } from '@beegreat/sugar'

const usdc = BaseChain.usdc
const aero = KNOWN_TOKENS[8453].aero
```

## Balances

```ts
import { BaseChain } from '@beegreat/sugar'

const mine = await sugar.getTokenBalance(BaseChain.usdc)
const theirs = await sugar.getTokenBalance(BaseChain.usdc, '0xOWNER')
```

`getTokenBalance(token, owner = account)` returns a `bigint` in the token's smallest unit. It reads the native balance for the native token and `balanceOf` for everything else. `balanceOf(tokenAddress, owner)` reads an ERC-20 by address.

## Allowances

These read or change what a spender may take from `account`.

| Method | Returns |
| --- | --- |
| `checkTokenAllowance(token, spender)` | Current allowance as `bigint` |
| `setTokenAllowance(token, spender, amount)` | One `approve` transaction, or `undefined` when the allowance already covers `amount` |
| `revokeTokenAllowance(token, spender)` | An `approve(spender, 0)` transaction, or an empty list when the allowance is already zero |
| `revokePermit2Allowance(token)` | Up to two transactions that clear the token's approval to Permit2 and Permit2's allowance for the swapper |

## Prices

```ts
import { BaseChain } from '@beegreat/sugar'

const prices = await sugar.getPrices([BaseChain.aero, BaseChain.eth])
for (const { token, price } of prices) console.log(token.symbol, price)
```

`getPrices` reads the on-chain price oracle and returns `{ token, price }` entries. `price` is a JavaScript number in the chain's stable token, USDC on Base. Tokens the oracle cannot price are left out, so look entries up by token instead of by position. Every token must belong to the client's chain. Oracle rates are cached for 5 seconds.

## Units

On-chain amounts are `bigint` values in the token's smallest unit. These helpers convert them.

| Helper | What it does |
| --- | --- |
| `parseTokenUnits(token, value)` | Human amount to `bigint` using `token.decimals`. Takes strings or numbers, including exponents such as `1e-6` |
| `tokenToNumber(token, amount)` | `bigint` to a JavaScript number. Use it for display, not for arithmetic |
| `parseEther(value)` | Human amount to an 18-decimal `bigint` |
| `floatToUint256(value, decimals)` | Human amount to `bigint` with explicit decimals, 18 by default |
| `applySlippage(amount, slippage)` | Minimum amount after slippage. `slippage` must be between 0 and 1 |
| `normalizeAddress(value)` | Checksummed address. Throws on invalid input |

```ts
import { BaseChain, parseTokenUnits, tokenToNumber } from '@beegreat/sugar'

const amount = parseTokenUnits(BaseChain.usdc, '25')
console.log(amount, tokenToNumber(BaseChain.usdc, amount))
```

This prints `25000000n 25`.

## Return types

The SDK returns `bigint` for on-chain integers such as balances, token amounts, liquidity, NFT IDs and transaction `value`. USD-style figures such as `price`, `tvl` and `apr` are numbers.

`JSON.stringify` cannot serialize a `bigint`. Pass SDK results through `toSugarJson` first. It turns every `bigint` into a decimal string and every non-finite number into a string. [Actions](/docs/aero/sdk-actions) and the CLI already return output in that form.

## Unsigned transactions

Transaction builders resolve to `UnsignedTransaction[]`. The one exception is `setTokenAllowance`, which resolves to a single transaction or `undefined`.

```ts
type UnsignedTransaction = {
  from: Address
  to: Address
  data: Hex
  value: bigint
}
```

`from` is `account`, `to` is the contract to call, `data` is the ABI-encoded call and `value` is the native amount in wei, usually `0n`.

The list is ordered, with approvals first and the action last. Send the transactions from `from`, on the client's chain, one at a time, and wait for each receipt before sending the next, because later steps rely on earlier approvals. Builders leave out an approval when the current allowance already covers the amount, so the length of a plan depends on chain state. Build a fresh plan right before you sign instead of storing one.

To have this done for you, with a summary and a confirmation for each step, use the `aero` CLI. See [Transactions](/docs/aero/transactions).

## Caching

Each client caches the token catalog and pool lists for 120 seconds and oracle rates for 5 seconds. Quote amounts, balances and allowances are always read live. `invalidate()` clears the cached tokens, pools and prices, which is useful after one of your own transactions confirms. To share caches across clients, pass a `cacheStore` as described in [Configuration](/docs/aero/sdk-configuration).
