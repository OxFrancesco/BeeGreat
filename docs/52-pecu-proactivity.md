# Pecu proactivity

Pecu can act without a new message. A user asks for a reminder, a scheduled or
recurring run, a heartbeat checklist or a price alert, and Pecu saves it as an
automation (a "task" in code) bound to the chat where it was asked. BeeGreat's
Agent Jobs (`docs/19-agent-jobs.md`) are the Convex equivalent for Bee; this
document covers Pecu only.

## Model

`src/task-contract.ts` owns every shape that crosses the wire.

| Field | Values |
| --- | --- |
| Mode | `remind` sends the instruction back, no model call. `run` runs the instruction as an agent turn. `heartbeat` runs a checklist and stays silent when nothing needs attention. |
| Trigger | `once` (epoch ms), `interval` (every N minutes, at least 5, on a fixed grid), `calendar` (HH:MM, weekdays, IANA zone), `price` (token, above or below, USD, check interval). |
| State | `active`, `paused`, `completed` (once and price after their run), `cancelled` (hidden everywhere). |
| Grant | Scopes (`trade`, `liquidity`), USD cap per run, validity days, and `requested`, `approved` or `revoked`. |

The Durable Object stores tasks, runs, notifications and push devices in
`basedbot_tasks`, `basedbot_task_runs`, `basedbot_notifications` and
`basedbot_push_devices` (`src/tasks.ts`). A run is unique by
`(task, scheduled occurrence)`, so two sweeps cannot run the same occurrence.
`src/task-schedule.ts` computes the next occurrence; calendar triggers keep their
wall-clock time across DST changes.

## Runtime

The Worker cron already fires every minute and the XChat alarm every 60 seconds.
Both call `ProactiveRunner.sweep()` (`src/proactive.ts`), which is single-flight
and runs at most four tasks at once. For each due task it advances the schedule
first, claims the run, then:

- `remind` delivers `Reminder: <instruction>`.
- `run` and `heartbeat` call `PecuAgent.runTask` with a synthetic verified
  message (`task:<runId>:<attempt>`) in the task's own conversation, so the model
  keeps that chat's session and context. The classifier is skipped and the prompt
  frames the stored instruction as the user's earlier words, with the task's code.
  Task tools stay available inside a run, so "every day until I hold 100 AERO"
  can delete itself or schedule its follow-up; the 20-automation cap bounds
  creation and no tool can approve an allowance.
- Price triggers read the Sugar oracle price through an Aero quote and only claim
  a run once the condition holds.

A web thread already answering a user, or the user's inference runtime being busy,
defers the run by a minute, up to ten attempts. A run left `running` for 15
minutes by an eviction is settled as failed instead of being re-run.

Heartbeat replies that start or end with `HEARTBEAT_OK` and carry at most 300
other characters are dropped, as in OpenClaw. Anything else is delivered.

## Unattended execution

Automated runs never inherit YOLO alone. `persistProposal` routes every proposal
made inside a run through `grantDecision` (`src/task-grant.ts`), which executes
only when all of these hold: mainnet execution is on, the Pecu smart wallet signs,
YOLO is on in the task's conversation, the grant is approved and unexpired, the
intent's scope is in the grant, and the plan's value plus earlier steps in the run
stays within the per-run cap.

Value comes from the exact persisted calls: `planOutflows`
(`src/transaction-plan.ts`) decodes native value, Universal Router swap inputs,
position-manager mints and router deposits, and treats withdrawals, collects,
stakes, unstakes and claims as moving nothing out. Any call shape it cannot decode
makes the plan unbounded, so it waits for the user. Non-USDC amounts are priced
with a live Aero quote to USDC.

Transfers, approvals, generic contract calls, Aave, Safe actions, vote locks and
deposit relays have no scope. A run can chain up to four proposals
(`eventId`, `eventId#2`, …), each only after the previous one succeeded on Base.
The first proposal that fails the decision stays a normal preview, the run stops,
and the reply ends with its confirmation code even when the model left it out.

The model manages automations itself with `task_create`, `task_list` and
`task_update`. `task_list` returns every field it needs (code, mode, state,
schedule, next run, full instruction, allowance, and whether the task belongs to
this chat), so it can resolve "move my AERO reminder to 10:00" to a code.
`task_update` edits only the fields it passes (title, mode, instruction, trigger,
grant or `remove_grant`) and also pauses, resumes, deletes and runs now.

Only the user approves a grant: `/tasks allow CODE [USD]` from a verified X or web
message, or **Approve** in web or Android, both of which call the signed-in
`task-action` endpoint. The model can request a grant and can pause, resume,
delete, run now or edit; editing the instruction or grant sends it back to
`requested`. Deleting a task revokes its grant.

## Delivery

X conversations get the reply through the encrypted outbox, anchored to the
verified event that created the task. Web threads get a history row whose reply
carries `origin`; clients show the automation title instead of a user bubble and
never offer retry on it. Every non-quiet run adds an in-app notification and, when
`FCM_SERVICE_ACCOUNT` is set, a data-only FCM HTTP v1 message to each registered
Firebase Installation ID (`src/integrations/fcm.ts`). FCM's `UNREGISTERED`
responses remove the device. The push tag is `task:<code>:<occurrence>`.

## Clients

| Surface | Decision |
| --- | --- |
| X Chat | Natural language plus `/tasks` commands; replies in the DM. |
| Web (`/agent` and Stocks chat) | Automations dialog, task-origin label, reload when the tab becomes visible. |
| Pecu Android | Automations sheet, FCM service, local exact alarms for fixed-time reminders using the same tag so the push replaces them, boot restore, deep links to the thread. |
| Providers | ChatGPT and OpenRouter share the same tools and prompt; runs use whichever route the user's turn would. |
| BeeGreat Expo, Android, CLI, iMessage, voice | Not affected; they do not run the Pecu agent. |

## Configuration

- `FCM_SERVICE_ACCOUNT` (Worker secret): the Google service-account JSON with the
  Firebase Cloud Messaging API enabled. Without it, notifications stay in the inbox.
- Android Gradle properties `pecu.firebase.appId`, `pecu.firebase.projectId`,
  `pecu.firebase.apiKey`, `pecu.firebase.senderId`: the public Firebase client
  identifiers. Empty values build an app without push.

## Verification boundary

Bun tests cover schedule math across DST, triggers, control and grant approval,
the grant decision matrix, outflow decoding from SDK-built calldata, reminders,
quiet and alerting heartbeats, execution within an allowance, approval fallbacks,
chained steps, price alerts, busy deferral, X outbox delivery and the FCM request
shape with a real RSA signature. Android tests cover fixture decoding, local alarm
replacement, notification tag replacement, deep links and the sheet. These use
fixtures: no funded automated trade, no real FCM delivery and no phone install have
been performed.
