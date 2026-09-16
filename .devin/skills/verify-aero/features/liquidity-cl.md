# CL liquidity

The concentrated-liquidity lifecycle on `CL2000-USDC/AERO` (lp `0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1`, tick spacing 2000): deposit inside an explicit price range to mint a CL NFT, stake it in the gauge, claim emissions and fees, unstake, and withdraw with `--burn` to retire the NFT.

## Sub-features

- `cl-deposit` mints a position NFT inside a price range.
- `cl-stake` deposits the NFT into the gauge (approve plus deposit).
- `cl-claim-emissions` harvests gauge rewards on the staked NFT.
- `cl-unstake` withdraws the NFT from the gauge.
- `cl-claim-fees` collects position fees.
- `cl-withdraw-burn` removes all liquidity and burns the NFT.

## How to get to it (user POV)

- Run `aero deposit --pool <lp> --amount0 <n> --price-lower <p> --price-upper <p> --use-decimals --yes`.
- Run `aero stake|claim-emissions|unstake|claim-fees --position <id> --yes`.
- Run `aero withdraw --position <id> --burn --yes`.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` exits 0 and the wallet holds USDC and AERO.
- Price bounds are in token1-per-token0 human units, here AERO per USDC. The runner quotes `aero quote --from-token USDC --to-token AERO --amount 1 --use-decimals` for spot and uses 0.5x and 2x around it.

- **Deposit.** Run `scripts/aero deposit --pool 0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1 --amount0 0.4 --price-lower <spot*0.5> --price-upper <spot*2> --use-decimals --yes`. `aero positions` gains a `is_cl: true` entry on this pool with `liquidity > 0`; its `id` is the position NFT used below.
- **Stake.** Run `scripts/aero stake --position <id> --yes`. Two transactions (approve, then gauge deposit); `staked > 0` afterwards.
- **Claim emissions.** Run `scripts/aero claim-emissions --position <id> --yes`. Receipts succeed.
- **Unstake.** Run `scripts/aero unstake --position <id> --yes`. `staked` returns to zero.
- **Claim fees.** Run `scripts/aero claim-fees --position <id> --yes`. Receipts succeed.
- **Withdraw and burn.** Run `scripts/aero withdraw --position <id> --burn --yes`. The id no longer appears in `aero positions` and USDC/AERO balances increase.
- **Runner.** `bun scripts/verify.ts --mode full --only swap,liquidity-cl,sweep` drives `tx.deposit.cl` through `tx.withdraw.cl` and captures the new position id itself; `swap` is included because the deposit needs USDC and AERO in the wallet, and `sweep` returns the balances to ETH afterwards.

## Gotchas

- A position out of range still mints but earns nothing; the runner always brackets the live spot price.
- The ALM steps (`local.alm-init`, `read.alm-status`, `read.alm-serve-once`) run while this position is live, between deposit and stake. See [ALM dry-run](./alm-dry-run.md).
- `--burn` only works on a full withdraw; a partial withdraw leaves the NFT alive.
- Several CL positions can coexist in one pool; the runner picks the highest id and warns if it had to choose.
