# Aero tokenized stocks and indices

Aero trades the ten Base tokenized stocks listed by [Dromos Kitchen](https://dromos.kitchen/dashboards/coinbase-tokenized-stocks), using fixed contract addresses checked against the [official Base stock directory](https://brand.base.org/stocks). Amounts use token decimals read from Base. A buy spends USDC; a sell spends stock token units.

```sh
aero stocks list
aero stocks buy --stock NVDAc --amount 25 --dry-run
aero stocks sell --stock NVDAc --amount 0.1 --dry-run

aero index create --name tech --allocations 'NVDAc=50,AAPLc=50'
aero index list
aero index show --name tech
aero index rebalance --name tech --cash 100 --dry-run
aero index update --name tech --allocations 'NVDAc=0,AAPLc=100'
aero index rebalance --name tech --dry-run
aero index delete --name tech
```

Connect a wallet or pass `--wallet` to build a transaction plan. Remove `--dry-run` to review and sign through the existing Aero wallet flow. `--yes` skips Aero's prompt. It does not skip wallet approval or plan validation. Every stock operation requires Base, chain 8453.

## TUI

Run `aero tui`, then select Stocks or Indices.

- Stocks shows an indicative one-token sale quote in USDC and wallet balances. Arrow keys select a stock. `b` buys; `s` sells; `r` refreshes; `i` opens indices.
- Indices lists saved portfolios and target-weight bars. `n` creates, `e` edits, `r` previews rebalancing, and `d` deletes saved weights after confirmation.
- The editor accepts a name and percentages with two decimal places. Weights must total 100%. `s` saves and Escape cancels.
- Rebalance preview shows current and target weights, each trade, and minimum outputs. Signing uses the existing wallet flow and execution journal.

## Portfolio accounting

An index is a saved allocation recipe, not a new on-chain token or vault. Definitions live in `~/.config/aero/indices`, or `AERO_INDEX_DIR`. Creating or deleting a definition moves no assets.

Rebalancing includes every wallet-held unit of the stocks named in that index. Two indices containing the same stock share those holdings. Existing wallet USDC is excluded unless explicitly added with `--cash`. Other stocks, staked assets, and liquidity positions are excluded.

Keep a removed constituent at 0% until it has been sold. The TUI preserves zero-weight entries when editing. Omitting a stock from CLI allocations leaves that holding untouched.

The planner values each position using a current full-position sale quote in USDC, calculates target values with integer arithmetic, sells overweight positions, then distributes the available budget across underweight positions. Buy spending never exceeds the explicit cash contribution plus the minimum proceeds of the sells. Fees, slippage, and token precision can leave small weight differences and residual USDC.

Approvals cover the combined input amount for each token. All sells and buys execute in one router transaction. A failed leg reverts every trade in the basket. Earlier approval transactions may remain; the existing execution journal handles interrupted signing. No automatic schedule runs in the background.

## Shared clients and release scope

The SDK exports `stocks`, `stock_buy`, `stock_sell`, and `index_rebalance` through its existing action contract. Bee's shared Web3 tools expose those actions to mobile, web, Bee CLI, iMessage, and voice through the same agent, including both model-provider paths. Existing confirmation cards and text output show trade amounts and minimum receipts. Refreshed baskets cannot increase a confirmed input, reduce an output minimum, change assets, or add trades without a new confirmation.

Named index files remain local to Aero. Other clients pass target allocations inline; this change adds no mobile or web portfolio screens. Shared agent and Convex changes require their normal deployments before they appear in hosted Bee clients. Aero runs directly from this checkout.

## Sources and verification

Coinbase tokenized stocks use Base's native B20 implementation. Use [Base's fork tools](https://github.com/base/base-std/blob/main/LIVE_PRECOMPILE_TESTING.md) for execution testing; ordinary Anvil encounters invalid bytecode at these addresses. The [issuer directory](https://brand.base.org/stocks) documents availability in eligible jurisdictions outside the US.

```sh
bun run --cwd packages/sugar test
bun run --cwd packages/sugar typecheck
bun run --cwd packages/sugar lint
bun run --cwd packages/sugar build
bun run --cwd packages/sugar test:performance
AERO_BASE_ANVIL=/path/to/base-anvil bun packages/sugar/scripts/stocks-fork.ts
```
