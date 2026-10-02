---
title: Automations
description: Reminders, scheduled runs, heartbeats and price alerts, and the allowance that lets Pecu trade while you are away.
group: Use
---

Ask Pecu to do something later and it saves an automation in the chat where you asked. When it runs, the result lands in that same chat and on your phone.

```text
Remind me every Monday at 9:00 to check AERO
Rebalance my index to NVDAc=50,AAPLc=50 every week
Every 30 minutes, rebalance my ETH/USDC position if it is out of range
When AERO drops below $1, buy $20 of it
Every hour, tell me if a position is out of range
```

## Kinds

| Kind | What happens when it runs |
| --- | --- |
| Reminder | Pecu sends your text back to you. No tools run. |
| Run | Pecu runs your request as a normal turn: it reads balances and prices and can prepare transactions. |
| Heartbeat | Pecu works through your checklist and stays silent when nothing needs your attention. |

Schedules can be one time (`at 15:00 tomorrow`), every N minutes (at least 5), or on days of the week at a local time in your time zone. A price alert checks a token's price every few minutes, runs once when the condition holds, and then finishes.

## Transactions while you are away

A run that wants to trade needs your approval twice over before it executes on its own:

1. YOLO is on in that chat.
2. The automation has an allowance you approved.

An allowance says what the automation may do and how much it may move per run. `trade` covers swaps, stock trades and index rebalances. `liquidity` covers Aerodrome deposits, withdrawals, staking, unstaking and claims. Transfers, approvals, contract calls, Aave, Safes and vote locks are never covered. Allowances last 30 days by default and at most 90.

Pecu measures each transaction from the exact calls it will sign and prices the tokens with a live quote. If a transaction is outside the allowance, above the limit, or cannot be measured, Pecu stops and sends you the preview instead. One run can chain up to 16 transactions, for example unstake, withdraw, re-deposit and stake, each only after the previous one is confirmed on Base.

When YOLO is off or there is no allowance, the run prepares a normal preview and your phone shows `confirm the transaction`. Previews still expire, so an old one needs a new run.

> [!WARNING]
> An approved allowance with YOLO on moves real funds on Base without asking. Pick a per-run limit you are comfortable losing to slippage or a bad price.

Pecu can ask for an allowance when it creates the automation, but it cannot approve one. You approve it with `/tasks allow CODE`, optionally with a new limit such as `/tasks allow ABC234 50`, or with **Approve** in the app. Changing what an automation does sends its allowance back for approval.

## Managing automations

Ask Pecu in your own words and it finds, edits or deletes the automation itself: `move my AERO reminder to 10:00`, `make the index rebalance run on Fridays`, `stop the pool rebalance`. A request with an end, like `every day until I hold 100 AERO`, deletes itself when the end is reached.

You can also send `/tasks` to list them with their codes. On the web, open **Automations** at the top of the chat. On Android, open your account menu and choose **Automations**.

| Command | What it does |
| --- | --- |
| `/tasks` | Lists your automations, schedules, next runs and allowances. |
| `/tasks pause ABC234` | Stops it until you resume it. |
| `/tasks resume ABC234` | Starts it again from the next scheduled time. |
| `/tasks run ABC234` | Runs it within a minute. |
| `/tasks allow ABC234 [USD]` | Approves its allowance, optionally with a different limit per run. |
| `/tasks revoke ABC234` | Revokes the allowance. Transactions wait for you again. |
| `/tasks cancel ABC234` | Deletes it and revokes its allowance. |

You can have up to 20 automations. Deleting a web thread deletes the automations that post into it.

## Notifications

Every run that has something to say appears in its chat. The Android app also shows a notification, and tapping it opens that chat. Reminders with a fixed time are also scheduled on the phone itself, so they appear on time even when the push arrives late. Allow notifications from the Automations screen on Android 13 and later.

## Approval and recovery

The Automations screen shows whether a run is working, waiting for approval, confirming a transaction, finished or stopped. Its saved steps show what happened before a stop. A prepared preview is not counted as a finished run.

For a run without an allowance, choose the allowed actions, a USD limit per run and a validity of 1 to 90 days in Automations, then select **Approve**. Nothing is approved by turning on YOLO alone. A preview already waiting still needs its own confirmation. Use **Revoke allowance** to stop future unattended transactions.

Once Pecu accepts a request, closing the app or losing the connection does not cancel it. Reopen the chat to read the saved result. The server recovers interrupted requests and checks submitted transactions before continuing. If the phone disconnects before the request reaches Pecu, reconnect and resume the same request.

An automation resumes its remaining work after you confirm a waiting step. It keeps the same run and cumulative allowance across recovery. An expired, cancelled or failed step stops that run; prepare a new preview with **Run now**. Pausing prevents further steps until you resume. External failures can still stop work, and linked-wallet signatures still require you.
