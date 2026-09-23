---
title: Policies and workflows
description: Limit what a signer may do with local policies, chain transactions into resumable workflows, and send EIP-5792 wallet batches.
group: CLI
---

## Policies

A policy is a named set of limits stored in the journal. The toolkit checks a plan against its policy when it signs, before anything is broadcast.

| Field | Meaning |
| --- | --- |
| `name` | Policy name, 1 to 100 letters, digits, `_` or `-` |
| `account` | The only account the policy authorizes |
| `chains` | Allowed chain IDs |
| `expiresAt` | Unix milliseconds. Signing fails at or after this time. |
| `maxFeeWei` | Fee cap per transaction, compared with `gas × gasPrice + l1FeeEstimate` |
| `nativeBudgetWei` | Total native value across every plan signed under the policy |
| `contracts` | Allowed targets, each with the 4-byte selectors it may call |
| `tokenBudgets` | Total ERC-20 amount per token across transfers and approvals |
| `recipients` | Allowed native recipients, ERC-20 recipients and ERC-20 spenders |
| `revoked` | Set `false` when you create the policy |

```sh
evm policy-create --input '{"name":"agent-session","account":"0xYOUR_ADDRESS","chains":[8453],"expiresAt":1798761600000,"maxFeeWei":"1000000000000000","nativeBudgetWei":"5000000000000000","contracts":[{"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","selectors":["0xa9059cbb"]}],"tokenBudgets":[{"token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"5000000"}],"recipients":["0xRECIPIENT"],"revoked":false}'
```

This policy lets one account on Base send up to 0.005 ETH and 5 USDC in total to one recipient, with a fee cap of 0.001 ETH per transaction, until 1 January 2027.

### How a plan is checked

At signing, the policy refuses the plan with `PolicyDenied` when any of these fails:

- The policy is not revoked and has not expired.
- The plan's account and chain match the policy.
- The plan's maximum fee fits `maxFeeWei`.
- A plan with calldata targets a listed contract with a listed selector.
- An ERC-20 `transfer` or `approve` names a listed recipient or spender, and its amount fits the remaining token budget. The token must have a budget entry.
- An ERC-20 `transferFrom` moves tokens from the policy's account to a listed recipient.
- A plan without calldata sends native value to a listed recipient.
- The plan's native value fits the remaining native budget.

### Reservations

A plan reserves its native value and token amount against the policy when it is signed. A retry of the same plan is not charged twice. Reservations are never released, including for failed, reverted and unresolved plans. An approval reserves its full amount even if the spender never uses it, and approvals and transfers draw from the same token budget.

For contract calls other than ERC-20 `transfer`, `approve` and `transferFrom`, only native value is counted. Tokens a protocol moves internally are not tracked by the token budget.

### Attach a policy

Name a policy on a single plan with the `policy` field, which `prepare`, `prepare-call`, `transfer`, `approve`, `revoke`, `wrap`, `bridge-prepare`, `swap`, `vault`, `lending`, `aero` and workflow step intents accept. To bind every plan, set `EVM_POLICY`. The signer then refuses any plan prepared under a different policy or none.

Policies are immutable. Creating a policy with an existing name fails with `InvalidState`. To change limits, revoke the policy and create one with a new name.

```sh
evm policy-revoke --input '{"name":"agent-session"}'
evm policies
```

`policies` lists every policy with its reservations.

### Where policies do not apply

| Signer or command | Result with a policy |
| --- | --- |
| Crossmint smart wallet | `CapabilityUnavailable`. Local limits cannot bound account-abstraction fees. |
| `batch-run` with `EVM_POLICY` set | `CapabilityUnavailable`. Use a workflow instead. |
| `sign-typed-data` with `EVM_POLICY` set | `PolicyDenied` |

