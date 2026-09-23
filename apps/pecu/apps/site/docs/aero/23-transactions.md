---
title: Transactions
description: How aero turns a command into a reviewed plan, signs it step by step, journals every submission and recovers when an outcome is unknown.
group: CLI
---

## Plans

A transaction command reads live chain state and builds a plan, an ordered list of unsigned transactions. Approvals come first and the action is the last step. Nothing is signed while the plan is built.

```json
{
  "transaction_steps": [
    {
      "role": "approval",
      "transaction": { "from": "0xYOUR_ADDRESS", "to": "0xTOKEN", "data": "0x...", "value": "0" }
    },
    {
      "role": "action",
      "transaction": { "from": "0xYOUR_ADDRESS", "to": "0xSPENDER", "data": "0x...", "value": "0" }
    }
  ]
}
```

`value` is a decimal string in wei. The plan also has a `transactions` array with the same transactions, plus context for the action, such as `quote` for a swap, `deposit`, `withdrawal`, `position`, `ve_nft`, or `trades` and `allocation` for stocks.

Approvals cover the exact amount the plan spends, not an unlimited allowance. A swap from an ERC-20 approves Permit2 and then the swapper through Permit2, and skips either approval when the current allowance is already enough.

## Review and confirm

With a connected wallet that matches `--wallet`, a transaction command runs like this:

1. Aero prints the chain id, the sender and a summary. The first line names the action and the number of transactions, and says "approvals first" when there is more than one.
2. The summary adds lines for the action. A swap shows the amounts, both asset addresses, the minimum output with its slippage and the price impact. A deposit or withdrawal shows the pool, both asset addresses and the amounts. Stock trades list each leg with its minimum output.
3. Aero asks "Sign and broadcast?" once for the whole plan. Answer no and nothing is sent.
4. A local wallet asks for its passphrase. A browser or WalletConnect wallet asks you to approve each transaction in the wallet.
5. Steps go out one at a time. Aero waits for each receipt before sending the next and prints a line per step, such as `[1/2] approval: sending via local wallet...` and `confirmed in block` with the block number.
6. When every step is confirmed, Aero prints `{"status": "sent", "chain": ..., "wallet": ..., "hashes": [...]}`.

A plan expires 10 minutes after it is built. If you leave the prompt open longer, Aero refuses to send and you run the command again for a fresh plan.

If a step reverts, Aero stops. Steps that already confirmed, usually approvals, stay on chain.

The TUI follows the same flow. The plan screen shows the summary and each step's target address, Enter signs, and `j` shows the raw plan. See [TUI](/docs/aero/tui#plans-and-signing).

## Flags that change the flow

| Flag | Effect |
| --- | --- |
| `--dry-run` | Print the unsigned plan as JSON and stop. Nothing is signed. |
| `--yes`, `-y` | Skip "Sign and broadcast?". Browser and WalletConnect wallets still ask for approval. A local wallet with `SUGAR_WALLET_PASSPHRASE` set signs with no prompt at all. |
| `--wallet` | Build the plan for another address. If it differs from the connected wallet, Aero prints the unsigned plan instead of signing. |

Without a terminal, for example in a pipe or cron job, the prompt cannot run. Aero stops with "no TTY for the confirmation prompt; pass --yes or --dry-run".

## Unsigned plans without a wallet

Without a connected wallet, pass the address the plan is for. Aero prints the unsigned plan and a hint on stderr to run `aero wallet connect`:

```sh
aero swap --from-token ETH --to-token USDC --amount 0.01 --use-decimals --wallet 0xYOUR_ADDRESS
```

Without a connected wallet and without `--wallet`, the command fails with "swap requires wallet", or the same message for the other commands. You can submit a printed plan with any tool you trust. Aero does not journal or track plans it did not send itself.

A plan with no steps, such as an index that is already on target, prints "Already balanced. No transactions needed." and sends nothing.

## Gas and preparation

These apply to the local wallet. Browser and WalletConnect wallets estimate gas and fees themselves.

