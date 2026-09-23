---
title: Agent conventions
description: How every command takes JSON input, returns JSON output, reports errors, and handles quantities, idempotency keys, approvals and states.
group: Start
---

Run `evm discover` before you build input for a command you have not used. Its schemas are generated from the same definitions the commands decode, so they cannot drift from the code.

## Input

Each call runs one command. Pass its JSON input through exactly one of these flags:

| Flag | Source |
| --- | --- |
| `--input '<json>'` | Inline string |
| `--file <path>` | File contents |
| `--stdin` | Standard input |

With no input flag the command receives `{}`. Two input flags fail with `InvalidInput`. Unknown fields also fail with `InvalidInput`, so a misspelled field is an error instead of being ignored.

```sh
evm balance --input '{"chainId":8453,"address":"0xYOUR_ADDRESS"}'
evm prepare-call --file plan.json
printf '%s' "$INPUT" | evm read --stdin
```

Passing JSON through standard input keeps user-supplied bytes out of shell parsing.

## Output

A successful command prints one line to standard output and exits with status 0:

```json
{"version":1,"ok":true,"command":"balance","result":{"chainId":8453,"address":"0xYOUR_ADDRESS","block":"30000000","balanceWei":"1500000000000000"}}
```

A failed command prints one line to standard output and exits with status 1:

```json
{"version":1,"ok":false,"error":{"code":"ApprovalRequired","message":"Review operation PLAN_ID, then pass --approve 0xFINGERPRINT or --yolo.","retryable":false}}
```

Wallet pairing links and QR codes go to standard error, so standard output stays machine-readable. Every result is checked against the command's published output schema before it is printed. If an unexpected failure escapes, the error is `InvalidState` and its message says that no success is assumed.

## Streaming output

`watch` and `watch-contract` print one JSON line per sample, each with the same envelope as above. Through the SDK, MCP and the TUI, the same commands return the collected array after the last sample. See [Monitoring](/docs/evm/monitoring).

## Quantities

- On-chain integers are decimal strings, such as `"1000000"`. Hex strings, JSON numbers, signs, leading zeros and decimal points are rejected.
- Native values and balances are in wei.
- Token amounts are in base units. One USDC, which has 6 decimals, is `"1000000"`.
- `chainId` is a JSON integer.
- `deadline` on plans and `expiresAt` on policies are Unix time in milliseconds, as JSON numbers.

`units` converts a decimal amount to base units and refuses to round:

```sh
evm units --input '{"amount":"1.25","decimals":6}'
```

```json
{"version":1,"ok":true,"command":"units","result":{"baseUnits":"1250000","decimal":"1.25","decimals":6}}
```

`{"amount":"1.0000001","decimals":6}` fails with `InvalidInput` because it has more fractional digits than the token supports.

## Idempotency keys

Every command that creates a plan, workflow, bridge, batch, typed-data signature or sponsored Safe operation takes a `key`. A key is 1 to 100 letters, digits, `_` or `-`.

- The same key with the same action returns the existing record in its current state. Nothing new is created.
- The same key with a different action fails with `IdempotencyConflict`. Sponsored Safe operations report it as `InvalidInput`.
- The operation ID is derived from the key, so it is known before any network call.
- For transaction plans, "the same action" means the same chain, account, destination, calldata, value, policy and deadline.

Use one key per intended action. After a timeout or an uncertain response, inspect the existing record and reuse its key or ID. A new key creates a second action. Use a new key only when the old plan expired or was cancelled and you have confirmed that nothing was sent.

## Approvals

Commands that can sign accept one approval:

| Approval | CLI flag | JSON `approval` field |
| --- | --- | --- |
| Exact | `--approve 0xFINGERPRINT` | `{"_tag":"approved","fingerprint":"0xFINGERPRINT"}` |
| Autonomous | `--yolo` | `{"_tag":"yolo"}` |
| None | No flag | `{"_tag":"required"}` |

The flags work only on `execute`, `workflow-run`, `bridge-run`, `batch-run` and `sign-typed-data`. Passing a flag and an `approval` field together is rejected. Without an approval, the command fails with `ApprovalRequired`, and the message names the fingerprint to approve.

