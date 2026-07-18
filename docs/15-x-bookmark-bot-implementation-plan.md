# X mention-to-bookmark bot implementation plan

- **Status:** Planned
- **Linear:** [FRA-473](https://linear.app/francesco-oddo/issue/FRA-473/implement-x-mention-to-bookmark-bot-with-vercel-chat-sdk)
- **Primary runtimes:** Cloudflare/Flue agent worker and Convex
- **Reference code:** `resources/chat` (`@chat-adapter/x` and `agents/chat-sdk`)

## Outcome

A BeeGreat user links their X identity once. After that, replying to a public
post and tagging the shared BeeGreat X bot saves the referenced post into that
user's Mind bookmarks. If another linked person tags the same bot, the post is
saved into their bookmarks instead.

Ownership is derived only from the verified X author ID. A webhook payload,
post body, URL, or Worker request can never choose a Clerk user or Hive owner.

## Product behavior

The MVP invocation is intentionally narrow:

1. A signed-in BeeGreat user connects an X account from Settings.
2. On X, that account replies to a public post and mentions `@BeeGreat`.
3. BeeGreat resolves the direct `replied_to` post, saves its canonical
   `https://x.com/i/status/{postId}` URL, and replies with a short confirmation.
4. An unlinked author receives a connection prompt and causes no write.
5. A mention without one unambiguous referenced post receives usage guidance
   and causes no write.

Any valid reply mention is the save command; no natural-language agent turn is
needed. Direct messages, arbitrary commands, private/protected post ingestion,
and posting as the human user are outside the MVP.

## Decisions and security invariants

- BeeGreat operates one shared bot account. Users link identity, not a private
  copy of the bot.
- X OAuth linking requests only `tweet.read users.read`, calls `/2/users/me`,
  persists the immutable X user ID, and discards the temporary user token.
- One active X identity can belong to only one BeeGreat account. Transfer
  requires an explicit disconnect before a fresh OAuth link.
- The X adapter verifies the CRC challenge and
  `x-twitter-webhooks-signature` before the mention handler runs.
- The webhook handler forwards `actorXUserId`, never `userId` or `ownerKey`.
- Convex resolves the identity, deduplicates the mention, and inserts the
  bookmark in one transaction. Chat SDK deduplication is defense in depth, not
  the business idempotency boundary.
- X workspace or conversation fallback is forbidden. A missing or ambiguous
  identity mapping is a no-op.
- OAuth state and PKCE verifiers expire, are single-use, and are never exposed
  to app clients after creation.
- The bot's OAuth credentials, application bearer token, webhook secret, and
  broker secret remain server-only.

## Architecture

### Chat SDK ingress

Add `chat` and `@chat-adapter/x` to `packages/agent` with Bun. Host the Chat SDK
instance inside a dedicated Cloudflare Agent so `createChatSdkState()` from the
already-installed `agents/chat-sdk` can provide persistent locks, deduplication,
cache, and rotated-token storage.

The Worker exposes both methods at `/channels/x/webhook`:

- `GET` handles X's CRC challenge.
- `POST` verifies and routes X Activity API events.

The route is exempt from Clerk authentication exactly like the existing signed
provider webhook routes. No other route receives this exemption. The Chat
instance registers `onNewMention` and does not subscribe to public threads.

### X identity linking

Keep identity linking separate from Beennectors. GitHub/Linear/Notion
Beennectors persist per-user API credentials for provider operations; the X
feature needs only a verified routing identity. The shared bot's write token is
deployment infrastructure, not a user credential.

Add these Convex tables:

```text
xIdentityAuthSessions
  userId, stateHash, encryptedCodeVerifier, status, expiresAt, updatedAt
  indexes: by_user, by_state_hash

xIdentityLinks
  userId, ownerKey, externalUserId, username, displayName?, linkedAt, updatedAt
  indexes: by_user, by_external_user

xMentionDeliveries
  mentionPostId, actorExternalUserId, userId?, targetPostId?, bookmarkId?,
  outcome, receivedAt
  index: by_mention_post_id
```

Convex indexes are not unique constraints, so the link-completion mutation must
query both indexes transactionally and reject a duplicate BeeGreat owner or X
identity before inserting.

### Referenced-post resolution

The normalized Chat SDK message contains the X author and mention post ID, but
`conversation_id` identifies the conversation root and is not necessarily the
post that the user replied to.

Resolve the target in this order:

1. Read `referenced_tweets` from `message.raw.post` when supplied by the
   Activity API.
2. Otherwise fetch the mention post with the server-only X application bearer
   token and request `tweet.fields=referenced_tweets`.
3. Select exactly one `replied_to` reference. A future quote-post extension may
   accept exactly one `quoted` reference, but it is not required for MVP.
4. Reject zero or multiple eligible targets rather than guessing.

The read-only lookup uses `X_APP_BEARER_TOKEN`; the Chat adapter independently
manages the bot user token used for replies. This avoids coupling target lookup
to the adapter's private rotating-token state.

### Atomic bookmark ingestion

Add a broker-authenticated endpoint such as `/internal/x/mentions`. Its input is
limited to:

```ts
{
  mentionPostId: string
  actorXUserId: string
  targetPostId: string
}
```

The endpoint invokes one internal Convex mutation which:

1. validates all three X IDs as decimal strings;
2. returns the recorded outcome if `mentionPostId` was already processed;
3. resolves exactly one `xIdentityLinks` row by `actorXUserId`;
4. verifies the stored `userId` and `ownerKey` still identify the same Hive;
5. calls the existing `insertBookmarkForOwner` helper with the canonical URL;
6. inserts the delivery outcome and bookmark ID in the same transaction; and
7. lets the existing scraper schedule enrich the bookmark asynchronously.

Expected outcomes are `saved`, `already_saved`, `unlinked`, `ambiguous`, and
`invalid_target`. Only `saved` and `already_saved` receive a success response on
X. Repeated deliveries must return the original outcome without another write.

## Implementation phases

### Phase 0 — Compatibility spike

- Pin the current compatible `chat` and `@chat-adapter/x` versions.
- Prove a named Cloudflare Agent export and `ChatSdkStateAgent` survive the
  Flue build pipeline and generated Wrangler configuration.
- Verify `nodejs_compat`, Durable Object bindings, and migrations locally.
- Replay signed CRC and mention fixtures without contacting X.

Stop and revise the hosting boundary if Flue cannot preserve the additional
Agent exports cleanly; do not fall back to in-memory Chat state in production.

### Phase 1 — Backend identity domain

- Add validators and the three Convex tables.
- Implement PKCE session creation, callback completion, connection status, and
  disconnect.
- Enforce both sides of the one-to-one identity invariant.
- Add the Settings connection UI on mobile and web.
- Add account-deletion cleanup for sessions, links, and delivery metadata.

### Phase 2 — Atomic ingestion boundary

- Implement the internal mutation and authenticated HTTP endpoint.
- Reuse `insertBookmarkForOwner` so normalization, URL deduplication, ownership,
  and scraping stay canonical.
- Return stable, non-sensitive outcome codes to the Worker.
- Add retention cleanup for delivery receipts.

### Phase 3 — X Chat SDK runtime

- Add the X adapter, durable Chat state, webhook route, and environment types.
- Resolve reply targets through raw references with API lookup fallback.
- Send the atomic ingestion request and map outcomes to concise replies.
- Capture operational failures in Sentry without post text, handles, raw
  webhook bodies, tokens, or X profile details.

### Phase 4 — Deployment and rollout

- Create/configure the X app and shared BeeGreat bot account.
- Register the production webhook and subscribe only to
  `post.mention.create`.
- Start with an allowlist of linked test accounts, then remove the gate after
  successful duplicate, spoofing, disconnect, and cross-user isolation tests.
- Document X automation-policy compliance and an immediate bot kill switch.

## Expected file map

```text
packages/backend/convex/schema.ts
packages/backend/convex/xIdentityValidators.ts
packages/backend/convex/xIdentity.ts
packages/backend/convex/xIdentityOAuth.ts
packages/backend/convex/xIdentityAuthActions.ts
packages/backend/convex/xMentions.ts
packages/backend/convex/http.ts
packages/backend/convex/accountDeletion.ts
packages/backend/.env.example

packages/agent/src/channels/x.ts
packages/agent/src/shared/x-client.ts
packages/agent/src/app.ts
packages/agent/wrangler.jsonc
packages/agent/.env.example
packages/agent/package.json

apps/mobile/src/components/beennectors/ or a dedicated connected-accounts surface
apps/web/src/features/settings/
```

Keep the X identity UI alongside connected accounts, while keeping its backend
domain separate from credential-bearing Beennectors.

## Test matrix

- Valid X OAuth callback links the logged-in BeeGreat user.
- Expired, reused, mismatched, and missing OAuth state fails closed.
- One X identity cannot be attached to two BeeGreat users.
- One BeeGreat user reconnecting the same X identity is idempotent.
- Author A saves only into A's Hive; author B saves only into B's Hive.
- Unlinked and ambiguous authors produce no bookmark.
- Forged or unsigned webhook requests never reach the handler.
- Duplicate webhook delivery creates one bookmark and one delivery receipt.
- A nested reply saves the direct parent, not `conversation_id`'s root.
- Standalone and ambiguous mentions produce no bookmark.
- Disconnect immediately prevents future saves.
- Account deletion removes the identity link and routing metadata.
- Sentry events contain no raw post text, webhook body, token, or profile data.

## Verification

Use Bun for every repository command:

```sh
bun test packages/backend packages/agent
bunx convex codegen
bunx tsc --noEmit -p packages/backend/tsconfig.json
bunx tsc --noEmit -p packages/agent/tsconfig.json
bun run --cwd packages/agent build
```

Before production rollout, replay captured signed X fixtures against a preview
Worker, confirm ownership in Convex with two linked test users, and manually
verify the saved bookmark appears only in the tagging user's Mind.

## Done when

- A linked user can save a public X post by replying and tagging BeeGreat.
- Two different linked users are demonstrably isolated.
- No unlinked, ambiguous, unsigned, duplicate, or malformed delivery can write
  a bookmark.
- The direct referenced post is saved deterministically.
- Chat state and business delivery receipts survive Worker restarts.
- Disconnect and account deletion revoke routing immediately.
- Focused backend, Worker, type, and build checks pass.

## References

- `resources/chat/packages/adapter-x/README.md`
- `resources/chat/packages/adapter-x/src/index.ts`
- `resources/chat/packages/chat/src/types.ts`
- `resources/chat/apps/docs/content/adapters/vendor-official/cloudflare-agents.mdx`
- [X OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X Get Post by ID](https://docs.x.com/x-api/posts/get-post-by-id)
- [X fields guide](https://docs.x.com/x-api/fundamentals/fields)
