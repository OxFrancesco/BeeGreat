---
title: Transactions
description: Prepare a transaction plan, review it, execute it with exact approval, and track it through inclusion, finality, reorgs and replacement.
group: CLI
---

## The flow

1. Prepare a plan with `prepare`, `prepare-call`, `transfer`, `approve`, `revoke` or `wrap`. The toolkit simulates it and stores it unsigned.
2. Review the plan's chain, account, destination, calldata, value, gas, fees and expiry.
3. Run `execute` with the plan's fingerprint, or with `--yolo`.
4. Run `status` or `wait` until the operation is `confirmed` or `reverted`.

```sh
evm transfer --input '{"chainId":8453,"account":"0xYOUR_ADDRESS","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","to":"0xRECIPIENT","amount":"1000000","key":"pay-recipient-001"}'
evm execute --input '{"id":"PLAN_ID"}' --approve 0xFINGERPRINT
evm wait --input '{"id":"PLAN_ID"}'
```

`PLAN_ID` is `result.plan.id` and `0xFINGERPRINT` is `result.plan.fingerprint` from the first command. This transfer sends 1 USDC on Base.

## Prepare a raw transaction

| Field | Required | Meaning |
| --- | --- | --- |
| `chainId` | Yes | Chain ID |
| `account` | Yes | The address that will sign |
| `to` | Yes | Destination |
| `data` | Yes | Calldata, `0x` for none |
| `value` | Yes | Native value in wei |
| `key` | Yes | Idempotency key for this action |
| `deadline` | No | Latest execution time, Unix milliseconds |
| `policy` | No | Name of a local policy to enforce at signing |

```sh
evm prepare --input '{"chainId":8453,"account":"0xYOUR_ADDRESS","to":"0xRECIPIENT","data":"0x","value":"1000000000000000","key":"send-eth-001"}'
```

## Prepare a contract call

