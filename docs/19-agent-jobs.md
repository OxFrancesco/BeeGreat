# Agent Jobs

Agent Jobs turn a natural-language instruction into a durable Bee thread that can
run once or on a recurring schedule. Convex owns the schedule and run ledger;
the Agent Worker owns execution.

## User flow

Users ask Bee for a Job in ordinary language, for example:

- “Every two hours, remind me on Telegram to stretch.”
- “At 09:00 Europe/Rome every weekday, summarize my priorities.”
- “Every hour, claim rewards from this Aerodrome pool and redeposit them.”

Bee translates that request into a structured `once`, `interval`, or `calendar`
schedule and calls `create_agent_job`. The same tools can list, update, pause,
resume, cancel, or run a Job immediately. Web and mobile expose the same Job
records and management actions.

## Runtime flow

1. `agentJobs` stores the instruction, schedule, delivery preferences, state, and
   detached Bee thread ID.
2. Convex schedules `agentJobRuns:materializeScheduledRun` for the next occurrence.
3. The mutation creates an idempotent `agentJobRuns` row, advances the Job's next
   occurrence, and schedules dispatch.
4. `agentJobDispatch:dispatch` calls the Agent Worker's authenticated
   `/internal/job-run` route.
5. The worker sends a `job.scheduled` signal to the Job's persistent Bee thread,
   using `job:<jobId>:<scheduledFor>` as the dispatch idempotency key.
6. Bee executes the instruction and calls either `complete_agent_job_run` or
   `wait_for_agent_job_external`.
7. A 15-minute Convex watchdog retries stuck dispatches and flags stale external
   waits for attention.

Only the watchdog is a static Convex cron. User-defined schedules use the Convex
scheduler, so they can be created and changed at runtime.

## Delivery

`in_app` is always available. `telegram` can be requested only when the user has
a connected Telegram account. Telegram delivery remains part of the Job
instruction so the same Bee thread can execute work and report its result.

## Financial Jobs

Unattended Aerodrome operations require a separate, explicit grant. Creating a
Job can request a grant, but cannot approve it. Approval happens from the signed-in
web or mobile Job screen and is limited to:

- the Bee smart wallet on Base;
- one exact Aerodrome pool address;
- a selected subset of `claim_emissions`, `claim_fees`, and `deposit`;
- three on-chain actions per run;
- 30 days, unless revoked sooner.

Every prepared Web3 action carries its private Job run ID. Convex verifies the
active run and exact grant before allowing the action, and settlement returns to
the same Job thread. This lets a run safely continue from claiming to redepositing
without granting Bee general unattended wallet access. EOA wallets and unrelated
Web3 operations cannot use Job grants.

## Operational guarantees

- An occurrence is unique by `(jobId, scheduledFor)`.
- Runs for one Job do not overlap.
- Dispatch retries use exponential backoff and stable idempotency keys.
- Calendar schedules preserve their IANA timezone across daylight-saving changes.
- Canceling a Job revokes its financial grant.
- Account deletion removes Jobs, runs, grants, and their detached threads.
