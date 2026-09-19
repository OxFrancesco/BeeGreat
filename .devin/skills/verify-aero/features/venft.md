# veNFT

`create-venft` locks AERO into a vote-escrow NFT for a chosen duration. The suite locks a small amount for one week (604800 seconds); VotingEscrow rounds the unlock time down to the weekly Thursday 00:00 UTC boundary, placing expiry at the next weekly boundary. Creation can still fail. A later run's sweep withdraws eligible locks once `expiresAt` has passed.

## Sub-features

- `venft-create` locks AERO into a new veNFT.
- `venft-sweep-expired` withdraws locks whose `expiresAt` has passed.

## How to get to it (user POV)

- Run `aero create-venft --amount <aero> --use-decimals --lock-duration-seconds 604800 --yes`.
- There is no CLI command to withdraw an expired lock; the SDK's `SugarClient.withdrawVeNft` does it.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` exits 0 and the wallet holds AERO (the runner swaps ETH to AERO earlier in the cycle; include `swap` and `sweep` in `--only` so the wallet is funded and emptied).
- VotingEscrow on Base is `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` (confirmed through `SugarClient.getVeNftContracts()`).

- **Create.** Run `scripts/aero create-venft --amount <aero> --use-decimals --lock-duration-seconds 604800 --yes`. The amount is sized to about $0.30 of AERO. Afterwards `balanceOf(wallet)` on VotingEscrow is one higher; the runner records it as the `veNftCount` delta.
- **Sweep expired locks.** Handled inside the runner as `sweep.pre.venft-expired`. It calls `client.getVeNfts(wallet)`, filters for `expiresAt > 0`, `expiresAt <= now`, `lockedAmount > 0`, not permanent, and not managed, and sends `client.withdrawVeNft(id)` through `sendPlan` with the sealed local wallet. This is the one place the suite signs outside the CLI, because no CLI command exists for it.
- **Runner.** `bun scripts/verify.ts --mode full --only swap,venft,sweep` for the lock; the expired sweep runs automatically at the start of `full` and `sweep` modes.

## Gotchas

- The lock is unspendable until the rounded Thursday boundary passes. Do not try to recover it mid-run; wait for the next run's sweep after `expiresAt`.
- Permanent and managed veNFTs are never touched by the sweep.
- The SDK-only lifecycle methods (`increaseVeNftAmount`, `extendVeNftLock`, `voteVeNft`, `resetVeNftVotes`, `pokeVeNftVotes`, `delegateVeNft`, `mergeVeNfts`, `splitVeNft`, `setVeNftPermanent`, `depositVeNftIntoManaged`, `withdrawVeNftFromManaged`, `claimVeNftRewards`, `claimVeNftRebase`) are not covered by this suite; they have no CLI surface.