`prepare-call` takes the [read fields](/docs/evm/reads#read-a-contract) plus `account`, `value` and `key`, and optional `policy` and `deadline`. It encodes the call with the ABI, then prepares it like `prepare`.

```json
{"chainId":8453,"address":"0xTOKEN","signatures":["function approve(address spender, uint256 amount) returns (bool)"],"functionName":"approve","args":["0xSPENDER","1000000"],"account":"0xYOUR_ADDRESS","value":"0","key":"approve-spender-001"}
```

## Asset plans

| Command | Input | Builds |
| --- | --- | --- |
| `transfer` | `chainId`, `account`, `to`, `amount`, `key`, optional `token`, optional `policy` | An ERC-20 `transfer` when `token` is set, otherwise a native transfer of `amount` wei |
| `approve` | `chainId`, `account`, `token`, `spender`, `amount`, `key`, optional `policy` | An exact ERC-20 `approve` |
| `revoke` | `chainId`, `account`, `token`, `spender`, `key`, optional `policy` | An ERC-20 `approve` of zero |
| `wrap` | `chainId`, `account`, `wrapper`, `amount`, `action` (`wrap` or `unwrap`), `key`, optional `policy` | `deposit()` with `amount` as value, or `withdraw(amount)`, on the wrapped-native contract you name |

Each returns the same plan as `prepare`.

## Read the plan

| Field | Meaning |
| --- | --- |
| `id` | Operation ID, derived from `key` |
| `intentHash` | Hash of chain, account, destination, calldata, value, policy and deadline |
| `fingerprint` | Hash of the intent, simulation block, gas, fees and expiry. Approve this. |
| `simulationBlock` | Block the simulation ran against |
| `gas` | Gas limit, the estimate plus 20 percent |
| `feeType` | `eip1559` or `legacy` |
| `gasPrice` | Max fee per gas for EIP-1559, or the gas price for legacy |
| `maxPriorityFeePerGas` | Priority fee cap for EIP-1559 |
| `l1FeeEstimate` | OP Stack L1 data fee upper bound in wei, `"0"` elsewhere |
| `createdAt`, `expiresAt` | Unix milliseconds |
| `replacement` | Present on replacement plans, with the original `id` and `nonce` |

The most the transaction can cost in fees is `gas × gasPrice + l1FeeEstimate` wei, on top of `value`. The TUI shows both numbers next to the approval prompt.

## Simulation

`prepare` runs `eth_call` at the latest block and estimates gas. If the call reverts, the command fails with `SimulationReverted` and stores nothing, so you can fix the call and reuse the same key.

`execute` simulates again right before signing. If the gas estimate now exceeds the plan's limit, or the L1 data fee estimate has grown, it refuses with `InvalidState`. Prepare a fresh plan with a new key. Simulation predicts the result at one block and can miss what changes before inclusion.

## Fees

When the latest block has a base fee, plans use EIP-1559 fees from the RPC's estimate. Otherwise they use a legacy gas price. On Base (8453), Base Sepolia (84532), OP Mainnet (10) and OP Sepolia (11155420), the plan also stores an L1 data fee upper bound from the OP Stack gas price oracle.

Fee caps are fixed when you prepare. If network fees rise above the cap, the transaction can wait in the mempool. Use `replace` to raise the fee.

## Expiry

A plan expires 10 minutes after it is prepared, or at `deadline` if that is earlier. Preparing again with the same key returns the same expired plan. After expiry, prepare with a new key, once you have confirmed the old plan was never sent.

## Execute

```sh
evm execute --input '{"id":"PLAN_ID"}' --approve 0xFINGERPRINT
evm execute --input '{"id":"PLAN_ID"}' --yolo
```

`execute` does these steps in order:

1. Reconciles the operation. A `confirmed`, `reverted` or `superseded` operation is returned as is, and nothing is sent.
2. Checks the approval against the stored fingerprint.
3. Takes the journal lock for this account and chain. Another unresolved operation for the same account and chain fails the call with `AccountBusy`.
4. Checks that a signer exists and matches the plan's account, and that the plan has not expired.
5. Simulates again and reads the pending nonce.
6. Reserves the plan against its policy, if it has one.
7. Signs, checks that the signed bytes match the plan exactly, and stores the bytes, hash and nonce.
8. Broadcasts the stored bytes and reconciles the receipt.

A local key in `EVM_PRIVATE_KEY` or an SDK signer is used before any connected wallet. With a connected wallet, step 7 hands the planned transaction and nonce to the wallet. The operation is `walletPending` while the wallet holds it, and `status` checks the transaction the wallet returns against the plan.

Once an operation has stored signed bytes or a wallet submission, running `execute` again on the same ID never signs another transaction. It rebroadcasts the stored bytes if they are not yet included, or reconciles and returns the recorded result.

## Status and wait

`status` reads the receipt and updates the journal. It never signs or broadcasts, so it is always safe to run.

`wait` calls `status` up to 30 times, one second apart plus RPC time, while the operation is `submitting`, `pending` or `walletPending`. It returns the latest state even if the transaction is still pending.

A `confirmed` or `reverted` state carries `block`, `blockHash`, `gasUsed` and `finality`:

| `finality` | Meaning |
| --- | --- |
| `included` | In a block the RPC currently reports as canonical |
| `safe` | At or below the RPC's `safe` block |
| `finalized` | At or below the RPC's `finalized` block |

`confirmed` means included, not final. Call `status` again later to see finality move forward.

## Reorgs

If a receipt disappears, or its block hash no longer matches the canonical block at that height, `status` moves the operation back to `submitting` for toolkit-signed transactions or `walletPending` for wallet transactions. Run `execute` with the same ID to rebroadcast the same signed bytes.

## Cancel an unsigned plan

```sh
evm cancel --input '{"id":"PLAN_ID"}'
```

`cancel` works only on a `prepared` plan. A cancelled plan cannot be executed. A submitted transaction cannot be cancelled this way. Use `replace` with `cancel: true`.

## Replace a stuck transaction

`replace` prepares a new plan with the same nonce as an unresolved transaction this toolkit signed with a local key.

| Field | Meaning |
| --- | --- |
| `id` | The original operation |
| `key` | A new key for the replacement |
| `gasPrice` | New max fee per gas, or gas price for legacy |
| `maxPriorityFeePerGas` | New priority fee cap, needed for EIP-1559 |
| `cancel` | `true` sends zero value to your own address with empty calldata, `false` repeats the original call |

```sh
evm replace --input '{"id":"PLAN_ID","key":"pay-recipient-001-bump","gasPrice":"4000000000","maxPriorityFeePerGas":"2000000000","cancel":false}'
```

Each fee cap must be at least 13 percent higher than the original's. For legacy transactions only `gasPrice` applies. The original must be `submitting` or `pending`. A `walletPending` transaction cannot be replaced with this command.

The replacement is a normal plan with its own fingerprint. Execute it separately. Before signing, it checks that the original is still pending and refuses if the original was already included. Whichever transaction is included first wins, and `status` marks the other `superseded`.

## Attach a wallet transaction

When a browser wallet or WalletConnect sends a transaction but its response is lost, `execute` fails with `SubmissionUncertain` and the operation stays `walletPending` without a hash. Find the transaction hash in the wallet's activity and attach it:

```sh
evm attach-transaction --input '{"id":"PLAN_ID","hash":"0xTRANSACTION_HASH"}'
```

The toolkit fetches the transaction and checks sender, destination, calldata, value and nonce, and that its gas and fee caps are not above the plan's. A mismatch fails with `InvalidInput`. A match is reconciled like any other operation.

## List operations

`operations` returns up to 100 recent operations from the journal without touching the network. Public results never include signed transaction bytes.

For interrupted submissions, locks and Crossmint operations, see [Recovery](/docs/evm/recovery).
