---
title: Aero commands
description: Advanced Aerodrome reads and transaction previews in chat, with every flag Pecu accepts.
group: Use
---

`/aero` gives you the Aerodrome command set from the [Aero SDK](/docs/aero) inside chat. You can ask for all of it in plain words too. The commands are for when you want exact control over pools, positions and flags.

`/aero`, `/aero help`, `/aero --help` and `/aero -h` all show the built-in help.

## Flag syntax

- Write flags as `--name value` or `--name=value`, with hyphens, as in `--pool-type`.
- Boolean flags accept `--flag`, `--flag true`, `--flag=false` or `--no-flag`.
- Each action accepts only its own flags. Any other flag returns an error such as `Unsupported parameter for pools: owner`. Positional arguments are rejected.
- Pecu sets the chain to Base, `8453`, and rejects any other `--chain`. It also rejects `--wallet`, because transactions always use your own wallet.
- Replace `0xPOOL` and `0xOWNER` with full addresses, and position `123` with an ID from `/aero positions`.

## Reads

Reads run immediately and never create a transaction.

| Command | What it does | Example |
| --- | --- | --- |
| `/aero stocks` | Lists the tokenized stocks with prices and your holdings. | `/aero stocks` |
| `/aero positions` | Lists your liquidity positions, or another address's with `--owner`. | `/aero positions --owner 0xOWNER` |
| `/aero pools` | Finds pools by token and pool type. | `/aero pools --token0 USDC --token1 AERO --pool-type volatile --limit 5` |
| `/aero epochs-latest` | Latest reward-period data across pools. | `/aero epochs-latest --pool-type cl` |
| `/aero epochs` | Reward-period history for one pool. | `/aero epochs --lp 0xPOOL --limit 5 --offset 0` |
| `/aero quote` | A swap quote with explicit flags. | `/aero quote --from-token ETH --to-token USDC --amount 0.001 --use-decimals` |

| Read | Flags |
| --- | --- |
| `positions` | `--owner`, optional. Without it, Pecu reads your wallet. |
| `pools` | `--token0`, `--token1`, `--pool-type`, `--limit` and `--full`, all optional. `--full` returns full pool details. |
| `epochs-latest` | `--pool-type`, optional. |
| `epochs` | `--lp` is required. `--pool-type`, `--limit` and `--offset` are optional. `--limit` defaults to 10 and `--offset` to 0. |
| `quote` | `--from-token`, `--to-token` and `--amount` are required. `--use-decimals` is optional. |

Chat replies summarize long results. Send `b/verbose` to see every record.

## Pool types and limits

- `--pool-type` is `stable`, `volatile` or `cl`, which is concentrated liquidity.
- `--limit` is a whole number from 1 to 100.
- `--offset` is a whole number, 0 or more.

## Amounts and decimals

- `quote`, `swap`, `deposit` and `create-venft` read amounts as integer base units unless you add `--use-decimals`. With it, `--amount 0.001` means 0.001 tokens. The short `/quote` and `/swap` commands add it for you.
- `stock-buy`, `stock-sell` and the `--cash` of `index-rebalance` always use normal units and do not accept `--use-decimals`.
- `unstake --amount` takes the SDK's integer amount, not a decimal. Leave it out to unstake the full position.

## Transaction previews

Every command below builds a preview. With YOLO off, confirm it by replying `confirm` or by sending `/confirm CODE`. With YOLO on, new requests run right away. The amounts are syntax examples, not suggestions.

| Command | What it does | Example |
| --- | --- | --- |
| `/aero swap` | Swap with an optional slippage limit. | `/aero swap --from-token ETH --to-token USDC --amount 0.001 --use-decimals --slippage 0.005` |
| `/aero deposit` | Add liquidity to a pool. | `/aero deposit --pool 0xPOOL --amount0 1 --amount1 1 --use-decimals` |
| `/aero withdraw` | Remove part or all of a position. | `/aero withdraw --position 123 --fraction 0.5` |
| `/aero stake` | Stake a position. | `/aero stake --position 123` |
| `/aero unstake` | Unstake a position. | `/aero unstake --position 123` |
| `/aero claim-emissions` | Claim a position's emissions rewards. | `/aero claim-emissions --position 123` |
| `/aero claim-fees` | Claim a position's trading fees. | `/aero claim-fees --position 123` |
| `/aero create-venft` | Lock AERO into a voting position. | `/aero create-venft --amount 1 --lock-duration-seconds 31536000 --use-decimals` |
| `/aero stock-buy` | Buy a tokenized stock. The amount is USDC to spend. | `/aero stock-buy --stock NVDAc --amount 1` |
| `/aero stock-sell` | Sell a tokenized stock. The amount is stock tokens. | `/aero stock-sell --stock NVDAc --amount 0.001` |
| `/aero index-rebalance` | Trade toward target stock weights, optionally adding USDC. | `/aero index-rebalance --allocations NVDAc=50,AAPLc=50 --cash 1` |

