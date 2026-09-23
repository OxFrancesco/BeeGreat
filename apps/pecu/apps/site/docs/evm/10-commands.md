---
title: Command reference
description: Every command in the catalog, grouped by area, with what it does and whether it can sign.
group: CLI
---

This list matches the catalog of version 0.2.0. Run `evm discover` for the exact input and output schema of each command. Every command here is also an MCP tool and a TUI form.

The Kind column says what a command can change:

| Kind | Meaning |
| --- | --- |
| read | Reads the chain, a provider or the journal. Changes nothing, or only records reconciled receipts. |
| local | Writes to the local journal or wallet files only. |
| proposal | Returns a hash-bound Safe proposal. Nothing is stored or signed. |
| plan | Stores an unsigned plan, workflow or batch for review. Nothing is signed. |
| signs | Produces a signature. Nothing is broadcast. |
| sends | Can sign and broadcast transactions. Requires approval. |

## CLI verbs

These run outside the catalog and have no JSON input.

| Command | What it does |
| --- | --- |
| `evm discover` | Prints commands, schemas, error codes and conventions. Also the default with no command, `--help` or `-h`. |
| `evm tui` | Starts the terminal UI. Requires an interactive terminal. |
| `evm mcp` | Starts the MCP server over stdio. |
| `evm wallet connect` | Alias for `wallet-connect`. Takes `--browser` or `--smart`, `--chain` and `--name`. |
| `evm wallet status` | Alias for `wallets`. |
| `evm wallet select` | Alias for `wallet-select`. Takes `--name`. |
| `evm wallet disconnect` | Alias for `wallet-disconnect`. Takes `--name`. |

## Contracts and chain data

| Command | Kind | What it does |
| --- | --- | --- |
| `inspect` | read | Returns an ABI you supply, or discovers a verified ABI and resolves EIP-1967 proxies |
| `read` | read | Calls a view function at a recorded block |
| `decode` | read | Decodes calldata, an event or a custom error with an ABI |
| `identity` | read | Returns the implementation address and bytecode hash |
| `resolve-name` | read | Resolves an ENS name on a chain with an ENS registry |
| `balance` | read | Native balance in wei at a recorded block |
| `token` | read | ERC-20 symbol, decimals and balance at one block |
| `allowance` | read | One ERC-20 allowance at a recorded block |
| `block` | read | Latest block or a specific block |
| `transaction` | read | A transaction by hash, including raw calldata |
| `logs` | read | Contract logs in pages of up to 2000 blocks and 1000 records |
| `capabilities` | read | Probes EIP-1559, safe and finalized block tags, asset simulation, signer and Socket endpoint |
| `simulate` | read | Simulates up to 32 calls and traces asset changes where `eth_simulateV1` is supported |
| `units` | read | Converts a decimal amount to base units without rounding. No network. |

## Transactions

| Command | Kind | What it does |
| --- | --- | --- |
| `prepare` | plan | Simulates and stores a raw transaction |
| `prepare-call` | plan | Encodes a contract call, simulates it and stores the plan |
| `execute` | sends | Signs and broadcasts a stored plan, or rebroadcasts its stored signed bytes |
| `status` | read | Reconciles an operation with its receipt. Never signs or broadcasts. |
| `wait` | read | Polls an operation for up to 30 passes, one second apart |
| `cancel` | local | Cancels an unsigned plan |
| `operations` | read | Lists up to 100 recent operations from the journal. No network. |
| `replace` | plan | Prepares a same-nonce fee replacement or cancellation |
| `attach-transaction` | local | Attaches a wallet transaction hash after a lost response, once it matches the plan |

## Assets

| Command | Kind | What it does |
| --- | --- | --- |
| `transfer` | plan | Native or ERC-20 transfer in base units |
| `approve` | plan | Exact ERC-20 allowance |
| `revoke` | plan | ERC-20 allowance of zero |
| `wrap` | plan | Deposit to or withdraw from a wrapped-native contract you specify |

## Wallets and signatures

| Command | Kind | What it does |
| --- | --- | --- |
| `wallet` | read | The signer address and its source. Never returns secrets. |
| `wallets` | read | Named connected wallets and the selected one |
| `wallet-connect` | local | Connects a browser, WalletConnect or Crossmint smart wallet. Interactive terminals only. |
| `wallet-select` | local | Selects a connected wallet by name |
| `wallet-disconnect` | local | Forgets a wallet connection and ends its WalletConnect session |
| `wallet-capabilities` | read | EIP-5792 batching and sponsorship support in the connected wallet |
| `sign-typed-data` | signs | Previews an EIP-712 digest, then signs it with approval |

## Wallet batches

| Command | Kind | What it does |
| --- | --- | --- |
| `batch-prepare` | plan | Stores an EIP-5792 batch of up to 32 calls with explicit atomicity and an optional paymaster |
| `batch-run` | sends | Submits an approved batch once, after storing its ID |
| `batch-status` | read | Queries the wallet for the same batch ID and verifies receipts |

## Policies

| Command | Kind | What it does |
| --- | --- | --- |
| `policy-create` | local | Creates an immutable named policy with limits, budgets and expiry |
| `policy-revoke` | local | Revokes a policy. Later signing under it is refused. |
| `policies` | read | Lists policies and their spending reservations |

## Workflows