- Aero adds 25% to the node's gas estimate, because swap gas can change between the estimate and inclusion.
- Preparing a transaction reads the nonce, gas and fees. If that fails, Aero retries up to 6 times with a delay that starts at 2 seconds and doubles, about a minute in total.
- If preparation still fails, Aero stops with "Local transaction preparation failed before broadcast after 6 attempts" and the reason. Nothing was sent for that step, and it stays ready for `aero executions resume`.

Receipts are read from the chain's RPC. Set `SUGAR_RPC_URI_<chainId>` to your own endpoint if the public one rate-limits or refuses receipt reads.

## The execution journal

Before the first send, Aero saves the plan as `executions/<id>.json` in the wallet directory, `~/.config/sugar-ts` by default. Files are written atomically with mode 0600 and updated after every state change.

| Step state | Meaning |
| --- | --- |
| `ready` | Not sent |
| `submitting` | Handed to the wallet. The outcome is unknown until a hash comes back. |
| `submitted` | The wallet returned a hash. Waiting for the receipt. |
| `confirmed` | Receipt succeeded |
| `reverted` | Receipt failed |

An execution is `active`, `complete`, `failed` after a revert, or `cancelled`.

While an execution for a wallet and chain is `active`, Aero refuses to start another plan for that wallet on that chain with "Wallet has an unresolved execution; inspect and resume it before starting another plan". A lock file, `<chainId>-<address>.lock` in the same directory, stops two Aero processes from sending for the same wallet at once.

## Executions commands

### List

```sh
aero executions list
```

Prints every saved execution with its id, chain, sender, status and each step's state and hash.

### Resume

```sh
aero executions resume --id PLAN_ID
```

Resume shows the steps and asks you to confirm, then signs with the active wallet, which must be the plan's sender. For each step it skips `confirmed`, waits for the receipt of `submitted` without resending, and sends `ready` steps while the plan is less than 10 minutes old. It refuses a `submitting` step, a `reverted` step, and executions that are `failed` or `cancelled`. It prints `{"status": "complete", "hashes": [...]}` when done. Resume needs a terminal for its prompt.

ALM phases cannot be resumed here. Use [ALM recovery](/docs/aero/alm#recovery).

### Cancel

```sh
aero executions cancel --id PLAN_ID
```

Cancel marks the remaining unsubmitted steps of an `active` execution as cancelled, after a confirmation. It refuses while any step is `submitting` or `submitted`. Confirmed transactions stay on chain.

## After an uncertain or lost submission

> [!WARNING]
> Do not rebuild and resend a plan while a step's outcome is unknown. The first transaction may already be on chain, and sending again can spend the funds twice. Check the wallet's activity on a block explorer first.

| What you see | Step state | What to do |
| --- | --- | --- |
| "Execution outcome unknown; resume PLAN_ID to check ... without resending" | `submitted` with a hash | Run `aero executions resume --id PLAN_ID`. It waits for that receipt and continues. |
| "Local transaction preparation failed before broadcast", or the wallet rejected the request | `ready` | Resume within 10 minutes of building the plan, or cancel and run the command again. |
| "Plan expired; cancel unsubmitted steps and build a new plan" | `ready` | Run `aero executions cancel`, then run the command again. The new plan skips approvals whose allowance is still enough. |
| "Submission outcome unknown; this execution is blocked until reconciled", or a browser tab closed or timed out while an approval was open | `submitting` | Look up the sender's recent transactions on a block explorer. Aero has no hash for this step, and neither resume nor cancel will act on it. The execution stays active and blocks new plans for that wallet on that chain. |
| "Receipt belongs to a replacement transaction" | `submitted` | The wallet replaced the transaction, for example by speeding it up. Check the replacement on a block explorer before doing anything else. |
| A step "reverted on-chain" | `reverted` | The execution is failed. Review the receipts, then build a new plan. |
| "Execution is locked. Stop overlapping Aero processes and inspect ..." | unchanged | Another Aero process is sending for this wallet. If none is running, a crashed process left the lock file. Confirm no Aero process is running, remove that lock file, then run `aero executions list`. |

In the TUI, `ctrl+c` during a broadcast shows a warning first. A second press within 3 seconds quits anyway, which can leave a step `submitting`.
