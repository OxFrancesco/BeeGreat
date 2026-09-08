# BeeGreat DeepSec remediation checklist

163 scanner findings. 163 fixed.

A checked item means the local source fix passed its recorded checks, or evidence shows that no fix is needed. This does not claim deployment, installed-device verification or historical-data reconciliation. See verification.md and docs/24-security-remediation.md for those limits. Existing browser-wallet work is preserved in the baseline snapshot.

- [x] DSEC-001 | HIGH | Auto-start executes scripts from an untrusted working directory
  - Status: fixed. Source: `apps/cli/src/agent-runtime.ts`.
  - Resolve automatic agent startup from the trusted repository path and reject scripts in an unrelated current directory.
  - Evidence: apps/cli/src/agent-runtime.test.ts

- [x] DSEC-002 | HIGH | Wallet confirmation hides the actual transfer recipient
  - Status: fixed. Source: `apps/cli/src/session.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-003 | HIGH | Queued text can authorize a newly proposed wallet transaction
  - Status: fixed. Source: `apps/cli/src/tui.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-004 | HIGH | Performance transactions bypass credential redaction
  - Status: fixed. Source: `apps/codex-adapter/sentry.server.config.ts`.
  - Shared telemetry sanitizes transaction spans and navigation data; Replay disabled on web and mobile.
  - Evidence: Observability tests: 6 passed; web and mobile SDK assignments typechecked; remaining callers pending final gate

- [x] DSEC-005 | HIGH | Group chats receive private account responses and address-link tokens
  - Status: fixed. Source: `apps/imessage-bridge/src/index.ts`.
  - Reject group messages before identity lookup. Isolate errors, queue by mapped account with bounded sender admission and deadlines, cancel attachment streams and limit agent abort cleanup to pending reply work.
  - Evidence: apps/imessage-bridge/src/inbound-queue.test.ts: 5 pass, 15 assertions; .deepsec/remediation/evidence/deepsec-review-inbound.md: reviewed once; confirmed findings addressed

- [x] DSEC-006 | HIGH | Displayed confirmation is not bound to the authorized transaction
  - Status: fixed. Source: `apps/mobile/src/components/agent/cards/web3-confirm-card.tsx`.
  - Web and mobile display the authenticated canonical summary, require it in confirmation, and render persisted states for all wallet types. Cancellation acknowledges its actual result before informing Bee. veNFT summaries include exact normalized amount and lock duration.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-finance-cards.md; .deepsec/remediation/evidence/deepsec-finance-card-tests.log; .deepsec/remediation/evidence/deepsec-finance-card-web-types.log; .deepsec/remediation/evidence/deepsec-finance-card-mobile-types.log

- [x] DSEC-007 | HIGH | Photo attachment API permits deletion of another user's storage object
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/journal-entry-editor-screen.tsx`.
  - Authenticated server uploads now bind new photo IDs to their owner, cap actual bytes, and clean rejected uploads. Unverified legacy deletion requests retain provenance review records; account tombstones remain until review completes. Historical blob ownership reconciliation remains a rollout prerequisite.
  - Evidence: 21 photo/account-deletion tests passed; concurrent 9-of-10 upload review passed; web/mobile/backend typechecks passed.

- [x] DSEC-008 | HIGH | Wallet confirmation displays model-written text unrelated to the authorized transaction
  - Status: fixed. Source: `apps/web/src/features/bee/generated-ui.tsx`.
  - Web and mobile display the authenticated canonical summary, require it in confirmation, and render persisted states for all wallet types. Cancellation acknowledges its actual result before informing Bee. veNFT summaries include exact normalized amount and lock duration.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-finance-cards.md; .deepsec/remediation/evidence/deepsec-finance-card-tests.log; .deepsec/remediation/evidence/deepsec-finance-card-web-types.log; .deepsec/remediation/evidence/deepsec-finance-card-mobile-types.log

- [x] DSEC-009 | HIGH | Shared Firecrawl tools lack Bee user ownership checks
  - Status: fixed. Source: `packages/agent/src/agents/bee.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-010 | HIGH | Missing webhook secrets enable forged provider deliveries
  - Status: fixed. Source: `packages/agent/src/app.ts`.
  - Require configured provider webhook secrets and reject missing, malformed or mismatched authentication before admission.
  - Evidence: packages/agent/test/webhook-auth.test.ts

- [x] DSEC-011 | HIGH | Sampled Sentry transactions bypass credential sanitization
  - Status: fixed. Source: `packages/agent/src/app.ts`.
  - Shared telemetry sanitizes transaction spans and navigation data; Replay disabled on web and mobile.
  - Evidence: Observability tests: 6 passed; web and mobile SDK assignments typechecked; remaining callers pending final gate

- [x] DSEC-012 | HIGH | Missing GitHub secret permits forged webhook dispatches
  - Status: fixed. Source: `packages/agent/src/channels/github.ts`.
  - Require configured provider webhook secrets and reject missing, malformed or mismatched authentication before admission.
  - Evidence: packages/agent/test/webhook-auth.test.ts

- [x] DSEC-013 | HIGH | Missing Linear secret permits forged webhook dispatches
  - Status: fixed. Source: `packages/agent/src/channels/linear.ts`.
  - Require configured provider webhook secrets and reject missing, malformed or mismatched authentication before admission.
  - Evidence: packages/agent/test/webhook-auth.test.ts

- [x] DSEC-014 | HIGH | Missing Notion token permits forged webhook dispatches
  - Status: fixed. Source: `packages/agent/src/channels/notion.ts`.
  - Require configured provider webhook secrets and reject missing, malformed or mismatched authentication before admission.
  - Evidence: packages/agent/test/webhook-auth.test.ts

- [x] DSEC-015 | HIGH | Missing client configuration disables OAuth audience validation
  - Status: fixed. Source: `packages/agent/src/middleware/auth.ts`.
  - Fail closed when the OAuth client audience is unconfigured; validate configured audiences before accepting tokens.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts

- [x] DSEC-016 | HIGH | Executable Astro content bypasses the guarded workspace restrictions
  - Status: fixed. Source: `packages/agent/src/shared/bee-sites/astro-creator.ts`.
  - Keep canonical source in the Worker; use a fresh offline SiteBuildSandbox for every build and discard it in finally. Execute as an unprivileged account with no credentials, stop children before collection, preserve only Worker-owned source.
  - Evidence: .deepsec/remediation/evidence/deepsec-astro-isolation-tests.log; .deepsec/remediation/evidence/deepsec-astro-real-container-test.log; .deepsec/remediation/evidence/deepsec-review-astro-isolation-local.md; .deepsec/remediation/evidence/deepsec-last-three-agent-types.log

- [x] DSEC-017 | HIGH | Public publishing has no enforced user-approval boundary
  - Status: fixed. Source: `packages/agent/src/shared/bee-sites/astro-creator.ts`.
  - Require authenticated exact-preview or exact-comment approval from a shared review page. Bind artifact digest and publication revision, or immutable issue identity, account and text. Preserve cancellation and uncertain outcomes without duplicate posting.
  - Evidence: .deepsec/remediation/evidence/deepsec-last-approvals-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-approval-review-react-tests.log; .deepsec/remediation/evidence/deepsec-review-last-approvals.md; .deepsec/remediation/evidence/deepsec-last-three-backend-types.log; .deepsec/remediation/evidence/deepsec-last-three-web-types.log

