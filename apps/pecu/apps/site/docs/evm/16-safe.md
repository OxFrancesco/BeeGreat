---
title: Safe wallets
description: Create and run Safe 1.4.1 organization wallets with owner approvals, batches, agent budgets, scoped roles, passkey owners and sponsored gas.
group: CLI
---

A Safe needs a threshold of its owners to approve each transaction. It can have one owner or require, for example, two of three. Several owners controlled by one secret do not give independent custody.

## What is verified

- The Safe proxy and its singleton must match the official Safe 1.4.1 code from the Safe deployments registry for that chain. Predictions use the Safe singleton on Ethereum mainnet and the L2 singleton elsewhere.
- Only three module types are accepted, Allowance 0.1.1, Safe 4337 0.3.0 and Zodiac Roles 2.1.1, each checked against pinned addresses and code hashes. A Roles module must be owned by the Safe and use it as avatar and target.
- A Safe with an unknown module, or with more than 32 enabled modules, is refused.
- Passkey owners use the pinned Safe WebAuthn signer factory and P-256 verifier.

A chain must have these deployments at the pinned addresses. Otherwise the commands fail with `InvalidInput`.

## How the commands fit together

Safe commands return one of three things:

| Kind | Commands | What you do next |
| --- | --- | --- |
| Read | `safe-info`, `safe-predict`, `safe-approvals`, `safe-budget`, `safe-module-info`, `safe-role-check`, `safe-passkey-address` | Nothing |
| Proposal | `safe-propose`, `safe-batch-propose`, `safe-cancel-propose`, `safe-owner-propose`, `safe-module-propose`, `safe-budget-propose`, `safe-budget-revoke-propose`, `safe-role-grant-propose`, `safe-role-revoke-propose`, `safe-passkey-owner-propose`, `safe-sponsored-enable-propose` | Owners approve it, then someone executes it |
| Plan | `safe-deploy`, `safe-approve`, `safe-execute`, `safe-execute-signatures`, `safe-budget-spend`, `safe-roles-deploy`, `safe-role-execute`, `safe-passkey-deploy` | Review it and run `execute`, like any other plan |

A proposal is a Safe transaction bound to the chain, Safe, destination, value, calldata, operation and the Safe's current nonce, plus its hash. Nothing is stored or signed. Keep the whole returned object, because the approval commands take it as `transaction`.

Native values are wei, token amounts are base units, and thresholds are owner counts.

## Create a Safe

```sh
evm safe-predict --input '{"chainId":8453,"owners":["0xOWNER_A","0xOWNER_B","0xOWNER_C"],"threshold":2,"saltNonce":"123456"}'
evm safe-deploy --input '{"chainId":8453,"owners":["0xOWNER_A","0xOWNER_B","0xOWNER_C"],"threshold":2,"saltNonce":"123456","account":"0xYOUR_ADDRESS","key":"treasury-deploy"}'
```

`safe-predict` returns the deterministic `safe` address, the factory, singleton, deployment calldata and whether it is already `deployed`. `safe-deploy` returns a plan that calls the Safe factory, plus the same `deployment` details. `account` pays for the deployment and does not need to be an owner. Execute the plan separately.

Owners must be 1 to 32 distinct addresses, excluding the zero address, `0x0000000000000000000000000000000000000001` and the Safe itself. The threshold must be between 1 and the number of owners. `saltNonce` is a decimal string below 2^256.

## Propose, approve and execute

```sh
evm safe-propose --input '{"chainId":8453,"safe":"0xSAFE","to":"0xRECIPIENT","value":"1000000000000000","data":"0x"}'
```

`safe-propose` returns the proposal with its `nonce` and `hash`. Refund fields are always zero. `operation` defaults to `0`, a CALL. The destination cannot be the zero address. Calls to the Safe itself are limited to recognized Safe administration functions.

Each owner then approves on chain:

```sh
evm safe-approvals --input '{"chainId":8453,"transaction":{"chainId":8453,"safe":"0xSAFE","to":"0xRECIPIENT","value":"1000000000000000","data":"0x","nonce":"4","hash":"0xSAFE_TX_HASH"}}'
evm safe-approve --input '{"chainId":8453,"transaction":{"chainId":8453,"safe":"0xSAFE","to":"0xRECIPIENT","value":"1000000000000000","data":"0x","nonce":"4","hash":"0xSAFE_TX_HASH"},"account":"0xOWNER_A","key":"treasury-4-owner-a"}'
```

`safe-approvals` recomputes the hash, rejects a changed payload or a stale nonce, and returns the owners, the owners who `approved`, the `threshold` and whether it is `ready`. `safe-approve` returns a plan that calls `approveHash` from one owner's account. Execute that plan with the owner's signer. An owner that is itself a contract must send the same calldata through its own contract.

Once `ready` is `true`, anyone can prepare the execution:

