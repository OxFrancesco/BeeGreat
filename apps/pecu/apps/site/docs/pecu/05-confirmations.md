---
title: Confirmations
description: How previews, confirmation codes, expiry, YOLO and transaction rechecks work.
group: Use
---

Pecu never sends a transaction straight from your request. It builds the exact transaction, checks it, saves it and shows you a preview. The transaction goes out only when you confirm that preview, or when YOLO is on for the chat.

## Previews

A preview says what will happen in plain terms. Depending on the action, it shows the amounts, the estimated amount you receive, the minimum you accept, the recipient and any warnings from Aave. It ends with the confirmation controls and the expiry.

When Aave needs a token approval, Pecu prepares that approval separately and limits it to the amount required for the action. The preview shows the spending limit. After approval confirms, ask Pecu to continue the supply or repayment. The approval alone does not perform that action.

- Previews currently show `Network fee: not estimated yet.` Pecu does not guess fees.
- Pecu prepares at most one preview per message. For several unrelated actions, it prepares the first one and the next after you confirm. Several stock trades in one message are the exception and share one basket preview.
- Some previews include token approvals that run before the main action. One confirmation covers every step, in order.
- In the web app a preview is a card with buttons. In X Chat it is a text message.

### Route and transactions

Pecu reads the exact calls it saved for a preview and lists every transaction in the order it signs them. Each one names the contract it calls, with a copy button for the full address. Approvals are marked `Permission only` because they let a contract spend a token and move nothing themselves.

On the web, the card also draws where your tokens go. Tokens and pools are connected in order, each connection carries the number of the transaction that makes it, and swaps name the pool type they trade through, such as `CL100` or `Volatile`. A plan that creates a pool shows the new pool with a dashed outline. Pointing at a transaction highlights its part of the route.

After you confirm, each transaction shows `Waiting`, `Submitted`, `Confirmed on Base` or `Failed`, with its own Basescan link once it has a hash. Transactions after a failed one show `Not sent`.

In X Chat the same list appears as numbered text lines under `Transactions:` when a preview has more than one transaction or trades through another token. A swap that goes through an intermediate token says so, for example `via AERO`.

## Confirmation codes

Each preview has its own code, like `ABC123`. Codes are six letters and digits, leaving out `I`, `O`, `0` and `1` so they are hard to misread. Lower case works too.

A code only works for the account that asked for it, in the same conversation. A code from X Chat does not work in the web app, and a code from one web thread does not work in another. Anywhere else, Pecu replies `Confirmation code not found for this X account and conversation.`

## Confirming in X Chat

You can confirm in two ways.

- Reply to the preview message with `confirm`. Pecu reads the code from its own preview, never from text you quote or paste, and the message you reply to must contain exactly one code.
- Send `/confirm ABC123` with the code from the preview.

A bare `confirm` that is not a reply to a preview gets a reminder to reply to the preview or use its code.

## Confirming on the web

Press the confirm button on the preview card. It sends `/confirm ABC123` for you, and the card updates with the result. The code is under Confirmation code on the card if you want to copy it.

| Card status | Meaning |
| --- | --- |
| Review before confirming | Waiting for you. The expiry time is shown next to it. |
| Submitted, waiting for the receipt | Sent. Press Check transaction to check it again. |
| Executed and verified on Base | The receipt was verified. The Basescan links open each transaction. |
| Failed | Pecu recorded a failure. The first line of the error is shown. |
| Cancelled, nothing was sent | You cancelled it. |
| Expired without confirmation | The expiry passed before you confirmed. |