- [x] DSEC-018 | HIGH | Predictable fallback keys allow forged webhook deliveries
  - Status: fixed. Source: `packages/agent/src/shared/beennectors/channel.ts`.
  - Require configured provider webhook secrets and reject missing, malformed or mismatched authentication before admission.
  - Evidence: packages/agent/test/webhook-auth.test.ts

- [x] DSEC-019 | HIGH | Comment writes rely on model instructions for user consent
  - Status: fixed. Source: `packages/agent/src/shared/beennectors/subagent.ts`.
  - Require authenticated exact-preview or exact-comment approval from a shared review page. Bind artifact digest and publication revision, or immutable issue identity, account and text. Preserve cancellation and uncertain outcomes without duplicate posting.
  - Evidence: .deepsec/remediation/evidence/deepsec-last-approvals-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-approval-review-react-tests.log; .deepsec/remediation/evidence/deepsec-review-last-approvals.md; .deepsec/remediation/evidence/deepsec-last-three-backend-types.log; .deepsec/remediation/evidence/deepsec-last-three-web-types.log

- [x] DSEC-020 | HIGH | Shared Firecrawl tools lack per-user resource authorization
  - Status: fixed. Source: `packages/agent/src/shared/firecrawl-subagent.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-021 | HIGH | Unrestricted draft attachment paths can expose the Google access token
  - Status: fixed. Source: `packages/agent/src/shared/google-workspace-subagent.ts`.
  - Command-specific pinned gog flag contracts restrict all file reads to per-invocation staged bytes, preserve parser literal values and avoid masking successful mutations on cleanup failure.
  - Evidence: .deepsec/remediation/evidence/deepsec-google-final-tests.log; .deepsec/remediation/evidence/deepsec-google-webhook-agent-types.log; .deepsec/remediation/evidence/deepsec-review-google-files.md

- [x] DSEC-022 | HIGH | Self-enabled users can launch coding tasks with shared organization authority
  - Status: fixed. Source: `packages/agent/src/shared/powerups/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-023 | HIGH | Forwarded authorization links attach victim credentials to an attacker account
  - Status: fixed. Source: `packages/backend/convex/beennectorAuthActions.ts`.
  - Finish provider callbacks through the authenticated web app. Atomically claim only the signed-in owner's session and preserve pending callbacks through redirect sign-in.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts; apps/web/src/features/settings/connection-callback.test.ts

- [x] DSEC-024 | HIGH | Workspace fallback gives unlinked webhook senders access to an owner's agent
  - Status: fixed. Source: `packages/backend/convex/beennectors.ts`.
  - Map signed webhook actors to their exact connected external account; remove the workspace-owner fallback.
  - Evidence: packages/backend/convex/beennectors.test.ts

- [x] DSEC-025 | HIGH | Forwarded authorization links attach a victim's health credentials to an attacker
  - Status: fixed. Source: `packages/backend/convex/googleHealthAuthActions.ts`.
  - Finish provider callbacks through the authenticated web app. Atomically claim only the signed-in owner's session and preserve pending callbacks through redirect sign-in.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts; apps/web/src/features/settings/connection-callback.test.ts

- [x] DSEC-026 | HIGH | Forwarded authorization links attach victim credentials to attacker accounts
  - Status: fixed. Source: `packages/backend/convex/http/beennectors.ts`.
  - Finish provider callbacks through the authenticated web app. Atomically claim only the signed-in owner's session and preserve pending callbacks through redirect sign-in.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts; apps/web/src/features/settings/connection-callback.test.ts

- [x] DSEC-027 | HIGH | Self-service Devin access exposes shared organization authority
  - Status: fixed. Source: `packages/backend/convex/http/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-028 | HIGH | Health authorization can connect a victim's data to an attacker
  - Status: fixed. Source: `packages/backend/convex/http/googleHealth.ts`.
  - Finish provider callbacks through the authenticated web app. Atomically claim only the signed-in owner's session and preserve pending callbacks through redirect sign-in.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts; apps/web/src/features/settings/connection-callback.test.ts

- [x] DSEC-029 | HIGH_BUG | Failure to send an error reply terminates the bridge
  - Status: fixed. Source: `apps/imessage-bridge/src/index.ts`.
  - Reject group messages before identity lookup. Isolate errors, queue by mapped account with bounded sender admission and deadlines, cancel attachment streams and limit agent abort cleanup to pending reply work.
  - Evidence: apps/imessage-bridge/src/inbound-queue.test.ts: 5 pass, 15 assertions; .deepsec/remediation/evidence/deepsec-review-inbound.md: reviewed once; confirmed findings addressed

- [x] DSEC-030 | HIGH_BUG | An idle editor automatically overwrites edits saved on another client
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/journal-entry-editor-screen.tsx`.
  - Shared journal session serializes saves, checks monotonic server revisions, hydrates idle remote updates, preserves conflict drafts, and offers explicit reload or replacement. Navigation guards and per-editor local recovery cover mobile/web. Conditional recovery cleanup and writer revocation prevent other tabs or delayed callbacks from erasing or recreating deleted drafts.
  - Evidence: 11 backend journal tests and 7 shared-session/browser-storage tests pass; web/mobile/backend types pass; single independent review issues corrected. Real browser navigation and native file/device validation remain final gates.

- [x] DSEC-031 | HIGH_BUG | Start command imports an obsolete build artifact
  - Status: fixed. Source: `apps/web/serve.ts`.
  - Start the current Nitro .output/server/index.mjs artifact and verify the built server responds on its task-owned port.
  - Evidence: .deepsec/remediation/evidence/deepsec-final-web-build.log; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-032 | HIGH_BUG | Switching conversations persists the previous conversation's messages into the new thread
  - Status: fixed. Source: `apps/web/src/features/bee/use-bee-agent.ts`.
  - Key the conversation provider by authenticated account and thread so changing identity remounts the agent hook and its transcript state.
  - Evidence: apps/web/src/features/bee/bee-agent-context.tsx; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-033 | HIGH_BUG | A second tab can silently cancel account data cleanup during identity deletion
  - Status: fixed. Source: `apps/web/src/features/settings/use-account-deletion.ts`.
  - Protect deletion manifests before Clerk deletion without freezing active-account bookmarks; never cancel prepared attempts on client resume; version achievement counting to combine live and historical events once; clear standing Web3 consent on disable and legacy reactivation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-final-state.md; .deepsec/remediation/evidence/deepsec-state-final-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-deletion-resume-tests.log

- [x] DSEC-034 | HIGH_BUG | Connecting Google Workspace selects an unresolvable model
  - Status: fixed. Source: `packages/agent/src/agents/bee.ts`.
  - Use the shared resolvable model default after Google Workspace connection and validate provider fallback behavior.
  - Evidence: packages/agent/test/bee-model.test.ts

- [x] DSEC-035 | HIGH_BUG | Worker cleanup failures permanently orphan account content
  - Status: fixed. Source: `packages/backend/convex/accountDeletion.ts`.
  - Retain the account cleanup manifest and chat identifiers until Worker cleanup actually succeeds; keep retry and watchdog recovery available.
  - Evidence: packages/backend/convex/accountDeletion.test.ts

