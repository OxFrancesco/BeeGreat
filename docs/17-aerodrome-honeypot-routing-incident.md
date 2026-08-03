# Aerodrome swap incident: honeypot routing + native-ETH deposits (2026-08-03)

A user asked Bee to put half of their ETH into a USDC/ETH pool on Aerodrome
(Base). The prepared swap (`prepare_sugar_execution`, `sugar_action: "swap"`,
0.001473797543240939 ETH → USDC) was confirmed and executed through the
Crossmint smart wallet, and **reverted on-chain with `TRANSFER_FAILED`**.
This doc records the diagnosis, the two bugs fixed in `packages/sugar`, and
the live verification, so future routing/deposit issues can be triaged faster.

## Symptom

```
Web3 action failed — execution_reverted, revert reason TRANSFER_FAILED
(unverified contract), Tenderly shared simulation link in the error payload.
```

## Diagnosis walkthrough (reusable)

1. The error payload from Crossmint includes a Tenderly **shared simulation
   link** (`tdly.co/shared/simulation/<id>`). The dashboard is a JS app; the
   raw trace is fetchable directly:
   - `GET https://api.tenderly.co/api/v1/public/cached-tx-data/network/<chainId>/simulation/<id>`
     → failing call (from/to/input/output/error).
   - `GET https://api.tenderly.co/api/v1/simulations/<id>` → full call trace
     (`transaction.transaction_info.call_trace`, recursive `calls`).
2. The trace showed: EntryPoint v0.7 → smart wallet → Aerodrome swapper
   (`0xcAF22ce3...`) `execute` with the correct `value`. `WRAP_ETH` succeeded;
   the plan was `WRAP_ETH → V2_SWAP_EXACT_IN → V3_SWAP_EXACT_IN`.
3. The chosen route was **WETH → S7 → USDC**, where S7
   (`0x8c386b032b1506af06cd432a8c4f97cd2bd05c5a`, "BTCSentinel") is a honeypot:
   its `transfer()` delegates to a hook contract that reverts. The V2 hop
   (pool → router) succeeded, but the router's `safeTransfer` of S7 into the
   CL pool during `uniswapV3SwapCallback` reverted → `TRANSFER_FAILED`.
4. Why the quoter picked it: honeypot pools quote absurdly good rates (the
   S7 route "paid" 4.3 USDC vs ~2.7 USDC real market), and quoting is a
   static call that does not exercise the poisoned transfer path.

## Root causes and fixes (`packages/sugar/src/client.ts`)

### 1. Swap routing accepted arbitrary intermediate tokens

`filterPoolsForSwap` keeps any pool that touches a connector token on
*either* side, so a junk `WETH↔S7` pool plus an `S7↔USDC` pool formed a
valid-looking 2-hop path. `getPathsForQuote` only applied the
`excludedTokenAddresses` **denylist** to intermediates.

**Fix:** multi-hop intermediates must now be in the
`connectorTokenAddresses` **allowlist** (plus the from/to tokens). Direct
routes are unaffected. The upstream Python sugar-sdk has the same gap; this
is an intentional hardening, not a parity break.

### 2. Native-ETH deposits threw before building a transaction

Pool specs built from the native token carry `tokenAddress: 'ETH'` with the
WETH address in `wrappedTokenAddress`. `collectApprovals` detected the native
leg by comparing `tokenAddress` to WETH only, so an ETH leg fell into the
ERC-20 branch and `normalizeAddress('ETH')` threw (`deposit` with
`token0/token1` including `eth` was unusable). The CL `mint` args had the
same problem.

**Fix:** new `isNativeLeg()` treats a leg as native when it has a
`wrappedTokenAddress` (pool specs) or its address equals the wrapped native
token (indexed pools); CL `mintArgs` now use `tokenContractAddress()`.

### Known follow-up (not fixed here)

`createPoolSpec` sorts legs by raw `tokenAddress`, so a native-ETH **CL**
spec can end up ordered differently from the on-chain pool (which sorts by
wrapped address). Irrelevant for basic pools (the router sorts internally),
but should be fixed before creating CL positions with a native-ETH leg.

## Live verification (Base mainnet, Bee smart wallet `0x9000...422E`)

Executed with the fixed SDK, signed server-side via Crossmint (same code
path as `web3.executeConfirmedAction`):

- Quote sanity: direct WETH/USDC route, 0.66% price impact vs the on-chain
  oracle (the old S7 route had quoted a fake ~2.4x better rate).
- Swap 0.001473797543240939 ETH → 2.70659 USDC:
  [`0xf805d78a...`](https://basescan.org/tx/0xf805d78a23c29d9e2299502173a1efdcedee6b21f2d95a56b6fd4ded87e15aab)
- Deposit into vAMM-WETH/USDC (`0xcDAC0d6c6C59727a65F871236188350531885C43`):
  [approve `0x178a67bf...`](https://basescan.org/tx/0x178a67bfc2805f4c7611359a7c1f1b49d5cccfec0554839b544ff423ad3de5ea),
  [addLiquidityETH `0xacac0819...`](https://basescan.org/tx/0xacac0819c955415eed9577e64d7d948cb714a0009f974537f002b308d719f0d9)
  — LP minted, ~0.0046 USDC refunded by the router's optimal-amount logic.

## Operational notes

- The fix lives in `packages/sugar`, which the Convex backend bundles: it
  reaches users only after a backend deploy (`bunx convex dev --once` for the
  dev deployment, `bunx convex deploy` for prod).
- Guardrails worth reusing when live-testing plans: assert the plan target is
  the known swapper/router, assert the tx `value` equals the intended amount,
  and grep the calldata for unexpected token addresses before signing.