A preview built for a [linked wallet](/docs/pecu/linked-wallets#use-a-linked-wallet-in-chat) reads Review, then sign in your wallet, and then Sent from your wallet, waiting for Base. Its button asks your wallet to send each transaction. Typed `/confirm` codes and YOLO never run it.

## Expiry

Previews currently expire after 10 minutes, and each one says `Expires in 10 minutes.`

- Once a preview expires without being sent, it cannot be sent. Pecu replies that the plan expired, and you ask for a new one.
- If a preview with several steps expires between steps, the remaining steps are not sent, but a step that already went through stays done. For example, an approval can be on-chain while the swap after it never went out. Check it with `/allowance` and remove it with `/revoke` if you no longer want it.
- Expiry never blocks checking a transaction that was already sent.

## Cancelling

Reply `cancel` to the preview in X Chat, press Cancel on the web card, or send `/cancel ABC123`. Pecu replies `Proposal cancelled. Nothing was sent.` and the preview can never be confirmed later.

`/cancel` only works on a pending preview. It cannot stop or undo a transaction that was already sent.

## YOLO

YOLO removes the confirmation prompt for new transaction requests.

| Command | Effect |
| --- | --- |
| `/yolo` | Shows whether YOLO is on for you in this chat. |
| `/yolo on` | New transaction requests run as soon as Pecu builds them. |
| `/yolo off` | New requests need your confirmation again. |

- YOLO starts off. Only the `/yolo on` command turns it on, and the AI cannot change it.
- It applies to your account in one conversation. Your X chat and each web thread have separate settings. While it is on, the web app shows a "YOLO on · turn off" button.
- Turning it on does not send previews you already have. Those still need a confirmation. Turning it off does not undo anything already sent.
- With YOLO on, the reply shows the preview, the result and a line such as `Check this request: /confirm ABC123` for rechecking later.

> [!WARNING]
> With YOLO on, a misread request is sent before you can review it. Keep it off unless you are comfortable with that, and turn it off with `/yolo off` when you are done.

### What YOLO never skips

YOLO only removes the prompt. Plan validation, the expiry, the saved-plan integrity check, the one-at-a-time execution lock, duplicate message protection and receipt verification all still run.

Some requests always wait for your confirmation, even with YOLO on:

- A generic contract call, where the AI wrote the call from your description. Its preview says `YOLO is on, but a contract call always needs your confirmation.`
- A transaction prepared right after you answer one of Pecu's questions.
- A transaction from an answer you regenerated with Retry in the web app.

## Clarifying questions

When a detail would change a transaction, Pecu asks before it builds anything. A question can come with up to six numbered choices.

- In X Chat, reply with your choice. In the web app, press one of the buttons under the question.
- A choice is never a confirmation. It leads to a new preview, and that preview needs your confirmation even with YOLO on.
- Reply `cancel` to drop the question. Pecu replies `Cancelled. No new transaction was sent.`
- A slash command sent while a question is open is not taken as the answer.

## Checking a sent transaction

Pecu reports success only after it verifies the receipt on Base. When it cannot verify yet, the reply says so.

| The reply says | What it means |
| --- | --- |
| submitted but its inclusion is not verified yet | It was sent, and Base has not shown it as included yet. |
| I couldn't confirm the status | Pecu could not read the status from the wallet provider. It may or may not have gone out. |
| a wallet permission is missing | Pecu cannot check the status because of a setup problem on its side. Your request is saved. |

In each case, send the same `/confirm ABC123` again, or press Check transaction on the web card. Pecu reads the status again and never resubmits a step that was already sent. If it already succeeded, you get the saved result.

### When something looks failed

- Do not start a new swap or transfer to replace it. The first one may still land, and you would pay twice.
- Send the same `/confirm ABC123` again and open the Basescan link if the reply has one.
- Pecu marks a transaction failed only when it knows nothing was approved, when the wallet provider reports a failure, or when the receipt on Base shows a revert. Any other error keeps the request open for rechecking.
- Once a preview is marked failed, confirming it again does nothing. Ask for a new preview if you still want the action.

## When transactions are paused

If transactions are switched off on Pecu's side, previews say `Transactions are currently disabled. Nothing has been sent.` and `/confirm` replies that no transaction was sent. Reads, quotes and previews keep working.