Smart signers need limits enforced on chain. See [Safe budgets and roles](/docs/evm/safe#agent-budgets).

## Workflows

A workflow is an ordered list of up to 32 transaction intents, each with an optional outcome check. `workflow-create` stores it unsigned. Nothing is simulated until it runs. Steps are not atomic. An early step can be included and a later step can fail.

```json
{"key":"fund-and-check","steps":[{"label":"Send ETH","intent":{"chainId":8453,"account":"0xYOUR_ADDRESS","to":"0xRECIPIENT","value":"1000000000000000","data":"0x","key":"fund-step-1"},"check":{"call":{"chainId":8453,"address":"0xTOKEN","signatures":["function balanceOf(address) view returns(uint256)"],"functionName":"balanceOf","args":["0xRECIPIENT"]},"comparison":"atLeast","expected":"1000000"}}]}
```

```sh
evm workflow-create --file workflow.json
evm workflow-run --input '{"id":"WORKFLOW_ID"}' --approve 0xFINGERPRINT
```

`WORKFLOW_ID` and `0xFINGERPRINT` are `id` and `fingerprint` from the created workflow. The fingerprint covers every step.

Each step's `intent` takes the same fields as `prepare`. Its `check` reads a contract after the step is confirmed and compares the result with `expected`. `equal` compares JSON values. `atLeast` compares decimal integer strings.

### Running and resuming

`workflow-run` works through the steps in order. For each step it prepares a plan under a key derived from the workflow ID and step index, executes it, waits for the receipt, and runs the check. The step's own `key` field does not decide the plan's identity. The run stops and returns when a step is still pending, reverts, or fails its check with `OutcomeMismatch`.

Run `workflow-run` again with the same ID to resume. Confirmed steps are not sent again, and a check that already passed for the same transaction is not repeated.

| Workflow state | Meaning |
| --- | --- |
| `prepared` | No step has a plan yet |
| `pending` | Some steps have plans, and not all are confirmed and checked |
| `completed` | Every step is confirmed and every check passed |
| `reverted` | A step reverted |
| `cancelled` | Future steps will not run |

`workflow-status` reconciles every step without sending anything. `workflow-cancel` stops future steps. Steps already submitted stay recoverable through `status`. A cancelled workflow cannot be resumed. Create a new one with a new key.

### Check an outcome directly

`verify-outcome` runs one check on its own and returns the read result, or fails with `OutcomeMismatch`:

```json
{"call":{"chainId":8453,"address":"0xTOKEN","signatures":["function allowance(address owner,address spender) view returns(uint256)"],"functionName":"allowance","args":["0xYOUR_ADDRESS","0xSPENDER"]},"comparison":"equal","expected":"0"}
```

`vault`, `lending`, `swap`, `bridge-prepare` and `aero` with a `key` also produce workflows. Run them with `workflow-run`, or `bridge-run` for Socket routes.

## Wallet batches

EIP-5792 batches send several calls to a connected wallet in one request. Check support first with `wallet-capabilities`.

```json
{"key":"batch-001","chainId":8453,"account":"0xYOUR_ADDRESS","calls":[{"to":"0xRECIPIENT","data":"0x","value":"1000000000000000"}],"atomicRequired":true}
```

```sh
evm batch-prepare --file batch.json
evm batch-run --input '{"id":"BATCH_ID"}' --approve 0xFINGERPRINT
evm batch-status --input '{"id":"BATCH_ID"}'
```

`batch-prepare` stores up to 32 calls with an explicit `atomicRequired` flag and an optional `paymasterUrl`, which must start with `https://`. A batch expires 10 minutes after it is prepared.

`batch-run` checks the approval against the batch fingerprint and requires a connected wallet for the batch account. It simulates every call with `eth_simulateV1`, and fails with `CapabilityUnavailable` if the RPC lacks that method or `SimulationReverted` if a call reverts. It stores the batch as `submitting` before calling `wallet_sendCalls` with the batch ID.

`batch-status` asks the wallet about the same ID. It checks the ID, the chain and, when you required it, atomicity. A completed batch must come with receipts, and each receipt must be successful and in a canonical block.

| Batch state | Meaning |
| --- | --- |
| `prepared` | Stored, not sent |
| `submitting` | Stored before contacting the wallet. The outcome is unknown until `batch-status` answers. |
| `pending` | The wallet reports it in progress |
| `confirmed` | Receipts verified |
| `failed` | The wallet reports failure |
| `partial` | The wallet reports partial execution |

If the wallet's response is lost, run `batch-status` or `batch-run` again with the same ID. Never prepare a new batch for the same calls. Batches need a connected wallet, so `EVM_PRIVATE_KEY` alone cannot send them.