| Command | Kind | What it does |
| --- | --- | --- |
| `workflow-create` | plan | Stores up to 32 ordered intents with optional outcome checks. Not atomic. |
| `workflow-run` | sends | Runs or resumes a workflow and stops on a pending, reverted or failed step |
| `workflow-status` | read | Reconciles each workflow transaction without sending |
| `workflow-cancel` | local | Stops future steps. Submitted steps stay recoverable. |
| `verify-outcome` | read | Reads a contract and asserts an expected value |

## Swaps and bridging

| Command | Kind | What it does |
| --- | --- | --- |
| `socket-chains` | read | Chains Socket supports |
| `socket-tokens` | read | Searches Socket assets on one chain by symbol or address |
| `socket-quote` | read | Current Socket V3 swap or bridge routes |
| `swap` | plan | Stores a same-chain Socket route and its approvals as a workflow |
| `bridge-prepare` | plan | Stores a cross-chain Socket route and its approvals as a workflow |
| `bridge-run` | sends | Runs the stored bridge workflow, then checks settlement |
| `bridge-status` | read | Reconciles source transactions and Socket destination status |
| `bridge-wait` | read | Polls settlement for up to 60 passes, five seconds apart |

## Protocols and indexed data

| Command | Kind | What it does |
| --- | --- | --- |
| `aero` | read or plan | Runs an Aero read or planner. With `key`, transaction plans become a workflow. |
| `vault` | plan | ERC-4626 deposit or redeem workflow with an outcome check |
| `lending` | plan | Aave-compatible supply or withdraw workflow for a pool you specify |
| `portfolio` | read | Indexed token holdings, NFTs, history or transfers with coverage notes |

## Monitoring

| Command | Kind | What it does |
| --- | --- | --- |
| `watch` | read | Samples the latest block at a fixed interval |
| `watch-contract` | local | Repeats a contract read and reports changes across restarts |
| `monitor-create` | local | Creates a contract event monitor with confirmations and a cursor |
| `monitor-poll` | local | Returns the next event batch, repeating it until acknowledged |
| `monitor-ack` | local | Acknowledges the exact batch and advances the cursor |
| `monitor-pause` | local | Pauses or resumes a monitor without losing its cursor |
| `monitors` | read | Lists stored monitors |

## Saved contracts

| Command | Kind | What it does |
| --- | --- | --- |
| `workspace` | read | Lists saved contract aliases |
| `save` | local | Saves or updates a chain-specific alias |
| `remove` | local | Removes an alias |

## Safe wallets

| Command | Kind | What it does |
| --- | --- | --- |
| `safe-predict` | read | Predicts a deterministic Safe address |
| `safe-deploy` | plan | Plans deployment of a Safe with explicit owners and threshold |
| `safe-info` | read | Owners, threshold, nonce and verified enabled modules |
| `safe-propose` | proposal | A CALL proposal at the current Safe nonce |
| `safe-batch-propose` | proposal | An atomic batch of up to 64 CALLs |
| `safe-approvals` | read | Verifies a proposal and reads on-chain owner approvals |
| `safe-approve` | plan | One owner's `approveHash` transaction |
| `safe-execute` | plan | Safe execution once enough owners approved on chain |
| `safe-execute-signatures` | plan | Safe execution with collected EOA, contract or passkey signatures |
| `safe-cancel-propose` | proposal | A zero-value self-call at the current nonce |
| `safe-owner-propose` | proposal | Add, remove or replace an owner, or change the threshold |

## Safe modules, budgets and roles

| Command | Kind | What it does |
| --- | --- | --- |
| `safe-module-info` | read | Verifies a module and reads whether it is enabled |
| `safe-module-propose` | proposal | Enables or disables a verified module |
| `safe-budget` | read | Token budget, amount spent, remaining amount and reset period |
| `safe-budget-propose` | proposal | Enables the Allowance module if needed and sets a delegate budget |
| `safe-budget-revoke-propose` | proposal | Deletes a delegate budget |
| `safe-budget-spend` | plan | A transfer from the Safe within the caller's budget |
| `safe-roles-deploy` | plan | Deploys a Zodiac Roles module owned by the Safe. Grants nothing. |
| `safe-role-grant-propose` | proposal | Grants a member function permissions with static argument limits |
| `safe-role-revoke-propose` | proposal | Removes a member from a role |
| `safe-role-check` | read | Simulates an exact role call |
| `safe-role-execute` | plan | A CALL through the Roles module as the member |

## Safe passkey owners

| Command | Kind | What it does |
| --- | --- | --- |
| `safe-passkey-address` | read | Predicts the signer contract for a P-256 public key |
| `safe-passkey-deploy` | plan | Deploys the passkey signer contract. Does not add it as an owner. |
| `safe-passkey-owner-propose` | proposal | Adds a deployed passkey signer as an owner |

## Safe sponsored execution

| Command | Kind | What it does |
| --- | --- | --- |
| `safe-sponsored-enable-propose` | proposal | Enables the verified ERC-4337 module and fallback handler |
| `safe-sponsored-propose` | plan | Builds and stores a paymaster-sponsored Safe UserOperation |
| `safe-sponsored-sign` | signs | Signs the exact fingerprint with the local EOA owner key |
| `safe-sponsored-signature` | local | Attaches an external EOA or passkey owner signature |
| `safe-sponsored-submit` | sends | Submits the signed operation, storing its hash first |
| `safe-sponsored-status` | read | Reads status and verifies the on-chain EntryPoint event |
| `safe-sponsored-cancel` | local | Cancels an unsubmitted local operation |
