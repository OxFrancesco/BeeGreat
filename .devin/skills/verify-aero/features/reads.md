# Reads

Every read command the CLI exposes: quoting a swap, listing pools, positions, epochs, and stocks, checking wallet status, and listing execution journals. Most print JSON on stdout; wallet status prints text. These commands do not sign transactions or change on-chain state.

## Sub-features

- `read-quote` prices a token pair with human or raw amounts.
- `read-pools` lists liquidity pools filtered by token pair.
- `read-positions` lists the wallet's LP and CL positions.
- `read-epochs` shows gauge epoch history for one pool.
- `read-epochs-latest` shows the latest epoch across pools by type.
- `read-stocks-list` lists the ten tokenized stocks.
- `read-wallet-status` shows the active wallet's address and source.
- `read-executions-list` lists execution journals and their status.

## How to get to it (user POV)

- Run `aero quote --from-token <from> --to-token <to> --amount <n> [--use-decimals]`.
- Run `aero pools [--token0 <sym>] [--token1 <sym>] [--full] [--limit <n>]`.
- Run `aero positions [--owner <address>]`.
- Run `aero epochs --lp <address> [--limit <n>]` or `aero epochs-latest [--pool-type volatile|stable|cl]`.
- Run `aero stocks list`.
- Run `aero wallet status`.
- Run `aero executions list`.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` reports the Base chain and a reachable RPC. The runner requires the isolated wallet. Standalone `positions --owner <address>` can read another address without a configured signer; `wallet status` prints a no-wallet message when none is configured.

- **Quote.** Price the ETH leg. Run `scripts/aero quote --from-token ETH --to-token USDC --amount 0.01 --use-decimals`. Exit 0 and the JSON contains `amount_out_decimal` above zero plus `from_price_usd`.
- **Pools.** List the pinned pair. Run `scripts/aero pools --token0 USDC --token1 AERO --full --limit 6`. The array includes lp `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` (vAMM) and `0xBE00fF35AF70E8415D0eB605a286D8A45466A4c1` (CL2000).
- **Positions.** Read the wallet's positions. Run `scripts/aero positions`. Exit 0 and the output is a JSON array (empty on a fresh wallet).
- **Epochs.** Read gauge history. Run `scripts/aero epochs --lp 0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d --limit 3`. Non-empty array.
- **Latest epochs.** Run `scripts/aero epochs-latest --pool-type volatile`. Non-empty array; this call fans out over many pools and is the most rate-limit-prone read.
- **Stocks.** Run `scripts/aero stocks list`. An array of ten markets including `NVDAc` at `0xb20000000000000000000078ee7ce2fe4908108c`.
- **Wallet.** Run `scripts/aero wallet status`. Output contains `local encrypted wallet` and the verify address.
- **Journals.** Run `scripts/aero executions list`. JSON array; an entry with `status: "active"` blocks new plans.
- **Runner.** Run all of the above at once: `bun scripts/verify.ts --mode reads`. Each lands as a `read.*` step record under `runs/<run-id>/steps/`.

## Gotchas

- `epochs-latest` is heavy and commonly rate limited on the public RPC; the runner marks it `flaky` rather than failed.
- `positions` on a wallet with no positions prints `[]`, which is a valid pass.
- Reads never write journals, so `executions list` before and after a reads run is identical.
