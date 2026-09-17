# iMessage outbox usage fix

September 17, 2026. Source commit `1f33cf180bbfe103f997ee7f8f492bf24df2fce5`
is pushed to GitHub and deployed to the production Railway bridge.

## Result

The bridge now backs off idle and failed claims instead of polling every three
seconds forever. It claims immediately at startup, waits 2.4 to 3 seconds after
work, and doubles the idle interval to a maximum of 60 seconds with 20% downward
jitter. At steady idle the interval is 48 to 60 seconds. Each request schedules
its successor only after finishing, so requests do not overlap.

Outbox HTTP calls have a ten-second timeout. Shutdown stops new claims and waits
for the current delivery, up to a 25-second process deadline. An unexpectedly
closed Spectrum message stream exits with code 1 so Railway's ON_FAILURE policy
can restart the bridge. HTTP recovery needs no subscription resynchronization;
the next successful claim reads the durable queue, and restart claims immediately.

## Measured locally

The same 120-second wall-clock idle window used the original loop from commit
`96b02c7f72abd98b6a04ba0f752599c55f97430a` and the replacement concurrently.

| Measurement | Before | After |
| --- | ---: | ---: |
| Idle claim requests | 40 | 6 |
| Fixture enqueue to intercepted send | 0.169 seconds | 12.540 seconds |

The measurement ran the actual bridge transport and delivery code with HTTP and
Spectrum sends intercepted. It included startup and used real timers and random
jitter. It is one latency sample, not a percentile. No production calls, real
recipients, or transactions were involved. At maximum backoff a newly queued
item can wait 60 seconds before the next claim, plus request and send time.

[Raw events](research/imessage-outbox-20260917/measurement.json) are retained.
Reproduce from the repository root with:

```sh
BASELINE_REVISION=96b02c7f72abd98b6a04ba0f752599c55f97430a bun run apps/imessage-bridge/scripts/measure-outbox.ts
```

The supplied September 17 audit reports 601K calls this cycle and 209K each to
`HTTP /internal/imessage` and `imessageOutbox.claimNext` over seven days. Those
are audit inputs, not counts remeasured here. No billing savings are claimed.
Production request counts were measured below. Real-recipient delivery latency
remains unmeasured. Use equal idle windows and count both functions separately.
Keep normal identity traffic separate from claim operations. Do not sum the pair as unique
deliveries. Observe actual invoices before attributing monetary savings.

## Measured in production after deployment

Read-only Convex execution logs from `quirky-hyena-231` captured two 120-second
windows. The old bridge was the sole running replica for the first window.
The replacement was the sole active replica for the second window. Retained
execution history reconciled the log stream startup boundary. The observed
post-release claim intervals were 53.656 and 56.682 seconds.

| Function | Before | After |
| --- | ---: | ---: |
| `imessageOutbox:claimNext` | 40 | 3 |
| `POST /internal/imessage` | 40 | 3 |
| Claim errors | 0 | 0 |

Before: 2026-09-17T07:57:38+00:00 through 2026-09-17T07:59:38+00:00.
After: 2026-09-17T08:12:48+00:00 through 2026-09-17T08:14:48+00:00.

These are observed function executions, not projected monthly savings. Claims
returned four bytes, consistent with the null empty-queue response. No enqueue,
complete or retry executions appeared in either observed window. The post-release
window began after startup; it is not the same startup phase as the local test.
[Production events and deployment evidence](research/imessage-outbox-20260917/production.json)
are retained without message content. No transactions or real-recipient test
messages were sent. Production delivery latency and invoice savings remain
unverified.

## Complete delivery path

1. Terminal action handling schedules `web3Notify.notifyActionSettled`.
2. That action calls `imessageOutbox.enqueueAction`. It reads the action, origin
   thread and existing action/status delivery index. Only iMessage-origin
   terminal states insert a pending `imessageDeliveries` row. Duplicate enqueue
   is a no-op. Fixtures use synthetic terminal actions with no transactions.
3. The Railway bridge calls worker `POST /bridge/outbox` using `x-bridge-secret`.
   The exact route checks the secret without requiring a user header. Other
   bridge routes still require user identity.
4. `callImessageService` calls Convex `POST /internal/imessage` with the broker
   bearer secret. Convex validates the request and calls `claimNext`.
5. `claimNext` reads the earliest expired lease and earliest due pending item
   using indexes. It recovers one expired lease, verifies an active connection,
   backs off unlinked recipients, and leases the selected row for 30 seconds.
6. The bridge renders through `projectTextWeb3Action`, opens a Spectrum DM,
   sends text and links, then calls `complete_delivery`. Failure calls
   `retry_delivery`. Both acknowledgements traverse the same worker and Convex
   route and enforce the current lease ID.

