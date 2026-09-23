---
title: Recovery
description: What the SQLite journal stores, how to recover an interrupted submission for each signer, and what never to do after a timeout.
group: Reference
---

## What the journal stores

Every plan, workflow, bridge, batch, policy, monitor, typed-data signature and sponsored Safe operation lives in the SQLite journal. For a local key, the toolkit stores the signed bytes, hash and nonce before it broadcasts anything. For Crossmint, it stores the provider transaction ID and UserOperation hash before asking for approval. For EIP-5792 batches, it stores the batch ID before contacting the wallet. For sponsored Safe operations, it stores the UserOperation hash before contacting the bundler.

That order means an interrupted command always leaves a record you can reconcile. The journal file has mode `0600`, and public results never include the signed bytes. Preserve the journal after any uncertain response. Deleting it loses the only copy of transactions that may still land.

## Rules after a timeout

1. Do not prepare a new action under a new key. It can send a second transaction.
2. Run `status` on the original ID. It never signs or broadcasts.
3. If the operation is `submitting` or `pending`, run `execute` on the same ID. It rebroadcasts the same signed bytes, so it cannot spend a second nonce.
4. If the operation is `walletPending`, reconcile it through the wallet that holds it, as described below.
5. Prepare a new action only after the old one is `confirmed`, `reverted`, `superseded` or `cancelled`, or has expired without ever being signed.

```sh
evm status --input '{"id":"PLAN_ID"}'
evm execute --input '{"id":"PLAN_ID"}' --approve 0xFINGERPRINT
```

## Recover by symptom

| Symptom | What happened | What to do |
| --- | --- | --- |
| `SubmissionUncertain` from `execute` with a local key | The signed bytes are stored as `submitting`. The broadcast result is unknown. | Run `status`, then `execute` on the same ID. |
| `SubmissionUncertain` from `execute` with a browser wallet or WalletConnect | The wallet may have sent it. The operation is `walletPending` with no hash. | Find the hash in the wallet's activity and run `attach-transaction`. |
| `SignerInteractionRequired`, wallet rejected | Nothing was submitted. The plan is back to `prepared`. | Run `execute` again when ready. |
| `AccountBusy` | Another operation for this account and chain is unresolved or executing. The message names it. | Reconcile that operation first. |
| Stuck in `pending` | Usually the fee cap is below what the network needs. | Use `replace` with higher fees, or with `cancel: true`. |
| `confirmed` became `submitting` | A reorg removed the transaction. | Run `execute` on the same ID to rebroadcast the same bytes. |
| `PlanExpired` before signing | The plan passed its expiry or deadline. | Prepare again with a new key. |
| `InvalidState` about gas or L1 fees at execute | The fresh simulation needs more than the plan allows. Nothing was signed. | Prepare again with a new key. |
| Workflow returned `pending` | A step is still unresolved. | Run `workflow-status`, then `workflow-run` on the same ID. |
| Bridge timed out | The source steps or destination are unresolved. | Run `bridge-status` or `bridge-wait` on the same bridge ID. |
| Batch response lost | The batch is `submitting`. | Run `batch-status` on the same batch ID. |
| Sponsored Safe submit timed out | The UserOperation hash is stored and the record is `pending`. | Run `safe-sponsored-status`, then `safe-sponsored-submit` on the same ID if needed. |

## Locks across processes

Before signing, `execute` takes a lock for the plan's account and chain in the journal. It refuses with `AccountBusy` while another operation for the same account and chain is `submitting`, `pending` or `walletPending`, or while another process holds the lock. A lock left by a process that no longer exists is cleared automatically. Two CLI processes executing the same plan against one journal submit only one transaction.

These locks cover only processes that share one journal file. Separate databases, other hosts and activity from the same wallet outside the toolkit do not see them. Keep every process that signs for an account on the same journal.

## Crossmint smart wallets

A Crossmint operation records the provider transaction ID and UserOperation hash before approval, and stays `walletPending` until it is confirmed on chain.

- To check it, reconnect the same smart wallet, then run `status` or `execute` on the same ID. Without that wallet, `status` fails with `SignerInteractionRequired`.
- `execute` on an operation still awaiting approval resumes the same Crossmint transaction and asks for the passkey again. It never creates a new transfer. If the plan has expired, it fails with `PlanExpired` instead.
- Confirmation needs the canonical receipt and a matching `UserOperationEvent` from a known EntryPoint, including its inner success flag. A reorg returns the operation to `walletPending`.
- If Crossmint reports the operation failed, `status` returns `OutcomeMismatch`. Inspect the provider transaction before you prepare anything new.

This adapter has no provider cancellation. A failed or expired unresolved Crossmint operation keeps blocking new submissions from that account in the same journal.

## Wallet batches

A batch ID is derived from its key and stored before `wallet_sendCalls`. After a lost response, `batch-status` or `batch-run` on the same ID asks the wallet about that batch. A wallet answer with a different ID, chain or atomicity is rejected, and completion requires successful, canonical receipts. Never prepare a new batch for the same calls until the old one is resolved.

## Never do these

- Retry a timed-out action under a new idempotency key before inspecting the original.
- Delete or replace the journal while an operation is `submitting`, `pending` or `walletPending`.
- Send from the same account with another tool while the toolkit has an unresolved operation for it.
- Treat `confirmed` as final. Check `finality`, and run `status` again for important transfers.
- Treat a source-chain bridge transaction as proof of delivery. Check `settlement.verified`.
