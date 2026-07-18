# Account-deletion release inventory

This document records what the submitted build deletes, what must be configured
outside the repository, and what remains controlled by Apple or another
provider. It is an engineering/release checklist, not a promise that a
dashboard-only step has already been completed.

## Runtime contract

1. The authenticated app creates a non-destructive Convex deletion intent with
   a device-held random capability. No user data is erased at this point.
2. A server-only, identity-and-job-bound preflight asks Clerk for that user's
   Apple OAuth access token. If Clerk returns one, Convex creates a five-minute
   ES256 Apple client secret and requires `/auth/revoke` to return HTTP 200. An
   explicit, structurally valid empty Clerk token list uses Apple's documented
   manual fallback. No provider token or client secret is persisted.
3. Only after that preflight succeeds does the app ask Clerk to delete the
   sign-in identity.
4. Cleanup is activated by either the capability after Clerk returns success or
   Clerk's signed `user.deleted` webhook. Both paths are idempotent.
5. External cleanup runs before local encrypted connection credentials are
   erased. Transient failures are retried with backoff; a 15-minute watchdog
   repairs stalled jobs.
6. Convex data is erased in bounded mutations and repeated until a full pass
   deletes nothing. The process is safe to resume after a crash or deployment.
7. A content-free tombstone retains the Clerk subject/owner key, counters, and
   timing fields for 30 days. It triggers six-hour safety sweeps for delayed
   writes, then deletes itself.

An unconfirmed intent expires after seven days without deleting anything. This
two-phase ordering prevents a failed Clerk deletion from leaving an active user
whose BeeGreat data has already been destroyed.

## Coverage and limitations

| System                                  | Automated behavior                                                                                                                                                                                                 | Release truth                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk                                   | The iOS client deletes the user; signed `user.deleted` delivery activates cleanup if the client crashes or loses connectivity.                                                                                     | The production webhook is mandatory.                                                                                                                                                                                                                      |
| Convex                                  | Deletes all subject/owner-keyed goals, projects, tasks, Hive/economy state, Mind/bookmark/memory state, chats, preferences, power-ups, integration sessions and credentials, wallet cache, and subscription cache. | Privacy-minimized global webhook receipts and legally required records are not user-content rows.                                                                                                                                                         |
| Flue / Cloudflare Durable Objects       | Calls a broker-authenticated Worker route for every known Bee conversation ID; each generated Bee Durable Object atomically runs `storage.deleteAll()`.                                                            | The Worker compatibility date is after `2026-02-24`, so `deleteAll()` also removes alarms. A failed batch is safe to retry.                                                                                                                               |
| RevenueCat                              | Calls `DELETE /v1/subscribers/{clerkUserId}`; HTTP 404 is treated as already complete.                                                                                                                             | This deletes BeeGreat's RevenueCat customer record. It does **not** cancel an App Store subscription or erase Apple's purchase history.                                                                                                                   |
| Google Health                           | Decrypts the refresh token (or access token fallback) and calls Google's OAuth revocation endpoint before deleting the local credential.                                                                           | A provider outage can delay or prevent immediate revocation; the local encrypted credential is still erased.                                                                                                                                              |
| GitHub, Linear, Notion                  | Attempts each provider's supported token revocation before deleting the local encrypted credential.                                                                                                                | Independently retained provider data remains governed by that provider.                                                                                                                                                                                   |
| ChatGPT / OpenAI                        | Deletes BeeGreat's encrypted credential and authorization-session data.                                                                                                                                            | No supported automatic upstream revocation is implemented; the user can revoke BeeGreat from the provider account.                                                                                                                                        |
| Crossmint / public blockchain           | Deletes BeeGreat's Convex wallet cache and disables access by deleting the Clerk identity and power-up state.                                                                                                      | Crossmint's documented Wallets API does not expose wallet deletion. A smart-contract wallet, balances, and public on-chain history cannot be erased by this flow. Confirm any ownership-detach option with Crossmint before production.                   |
| Sign in with Apple                      | Before identity deletion, fetches any Apple OAuth access token held by Clerk and revokes it through Apple's `/auth/revoke` using a just-in-time ES256 client secret. No provider token is stored by BeeGreat.      | Clerk's native Expo ID-token flow may yield an explicit empty token list. Apple TN3194 requires deletion to continue and the app directs the user to Apple Account settings in that no-token case. Clerk/Apple errors are never treated as an empty list. |
| Apple subscription and purchase records | None.                                                                                                                                                                                                              | Account deletion does not cancel BeeGreat Pro. The user must manage it in Apple Subscriptions; Apple controls transaction retention.                                                                                                                      |

