# Base mainnet Web3 lifecycle test

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

This opt-in suite exercises BeeGreat's existing Sugar transaction builders with
the production Crossmint smart wallet owned by the exact Clerk user
`Francesco Oddo`.

It runs this Base mainnet lifecycle:

1. Resolve the Clerk user and compare Crossmint's wallet with the wallet cached
   in Convex.
2. Read ETH and AERO prices from Aerodrome's on-chain oracle and enforce a hard
   $5 ETH-denominated budget.
3. Swap ETH to AERO.
4. Reuse an explicitly identified real ~$1 veNFT, or create one only with an
   irreversible-action acknowledgement.
5. Deposit into the canonical volatile WETH/AERO pool.
6. Stake the LP tokens, claim emissions, unstake, and claim fees.
7. Withdraw all test liquidity and swap every remaining liquid AERO back to
   ETH.

The veNFT remains after the run because its AERO is intentionally locked and
cannot be swapped back until expiry. The suite refuses to start if the wallet
already has liquid AERO or a WETH/AERO position, so cleanup cannot consume
pre-existing funds. It never touches positions in other pools.

Do not run this as a routine unit test; it is intentionally excluded unless the
dedicated script sets `RUN_BASE_MAINNET_E2E=1`. Every live run requires the
exact expected wallet address. Reusing a known veNFT is the default safe path.

Run only with explicit mainnet intent:

```sh
BEE_MAINNET_WALLET_ADDRESS=0x... \
BEE_MAINNET_REUSE_VENFT_ID=123456 \
BEE_MAINNET_BUDGET_USD=5 \
bun run --cwd packages/backend test:base-mainnet
```

Creating a new, irreversible lock instead requires omitting
`BEE_MAINNET_REUSE_VENFT_ID` and setting
`BEE_MAINNET_IRREVERSIBLE_ACK=create-real-venft-on-base`.

The test simulates every transaction before broadcast, includes estimated and
paid gas in the $5 budget, waits for receipts, refreshes quotes after approvals,
revokes touched allowances, and attempts to unwind a partially completed
WETH/AERO lifecycle before surfacing an error. A mode-0600 JSONL recovery
journal is written under `packages/backend/.artifacts/base-mainnet/` (override
with `BEE_MAINNET_JOURNAL_PATH`).

If Crossmint confirms a write but the process is interrupted before cleanup,
run the suite with `BEE_MAINNET_RECOVER_ONLY=1` and the exact
`BEE_MAINNET_REUSE_VENFT_ID`. Recovery only unwinds the target position, swaps
liquid AERO back to ETH, and revokes approvals; it never begins a new lifecycle.
