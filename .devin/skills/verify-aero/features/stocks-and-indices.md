# Stocks and indices

`stocks` trades the ten tokenized stock markets against USDC, and `index` manages saved stock-weight lists locally with a dry-run rebalance preview. Stock buys and sells broadcast real transactions; index files live under the isolated `AERO_INDEX_DIR`.

## Sub-features

- `stocks-list` shows the catalog with live prices.
- `stocks-buy` converts USDC into a stock token.
- `stocks-sell` converts a stock token back to USDC.
- `index-crud` creates, lists, shows, updates, and deletes a saved index.
- `index-rebalance-plan` prints the trade list a rebalance would make.

## How to get to it (user POV)

- Run `aero stocks list`, `aero stocks buy --stock <sym> --amount <usdc> --yes`, `aero stocks sell --stock <sym> --amount <n> --yes`.
- Run `aero index create|list|show|update|delete` with `--name` and `--allocations`.
- Run `aero index rebalance --name <n> --cash <usdc> --dry-run` to preview.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` exits 0; `scripts/aero stocks list` shows `NVDAc` at `0xb20000000000000000000078ee7ce2fe4908108c`.
- For buys, the wallet holds USDC (the runner orders swaps first).

- **List.** Run `scripts/aero stocks list`. Array of ten markets with `symbol`, `address`, and `price_usdc`.
- **Buy.** Run `scripts/aero stocks buy --stock NVDAc --amount 0.4 --yes`. The amount is USDC. Afterwards the NVDAc balance (read via viem) is positive.
- **Sell.** Run `scripts/aero stocks sell --stock NVDAc --amount <exact balance> --yes`. The amount is NVDAc units; the runner passes the full formatted balance. Afterwards the NVDAc balance is zero.
- **Index lifecycle.** Run `scripts/aero index create --name aero-verify --allocations NVDAc=50,AAPLc=50`, then `scripts/aero index list`, `scripts/aero index show --name aero-verify`, `scripts/aero index update --name aero-verify --allocations NVDAc=100`, and `scripts/aero index delete --name aero-verify`. Each prints the index JSON or list; `show` and `update` must round-trip the allocation string.
- **Rebalance preview.** Run `scripts/aero index rebalance --name aero-verify --cash 0.5 --dry-run`. The plan JSON contains a `trades` array.
- **Runner.** `bun scripts/verify.ts --mode full --only swap,stocks,sweep` for the buy and sell; `--only indices` for the local index steps plus the rebalance dry-run. `swap` is included because the buy needs USDC in the wallet, and `sweep` returns the balances to ETH afterwards.

## Gotchas

- Buy amounts are USDC, sell amounts are stock units. Passing a USDC figure to `sell` sells more than held and fails.
- There is no broadcast rebalance in this suite; only the `--dry-run` plan is driven. Stock rebalances ride the ordinary transaction path if a real run is ever wanted.
- Index files are local state under `AERO_INDEX_DIR`; `cleanup.sh` removes them.
