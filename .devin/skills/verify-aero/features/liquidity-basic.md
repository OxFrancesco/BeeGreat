# Basic liquidity

The classic volatile-AMM lifecycle on `vAMM-USDC/AERO` (lp `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d`): deposit two-sided liquidity, stake the LP token in the gauge, claim emissions, unstake, claim fees, and withdraw everything back to tokens.

## Sub-features

- `basic-deposit` mints LP tokens from USDC and AERO.
- `basic-stake` deposits the LP into the pool's gauge.
- `basic-claim-emissions` harvests gauge rewards.
- `basic-unstake` pulls the LP back out of the gauge.
- `basic-claim-fees` collects accrued trading fees.
- `basic-withdraw` burns the LP and returns the underlying tokens.

## How to get to it (user POV)

- Run `aero deposit --pool <lp> --amount0 <n> --use-decimals --yes`.
- Run `aero stake --pool <lp> --yes`, `aero claim-emissions --pool <lp> --yes`, `aero unstake --pool <lp> --yes`, `aero claim-fees --pool <lp> --yes`, `aero withdraw --pool <lp> --yes`.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` exits 0 and the wallet holds USDC and AERO from the swap steps (the runner orders it so; with `--only liquidity-basic` on a fresh wallet the deposits fail for lack of funds).
- The pool has a live gauge, confirmed by `read.pools` showing `gauge_alive: true`.

- **Deposit.** Run `scripts/aero deposit --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --amount0 0.4 --use-decimals --yes`. A `sent` result; afterwards `scripts/aero positions` shows an entry whose `pool.lp` is this pool with `liquidity > 0`.
- **Stake.** Run `scripts/aero stake --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --yes`. The position's `staked` becomes positive.
- **Claim emissions.** Run `scripts/aero claim-emissions --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --yes`. Receipts succeed; the reward is near zero on a fresh stake, which is fine.
- **Unstake.** Run `scripts/aero unstake --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --yes`. `staked` returns to zero while `liquidity` stays positive.
- **Claim fees.** Run `scripts/aero claim-fees --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --yes`. Receipts succeed.
- **Withdraw.** Run `scripts/aero withdraw --pool 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --yes`. The pool disappears from `positions` (or shows zero liquidity) and the USDC and AERO balances increase.
- **Runner.** `bun scripts/verify.ts --mode full --only swap,liquidity-basic,sweep` drives the six steps as `tx.deposit.basic` through `tx.withdraw.basic`; `swap` is included because the wallet must hold USDC and AERO before depositing, and `sweep` returns the balances to ETH afterwards.

## Gotchas

- `--amount0` is the first pool token (USDC here); the CLI computes the matching second leg from the pool ratio.
- Deposit implies the matching approvals, so the plan usually has more steps than one.
- If a `tx` step fails mid-lifecycle the runner marks later dependent steps `skipped (upstream failed)` and still runs the post-sweep.
- Leftover basic positions are cleaned up by `sweep.pre.positions` at the start of the next full or sweep run.