```sh
evm safe-execute --input '{"chainId":8453,"transaction":{"chainId":8453,"safe":"0xSAFE","to":"0xRECIPIENT","value":"1000000000000000","data":"0x","nonce":"4","hash":"0xSAFE_TX_HASH"},"account":"0xYOUR_ADDRESS","key":"treasury-4-execute"}'
```

`safe-execute` fails until the threshold of on-chain approvals exists. To execute with signatures collected off chain instead, use `safe-execute-signatures` with a `signatures` array of `{ owner, data, contract }` entries from distinct current owners that meet the threshold. It simulates contract signature checks, including passkey signatures, before returning the plan.

An `approveHash` approval is permanent for that hash. The outer plan's expiry does not expire it.

## Cancel a proposal

`safe-cancel-propose` takes `chainId` and `safe` and returns a zero-value call from the Safe to itself at the current nonce. Owners must approve and execute it before a competing proposal to invalidate that proposal. Cancellation can lose that race. Cancelling locally revokes nothing on chain.

## Change owners

`safe-owner-propose` takes `chainId`, `safe` and one `change`:

| `change` | Effect |
| --- | --- |
| `{"kind":"add","owner":"0xOWNER","threshold":2}` | Adds an owner and sets the threshold |
| `{"kind":"remove","owner":"0xOWNER","threshold":1}` | Removes an owner and sets the threshold |
| `{"kind":"replace","owner":"0xOWNER","replacement":"0xOWNER_NEW"}` | Swaps one owner for another |
| `{"kind":"threshold","threshold":2}` | Changes the threshold |

The current owners must approve and execute the change. Replacing a lost signer keeps the Safe address, assets and threshold, but the surviving owners must still meet the current threshold. There is no recovery once too few owners remain.

## Batches

`safe-batch-propose` takes up to 64 CALLs and wraps them in the official MultiSendCallOnly contract:

```json
{"chainId":8453,"safe":"0xSAFE","calls":[{"to":"0xRECIPIENT","value":"1000000000000000","data":"0x"},{"to":"0xRECIPIENT_B","value":"2000000000000000","data":"0x"}]}
```

The batch is atomic. If one call fails, none apply. Delegatecall is allowed only for this validated batch contract with zero outer value. Arbitrary delegatecall and nested delegated calls are rejected.

## Modules

`safe-module-info` verifies a module and reports whether it is enabled. `safe-module-propose` takes `module` and `enabled` and proposes enabling or disabling a verified module. An enabled module can act under its own rules without further owner approval, so owners approve every change to module authority.

## Agent budgets

A budget lets a delegate account spend a capped amount of one token from the Safe without an owner vote for each payment. It uses the Safe Allowance module.

```sh
evm safe-budget-propose --input '{"chainId":8453,"safe":"0xSAFE","delegate":"0xYOUR_ADDRESS","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"50000000","resetMinutes":1440}'
```

This proposes a 50 USDC budget that refills every 1440 minutes. Use the zero address as `token` for ETH. `resetMinutes` of `0` makes a one-time budget. The amount must fit in a uint96. The delegate cannot be the zero address, `0x0000000000000000000000000000000000000001` or the Safe. The proposal is one batch that enables the module if needed, adds the delegate and sets the budget.

| Command | Input | Result |
| --- | --- | --- |
| `safe-budget` | `chainId`, `safe`, `delegate`, `token` | `amount`, `spent`, `remaining`, `resetMinutes`, `lastResetMinutes`, `nonce` and whether the module is `enabled` |
| `safe-budget-spend` | `chainId`, `safe`, `account`, `token`, `to`, `amount`, `key` | A plan for the delegate `account`. No owner vote. You still approve it with `execute`. |
| `safe-budget-revoke-propose` | `chainId`, `safe`, `delegate`, `token` | A proposal that deletes the budget |

A budget limits amount, not recipients. Use roles when the recipient or the contract action must be fixed too. To remove every budget at once, disable the module with `safe-module-propose`.

## Scoped roles

Zodiac Roles lets a member call specific functions on specific contracts through the Safe, with fixed or capped arguments.

1. Prepare and execute `safe-roles-deploy` with `chainId`, `safe`, `saltNonce`, `account` and `key`. The result includes the new `module` address. The module starts with no authority.
2. Propose `safe-role-grant-propose`, then have owners approve and execute it. The proposal enables the module if needed, scopes each permission and assigns the member.
3. Check the setup with `safe-module-info` and simulate the call you plan to make with `safe-role-check`.
4. Prepare `safe-role-execute` as the member account and execute it.

```json
{"chainId":8453,"safe":"0xSAFE","module":"0xROLES_MODULE","role":"0x1212121212121212121212121212121212121212121212121212121212121212","member":"0xYOUR_ADDRESS","permissions":[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","selector":"0xa9059cbb","parameters":[{"kind":"equal","value":"0xPADDED_RECIPIENT"},{"kind":"max","value":"5000000"}]}]}
```