- [x] DSEC-036 | HIGH_BUG | Failed conversation deletion loses its recovery data
  - Status: fixed. Source: `packages/backend/convex/accountDeletionActions.ts`.
  - Retain the account cleanup manifest and chat identifiers until Worker cleanup actually succeeds; keep retry and watchdog recovery available.
  - Evidence: packages/backend/convex/accountDeletion.test.ts

- [x] DSEC-037 | HIGH_BUG | Status lookup failures abandon potentially submitted transactions
  - Status: fixed. Source: `packages/backend/convex/web3Execution.ts`.
  - After approval, unknown provider results and failed settlement writes preserve the saved transaction ID. Monitoring uses leases, bounded backoff and a watchdog, including legacy false-failure recovery. Recovery observes existing transactions without issuing approvals or replacements.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-settlement.md; .deepsec/remediation/evidence/deepsec-settlement-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-settlement-types.log

- [x] DSEC-038 | HIGH_BUG | Transient errors can permanently mark submitted transactions as failed
  - Status: fixed. Source: `packages/backend/convex/web3lib/executeConfirmed.ts`.
  - After approval, unknown provider results and failed settlement writes preserve the saved transaction ID. Monitoring uses leases, bounded backoff and a watchdog, including legacy false-failure recovery. Recovery observes existing transactions without issuing approvals or replacements.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-settlement.md; .deepsec/remediation/evidence/deepsec-settlement-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-settlement-types.log

- [x] DSEC-039 | HIGH_BUG | Monitoring deadlines declare failure without establishing the transaction outcome
  - Status: fixed. Source: `packages/backend/convex/web3lib/socketOrchestration.ts`.
  - After approval, unknown provider results and failed settlement writes preserve the saved transaction ID. Monitoring uses leases, bounded backoff and a watchdog, including legacy false-failure recovery. Recovery observes existing transactions without issuing approvals or replacements.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-settlement.md; .deepsec/remediation/evidence/deepsec-settlement-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-settlement-types.log

- [x] DSEC-040 | HIGH_BUG | Reconciliation reports failure without establishing transaction failure
  - Status: fixed. Source: `packages/backend/convex/web3lib/sugarExecution.ts`.
  - After approval, unknown provider results and failed settlement writes preserve the saved transaction ID. Monitoring uses leases, bounded backoff and a watchdog, including legacy false-failure recovery. Recovery observes existing transactions without issuing approvals or replacements.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-settlement.md; .deepsec/remediation/evidence/deepsec-settlement-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-settlement-types.log

- [x] DSEC-041 | HIGH_BUG | Destination balance inflates the origin-chain debit
  - Status: fixed. Source: `packages/sugar/src/planner.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-042 | MEDIUM | An unauthenticated callback can terminate an ongoing login
  - Status: fixed. Source: `apps/cli/src/callback-server.ts`.
  - Ignore unauthenticated or mismatched login callbacks without terminating the pending login; complete only the matching state.
  - Evidence: apps/cli/src/callback-server.test.ts

- [x] DSEC-043 | MEDIUM | Keychain writes expose access and refresh tokens in process arguments
  - Status: fixed. Source: `apps/cli/src/credential-store.ts`.
  - Send Keychain credential contents through standard input rather than process arguments.
  - Evidence: apps/cli/src/credential-store.test.ts

- [x] DSEC-044 | MEDIUM | Untrusted reply text reaches the terminal without control-character filtering
  - Status: fixed. Source: `apps/cli/src/index.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-045 | MEDIUM | One sender can monopolize the shared inbound message loop
  - Status: fixed. Source: `apps/imessage-bridge/src/index.ts`.
  - Reject group messages before identity lookup. Isolate errors, queue by mapped account with bounded sender admission and deadlines, cancel attachment streams and limit agent abort cleanup to pending reply work.
  - Evidence: apps/imessage-bridge/src/inbound-queue.test.ts: 5 pass, 15 assertions; .deepsec/remediation/evidence/deepsec-review-inbound.md: reviewed once; confirmed findings addressed

- [x] DSEC-046 | MEDIUM | Realtime voice credentials have no per-user issuance or usage limits
  - Status: fixed. Source: `apps/mobile/src/app/voice-conversation.tsx`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-047 | MEDIUM | Photo attachment API permits deletion of another user's stored file
  - Status: fixed. Source: `apps/web/src/features/health/journal-pages.tsx`.
  - Authenticated server uploads now bind new photo IDs to their owner, cap actual bytes, and clean rejected uploads. Unverified legacy deletion requests retain provenance review records; account tombstones remain until review completes. Historical blob ownership reconciliation remains a rollout prerequisite.
  - Evidence: 21 photo/account-deletion tests passed; concurrent 9-of-10 upload review passed; web/mobile/backend typechecks passed.

- [x] DSEC-048 | MEDIUM | iMessage linking tokens leak through Sentry Replay URLs
  - Status: fixed. Source: `apps/web/src/routes/link.imessage.tsx`.
  - Shared telemetry sanitizes transaction spans and navigation data; Replay disabled on web and mobile.
  - Evidence: Observability tests: 6 passed; web and mobile SDK assignments typechecked; remaining callers pending final gate

- [x] DSEC-049 | MEDIUM | Paid voice endpoints have no per-user usage limits
  - Status: fixed. Source: `packages/agent/src/app.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-050 | MEDIUM | Authenticated users can consume shared voice credits without usage limits
  - Status: fixed. Source: `packages/agent/src/routes/voice.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-051 | MEDIUM | Voice request bodies are buffered without a size limit
  - Status: fixed. Source: `packages/agent/src/routes/voice.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-052 | MEDIUM | Paid Firecrawl operations have no per-user usage budget
  - Status: fixed. Source: `packages/agent/src/shared/firecrawl-subagent.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-053 | MEDIUM | Media generation spends shared FAL credits without per-user limits
  - Status: fixed. Source: `packages/agent/src/shared/imagine-subagent.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-054 | MEDIUM | Users can repeatedly charge shared Devin credits without enforced quotas
  - Status: fixed. Source: `packages/agent/src/shared/powerups/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-055 | MEDIUM | Reactivating completed Jobs bypasses the per-user Job limit
  - Status: fixed. Source: `packages/backend/convex/agentJobs.ts`.
  - Apply the active-and-paused Job capacity limit inside both creation and completed-to-active mutations.
  - Evidence: packages/backend/convex/agentJobs.test.ts

- [x] DSEC-056 | MEDIUM | Job execution bypasses the optional subscription requirement
  - Status: fixed. Source: `packages/backend/convex/agentJobs.ts`.
  - Apply the same optional subscription requirement at scheduled Worker admission and preserve retry for unavailable verification.
  - Evidence: packages/agent/src/routes/internal.ts

- [x] DSEC-057 | MEDIUM | Site owners can republish suspended sites
  - Status: fixed. Source: `packages/backend/convex/beeSites.ts`.
  - Reject suspended sites and bind publication to the current preview digest, slug and publication revision; unpublish invalidates stale approval.
  - Evidence: packages/backend/convex/beeSites.test.ts

