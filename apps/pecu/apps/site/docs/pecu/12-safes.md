---
title: Safes
description: Create Safe wallets with several owners at pecu.app/profile, collect approvals from Pecu and browser wallets, and manage owners and spending limits.
group: Use
---

A Safe is a wallet on Base that runs a transaction only after enough of its owners approve it, for example two of three. pecu.app/profile is where you create Safes, group them into organizations and approve their transactions. Open it from Profile in the account menu, or go to the address directly.

## Organizations

An organization is a named group of Safes with a shared list of names for owner addresses. It exists only in your Pecu profile. Deleting an organization removes it and its names from your profile. The Safes stay on Base with their funds, and you can add them again by address.

You can have up to 20 organizations, with up to 20 Safes and 100 saved names in each.

## Create a Safe

In an organization, press Add Safe, then Create new.

1. Name the Safe.
2. Pick the owners. Your Pecu wallet and your connected browser wallet are listed and checked. Add any other owner by address, with an optional name.
3. Choose how many owners must approve each transaction.
4. Press Review Safe. Pecu shows the usual transaction card. Confirm it to create the Safe from your Pecu wallet, which pays the network fee.

The Safe shows as Creating until the transaction is confirmed on Base. If you cancel the card or it expires, the Safe shows as Not created and you can remove it.

To add a Safe that already exists, pick Add existing and paste its address. Pecu accepts Safe 1.4.1 wallets on Base with no modules other than spending limits, sponsored transactions and Zodiac Roles.

## Owners and approvals

Each owner approves in one of three ways.

| Owner | How it approves |
| --- | --- |
| Your Pecu wallet | Approve with Pecu wallet records the approval on Base after you confirm the card. |
| A browser wallet you connect | Sign with your wallet signs the transaction in the wallet. It costs nothing and sends nothing. |
| Anyone else | They add the same Safe to their own Pecu profile and approve there, or approve on Base with another Safe tool. |

Connect a browser wallet with Connect wallet in the top bar. Pecu finds wallet extensions such as Rabby or MetaMask. The wallet switches to Base before it signs. Disconnect it from the same menu.

> [!WARNING]
> Every Pecu wallet is signed by Pecu's server. A Safe whose owners are all Pecu wallets is not independently controlled. Give at least some owners wallets they hold themselves.

## Propose a transaction

Press New transaction to send ETH, USDC, AERO or another token from the Safe. Amounts are in normal units. The transaction joins the Safe's queue with no approvals. Proposing it approves nothing.

Owner changes are proposals too. On the Owners tab you can add, remove or replace an owner and change the required approvals. Replacing an owner keeps the Safe's address, funds and required approvals. There is no recovery if too few owners remain to meet the requirement.

The profile proposes sends, owner changes, rejections and spending limits. Chat can also propose token allowances. For other contract calls, use evmSDK.

## The queue

The Transactions tab lists pending transactions. Everyone who adds the Safe to a Pecu profile sees the same queue, with who proposed each transaction, which owners approved on Base and which signed in a browser wallet. A Safe's address is public, so treat pending transactions as visible to anyone who knows it.

- All pending transactions share the Safe's next position. When one runs, the others can no longer run and move to History as replaced.
- Reject proposes an empty transaction at the same position. If owners approve and run it first, the pending transactions are cancelled.
- The person who proposed a transaction can remove it from the queue. That does not undo approvals already recorded on Base.
- One person can have up to 10 pending transactions on a Safe.

## Execute

Once enough owners approve, execute the transaction.

- Execute with Pecu wallet shows a card. Confirm it and Pecu sends the transaction from your Pecu wallet with the collected approvals and signatures.
- Execute with your wallet sends it from your connected browser wallet, which pays the network fee.

If the wallet that executes is an owner that has not approved yet, executing counts as its approval. With two of three required and one signature collected, an owner can execute in one step.

History lists transactions that ran, with a Basescan link, and ones that were replaced. When Pecu cannot tell whether a transaction ran elsewhere, it shows No longer pending.

## Spending limits

A spending limit lets one address spend up to an amount of one token from the Safe without asking the other owners each time. It can refill every day, week or 30 days, or be one time. Setting and removing limits are Safe transactions that owners approve.

A limit caps the amount, not the recipient. When your Pecu wallet has a limit, press Spend on the Settings tab to pay from it after you confirm the card.

## In chat

Pecu in X Chat and on pecu.app/agent sees the same queue. Ask what is pending on a Safe to get its transactions, approvals and signatures. When your wallet's approval completes the requirement, Pecu can execute with the collected signatures after your confirmation. Safe transactions you propose in chat join the queue.
