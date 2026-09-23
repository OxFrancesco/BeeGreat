---
title: Stocks
description: Read tokenized stock prices and balances on Base, and build USDC buy, sell and index rebalance plans through the SDK's action interface.
group: SDK
---

The SDK exposes tokenized stocks through four [actions](/docs/aero/sdk-actions), `stocks`, `stock_buy`, `stock_sell` and `index_rebalance`, run with `executeSugarAction` or `executeSugarActionJson`. The stock catalog and trading helpers behind them are internal and not exported. Saved, named indices are a CLI and TUI feature, covered in [Stocks and indices](/docs/aero/stocks-and-indices).

Every stock action requires Base, chain 8453. Any other chain throws `Tokenized stocks are available on Base only, chain 8453`.

## Supported stocks

These are the ten Coinbase tokenized stocks on Base tracked by Dromos Kitchen. The contract addresses are fixed in the SDK.

| Symbol | Company | Address |
| --- | --- | --- |
| `NVDAc` | NVIDIA | `0xb20000000000000000000078ee7ce2fe4908108c` |
| `AAPLc` | Apple | `0xb200000000000000000000c2e324d24d7eecd1fb` |
| `GOOGLc` | Alphabet | `0xb2000000000000000000002d0ba3164cc74f58b7` |
| `METAc` | Meta | `0xb2000000000000000000008bc8786b856e61707c` |
| `AMZNc` | Amazon | `0xb200000000000000000000d9192b6b456483c2e8` |
| `MSFTc` | Microsoft | `0xb200000000000000000000ab99cfa739e253872b` |
| `TSLAc` | Tesla | `0xb2000000000000000000001e800a7f5189430cd0` |
| `MSTRc` | Strategy | `0xb2000000000000000000004884b426556b92883d` |
| `SNDKc` | Sandisk | `0xb200000000000000000000397293cb8cda9a10c5` |
| `SPCXc` | SpaceX | `0xb2000000000000000000007b9fcbd005511acbd5` |

The `stock` parameter accepts the symbol, the ticker without the trailing `c` (`NVDA`), or the contract address, in any case. The same symbol list is available at runtime as the `choices` of the `stock` parameter in `ACTION_SCHEMA.stock_buy`.

All trades are against Base USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Market data

```ts
import { executeSugarAction } from '@beegreat/sugar'

const market = await executeSugarAction('stocks', {
  chain: 8453,
  wallet: '0xYOUR_ADDRESS',
})
```

The result is one entry per stock with `symbol`, `name`, `address`, `price_usdc`, `balance` and `error`. `price_usdc` is a live quote for selling one whole token into USDC, as a decimal string. `balance` is the wallet's holding as a decimal string, or `null` without a `wallet`. When a stock cannot be read or quoted, its `price_usdc` and `balance` are `null` and `error` holds the message. The other stocks still return.

## Buy and sell

```ts
const buy = await executeSugarAction('stock_buy', {
  chain: 8453,
  wallet: '0xYOUR_ADDRESS',
  stock: 'NVDAc',
  amount: '25',
})

const sell = await executeSugarAction('stock_sell', {
  chain: 8453,
  wallet: '0xYOUR_ADDRESS',
  stock: 'NVDAc',
  amount: '0.1',
  slippage: 0.005,
})
```

| Action | `amount` means |
| --- | --- |
| `stock_buy` | USDC to spend |
| `stock_sell` | Stock tokens to sell |

`amount` is a plain decimal string in human units, with no exponent and no more decimal places than the token has. The action checks the wallet balance first and throws `Insufficient USDC balance` or `Insufficient <symbol> balance` when it is short. `slippage` defaults to `0.01` and must be at least 0 and below 1.

The plan is built with `swapBasketFromQuotes`. It holds the Permit2 approvals the input token needs, then one swap transaction.

## Rebalance toward target weights

```ts
const plan = await executeSugarAction('index_rebalance', {
  chain: 8453,
  wallet: '0xYOUR_ADDRESS',
  allocations: 'NVDAc=50,AAPLc=50',
  cash: '100',
})
```

`allocations` lists target percentages as `SYMBOL=percent`, separated by commas. Each percentage can have up to two decimal places, the total must be exactly 100, and a stock can appear only once. A weight of `0` sells that stock out of the index. `cash` is extra USDC to add, `0` by default.

The planner works in these steps.

1. Values every wallet holding of the listed stocks with a live quote for selling the whole position into USDC.
2. Adds `cash` to get the total and computes each stock's target value.
3. Sells the part of each overweight holding above its target.
4. Spends at most `cash` plus the minimum proceeds of those sales on the underweight stocks, split in proportion to how far each is below target.

All sales and buys go into one swap transaction, so a failed leg reverts the whole basket. Approvals cover the combined input per token. Stocks not listed in `allocations` and USDC beyond `cash` are left alone. When the holdings already match the targets, the plan has no transactions. With no holdings and no `cash`, the action throws.

Fees, slippage and rounding can leave small differences from the target weights and a little USDC.

## Output

Every trade action returns the usual `transactions` and `transaction_steps` described in [Actions](/docs/aero/sdk-actions), plus these fields.

| Field | Contents |
| --- | --- |
| `trades` | One entry per swap leg with `from`, `to`, `amount`, `expected`, `minimum`, the token addresses and raw amounts |
| `allocation` | For `index_rebalance`, one row per stock with `balance`, `current_usdc`, `current_pct`, `target_pct` and `target_usdc`. Empty for single trades |
| `slippage` | The slippage used |
| `cash_contribution`, `total_usdc` | For `index_rebalance` only |

`minimum` is the least the leg can return after slippage. Check it before signing.
