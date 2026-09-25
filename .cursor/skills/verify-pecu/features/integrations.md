# DeFi, stocks and Safes

## Sub-features

LP deposit/stake/emissions/unstake/fees/withdraw; veNFT create/inspect/unlock; stock buy/sell/basket/rebalance/restore; Aave approval/supply/borrow/repay/withdraw; Safe create/fund/propose/approve/execute/budget/roles/sweep.

## How to get to it (user POV)

Use `/aero help`, natural Aave and Safe requests, and `/profile` for organization state. Public command docs are under `/docs/pecu`.

## Driving it with T3

Follow each lifecycle's prerequisite order. LP deposits must show both token amounts. Baskets use one code and disclose all legs. Aave approval and supply are separate previews; preserve every warning. Safe owner, threshold, nonce, budget and recipient restrictions must match the request. Prove both the way in and the way out, and inspect final state independently. Record every lifecycle stage separately.

## Gotchas

Provider responses, fees and market prices change. Never require a stale exact quote. Locked tokens cannot be swept before unlock. No Safe address exists until deployment succeeds. Whop deposits, passkeys, recovery fault injection and X writes remain excluded when the task says so.