This grant lets the member send at most 5 USDC per call, only to one recipient. `role` is any nonzero 32-byte value you choose. Each permission fixes a target and a 4-byte selector. `parameters` lists the function's arguments in order. `equal` fixes an argument to an exact 32-byte value, so an address is left-padded with zeros to 32 bytes. `max` caps an unsigned argument, inclusive. A grant takes 1 to 16 permissions with up to 32 parameters each.

`safe-role-check` and `safe-role-execute` take `chainId`, `safe`, `module`, `role`, `account`, `to` and `data`. `safe-role-execute` also takes `key`. The call reverts if the permission is denied or the inner call fails. `safe-role-revoke-propose` removes a member from a role.

Limits of the permission builder:

- Static ABI arguments only. Dynamic tuples, arrays and bytes are not supported.
- No native ETH value and no delegatecall.
- A permission cannot target the zero address, the Safe or its Roles module.
- A grant updates only the functions it lists. It does not clear earlier grants or other memberships. Use a fresh role key for a separate policy.
- Token approvals give the spender authority of its own. Fix the spender and cap the amount.

A member can be another Safe with a lower threshold. That Safe proposes a CALL to the Roles module's `execTransactionWithRole`, its own threshold authorizes it, and the treasury's role limits still apply. The treasury threshold does not change.

## Passkey owners

In a browser, import `createSafePasskey` and `signSafeWithPasskey` from `@beegreat/evm/safe/passkey-browser`. Registration uses WebAuthn P-256 with user verification required. Store the returned credential ID and public key coordinates for that user and relying-party domain. The private key stays in the authenticator.

| Command | Input | Result |
| --- | --- | --- |
| `safe-passkey-address` | `chainId`, `safe`, `passkey` with `x` and `y` as decimal strings | The signer contract `owner`, `factory`, `verifier` and whether it is `deployed` |
| `safe-passkey-deploy` | Same plus `account` and `key` | A plan that deploys the signer contract. It does not add an owner. |
| `safe-passkey-owner-propose` | `chainId`, `safe`, `passkey`, `threshold` | A proposal that adds the deployed signer as an owner |

`signSafeWithPasskey` checks the chain and the full Safe transaction hash before asking for a WebAuthn assertion. It returns signatures for `safe-execute-signatures`. Replace or remove a lost passkey with `safe-owner-propose` while enough other owners remain. There is no guardian recovery module.

## Sponsored gas

A Safe can run CALLs as an ERC-4337 UserOperation paid by a paymaster. Configure one bundler and paymaster for one chain with `EVM_SAFE_RELAY_CHAIN_ID`, `EVM_SAFE_BUNDLER_URL`, `EVM_SAFE_PAYMASTER_URL` and optionally `EVM_SAFE_SPONSORSHIP_POLICY_ID`, and configure an RPC for the same chain. See [Configuration](/docs/evm/configuration#environment-variables).

1. For an existing Safe, owners approve and execute `safe-sponsored-enable-propose`, which enables the verified 4337 module and fallback handler. A new Safe can be deployed by its first sponsored operation.
2. `safe-sponsored-propose` takes `chainId`, `wallet`, `calls` and `key`. `wallet` is `{ "safe": "0xSAFE" }` or `{ "owners": [...], "threshold": 2, "saltNonce": "123456" }`. `calls` are up to 64 CALLs. The result has the full operation, its `fingerprint` and a `validUntil` ten minutes out.
3. Collect owner signatures. `safe-sponsored-sign` with `id` and `fingerprint` signs with the local key. `safe-sponsored-signature` attaches an externally produced signature as `{ owner, data, contract }`. It must be a SafeOp signature. A normal Safe transaction signature does not work.
4. `safe-sponsored-submit` with `id` and `fingerprint` checks the threshold, simulates the signed EntryPoint call, stores the UserOperation hash, then sends it to the bundler. A retry reuses the same operation.
5. `safe-sponsored-status` with `id` verifies the EntryPoint event, sender, nonce, paymaster and canonical receipt block.

Sponsored operations move through `prepared`, `pending`, `confirmed`, `reverted` and `cancelled`. After a timeout, run `safe-sponsored-status` before anything else. `safe-sponsored-cancel` cancels only an unsubmitted local record. It cannot revoke signatures held elsewhere, which stay usable until `validUntil` passes or the nonce is used. Paymaster funding and eligibility are the provider's policy. Inclusion is not a finality guarantee.

> [!WARNING]
> Owner approvals, budgets and role grants authorize real spending from the Safe. An `approveHash` approval cannot be withdrawn, and a budget or role lets its holder spend without a new owner vote. Check every address, amount and permission before owners approve.
