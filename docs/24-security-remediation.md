# Security and reliability remediation

The September 2026 DeepSec pass exported 163 findings. The implementation and per-finding evidence are tracked in `.deepsec/remediation/checklist.json` and `.deepsec/remediation/checklist.md`. That checklist describes the local source revision. It does not establish that production or an installed mobile build contains the fixes.

## Behavior changes

### Authentication and connections

OAuth callbacks finish in the authenticated web app. The signed-in BeeGreat account must own the pending authorization before the backend can exchange or attach credentials. The browser preserves the pending callback through a sign-in redirect and removes it after completion. Mobile, CLI and iMessage handoffs use this same check.

Cancellation identifies the original authorization session. Disconnect detaches the current connection before provider revocation. Delayed callbacks, refreshes and unauthorized responses cannot remove a replacement connection. Known rate limits preserve a retryable connection; an uncertain rotating-token exchange requires reauthentication instead of replaying the old refresh token.

CLI login ignores unsolicited callbacks. Saved tokens travel to Keychain through standard input. Automatic agent startup resolves the trusted checkout instead of running scripts from the current directory. ChatGPT disconnect also clears the worker's cached provider credentials.

### Approvals and transaction recovery

Wallet confirmation renders the backend's saved transaction summary. Every confirmation must match that summary. CLI and iMessage accept a decision only for the proposal already displayed to the user. A queued message cannot approve a later proposal. Web and mobile render the saved execution state and acknowledge cancellation before reporting it to Bee.

Comment tools create a pending review containing the account, immutable issue identity, target URL and exact text. They return a review link. The user signs in and selects **Post this comment** or **Cancel**. The backend submits the saved text once. A lost provider response remains unknown and does not trigger another post.

Site publishing works the same way. Bee creates a preview and returns a review link. Approval binds the preview's artifact digest, destination slug and publication revision. It promotes that artifact without rebuilding it. Unpublish, cancellation, suspension or a changed destination invalidates stale approval.

Every client can open these authenticated review links. Web and mobile show ordinary links in the chat; CLI and iMessage present the same URL as text. Voice returns the link through the shared tool result for review in a browser. OpenRouter and Codex use the same backend approval contract. A model's reply or a generic chat confirmation cannot replace these controls.

Settlement recovery keeps the saved provider transaction identity after uncertain responses or failed database writes. A leased observer checks the existing transaction with bounded backoff. Historical records selected for recovery are observation only. Recovery never issues a replacement transaction or repeats approval. An interruption before provider approval can require operator reconciliation.

Sugar restores a retryable step after a confirmed wallet rejection or a local failure before broadcast. Unknown broadcast outcomes remain blocked for reconciliation. ALM discovers the replacement position from verified mint receipts and checks its owner, pool and range.

### Agent execution and paid services

Provider webhooks require configured authentication and an exact external-account mapping. Accepted events persist their complete payload and stable admission key before acknowledgment. An outbox retries temporary delivery failures and lost acknowledgments. Disconnect cancels undelivered work for that connection.

Paid tools and realtime voice use atomic per-user and global budgets. Realtime clients receive short-lived worker tickets. The worker owns the provider session, limits requests and relays audio. Devin access requires administrator approval. Polling is coalesced and metered.

Google Workspace commands use a flag catalog tied to the pinned gog version. File-input flags can read only bytes supplied with that invocation and staged in a private temporary directory. Cleanup failure cannot turn a successful provider mutation into an apparent failure.

Astro source stays in Worker-owned memory. Each check or build gets a new `SiteBuildSandbox` with internet disabled. The build runs without credentials under an unprivileged account. The Worker captures bounded output, discards the VM and uploads the captured files. Build code cannot alter the canonical source used by the next build.

### Data and client state

Journal photo uploads pass through an authenticated, byte-limited backend route that records ownership. Legacy blobs without trustworthy ownership evidence stay in a review queue. Account deletion retains its cleanup manifest until required Worker and storage cleanup succeeds.

Web and mobile journal editors serialize saves, compare server revisions and preserve a recoverable local draft. Conflicts offer reload or explicit replacement. Offline migration imports dated drafts atomically and records receipts so retries cannot duplicate entries. NFC edits submit changed fields with a revision check. Overlapping native NFC writes cannot cancel the active writer.

Android rename and date controls use a dialog that supports text input and every supplied action. Bookmark, profile and question edits preserve newer input while requests finish. Health views update their local date after midnight and reject stale date-bound submissions. Voice playback and realtime sessions release only the resources they own.

Job activation enforces capacity and subscription rules. Cancellation skips work that has not claimed dispatch. It does not abort work already accepted by the agent. Recurrence preserves its original calendar anchor across short months and rejects unbounded historical catch-up. Goal deletion also removes recurrence schedules.

Telemetry sanitizes transaction spans and navigation attributes. Replay is disabled on web and mobile. Terminal output escapes control sequences while retaining canonical financial addresses. Highlighted code uses full-content cache keys and bounded eviction.

## Deployment and historical-data checks

The local implementation requires coordinated release. Review these items against the actual deployment before treating the findings as resolved in production.

1. Verify the intended personal Cloudflare account, Convex project, web deployment and Railway bridge service. Preserve the existing broker secret and check its presence on both ends without printing it. Configure the authenticated `WEB_APP_URL` and each provider's webhook secret.
2. Deploy additive Convex contracts and functions before their callers. Deploy the agent with the `SiteBuildSandbox` binding and migration, then the web app, sites worker, Codex adapter and iMessage bridge. Release CLI and mobile clients against those contracts. Older clients that omit a newly required approval or revision field must update.
3. Verify an authenticated OAuth handoff through redirect sign-in, a cancelled older connection alongside a newer one, and provider-specific refresh behavior. Confirm comments and site publication through the saved review page with controlled accounts and content.
4. Verify the Cloudflare sandbox's actual VM and network boundary. The local Docker test establishes the unprivileged offline build behavior but does not replace that deployment check.
5. Reconcile historical photo ownership from trusted records before clearing review jobs or finishing affected account deletions. Inspect older orphaned Worker data independently. No ownership is inferred from a client-supplied storage ID.
6. Inspect legacy settlement recovery against provider receipts. A watchdog may resume observation after deployment, but it must not replay approval or submission. Resolve hashless or approval-uncertain records with provider evidence.
7. Inspect old webhook delivery rows. Rows created before payload persistence cannot reconstruct an event that was never saved. Provider replay is a separate, deliberate operation.
8. Verify paid-service limits and Devin access with the intended billing configuration. Reconcile prior usage separately. Existing telemetry and already-issued browser cache headers are historical effects; the source changes cannot retroactively remove them.
9. Resolve Expo Doctor's dependency findings before the native release gate. Then verify Android and iOS dialog interaction, journal recovery, audio interruption, NFC and subscription lifecycle on installed builds. JavaScript export and mocked native tests do not prove hardware behavior.

## Local verification

The evidence directory records package tests, type checks, lint, builds, actual route/component tests, runtime reproductions and the offline Astro container check. Each checklist entry names its source boundary and evidence. Failed diagnostics and unavailable production or device checks remain visible in the report.

No product deployment, provider comment, financial transaction, credential rotation or historical-data migration is part of the local verification result. The preexisting browser-wallet work remains in the working tree and its original snapshot is retained for comparison.
