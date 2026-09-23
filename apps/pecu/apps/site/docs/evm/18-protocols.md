---
title: Protocols and portfolio
description: Plan Aero actions, ERC-4626 vault and Aave-compatible lending workflows, and read indexed holdings and history from Blockscout.
group: CLI
---

## Aero

`aero` runs an action from the bundled Aero SDK, the same one behind the `aero` CLI. See [Aero](/docs/aero) for what each action does.

| Field | Meaning |
| --- | --- |
| `action` | One Aero action, in snake_case |
| `parameters` | The action's parameters as strings, numbers or booleans. Must include `chain`. |
| `key` | Optional. Turns a transaction plan into a stored workflow. |
| `policy` | Optional. Policy name for the workflow's steps. |

The actions are `stocks`, `deposit`, `positions`, `pools`, `epochs_latest`, `epochs`, `withdraw`, `stake`, `unstake`, `claim_emissions`, `claim_fees`, `create_venft`, `quote`, `swap`, `stock_buy`, `stock_sell` and `index_rebalance`. Parameter names are snake_case too, such as `from_token` and `use_decimals`. Transaction actions need `wallet`, the address that will sign. Nothing fills it for you.

```sh
evm aero --input '{"action":"quote","parameters":{"chain":8453,"from_token":"ETH","to_token":"USDC","amount":"0.001","use_decimals":true}}'
evm aero --input '{"action":"swap","parameters":{"chain":8453,"wallet":"0xYOUR_ADDRESS","from_token":"ETH","to_token":"USDC","amount":"0.001","use_decimals":true,"slippage":0.005},"key":"aero-swap-001"}'
```

The result is `{ result, workflow }`. `result` is the Aero SDK's JSON. `workflow` is `null` for reads and for transaction actions without `key`. With `key`, each transaction in the Aero plan becomes one workflow step, signed by that transaction's `from` address. Review the workflow, then run it with `workflow-run` and its fingerprint.

`chain` must be a chain the Aero SDK supports, and the toolkit needs an RPC for it. The built-in RPCs cover Base (8453) and OP Mainnet (10). Aero slippage is a fraction from 0 to 1, unlike Socket's percent.

## ERC-4626 vaults

`vault` builds a workflow for a deposit or a redemption.

| Field | Meaning |
| --- | --- |
| `chainId`, `account` | Chain and signing account |
| `vault` | The ERC-4626 vault |
| `amount` | Asset base units for `deposit`, share base units for `redeem` |
| `action` | `deposit` or `redeem` |
| `key` | Workflow key |
| `policy` | Optional policy name |

```sh
evm vault --input '{"chainId":8453,"account":"0xYOUR_ADDRESS","vault":"0xVAULT","amount":"1000000","action":"deposit","key":"vault-deposit-001"}'
```

A deposit has two steps. The first approves exactly `amount` of the vault's asset. The second calls `deposit(amount, account)` and checks that your share balance reached at least your balance before plus the vault's `previewDeposit`. A redemption has one step that calls `redeem(amount, account, account)` and checks that your asset balance reached at least your balance before plus `previewRedeem`. Balances are read when you prepare, so a check can fail if they change before the run.

## Aave-compatible lending

`lending` builds a supply or withdrawal workflow for a pool address you provide.

| Field | Meaning |
| --- | --- |
| `chainId`, `account` | Chain and signing account |
| `pool` | The lending pool contract |
| `asset` | The ERC-20 asset |
| `amount` | Asset base units |
| `action` | `supply` or `withdraw` |
| `key` | Workflow key |
| `policy` | Optional policy name |

```sh
evm lending --input '{"chainId":8453,"account":"0xYOUR_ADDRESS","pool":"0xPOOL","asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"1000000","action":"supply","key":"supply-usdc-001"}'
```

A supply approves exactly `amount` to the pool, then calls `supply(asset, amount, account, 0)`. A withdrawal calls `withdraw(asset, amount, account)`. These steps have no outcome check. The toolkit does not look up pool addresses, so check the pool yourself.

## Portfolio

`portfolio` reads indexed data from Blockscout.

| Field | Meaning |
| --- | --- |
| `chainId` | 1, 8453, 10 or 42161 |
| `address` | The account to read |
| `kind` | `tokens`, `nfts`, `history` or `transfers` |
| `cursor` | Optional. The `nextCursor` object from the previous page. |

```sh
evm portfolio --input '{"chainId":8453,"address":"0xYOUR_ADDRESS","kind":"tokens"}'
```

The result has `items`, `nextCursor` (`null` on the last page), `source`, `fetchedAt` and `coverage`. On other chains the command fails with `CapabilityUnavailable`.

Indexer coverage and freshness vary, and token metadata is untrusted. A portfolio page does not prove complete holdings, active allowances or DeFi positions. An RPC alone cannot list every asset or allowance, so for tokens you already know, use [`token`](/docs/evm/reads#chain-data) and `allowance`.