- [x] DSEC-058 | MEDIUM | Bookmark processing has no per-user spending or submission limit
  - Status: fixed. Source: `packages/backend/convex/bookmarkCrawl.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-059 | MEDIUM | Authenticated users can schedule unlimited paid bookmark processing
  - Status: fixed. Source: `packages/backend/convex/bookmarks.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-060 | MEDIUM | Users can launch unlimited work against the shared Devin account
  - Status: fixed. Source: `packages/backend/convex/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-061 | MEDIUM | Devin session creation has no enforced per-user spending quota
  - Status: fixed. Source: `packages/backend/convex/http/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-062 | MEDIUM | Billable media generation has no per-user usage controls
  - Status: fixed. Source: `packages/backend/convex/http/falMedia.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-063 | MEDIUM | Forwarded Telegram login links allow messaging another user's account
  - Status: fixed. Source: `packages/backend/convex/http/telegram.ts`.
  - Finish provider callbacks through the authenticated web app. Atomically claim only the signed-in owner's session and preserve pending callbacks through redirect sign-in.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts; apps/web/src/features/settings/connection-callback.test.ts

- [x] DSEC-064 | MEDIUM | Attaching another user's storage ID grants file deletion authority
  - Status: fixed. Source: `packages/backend/convex/journalEntries.ts`.
  - Authenticated server uploads now bind new photo IDs to their owner, cap actual bytes, and clean rejected uploads. Unverified legacy deletion requests retain provenance review records; account tombstones remain until review completes. Historical blob ownership reconciliation remains a rollout prerequisite.
  - Evidence: 21 photo/account-deletion tests passed; concurrent 9-of-10 upload review passed; web/mobile/backend typechecks passed.

- [x] DSEC-065 | MEDIUM | Unauthenticated query exposes other users' enabled power-ups
  - Status: fixed. Source: `packages/backend/convex/powerups.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-066 | MEDIUM | One account can permanently reserve unlimited profile handles
  - Status: fixed. Source: `packages/backend/convex/publicProfiles.ts`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-067 | MEDIUM | Historical recurrence dates cause unbounded synchronous catch-up
  - Status: fixed. Source: `packages/backend/convex/recurrence.ts`.
  - Bound historical recurrence catch-up and calculate each month from the original anchor day so February does not shift later dates.
  - Evidence: packages/backend/convex/recurrence.test.ts

- [x] DSEC-068 | MEDIUM | Authenticated users can schedule unmetered paid scraping and summarization
  - Status: fixed. Source: `packages/backend/convex/scraper.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-069 | MEDIUM | Delayed purchase webhook can override newer inactive subscription state
  - Status: fixed. Source: `packages/backend/convex/subscriptions.ts`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-070 | MEDIUM | Navigation breadcrumbs retain sensitive URL parameters
  - Status: fixed. Source: `packages/observability/src/sentry.ts`.
  - Shared telemetry sanitizes transaction spans and navigation data; Replay disabled on web and mobile.
  - Evidence: Observability tests: 6 passed; web and mobile SDK assignments typechecked; remaining callers pending final gate

- [x] DSEC-071 | MEDIUM | Unsolicited NFT transfers can halt wallet automation
  - Status: fixed. Source: `packages/sugar/src/alm/engine.ts`.
  - ALM identifies the replacement NFT from deposit mint logs and verifies owner, pool and range. External rejection and local preparation failures restore a retryable step; uncertain broadcasts remain blocked.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-final.md; .deepsec/remediation/evidence/deepsec-sugar-final-tests.log; .deepsec/remediation/evidence/deepsec-local-prebroadcast-verified.log; .deepsec/remediation/evidence/deepsec-sugar-reviewed-types.log

- [x] DSEC-072 | MEDIUM | Unescaped token symbols can spoof the transaction confirmation
  - Status: fixed. Source: `packages/sugar/src/cli/run-action.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-073 | MEDIUM | Unescaped token metadata can falsify transaction confirmations
  - Status: fixed. Source: `packages/sugar/src/send.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-074 | MEDIUM | Destination balance incorrectly increases the origin bridge debit
  - Status: fixed. Source: `packages/sugar/src/superswap.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-075 | MEDIUM | First-time pairing can create world-readable session key storage
  - Status: fixed. Source: `packages/sugar/src/walletconnect.ts`.
  - Create and repair private WalletConnect storage before SDK startup, protect later writes, reject symlinks; preserve resolved multicall errors and distinguish aggregate failure from genuine quoter reverts for bounded retries and fallback.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-io.md; .deepsec/remediation/evidence/deepsec-sugar-io-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-sugar-real-multicall.log; .deepsec/remediation/evidence/deepsec-sugar-io-types.log

- [x] DSEC-076 | MEDIUM | Transfer confirmations hide the recipient address
  - Status: fixed. Source: `packages/tool-presentation/src/web3-text.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-077 | BUG | Transient refresh failures delete valid saved credentials
  - Status: fixed. Source: `apps/cli/src/clerk-auth.ts`.
  - Preserve saved CLI credentials on transient refresh errors and clear them only after a confirmed invalid grant.
  - Evidence: apps/cli/src/clerk-auth.test.ts

- [x] DSEC-078 | BUG | Mixed confirmation cards display one action but apply another
  - Status: fixed. Source: `apps/cli/src/session.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-079 | BUG | Starting a new conversation strands queued messages
  - Status: fixed. Source: `apps/cli/src/tui.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-080 | BUG | Failed unlink requests are reported as an already-disconnected address
  - Status: fixed. Source: `apps/imessage-bridge/src/identity.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-081 | BUG | Goal and project renaming does nothing on Android
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/goals/[goalId].tsx`.
  - Use the shared Android input/action dialog for goal, project and task menus, retaining text entry, all actions and cancellation.
  - Evidence: apps/mobile/src/components/input-dialog.tsx

- [x] DSEC-082 | BUG | Goal renaming does nothing on Android
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/goals/index.tsx`.
  - Use the shared Android input/action dialog for goal, project and task menus, retaining text entry, all actions and cancellation.
  - Evidence: apps/mobile/src/components/input-dialog.tsx

- [x] DSEC-083 | BUG | Task and project renaming does nothing on Android
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/goals/project/[projectId].tsx`.
  - Use the shared Android input/action dialog for goal, project and task menus, retaining text entry, all actions and cancellation.
  - Evidence: apps/mobile/src/components/input-dialog.tsx

- [x] DSEC-084 | BUG | Android truncates date menus and removes cancellation options
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/goals/project/[projectId].tsx`.
  - Use the shared Android input/action dialog for goal, project and task menus, retaining text entry, all actions and cancellation.
  - Evidence: apps/mobile/src/components/input-dialog.tsx

- [x] DSEC-085 | BUG | Save completion discards edits made while saving
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/mind/[bookmarkId].tsx`.
  - Track editor revisions so an older bookmark save response cannot overwrite newer title or note edits.
  - Evidence: apps/mobile/src/app/(tabs)/mind/[bookmarkId].tsx

- [x] DSEC-086 | BUG | Rapid label changes overwrite earlier changes
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/mind/[bookmarkId].tsx`.
  - Apply owner-checked atomic label add/remove operations against current server state.
  - Evidence: packages/backend/convex/bookmarks.test.ts

