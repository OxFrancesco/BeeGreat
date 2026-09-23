---
title: Actions
description: Run any Aero action by name with plain JSON parameters, validate requests with validateSugarRequest, and read the JSON results.
group: SDK
---

Actions are the JSON layer over `SugarClient`. The `aero` CLI flags, the TUI forms and the headless `sugar-ts` parser all turn their input into the same action request. Transaction actions return unsigned plans here too. Nothing is signed.

## Run an action

```ts
import { executeSugarAction, executeSugarActionJson } from '@beegreat/sugar'

const pools = await executeSugarAction('pools', {
  chain: 8453,
  pool_type: 'cl',
  limit: 5,
})

const text = await executeSugarActionJson('quote', {
  chain: 8453,
  from_token: 'ETH',
  to_token: 'USDC',
  amount: '0.01',
  use_decimals: true,
})
```

`executeSugarAction(action, parameters, options?)` validates the parameters, creates a `SugarClient` for `parameters.chain`, runs the action and resolves to `SugarJson`, plain JSON in which every bigint is a decimal string. `executeSugarActionJson` resolves to the same value as a string indented by two spaces.

`options` takes every [client option](/docs/aero/sdk-client#options), such as `rpcUrl`, `rpcPolicy` or `cacheStore`, plus `clientFactory(chainId, options)` to supply your own client. A `wallet` parameter becomes the client's `account`.

Validation failures and domain errors, such as a missing token or an empty route, reject with an `Error`. RPC failures reject with a `SugarRpcError`, described in [Configuration](/docs/aero/sdk-configuration#errors).

## Action names

There are 17 actions. `SUGAR_ACTIONS` lists all of them and `isSugarAction(name)` checks a string. The 11 transaction actions are listed in `SUGAR_TX_ACTIONS`, exported with `isSugarTxAction` from `@beegreat/sugar/contracts`.

| Action | Type | Parameters |
| --- | --- | --- |
| `pools` | Read | `token0`, `token1`, `pool_type`, `full`, `limit` |
| `positions` | Read | `owner` or `wallet` |
| `epochs_latest` | Read | `pool_type` |
| `epochs` | Read | `lp`, `pool_type`, `limit`, `offset` |
| `quote` | Read | `from_token`, `to_token`, `amount`, `use_decimals` |
| `stocks` | Read | `wallet`, optional |
| `swap` | Transaction | `from_token`, `to_token`, `amount`, `slippage`, `use_decimals` |
| `deposit` | Transaction | `pool`, or `token0`, `token1`, `pool_type` and `tick_spacing` for a new pool. Then `amount0`, `amount1`, `price_lower`, `price_upper`, `tick_lower`, `tick_upper`, `initial_price`, `slippage`, `deadline_minutes`, `use_decimals` |
| `withdraw` | Transaction | `pool`, `position`, `fraction`, `burn`, `collect`, `unwrap_native`, `slippage`, `deadline_minutes` |
| `stake` | Transaction | `pool`, `position` |
| `unstake` | Transaction | `pool`, `position`, `amount` |
| `claim_emissions` | Transaction | `pool`, `position` |
| `claim_fees` | Transaction | `pool`, `position`, `burn`, `unwrap_native` |
| `create_venft` | Transaction | `amount`, `lock_duration_seconds`, `use_decimals` |
| `stock_buy` | Transaction | `stock`, `amount`, `slippage` |
| `stock_sell` | Transaction | `stock`, `amount`, `slippage` |
| `index_rebalance` | Transaction | `allocations`, `cash`, `slippage` |

Every action also takes `chain`, and transaction actions take `wallet`. The top-level `aero` commands use the same names with dashes, such as `claim-emissions`. The stock actions live under `aero stocks` and `aero index`. See the [CLI reference](/docs/aero/cli-reference).

## Parameters

`ACTION_SCHEMA`, defined in `action-schema.ts`, is the single description of every action's parameters. CLI flags and help, TUI forms, headless flag parsing and `validateSugarRequest` are all derived from it, so it is always current. Read it at runtime with `requestParameters(action)`, which adds the `chain` and `wallet` context parameters.

```ts
import { requestParameters } from '@beegreat/sugar'

for (const spec of requestParameters('swap')) {
  console.log(spec.name, spec.kind, spec.required ?? false, spec.description)
}
```

| Parameter | Kind | Notes |
| --- | --- | --- |
| `chain` | integer | Required on every action. A supported chain ID. The CLI fills in 8453 |
| `wallet` | address | Required for transaction actions. Also accepted by `positions` and `stocks` |
| `owner` | address | `positions` only. Falls back to `wallet` |
| `token0`, `token1` | token | Symbol or address. Filters for `pools`, the tokens of a new pool for `deposit` |
| `pool_type` | choice | `cl`, `stable` or `volatile` |
| `full` | boolean | `pools` returns full pool details instead of the swap summary |
| `limit` | integer | 1 to 100. `pools` returns every match when omitted, `epochs` defaults to 10 |
| `offset` | integer | `epochs` only. Defaults to 0 |
| `lp` | address | Required for `epochs`. The pool to read |
| `from_token`, `to_token` | token | Required for `quote` and `swap` |
| `amount` | string | See [Amounts](/docs/aero/sdk-actions#amounts) |
| `use_decimals` | boolean | Read amounts as human units. Without it amounts are raw integers |
| `slippage` | number | 0 to 1. `swap` defaults to the chain's `swapSlippage`, every other action to 0.01 |
| `deadline_minutes` | integer | Positive. Defaults to 30 |
| `pool` | address | The existing pool for `deposit`, or the position's pool for position actions |
| `position` | integer string | The position's NFT ID as a string of digits, so IDs above the safe integer range survive |
| `amount0`, `amount1` | string | Token0 and token1 amounts for `deposit` |
| `tick_spacing` | integer | New CL pools only |
| `price_lower`, `price_upper` | number | CL range as prices |
| `tick_lower`, `tick_upper` | integer | CL range as ticks |
| `initial_price` | number | Starting price for a CL pool with no price yet |
| `fraction` | decimal string | Above 0 and at most 1. Everything when omitted |
| `burn` | boolean | Burn the emptied CL NFT |
| `collect` | boolean | Collect owed fees while withdrawing from a CL position. Defaults to `true` |
| `unwrap_native` | boolean | Pay out ETH instead of WETH |
| `lock_duration_seconds` | integer | Required for `create_venft`. Positive |
| `stock` | string | Required for stock trades. See [Stocks](/docs/aero/sdk-stocks) |
| `allocations` | string | Required for `index_rebalance`, such as `NVDAc=50,AAPLc=50` |
| `cash` | string | USDC to add in `index_rebalance`. Defaults to `0` |

### Amounts

| Action | `amount` means |
| --- | --- |
| `quote`, `swap` | Amount of `from_token` |
| `create_venft` | Governance tokens to lock |
| `unstake` | Raw LP units to unstake from a basic pool. Everything when omitted |
| `stock_buy` | USDC to spend, in human units |
| `stock_sell` | Stock tokens to sell, in human units |

For `quote`, `swap`, `deposit` and `create_venft`, amounts are raw integer strings in the token's smallest unit unless `use_decimals` is `true`. `amount: '0.01'` without `use_decimals` fails, because `0.01` is not an integer. Pass `amount` and `amount0` as strings, not numbers.

### Selecting a position

`withdraw`, `stake`, `unstake`, `claim_emissions` and `claim_fees` need `position`, `pool`, or both. With only `position`, the client scans every pool for that NFT. With only `pool`, the wallet must hold exactly one position in it. Basic pool positions have ID `0`, so select them by `pool`.

## Validation

`validateSugarRequest(action, raw)` returns the cleaned parameters or throws an `Error` with a readable message. `executeSugarAction` calls it first. Call it yourself to reject bad input early, for example at an API boundary.

```ts
import { validateSugarRequest } from '@beegreat/sugar'

const parameters = validateSugarRequest('swap', {
  chain: 8453,
  wallet: '0xYOUR_ADDRESS',
  from_token: 'ETH',
  to_token: 'USDC',
  amount: '0.01',
  use_decimals: true,
})
```

It enforces these rules.

- Unknown parameter names are rejected, for example `Unsupported parameter for swap: private_key`.
- Every value must match its kind. `null` and `undefined` values are dropped.
- Required parameters must be present.
- `chain` must be supported, `limit` must be 1 to 100, `offset` at least 0, `slippage` 0 to 1, `fraction` above 0 and at most 1, `deadline_minutes` positive, and `lock_duration_seconds` a positive safe integer.
- `positions` needs `wallet` or `owner`. Position actions need `pool` or `position`.
- `deposit` takes either `pool` or a new pool description, never both. A new pool needs `token0`, `token1` and `pool_type`, plus `tick_spacing` when the type is `cl`. `tick_spacing` is rejected for other types.
- Addresses must be 20-byte `0x` hex. Strings are limited to 256 characters, and a string shaped like a 32-byte private key is rejected with `Sugar accepts public addresses only, never private keys`.

## Output

### Reads

| Action | Output |
| --- | --- |
| `pools` | An array. Each entry has `chain_id`, `chain_name`, `lp`, `type`, `type_label`, `token0_address`, `token1_address`, `factory`, `is_cl` and `is_stable`. With `full`, entries carry `symbol`, `pool_fee`, `tvl`, `token0` and `token1` objects, `reserve0`, `reserve1`, `gauge`, `gauge_alive` and `weekly_emissions` instead of the address and factory fields |
| `positions` | An array of positions with `id`, a `pool` summary, `liquidity`, `staked`, token amounts, earned fees, `emissions_earned` and the tick range |
| `epochs_latest`, `epochs` | An array of epochs with `ts`, `epoch_date`, `lp`, `pool`, `votes`, `emissions`, `total_fees`, `total_incentives`, `fees` and `incentives` |
| `quote` | `from_token`, `to_token`, `amount_in`, `amount_out`, their `_decimal` forms, `price`, `from_price_usd`, `to_price_usd`, `price_impact`, `price_impact_pct` and `route` |
| `stocks` | See [Stocks](/docs/aero/sdk-stocks#market-data) |

`type_label` is `volatile`, `stable` or `cl-` followed by the tick spacing. In `quote`, the prices come from the oracle in the chain's stable token and `price_impact` compares the output with the oracle rate. Both are `null` when the oracle cannot price a token.

### Transaction plans

Every transaction action returns an object with two lists.

- `transactions` is the ordered list of unsigned transactions, with `value` as a decimal string.
- `transaction_steps` holds the same transactions as `{ role, transaction }`. `role` is `action` for the last entry and `approval` for every entry before it.

Each action adds one context object.

| Action | Key | Contents |
| --- | --- | --- |
| `swap` | `quote` | The quote fields plus `slippage`, `min_amount_out` and `min_amount_out_decimal` |
| `deposit` | `deposit` | `pool`, `creates_pool`, `amount0`, `amount1`, their `_decimal` forms, `tick_lower` and `tick_upper` |
| `withdraw` | `withdrawal` | `pool`, `position`, `liquidity`, `amount0`, `amount1`, their `_decimal` forms and `burn` |
| `stake`, `unstake`, `claim_emissions`, `claim_fees` | `position` | `id` and a `pool` summary |
| `create_venft` | `ve_nft` | `amount`, `amount_decimal`, `amount_formatted`, `governance_token`, `governance_symbol` and `lock_duration_seconds` |
| `stock_buy`, `stock_sell`, `index_rebalance` | `trades`, `allocation`, `slippage` | See [Stocks](/docs/aero/sdk-stocks#output) |

Show the context to whoever signs, especially `min_amount_out` for swaps and `minimum` for stock trades.

## Headless CLI helpers

`@beegreat/sugar/cli` turns argv-style input into the same requests and always prints JSON. `parseSugarCliArgs(argv)` accepts `--flag=value`, `--flag value`, bare boolean flags and `--no-<flag>` for booleans. `runSugarCli(argv, options?, write?)` parses, runs the action and writes the JSON.

```ts
import { runSugarCli } from '@beegreat/sugar/cli'

await runSugarCli(['pools', '--chain=8453', '--pool-type=cl', '--limit=5'])
```

When `tsc` checks a project that imports `@beegreat/sugar/cli`, it also checks the TUI source behind it. Add `@types/react` as a dev dependency and set these compiler options, or the check fails inside the package.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react"
  }
}
```