A plan's fingerprint covers its intent, simulation block, gas limit, fees and expiry. Any change to the plan produces a different fingerprint, so an exact approval cannot carry over to a plan you did not review.

`--yolo` removes the toolkit's approval check for that single invocation. Simulation, chain, account, expiry and policy checks still run, and interactive wallets still ask their owner.

## Operation states

Every transaction plan has a `state` object whose `_tag` is one of these:

| State | Meaning |
| --- | --- |
| `prepared` | Simulated and stored. Not signed. |
| `submitting` | Signed bytes, hash and nonce are stored. Broadcast has not been confirmed as accepted. |
| `pending` | The RPC accepted the signed bytes. No receipt yet. |
| `walletPending` | An external wallet or Crossmint holds the request. The hash can be `null` until the wallet returns it. |
| `confirmed` | Included and successful. `finality` is `included`, `safe` or `finalized`. |
| `reverted` | Included and failed. |
| `superseded` | Another operation with the same nonce was included. `by` names it. |
| `cancelled` | An unsigned plan cancelled locally. |

The toolkit never merges these. Unsigned (`prepared`), signed but unresolved (`submitting`, `walletPending`), pending, included (`confirmed`, `reverted`) and cancelled stay distinct in every interface. `confirmed` means included, not final. A reorg can move an operation back to `submitting` or `walletPending`.

Workflows, wallet batches, bridges and sponsored Safe operations have their own state sets, described on their pages.

## Error codes

Every error has a stable `code`, a `message` and a `retryable` flag. `retryable: true` means the same call can be repeated, which mostly applies to RPC and provider reads. It never means that a write should be recreated under a new key.

| Code | What it means | What to do |
| --- | --- | --- |
| `InvalidInput` | Input failed its schema, arguments did not match the ABI, or a Safe rule rejected the request | Fix the input |
| `RpcError` | An RPC request failed or no configured endpoint responded | Retry the read, or check the RPC |
| `ChainMismatch` | An RPC, typed-data domain or smart wallet belongs to a different chain | Fix the chain or RPC configuration |
| `AbiUnavailable` | No bytecode at the address, or no ABI could be found | Supply `abi` or `signatures`, or set an Etherscan key |
| `SimulationReverted` | Simulation reverted | Nothing was stored or sent. Fix the call. |
| `ApprovalRequired` | No approval, or the fingerprint does not match | Review the plan, then approve its fingerprint |
| `SignerInteractionRequired` | No signer, the wallet needs an interactive terminal, or the wallet rejected before submission | Connect or reconnect the wallet |
| `AccountMismatch` | The signer is not the plan's account | Select the right wallet or key |
| `PlanExpired` | The plan, batch or deadline expired | Prepare again with a new key |
| `NotFound` | The operation, workflow, bridge, batch or monitor does not exist, or a name did not resolve | Check the ID or name |
| `IdempotencyConflict` | The key belongs to a different action | Reuse the original action, or pick a key for the new one |
| `AccountBusy` | Another operation for this account and chain is unresolved or executing | Reconcile the named operation first |
| `StorageError` | The journal could not be opened or updated | Preserve the database and inspect it before retrying |
| `SubmissionUncertain` | The broadcast, wallet or provider outcome is unknown | Run `status`, then follow [Recovery](/docs/evm/recovery) |
| `InvalidState` | The current state does not allow the request, or a signed or provider result did not match the plan | Read the message and inspect the operation |
| `PolicyDenied` | A policy refused the plan | Change the plan or use a different policy |
| `ProviderUnavailable` | Socket, Blockscout or Aero failed or returned an unexpected shape | Retry later if `retryable` is true |
| `QuoteExpired` | Reserved in the schema | The current source does not emit it |
| `OutcomeMismatch` | A workflow check failed, Crossmint reported failure, or a batch receipt reverted | Inspect the transaction before any new action |
| `CapabilityUnavailable` | The chain, RPC or wallet lacks a required feature | Use a supported chain, RPC or wallet |