## Required production configuration

### Convex

- `CLERK_WEBHOOK_SIGNING_SECRET`: Clerk endpoint signing secret.
- `CLERK_SECRET_KEY`: server-only key for the just-in-time Apple token lookup.
- `APPLE_SIGN_IN_CLIENT_ID`: exact App ID or Services ID that minted Clerk's
  returned Apple token.
- `APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, and
  `APPLE_SIGN_IN_PRIVATE_KEY`: Sign in with Apple REST signing credentials.
- `AGENT_URL`: deployed Flue Worker origin.
- `AGENT_CREDENTIAL_BROKER_SECRET`: identical high-entropy value in Convex and
  the Worker; never expose it through an `EXPO_PUBLIC_*` variable.
- `REVENUECAT_SECRET_API_KEY`: server-side key authorized for Customer Info and
  subscriber deletion.
- Existing Google Health and Beennector encryption/OAuth secrets must remain
  available long enough to decrypt and revoke credentials during deletion.

### Clerk Dashboard

- Add `https://<production-convex-site>/webhooks/clerk`.
- Subscribe to `user.deleted`.
- Copy its signing secret into the Convex deployment, then send and verify a
  signed test event.
- Confirm self-service user deletion is enabled for the submitted instance.

### Flue Worker / Cloudflare

- Deploy the build containing the `deleteAccountData` agent RPC and private
  `/internal/account-deletion` route.
- Set `AGENT_CREDENTIAL_BROKER_SECRET` to the same value as Convex.
- Keep the Durable Object binding `FLUE_BEE_AGENT` and its SQLite migration.
- Confirm the production compatibility date remains `2026-02-24` or later (or
  enable `delete_all_deletes_alarm`).

### RevenueCat and OAuth providers

- Verify the RevenueCat server key against a sandbox customer deletion and an
  already-absent customer before release.
- Verify Google, GitHub, Linear, and Notion revocation with test accounts and a
  forced 5xx/network failure to exercise retry.
- Verify Clerk returns an Apple access token for at least one production-like
  test user and confirm Apple's endpoint returns HTTP 200. Native users for whom
  Clerk returns a valid empty list remain on Apple's documented manual fallback.

## Release verification

- Failed Clerk deletion: the prepared intent is cancelled and product data
  remains.
- Missing Apple/Clerk server configuration, Clerk rejection, malformed token
  response, Apple rejection, or network timeout: the prepared intent is
  cancelled and both the Clerk identity and product data remain intact.
- Explicit empty Clerk Apple token list: the flow proceeds without Apple REST
  credentials and the manual Apple Account settings guidance remains visible.
- Apple revocation succeeds but the app stops before Clerk deletion: the
  prepared intent remains non-destructive and is safely cancelled on resume;
  the user can retry deletion.
- Successful deletion with app termination before activation: Clerk webhook
  activates and finishes cleanup.
- Duplicate client activation and duplicate Clerk webhook: one idempotent job.
- Worker/RevenueCat/provider 5xx: retry occurs without duplicating data or
  reviving an entitlement.
- Process termination midway through Convex erasure: watchdog resumes from the
  durable cursor.
- A simulated delayed write after the first empty pass: the tombstone safety
  sweep removes it.
- Apple sandbox subscription remains manageable after BeeGreat account deletion
  and the UI never claims that deletion cancels it.

Do not paste the App Review notes until these production checks are evidenced.

Official behavior references: [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple), [Cloudflare `deleteAll()` alarm behavior](https://developers.cloudflare.com/changelog/post/2026-02-24-deleteall-deletes-alarms/), and [Crossmint Wallet API scopes](https://docs.crossmint.com/introduction/platform/api-keys/scopes).
