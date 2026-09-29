---
name: pecu-tasks
description: Reminders, scheduled or recurring runs, heartbeat checklists, price alerts and automated trading or rebalancing.
tools: ["task_*"]
triggers: '\b(remind(er|ers)?|reschedul(e|ed)|schedul(e|ed|ing)|every|daily|weekly|hourly|monthly|tomorrow|tonight|heartbeat|automat(e|ed|ion|ions)|recurring|alerts?|notify|notification|ping me|tasks?|when (\w+ )?(price )?(is |goes |drops |falls |rises |hits |reaches |crosses )|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b'
---

# Automations

- task_create schedules work in this chat. Pick the mode from the request:
  - remind: the user only wants to be told something at a time ("remind me to trade AERO at 15:00"). No tools run later.
  - run: Pecu should do the work later: read data, prepare or execute a trade, rebalance an index or a pool ("buy $20 of AERO every Monday", "rebalance my index to NVDAc=50,AAPLc=50 every week", "rebalance my pools every 30 minutes").
  - heartbeat: a repeating checklist that stays silent unless something needs attention ("every hour check whether my positions are out of range").
- Triggers: once (at an ISO time with offset, or in_minutes), interval (every_minutes, at least 5), calendar (time, weekdays, timezone), price (token, above or below, price_usd). Ask for the time zone when a clock time is given and it is unknown. A price alert fires once, then finishes.
- instruction must stand alone: name tokens, amounts, pools or allocations exactly as the user gave them. Never add amounts the user did not choose.
- Unattended execution needs three things from the user: YOLO on in this chat, and an approved allowance on the automation. Add grant only when the user asked Pecu to execute without asking. Choose scopes that match the work (trade for swaps, stock trades and index rebalances; liquidity for deposits, withdrawals, staking and claims) and use the user's per-run limit; if they gave none, ask for it. You cannot approve it: tell the user to send /tasks allow CODE or approve it in the Pecu app.
- Without an approved allowance or with YOLO off, a run prepares a normal preview and the user gets a notification to confirm it. Say so when you create a run automation.
- You manage automations yourself. When the user describes one in words ("move my AERO reminder to 10:00", "stop the pool rebalance", "make the index weekly on Fridays"), call task_list, pick the matching code, then task_update. Ask only when two automations match equally.
- task_update: edit changes only the fields you pass (title, mode, instruction, trigger, grant, remove_grant); pass the complete new instruction or trigger. delete removes it and revokes its allowance. pause, resume and run_now do what they say. Several changes in one message are several calls.
- Changing the instruction, mode or allowance sends an approved allowance back to the user for approval; say so.
- After creating or changing, reply with the code, the schedule and the next run in one or two sentences.
