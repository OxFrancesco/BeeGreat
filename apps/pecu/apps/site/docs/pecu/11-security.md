---
title: Security
description: How your wallet is held, what the AI can and cannot do, and every check between a request and a signed transaction.
group: Reference
---

Every Pecu transaction takes the same path. The AI can propose a transaction, but only code outside the AI validates it, saves it and sends it, and only after your confirmation or an explicit YOLO setting.

## How your wallet is held

- Each verified account gets one Crossmint smart wallet on Base. In X Chat, the account is the numeric sender ID that X Chat signs on every message. On the web, it is your verified linked X account, or your sign-in account when no X account is linked.
- Pecu's server holds the signer for every wallet. You never receive a private key or seed phrase, and Pecu never asks for one.
- Deposit relays come from a separate treasury wallet that belongs to Pecu.

> [!WARNING]
> This is not self-custody. The checks on this page are rules in Pecu's software, not limits enforced on-chain, and whoever controls Pecu's servers can sign for your wallet. Keep only amounts you are willing to trust to that.

## What the AI can do

The AI runs with a fixed list of tools. Everything else is denied.

| It can | Through |
| --- | --- |
| Read your wallet address and balances | Wallet tools |
| Read Aerodrome pools, positions, reward periods, stocks and quotes | One tool per Aerodrome read |
| Propose Aerodrome, stock, Aave and generic Base transactions | Proposal tools that can only save a preview |
| Read any Base token, allowance or contract, inspect verified ABIs and decode data | EVM read tools |
| Set up Whop deposits and check their status | Deposit tools |
| Read Nansen and Polymarket data and start Exa research | Analytics tools |
| Ask you a question with choices | A question tool that ends the turn |
| Propose Safe organization wallet actions | Safe tools |

It has no shell, filesystem, browser, code editing, web search, subagents or general network access.

## What the AI cannot do

- Confirm a preview. Confirmation is a separate message from you, handled by code the AI never touches.
- Turn on YOLO. Only your `/yolo on` command changes it.
- Choose the wallet or chain. Tools bind your own wallet and Base, and a wallet override or another chain is rejected.
- Create more than one preview for a message, or any preview while its own question to you is still open.
- Move tokens through a generic contract call. A call that uses ERC-20 `transfer`, `approve`, `transferFrom`, `increaseAllowance` or `permit`, ERC-721 `setApprovalForAll` or `safeTransferFrom`, ERC-1155 `safeTransferFrom` or `safeBatchTransferFrom`, or Aave `approveDelegation` is rejected. Generic calls also wait for your confirmation, even with YOLO on.

## How plans are built

Every transaction starts as an unsigned plan, built by a service that cannot sign.

- Aerodrome and stock plans come from the [Aero SDK](/docs/aero).
- Generic Base reads and plans run the `evm` CLI from [evmSDK](/docs/evm) in an isolated sandbox. It accepts one allow-listed read or plan-building command per request. Commands that sign, broadcast, connect wallets or recover journals are not on the list, and every request must target Base.
- The sandbox receives its input as JSON, never through shell parsing. Each call works in a temporary folder that is deleted before the response returns. The sandbox holds no wallet keys.
- Before building a transfer or approval, Pecu reads the token's decimals and your balance. It refuses amounts above your balance and transfers to your own wallet.

## Checks before a plan is saved

Pecu validates each plan against the action you asked for before saving it.

- Every call must come from your wallet and must not target the zero address or your own wallet.
- Aerodrome and stock plans have 1 to 16 calls. Approvals come first, use only approval functions and send no ETH. Exactly one main action comes last.
- A transfer is either plain ETH with a positive amount or a single ERC-20 `transfer`. An approval is a single ERC-20 `approve`, and a revoke must set the allowance to zero.
- Aave plans must be for Base and for your wallet.
- A deposit relay must be one USDC transfer on Base, to your wallet, for the exact deposit amount.

## How plans are saved and sent

- Pecu saves the exact calls with a SHA-256 digest of them, the action, the expiry and a hash of the confirmation code.
- On confirmation, Pecu checks the sender, conversation, state and expiry, validates the plan against your wallet again and recomputes the digest. A mismatch fails the plan and nothing is sent.
- Only one execution of a plan can run at a time, and a repeated message is answered from its saved reply instead of running again.
- Each step's transaction ID from the wallet provider is saved before approval. If Pecu restarts midway, it resumes from the first unfinished step.
- Pecu asks the wallet provider to approve a step only while that step is still waiting for approval, so no step is submitted twice.

## Confirmation scope

- Codes are six characters from a 32-character alphabet, about 1.07 billion combinations.
- A code is looked up together with your account and conversation. Another account cannot use it, and neither can you from another conversation.
- In X Chat, replying `confirm` uses the code from Pecu's own saved message, or from a reply preview that X has validated. Quoted or pasted text is never trusted, and the message you reply to must contain exactly one code.
- Deposit relays have no code and cannot be confirmed or cancelled from chat.

## Receipt verification

A transaction counts as successful only after Pecu verifies its receipt on Base.

- The receipt's block must still be part of the chain.
- The receipt must contain a `UserOperationEvent` from a known EntryPoint, version 0.6, 0.7 or 0.8, whose operation hash and sender match the approved operation.
- The event's `success` flag must be set. A bundler transaction can succeed while the operation inside it reverts, and Pecu reports that as a revert.
- A receipt that is not available yet leaves the transaction pending. Sending the same `/confirm` code checks again without resubmitting.
- A plan is marked failed only when nothing was approved, the wallet provider reports a failure, or a verified receipt shows a revert. Any other error after approval keeps it pending.

## Verbose output

Normal replies never include JSON, call data, wei amounts or internal plan IDs. `b/verbose` shows the latest technical result saved for your account in the current conversation. It does not rerun anything, and other accounts cannot read it.

## Organization wallets

Pecu can create and use Safe organization wallets when you ask in plain words. Their transactions use the same preview and confirmation flow. A Safe is only as independent as its owners. Several owner wallets that are all held by Pecu are controlled by the same server, so they are not independent signers.

## Data shared with other services

| Service | What it receives |
| --- | --- |
| OpenAI, through your ChatGPT subscription or OpenRouter | Your AI conversations |
| TypeSafe, when classification is on | The text of your current message only |
| Crossmint | Your wallet and the transactions you confirm |
| Nansen | The addresses and tokens you ask about, with your wallet as the default |
| Aave's public service | Your wallet address, for Aave reads and previews |
| Polymarket | Public read requests |
| Exa | Your question, when you start Polymarket research |
| Whop | Your email and your deposits |
| PostHog | Usage events with a hashed account ID, without message text, replies, emails, wallet addresses, amounts or codes |

## Known gaps in live testing

These paths are covered by automated tests and fixtures. As of September 2026, the project has no recorded end-to-end production check for them:

- Receipt verification against a real Crossmint user operation, and a funded transaction confirmed end to end with its receipt checked.
- The hosted EVM sandbox and its cold-start time.
- Live Whop deposits and relays. Webhook checks, holds and the relay path are covered by tests only.
- Automatic acceptance of new message requests on X.
- Nansen and Polymarket answers inside a live chat where the AI picks the reads. Their data adapters were checked with fixtures and direct API calls.
