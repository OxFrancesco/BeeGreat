# Swap

Swap trades one token for another through the best Aerodrome route. The user previews the trade as an unsigned plan, then broadcasts it; the CLI reports the transaction hashes once confirmed.

## Sub-features

- `swap-plan` builds the unsigned plan with quote details.
- `swap-send` broadcasts the plan and prints the result JSON.
- `swap-proof` confirms the receipt and the balance delta independently.

## How to get to it (user POV)

- Run `aero swap --from-token <from> --to-token <to> --amount <n> --use-decimals --dry-run` to preview.
- Run the same command with `--yes` instead of `--dry-run` to send.

## Driving it with verify-aero

Preconditions:

- `bun scripts/doctor.ts` exits 0: wallet present, passphrase set, ETH above the required floor.
- No `active` journal in `scripts/aero executions list`.

- **Preview.** Build the plan without sending. Run `scripts/aero swap --from-token ETH --to-token USDC --amount 0.0002 --use-decimals --dry-run`. Exit 0 and stdout is the plan JSON with `transaction_steps` and `quote.min_amount_out`, `quote.min_amount_out_decimal`, `quote.from_price_usd`, `quote.amount_out_decimal`.
- **Send.** Broadcast the same trade. Run `scripts/aero swap --from-token ETH --to-token USDC --amount 0.0002 --use-decimals --yes`. stdout shows the plan summary, `[i/n] role: ...` send lines, then `{"status":"sent","chain":8453,"wallet":"0x...","hashes":["0x..."]}`.
- **Proof.** The runner fetches each hash's receipt via viem and requires `status: "success"`, checks `hashes.length` against `plan.transaction_steps.length`, and records the USDC delta which must cover `quote.min_amount_out`. A journal file appears under `wallet/executions/<uuid>.json` with status `complete`.
- **Runner.** `bun scripts/verify.ts --mode dry-run --only tx.swap` captures the plans only; `bun scripts/verify.ts --mode full --only tx.swap` sends them for real.

## Gotchas

- `--amount` is in units of the from-token; always pass `--use-decimals` when typing human amounts.
- A swap whose plan has zero `transaction_steps` prints a "no transactions needed" line instead of a `sent` JSON; the runner treats that as a valid no-op.
- Swapping the full balance back to ETH is how the suite ends a cycle; the sweep steps run the same `swap` command with the exact balance.