A preview can include token approvals before the main action. One confirmation runs them all, in order.

| Action | Required | Optional |
| --- | --- | --- |
| `swap` | `--from-token`, `--to-token`, `--amount` | `--use-decimals`, `--slippage` |
| `deposit` | one pool selection form, see below | `--amount0`, `--amount1`, `--use-decimals`, `--slippage`, `--deadline-minutes`, CL range flags |
| `withdraw` | `--position` or `--pool` | `--fraction`, `--collect`, `--burn`, `--unwrap-native`, `--slippage`, `--deadline-minutes` |
| `stake`, `claim-emissions` | `--position` or `--pool` | none |
| `unstake` | `--position` or `--pool` | `--amount` |
| `claim-fees` | `--position` or `--pool` | `--burn`, `--unwrap-native` |
| `create-venft` | `--amount`, `--lock-duration-seconds` | `--use-decimals` |
| `stock-buy`, `stock-sell` | `--stock`, `--amount` | `--slippage` |
| `index-rebalance` | `--allocations` | `--cash`, `--slippage` |

## Choosing a pool to deposit into

Use one of two forms. Mixing them is rejected.

- An existing pool, with `--pool 0xPOOL`.
- A token pair, with `--token0`, `--token1` and `--pool-type`. A `cl` pair also needs `--tick-spacing`, which `stable` and `volatile` pairs reject. If no pool exists for the pair, the preview creates one.

```text
/aero deposit --pool 0xPOOL --amount0 1 --amount1 1 --use-decimals
/aero deposit --token0 USDC --token1 AERO --pool-type volatile --amount0 1 --amount1 1 --use-decimals
```

- `--amount0` and `--amount1` follow the pool's own token0 and token1 order. Check the pool with `/aero pools` first.
- A new `stable` or `volatile` pool needs both amounts. An existing one can work out the other side from one amount.
- CL deposits accept `--price-lower`, `--price-upper`, `--tick-lower`, `--tick-upper` and `--initial-price`. The right values depend on the pool, so look them up rather than guessing. Basic pools reject these flags.

## Working with positions

- `withdraw`, `stake`, `unstake`, `claim-emissions` and `claim-fees` need `--position` or `--pool`. For a basic pool position, use the pool address. `--position 0` on its own is ambiguous and also needs `--pool`.
- `withdraw --fraction 0.5` removes half the position. The fraction must be above 0 and at most 1. Without it, the whole position is withdrawn.
- `withdraw` collects fees by default. Add `--no-collect` to skip that.
- `--burn` closes a CL position completely and only works with a fraction of 1. Leave `--burn` and `--unwrap-native` off unless you know what they do for that position.
- `deposit` and `withdraw` use a 30-minute deadline unless you set `--deadline-minutes`.

## Slippage

`--slippage` is a fraction, so `0.005` means 0.5%. It applies to `swap`, `deposit`, `withdraw`, `stock-buy`, `stock-sell` and `index-rebalance`. Pecu uses 1% when you leave it out and currently rejects anything above 1%, so you can only set a tighter limit.

## Locking AERO

`create-venft` needs `--amount` and `--lock-duration-seconds`, a positive whole number of seconds. `31536000` is 365 days. The contract decides which durations it accepts.

## Stock flags

- `--stock` takes a symbol from `/aero stocks`, such as `NVDAc`.
- `--allocations` is a comma-separated list of `SYMBOL=percent` entries. Each stock appears once, each weight has up to two decimals, and the weights total 100.
- `--cash` adds that much USDC to the rebalance. It defaults to 0.
- If your holdings already match the weights, Pecu replies that no transaction plan was created.

[Stocks](/docs/pecu/stocks) covers the whole stock flow, including baskets and the Aero Stocks web app.