- [x] DSEC-087 | BUG | Label-filtered search hides matches beyond the first 24 results
  - Status: fixed. Source: `apps/mobile/src/app/(tabs)/mind/index.tsx`.
  - Use owner-scoped paginated search with label filters and preserve the continuation cursor for later matches.
  - Evidence: packages/backend/convex/bookmarks.test.ts

- [x] DSEC-088 | BUG | Save responses overwrite edits made while saving
  - Status: fixed. Source: `apps/mobile/src/app/public-profile.tsx`.
  - Apply canonical profile save results only to fields that still equal their submitted values; preserve later edits independently.
  - Evidence: apps/web/src/features/settings/public-profile-settings.tsx; apps/mobile/src/app/public-profile.tsx

- [x] DSEC-089 | BUG | Shares without a usable URL remain stuck saving
  - Status: fixed. Source: `apps/mobile/src/app/share.tsx`.
  - End the share loading state when URL resolution completes without a usable URL and expose the existing recovery controls.
  - Evidence: apps/mobile/src/app/share.tsx

- [x] DSEC-090 | BUG | Pending startup can reactivate the microphone after closing the screen
  - Status: fixed. Source: `apps/mobile/src/app/voice-conversation.tsx`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-091 | BUG | Mixed question types leave selected answers unsendable
  - Status: fixed. Source: `apps/mobile/src/components/agent/cards/question-card.tsx`.
  - Collect free text and option answers in one indexed map and require an answer for every question before multi-question submission.
  - Evidence: apps/web/src/features/bee/generated-ui.tsx; apps/mobile/src/components/agent/cards/question-card.tsx

- [x] DSEC-092 | BUG | Rejecting a later wallet step falsely reports that nothing was sent
  - Status: fixed. Source: `apps/mobile/src/components/agent/cards/web3-confirm-card.tsx`.
  - Web and mobile display the authenticated canonical summary, require it in confirmation, and render persisted states for all wallet types. Cancellation acknowledges its actual result before informing Bee. veNFT summaries include exact normalized amount and lock duration.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-finance-cards.md; .deepsec/remediation/evidence/deepsec-finance-card-tests.log; .deepsec/remediation/evidence/deepsec-finance-card-web-types.log; .deepsec/remediation/evidence/deepsec-finance-card-mobile-types.log

- [x] DSEC-093 | BUG | Reopened smart-wallet cards ignore persisted execution status
  - Status: fixed. Source: `apps/mobile/src/components/agent/cards/web3-confirm-card.tsx`.
  - Web and mobile display the authenticated canonical summary, require it in confirmation, and render persisted states for all wallet types. Cancellation acknowledges its actual result before informing Bee. veNFT summaries include exact normalized amount and lock duration.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-finance-cards.md; .deepsec/remediation/evidence/deepsec-finance-card-tests.log; .deepsec/remediation/evidence/deepsec-finance-card-web-types.log; .deepsec/remediation/evidence/deepsec-finance-card-mobile-types.log

- [x] DSEC-094 | BUG | Failed slash command overwrites a newer draft
  - Status: fixed. Source: `apps/mobile/src/components/agent/prompt-input.tsx`.
  - Restore a failed slash command only when the input is still empty, preserving a newer draft.
  - Evidence: apps/mobile/src/components/agent/prompt-input.tsx

- [x] DSEC-095 | BUG | Initially streaming reasoning never starts its timer or opens automatically
  - Status: fixed. Source: `apps/mobile/src/components/agent/reasoning.tsx`.
  - Initialize the reasoning timer for an initially streaming response and reset automatic-collapse state for each later stream.
  - Evidence: apps/mobile/src/components/agent/reasoning.tsx; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-096 | BUG | Android system Back bypasses saving and discards pending edits
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/journal-entry-editor-screen.tsx`.
  - Shared journal session serializes saves, checks monotonic server revisions, hydrates idle remote updates, preserves conflict drafts, and offers explicit reload or replacement. Navigation guards and per-editor local recovery cover mobile/web. Conditional recovery cleanup and writer revocation prevent other tabs or delayed callbacks from erasing or recreating deleted drafts.
  - Evidence: 11 backend journal tests and 7 shared-session/browser-storage tests pass; web/mobile/backend types pass; single independent review issues corrected. Real browser navigation and native file/device validation remain final gates.

- [x] DSEC-097 | BUG | Offline drafts from previous days are never recovered
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/journal-screen.tsx`.
  - Both NFC editors capture current settings and send only changed fields with a required monotonic revision. Offline migration imports all dated user drafts atomically, rejects account switches, deduplicates retries and backup replay, and clears only the imported snapshot. Effect restarts and explicit retry preserve completion feedback.
  - Evidence: 11 backend tests and 1 local storage test passed; independent review lifecycle issue corrected; web/mobile/backend typechecks passed.