Convex's queue schema, lease duration, retry deadlines, due-time ordering,
connection validation, stale-lease rejection and enqueue deduplication are
unchanged. Retry delay is based on attempts and capped by the existing code.
The delivery contract remains at least once. A crash or lost acknowledgement
after a successful send can cause a duplicate. This fix does not claim exactly
once delivery or strict per-recipient ordering across competing instances.

The existing authenticated settlement callback wakes a Flue conversation, not
the global bridge outbox loop. The bridge has no Convex subscription and its
Railway service has no public domain or callback listener. Spectrum's inbound
stream is for user messages. Event wakeups would require a new authenticated
subscription or relay, reconnect handling and durable recovery. Bounded backoff
fits the current architecture without adding polling elsewhere, credentials,
public endpoints or a new worker service.

## Running deployments

Live Railway status on September 17 showed one environment and one service in
the linked BeeGreat project, with one running replica:

| Item | Verified value |
| --- | --- |
| Project | BeeGreat, `3a7da22d-63f1-4b32-bae7-1b0ae7c15cbd` |
| Environment | production, `7b0b353e-5909-4fdc-a078-349cbc54bcac` |
| Bridge service | `f8b5c392-5e4a-4a79-a408-1e639d73d0e4` |
| Active deployment | `2d58eb4a-5377-4a20-bcb3-49e277a32f66`, September 17 |
| Running instance | `e88684c4-958c-4e85-8e9e-b3e6476dcd16` |
| Region | `us-east4-eqdc4a` |
| Bridge AGENT_URL | `https://beegreat-agent.oddofrancesco000.workers.dev` |
| Active worker version | `d9a38c89-667f-4201-9a8f-7437f0bb3d24`, September 7 |
| Cloudflare account | personal account `157a8b025a13404b16f11ad7078e53f1` |

Local process checks inspected bridge-like commands and every Bun/Node working
directory. BeeGreat-local candidates were Codex, MCP processes and the Pecu Vite
server, with no local bridge found. No iMessage bridge launch-agent entry was
found. This inventory covers the linked Railway project and this Mac, not
unregistered hosts or unrelated Railway accounts.

Live worker settings expose CONVEX_URL as a secret binding, without its value.
The production measurements above observed the outbox executing on
`quirky-hyena-231`. Railway reports the new deployment successful and only its
replacement replica active. Startup logs at 08:11:23 UTC show Spectrum starting
with the iMessage provider and the bridge connecting to the expected worker.
The former deployment was `15e7955a-9b8a-4639-8313-15e9fe006a75`.

The new release used a `git archive` snapshot of the pushed commit, excluding
local secrets, dependencies and untracked files. Railway's image digest is
`sha256:4eaae58ad7bada6e1d79ba6d7f3436fca679491001ad88f128db3a9b350848ed`. Its configured
install command remains `bun install` and its start command remains
`bun run --cwd apps/imessage-bridge start`. SSH was unavailable because no key
is registered; runtime logs were retrieved through the Railway CLI's built-in
MCP `get_logs` tool without modifying editor configuration.

## Validation and rollout

Passed with Bun:

- Bridge suite: 38 tests, including real transport/render/send/ack fixture,
  send failure, idle recovery, offline recovery, jitter, non-overlap and stop.
- Convex iMessage/outbox suites: 19 tests, including competing claims, retry
  deadlines, expired leases, stale acknowledgement rejection and deduplication.
- Worker iMessage route suites: 9 tests, including secret rejection and trusted
  forwarding. These are local handler tests, not deployed endpoint tests.
- Bridge and backend type checks.
- Bridge bundle: 1,546 modules, 5.83 MB. Railway runs Bun source directly; the
  bundle proves compilation, not a provider connection.
- Git whitespace check.

Only the Railway bridge needed a production update. It was deployed from the
isolated monorepo snapshot after local/remote commit equality was verified.
Railway finished the build, reported SUCCESS, started one replacement replica
and removed the old deployment from its active list. No leases were cleared.

Convex has test-only changes. The agent worker, web, Expo mobile, Android, CLI,
voice and shared contracts need no deployment or rebuild. Their user-facing
behavior and both OpenRouter and ChatGPT provider paths are unchanged. No
reverse-state controls or presentation changes apply. Normal iMessage chat
still uses the existing inbound stream; only terminal outbox updates back off.

Equal production idle windows are recorded above. For provider delivery
verification, use an isolated queue or an explicitly authorized test recipient.
Do not inject synthetic records into the live outbox: the bridge could send them.
Lease-expiry recovery and retry delivery can now take up to the idle cap beyond
their eligibility time. Rollback is redeployment of the previous bridge artifact;
it needs no schema rollback and leaves durable deliveries intact, but restores
the old polling cost.