- [x] DSEC-098 | BUG | Deleted legacy reflections reappear when Journal is reopened
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/journal-screen.tsx`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-099 | BUG | Repeated equal additions do not reset the undo timer
  - Status: fixed. Source: `apps/mobile/src/components/bee-healthy/water-screen.tsx`.
  - Give every successful water addition a new identity and use it as the undo timeout dependency, including repeated equal amounts.
  - Evidence: apps/mobile/src/components/bee-healthy/water-screen.tsx; apps/web/src/features/health/health-pages.tsx

- [x] DSEC-100 | BUG | Cancelling an older authorization can disconnect a newer connection
  - Status: fixed. Source: `apps/mobile/src/components/beennectors/beennectors-settings.tsx`.
  - Cancel only the named pending authorization session so older cancellation cannot disconnect a newer connection.
  - Evidence: packages/backend/convex/telegram.test.ts; packages/backend/convex/oauthCompletion.test.ts

- [x] DSEC-101 | BUG | Reopened saved previews silently discard edits
  - Status: fixed. Source: `apps/mobile/src/components/first-focus/first-focus-preview-card.tsx`.
  - Query the canonical saved first-focus receipt using the same normalized request ID as confirmation and render saved previews as committed.
  - Evidence: packages/backend/convex/firstFocus.test.ts

- [x] DSEC-102 | BUG | Haptic failure reports a committed plan as unsaved
  - Status: fixed. Source: `apps/mobile/src/components/first-focus/first-focus-preview-card.tsx`.
  - Commit the saved-plan state before detached haptic feedback and consume haptic failure without reporting a failed save.
  - Evidence: apps/mobile/src/components/first-focus/first-focus-preview-card.tsx

- [x] DSEC-103 | BUG | Transient image failures remain cached after connectivity returns
  - Status: fixed. Source: `apps/mobile/src/components/mind/use-cached-sk-image.ts`.
  - Cache only successfully decoded images and always clear the pending request so a later mount can retry failed fetches.
  - Evidence: apps/mobile/src/components/mind/use-cached-sk-image.ts

- [x] DSEC-104 | BUG | NFC editor can overwrite newer action settings with stale values
  - Status: fixed. Source: `apps/mobile/src/components/nfc-actions/nfc-action-type-screen.tsx`.
  - Both NFC editors capture current settings and send only changed fields with a required monotonic revision. Offline migration imports all dated user drafts atomically, rejects account switches, deduplicates retries and backup replay, and clears only the imported snapshot. Effect restarts and explicit retry preserve completion feedback.
  - Evidence: 11 backend tests and 1 local storage test passed; independent review lifecycle issue corrected; web/mobile/backend typechecks passed.

- [x] DSEC-105 | BUG | Cancelled connection can disconnect a newer session
  - Status: fixed. Source: `apps/mobile/src/components/subscription/subscription-provider.tsx`.
  - Serialize subscription client lifecycle operations and require the current connection lease for disconnects and callbacks.
  - Evidence: apps/mobile/src/lib/subscription-client.test.ts

- [x] DSEC-106 | BUG | Disconnected wallets cannot be unlinked through settings
  - Status: fixed. Source: `apps/mobile/src/components/web3/wallet-settings.tsx`.
  - Show Unlink for every stored external wallet and remove its backend association before optional local-provider disconnect.
  - Evidence: apps/mobile/src/components/web3/wallet-settings.tsx; apps/web/src/features/settings/wallet-settings.tsx

- [x] DSEC-107 | BUG | Cancelled startup can restart the microphone after the conversation ends
  - Status: fixed. Source: `apps/mobile/src/hooks/use-xai-voice-conversation.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-108 | BUG | Microphone resume failure disables the displayed retry action
  - Status: fixed. Source: `apps/mobile/src/hooks/use-xai-voice-conversation.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-109 | BUG | Mobile agent URL defaults to the device's localhost
  - Status: fixed. Source: `apps/mobile/src/lib/flue.ts`.
  - Default mobile agent traffic to the established production Worker URL when no explicit environment override is set.
  - Evidence: apps/mobile/src/lib/flue.ts; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-110 | BUG | Overlapping NFC writes cancel the active write
  - Status: fixed. Source: `apps/mobile/src/lib/nfc-tags.ts`.
  - Acquire the native NFC write lock before requesting the device and release only the owning operation in nested cleanup.
  - Evidence: apps/mobile/src/lib/nfc-tags.test.ts

- [x] DSEC-111 | BUG | Stale disconnect clears a newer connection for the same account
  - Status: fixed. Source: `apps/mobile/src/lib/subscription-client.ts`.
  - Serialize subscription client lifecycle operations and require the current connection lease for disconnects and callbacks.
  - Evidence: apps/mobile/src/lib/subscription-client.test.ts

- [x] DSEC-112 | BUG | Synthesized speech files accumulate without cleanup
  - Status: fixed. Source: `apps/mobile/src/lib/voice-api.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-113 | BUG | Mutable public asset URLs are cached as immutable for one year
  - Status: fixed. Source: `apps/sites/src/index.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-114 | BUG | Directory pages are served without canonical trailing slashes
  - Status: fixed. Source: `apps/sites/src/index.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-115 | BUG | Different tool results can display identical cached content
  - Status: fixed. Source: `apps/web/src/components/ai-elements/code-block.tsx`.
  - Key highlighted output by the complete language and content, with bounded LRU entries and memory accounting that rejects oversized results.
  - Evidence: apps/web/src/components/ai-elements/code-token-cache.test.ts; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-116 | BUG | Highlighted tool results accumulate without eviction
  - Status: fixed. Source: `apps/web/src/components/ai-elements/code-block.tsx`.
  - Key highlighted output by the complete language and content, with bounded LRU entries and memory accounting that rejects oversized results.
  - Evidence: apps/web/src/components/ai-elements/code-token-cache.test.ts; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-117 | BUG | Out-of-range preview timestamps crash conversation rendering
  - Status: fixed. Source: `apps/web/src/features/bee/first-focus-preview.tsx`.
  - Reject nonfinite or out-of-range preview timestamps at the shared beeui schema boundary before any channel renders them.
  - Evidence: packages/tool-presentation/src/first-focus-validation.test.ts; .deepsec/remediation/evidence/deepsec-review-final-seven.md

- [x] DSEC-118 | BUG | Failed token requests leave the microphone running
  - Status: fixed. Source: `apps/web/src/features/bee/use-realtime-voice.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-119 | BUG | Callbacks from an ended session can tear down its replacement
  - Status: fixed. Source: `apps/web/src/features/bee/use-realtime-voice.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-120 | BUG | Late response completion can permanently disable microphone transmission
  - Status: fixed. Source: `apps/web/src/features/bee/use-realtime-voice.ts`.
  - Voice sessions own asynchronous resources and reject stale callbacks; speech replies own unique players and files; native audio mode transitions share one queue.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-voice-clients.md; .deepsec/remediation/evidence/deepsec-voice-client-runtime-tests.log; .deepsec/remediation/evidence/deepsec-speech-files-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-client-web-types.log; .deepsec/remediation/evidence/deepsec-voice-client-mobile-final-types.log

- [x] DSEC-121 | BUG | Pages left open overnight write health updates to yesterday
  - Status: fixed. Source: `apps/web/src/features/health/health-pages.tsx`.
  - Refresh the current local day at midnight, focus and visibility changes; reset day-specific state and reject stale date-bound writes.
  - Evidence: apps/web/src/features/health/use-current-local-day.ts; apps/web/src/features/health/health-pages.tsx

- [x] DSEC-122 | BUG | Navigating away discards pending journal edits
  - Status: fixed. Source: `apps/web/src/features/health/journal-pages.tsx`.
  - Shared journal session serializes saves, checks monotonic server revisions, hydrates idle remote updates, preserves conflict drafts, and offers explicit reload or replacement. Navigation guards and per-editor local recovery cover mobile/web. Conditional recovery cleanup and writer revocation prevent other tabs or delayed callbacks from erasing or recreating deleted drafts.
  - Evidence: 11 backend journal tests and 7 shared-session/browser-storage tests pass; web/mobile/backend types pass; single independent review issues corrected. Real browser navigation and native file/device validation remain final gates.

- [x] DSEC-123 | BUG | Disconnecting ChatGPT leaves cached credentials active
  - Status: fixed. Source: `packages/agent/src/agents/bee.ts`.
  - Clear cached ChatGPT provider credentials when disconnecting and re-resolve credentials before later requests.
  - Evidence: packages/agent/src/providers/pi-chatgpt.ts

- [x] DSEC-124 | BUG | Claiming before dispatch prevents recovery from transient failures
  - Status: fixed. Source: `packages/agent/src/channels/github.ts`.
  - Persist immutable webhook payload and stable admission key before ACK; lease-backed outbox retries transient or lost responses and cancels disconnected accounts. Worker broker endpoint returns actual Flue submission receipt.
  - Evidence: .deepsec/remediation/evidence/deepsec-webhook-outbox-tests.log; .deepsec/remediation/evidence/deepsec-webhook-route-tests.log; .deepsec/remediation/evidence/deepsec-review-webhook-outbox.md; .deepsec/remediation/evidence/deepsec-webhook-reviewed-backend-types.log; .deepsec/remediation/evidence/deepsec-google-webhook-agent-types.log

- [x] DSEC-125 | BUG | Failed dispatches are permanently suppressed as duplicates
  - Status: fixed. Source: `packages/agent/src/channels/linear.ts`.
  - Persist immutable webhook payload and stable admission key before ACK; lease-backed outbox retries transient or lost responses and cancels disconnected accounts. Worker broker endpoint returns actual Flue submission receipt.
  - Evidence: .deepsec/remediation/evidence/deepsec-webhook-outbox-tests.log; .deepsec/remediation/evidence/deepsec-webhook-route-tests.log; .deepsec/remediation/evidence/deepsec-review-webhook-outbox.md; .deepsec/remediation/evidence/deepsec-webhook-reviewed-backend-types.log; .deepsec/remediation/evidence/deepsec-google-webhook-agent-types.log

- [x] DSEC-126 | BUG | Claimed Notion events cannot recover after dispatch failure
  - Status: fixed. Source: `packages/agent/src/channels/notion.ts`.
  - Persist immutable webhook payload and stable admission key before ACK; lease-backed outbox retries transient or lost responses and cancels disconnected accounts. Worker broker endpoint returns actual Flue submission receipt.
  - Evidence: .deepsec/remediation/evidence/deepsec-webhook-outbox-tests.log; .deepsec/remediation/evidence/deepsec-webhook-route-tests.log; .deepsec/remediation/evidence/deepsec-review-webhook-outbox.md; .deepsec/remediation/evidence/deepsec-webhook-reviewed-backend-types.log; .deepsec/remediation/evidence/deepsec-google-webhook-agent-types.log

- [x] DSEC-127 | BUG | Midstream fallback leaves an unfinished assistant message
  - Status: fixed. Source: `packages/agent/src/providers/pi-chatgpt.ts`.
  - Close the in-progress assistant message before switching a midstream Codex response to fallback.
  - Evidence: packages/agent/test/pi-chatgpt-fallback.test.ts

- [x] DSEC-128 | BUG | Invalid disconnect addresses silently disconnect every linked address
  - Status: fixed. Source: `packages/agent/src/routes/cli.ts`.
  - Preserved canonical financial addresses, bound CLI decisions to displayed summary and queue timing, sanitized terminal output, validated explicit unlink addresses, distinguished unlink failures, and corrected site cache and directory URLs.
  - Evidence: CLI focused suites 28 passed; shared terminal/site/identity/text suites 18 passed; Worker invalid-address route test passed; backend firstFocus/bookmarks/sites/imessage 39 passed; CLI/sites/backend typechecks passed. iMessage displayed-summary continuity needs explicit final review.

- [x] DSEC-129 | BUG | Scheduled wallet grant requests are silently discarded
  - Status: fixed. Source: `packages/agent/src/shared/agent-job-tools.ts`.
  - Validate and forward the scheduled wallet grant from the HTTP request into a pending grant that still requires authenticated approval.
  - Evidence: packages/backend/convex/agentJobs.test.ts

- [x] DSEC-130 | BUG | Account deletion leaves wallet challenges and YOLO preferences behind
  - Status: fixed. Source: `packages/backend/convex/accountDeletion.ts`.
  - Include wallet challenges and YOLO preferences in indexed account purging and tombstone sweeps.
  - Evidence: packages/backend/convex/accountDeletion.test.ts

- [x] DSEC-131 | BUG | Queued runs still dispatch after their Job is canceled
  - Status: fixed. Source: `packages/backend/convex/agentJobRuns.ts`.
  - Recheck Job cancellation when queued work claims dispatch, mark it skipped and clear its active-run reference.
  - Evidence: packages/backend/convex/agentJobs.test.ts

- [x] DSEC-132 | BUG | Cancelled Jobs can still start queued executions
  - Status: fixed. Source: `packages/backend/convex/agentJobs.ts`.
  - Recheck Job cancellation when queued work claims dispatch, mark it skipped and clear its active-run reference.
  - Evidence: packages/backend/convex/agentJobs.test.ts

- [x] DSEC-133 | BUG | Concurrent callbacks can discard a successful token exchange
  - Status: fixed. Source: `packages/backend/convex/beennectorAuthActions.ts`.
  - Tie OAuth exchange completion and failure to one atomic attempt claim so a duplicate callback cannot discard the winning exchange.
  - Evidence: packages/backend/convex/oauthCompletion.test.ts

- [x] DSEC-134 | BUG | Token refresh can outlive its lease and lose rotated credentials
  - Status: fixed. Source: `packages/backend/convex/beennectorAuthActions.ts`.
  - Bound token refresh requests through body consumption, preserve ciphertext on configuration or transient errors, retry known non-consumption errors and prevent replay after uncertain rotation.
  - Evidence: packages/backend/convex/credentialRefreshPolicy.test.ts

- [x] DSEC-135 | BUG | An older disconnect can delete a newly established connection
  - Status: fixed. Source: `packages/backend/convex/beennectorAuthActions.ts`.
  - Detach the selected connection before asynchronous revocation and compare the credential used by a failed request before invalidating it.
  - Evidence: packages/backend/convex/beennectors.test.ts

- [x] DSEC-136 | BUG | A delayed 401 can invalidate a newly connected account
  - Status: fixed. Source: `packages/backend/convex/beennectorOperations.ts`.
  - Detach the selected connection before asynchronous revocation and compare the credential used by a failed request before invalidating it.
  - Evidence: packages/backend/convex/beennectors.test.ts

- [x] DSEC-137 | BUG | An in-flight deployment can undo an unpublish
  - Status: fixed. Source: `packages/backend/convex/beeSites.ts`.
  - Reject suspended sites and bind publication to the current preview digest, slug and publication revision; unpublish invalidates stale approval.
  - Evidence: packages/backend/convex/beeSites.test.ts

- [x] DSEC-138 | BUG | Stale reauthentication status prevents ChatGPT reconnection
  - Status: fixed. Source: `packages/backend/convex/chatgptAuth.ts`.
  - Give starting and pending ChatGPT authorization precedence over stale reauthentication state.
  - Evidence: packages/backend/convex/chatgptAuth.ts

- [x] DSEC-139 | BUG | Refresh requests can outlive their lease and lose rotated credentials
  - Status: fixed. Source: `packages/backend/convex/chatgptAuthActions.ts`.
  - Bound token refresh requests through body consumption, preserve ciphertext on configuration or transient errors, retry known non-consumption errors and prevent replay after uncertain rotation.
  - Evidence: packages/backend/convex/credentialRefreshPolicy.test.ts

- [x] DSEC-140 | BUG | Temporary encryption configuration failures delete stored credentials
  - Status: fixed. Source: `packages/backend/convex/chatgptAuthActions.ts`.
  - Bound token refresh requests through body consumption, preserve ciphertext on configuration or transient errors, retry known non-consumption errors and prevent replay after uncertain rotation.
  - Evidence: packages/backend/convex/credentialRefreshPolicy.test.ts

- [x] DSEC-141 | BUG | Slow refreshes can outlive their lease and lose rotated credentials
  - Status: fixed. Source: `packages/backend/convex/chatgptOpenAi.ts`.
  - Bound token refresh requests through body consumption, preserve ciphertext on configuration or transient errors, retry known non-consumption errors and prevent replay after uncertain rotation.
  - Evidence: packages/backend/convex/credentialRefreshPolicy.test.ts

- [x] DSEC-142 | BUG | Each inspection starts another independent polling chain
  - Status: fixed. Source: `packages/backend/convex/devin.ts`.
  - Atomic per-user and global service budgets, bounded requests, approved Devin access, durable coalesced polls, stateless metered Firecrawl tools, trusted media attribution, and server-controlled realtime voice tickets and relay.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-quota.md; .deepsec/remediation/evidence/deepsec-review-voice.md; .deepsec/remediation/evidence/deepsec-paid-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-voice-workerd.log; .deepsec/remediation/evidence/deepsec-firecrawl-admission-tests.log

- [x] DSEC-143 | BUG | Backfill undercounts progress when live completions precede it
  - Status: fixed. Source: `packages/backend/convex/economyLib/achievements.ts`.
  - Protect deletion manifests before Clerk deletion without freezing active-account bookmarks; never cancel prepared attempts on client resume; version achievement counting to combine live and historical events once; clear standing Web3 consent on disable and legacy reactivation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-final-state.md; .deepsec/remediation/evidence/deepsec-state-final-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-deletion-resume-tests.log

- [x] DSEC-144 | BUG | Goal deletion retains recurring task and project content
  - Status: fixed. Source: `packages/backend/convex/goals.ts`.
  - Delete recurrence schedules with their owning goal using bounded scheduled continuation; removed goals cannot materialize new tasks.
  - Evidence: packages/backend/convex/goals.ts; packages/backend/convex/recurrence.test.ts

- [x] DSEC-145 | BUG | Job creation silently discards the requested wallet grant
  - Status: fixed. Source: `packages/backend/convex/http/jobs.ts`.
  - Validate and forward the scheduled wallet grant from the HTTP request into a pending grant that still requires authenticated approval.
  - Evidence: packages/backend/convex/agentJobs.test.ts

- [x] DSEC-146 | BUG | Disconnect-all leaves linked addresses active after the first 20
  - Status: fixed. Source: `packages/backend/convex/imessage.ts`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-147 | BUG | Deleted legacy journal entries are automatically recreated
  - Status: fixed. Source: `packages/backend/convex/journalEntries.ts`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-148 | BUG | Legacy imports can create entries that reject ordinary edits
  - Status: fixed. Source: `packages/backend/convex/journalEntries.ts`.
  - Bound handle retention and renames; enforce REST observation ordering; list and unlink legacy addresses beyond 20 while capping new links; persist journal migration markers and repair imported calendar timestamps.
  - Evidence: .deepsec/remediation/evidence/deepsec-backend-round4-tests.log: 34 tests passed; /tmp/deepsec-review-state.diff

- [x] DSEC-149 | BUG | Short-month clamping permanently changes the recurrence date
  - Status: fixed. Source: `packages/backend/convex/recurrence.ts`.
  - Bound historical recurrence catch-up and calculate each month from the original anchor day so February does not shift later dates.
  - Evidence: packages/backend/convex/recurrence.test.ts

- [x] DSEC-150 | BUG | Subscription verification timeout excludes response-body consumption
  - Status: fixed. Source: `packages/backend/convex/revenueCatRest.ts`.
  - Keep the RevenueCat request abort deadline active through response body reading and parsing.
  - Evidence: packages/backend/convex/revenueCatRest.test.ts

- [x] DSEC-151 | BUG | Tasks under completed goals can be reopened but cannot be completed again
  - Status: fixed. Source: `packages/backend/convex/tasks.ts`.
  - Reject reopening a task whose goal is missing or inactive, preserving completion behavior for active goals.
  - Evidence: packages/backend/convex/tasks.ts

- [x] DSEC-152 | BUG | veNFT confirmations omit the irreversible lock duration
  - Status: fixed. Source: `packages/backend/convex/web3lib/sugarExecution.ts`.
  - Web and mobile display the authenticated canonical summary, require it in confirmation, and render persisted states for all wallet types. Cancellation acknowledges its actual result before informing Bee. veNFT summaries include exact normalized amount and lock duration.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-finance-cards.md; .deepsec/remediation/evidence/deepsec-finance-card-tests.log; .deepsec/remediation/evidence/deepsec-finance-card-web-types.log; .deepsec/remediation/evidence/deepsec-finance-card-mobile-types.log

- [x] DSEC-153 | BUG | Revoking YOLO consent requires re-enabling Web3
  - Status: fixed. Source: `packages/backend/convex/web3Prefs.ts`.
  - Protect deletion manifests before Clerk deletion without freezing active-account bookmarks; never cancel prepared attempts on client resume; version achievement counting to combine live and historical events once; clear standing Web3 consent on disable and legacy reactivation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-final-state.md; .deepsec/remediation/evidence/deepsec-state-final-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-deletion-resume-tests.log

- [x] DSEC-154 | BUG | Notification subprocess can stall the entire ALM loop
  - Status: fixed. Source: `packages/sugar/src/alm/notify.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-155 | BUG | Multicall failures bypass quote retries and fallback
  - Status: fixed. Source: `packages/sugar/src/quotes.ts`.
  - Create and repair private WalletConnect storage before SDK startup, protect later writes, reject symlinks; preserve resolved multicall errors and distinguish aggregate failure from genuine quoter reverts for bounded retries and fallback.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-io.md; .deepsec/remediation/evidence/deepsec-sugar-io-reviewed-tests.log; .deepsec/remediation/evidence/deepsec-sugar-real-multicall.log; .deepsec/remediation/evidence/deepsec-sugar-io-types.log

- [x] DSEC-156 | BUG | Rejecting a wallet request persistently blocks further executions
  - Status: fixed. Source: `packages/sugar/src/send.ts`.
  - ALM identifies the replacement NFT from deposit mint logs and verifies owner, pool and range. External rejection and local preparation failures restore a retryable step; uncertain broadcasts remain blocked.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-final.md; .deepsec/remediation/evidence/deepsec-sugar-final-tests.log; .deepsec/remediation/evidence/deepsec-local-prebroadcast-verified.log; .deepsec/remediation/evidence/deepsec-sugar-reviewed-types.log

- [x] DSEC-157 | BUG | Fee claims reject valid positions using unrelated staking checks
  - Status: fixed. Source: `packages/sugar/src/transactions.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-158 | BUG | An invalidated analytics load can overwrite a newer report
  - Status: fixed. Source: `packages/sugar/src/tui/analytics/load.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-159 | BUG | Repeat-passphrase prompt inherits the original passphrase
  - Status: fixed. Source: `packages/sugar/src/tui/dialogs.tsx`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-160 | BUG | Dollar income per voting unit is displayed as percentage yield
  - Status: fixed. Source: `packages/sugar/src/tui/screens/analytics.tsx`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-161 | BUG | Switching chains retains the previous chain's financial metrics
  - Status: fixed. Source: `packages/sugar/src/tui/screens/home.tsx`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-162 | BUG | Repeat-passphrase dialog retains the first passphrase
  - Status: fixed. Source: `packages/sugar/src/tui/screens/wallet.tsx`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts

- [x] DSEC-163 | BUG | Completing a prompt destroys stdin before subsequent prompts
  - Status: fixed. Source: `packages/sugar/src/wallet.ts`.
  - Separate origin debit from destination holdings; escape terminal controls; bound and reap notifier children; correct fee-only checks; isolate analytics generations and dialog state; label income units accurately; bind metrics to chain; keep stdin usable across prompts and cancellation.
  - Evidence: .deepsec/remediation/evidence/deepsec-review-sugar-small.md; .deepsec/remediation/evidence/deepsec-sugar-small-tests.log; .deepsec/remediation/evidence/deepsec-sugar-small-types.log; /tmp/deepsec-prompt-verify.ts
