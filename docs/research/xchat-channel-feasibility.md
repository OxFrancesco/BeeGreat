# XChat channel feasibility for BeeGreat

- Date: 2026-07-30
- Status: feasible, pending a credential and runtime compatibility spike
- Scope: research only; no application code changed

## Verdict

BeeGreat can add XChat as a real encrypted messaging channel today. X now
publishes an [XChat introduction](https://docs.x.com/xchat/introduction), a
[current OpenAPI contract](https://docs.x.com/openapi.json), and an official
[Chat XDK](https://docs.x.com/xchat/xchat-xdk). This is a public developer
surface, not merely an announced consumer feature.

The best fit is a **single BeeGreat X bot account** that receives encrypted
chats, resolves the sender's verified X identity to one BeeGreat account, sends
the plaintext to that user's Bee agent, and encrypts the reply back to XChat.
This extends the shared bot and `xIdentityLinks` design already planned in
[`docs/15-x-bookmark-bot-implementation-plan.md`](../15-x-bookmark-bot-implementation-plan.md);
it does not require access to every linked user's private inbox.

Before committing to production, complete two gates:

1. Confirm the BeeGreat Developer Console app can call the `/2/chat/*`
   endpoints and inspect its actual endpoint prices and rate-limit headers.
2. Finish the Bun runtime spike. On 2026-07-30, the currently published
   `@xdevplatform/chat-xdk@0.4.3` and `@xdevplatform/xdk@0.6.6` packages
   installed and imported successfully under Bun. A live Juicebox unlock,
   offline crypto vectors, restart recovery, and an encrypted round-trip still
   need testing. X documents the JavaScript/WASM binding for Node 18+, but does
   not claim Bun or Cloudflare Workers compatibility.

## What is publicly implementable

| Capability | Public support |
| --- | --- |
| Encrypted 1:1 text | Yes: conversation keys, signed encrypted messages, inbox/history APIs |
| Live inbound/outbound events | Yes: `chat.received`, `chat.sent`, and `chat.conversation_join` through X Activity stream or webhooks |
| Encrypted media/files | Yes: local stream encryption plus three-step XChat media upload/download |
| Encrypted groups | Yes: initialize/create, add members, key rotation, and group messaging |
| Typing and read state | Yes |
| Calls, disappearing-message controls, unsend/delete, edit, Grok actions, group invite links | No corresponding operation in the current public OpenAPI |
| Reactions and voice-note product semantics | The consumer product and crypto library mention them, but the current public OpenAPI does not document a dedicated operation; do not include them in the MVP |

The API flow is client-side encryption: create and register identity/signing
keys, exchange a per-conversation key, encrypt and sign locally, send only
ciphertext to X, then verify and decrypt received ciphertext. X's
[Getting Started guide](https://docs.x.com/xchat/getting-started) provides
working TypeScript, Python, Rust, Go, C#, and Java examples. The official
[sample bots](https://github.com/xdevplatform/chat-xdk/tree/main/examples)
perform the same receive → decrypt → reply → encrypt → send loop BeeGreat
needs.

This is not anonymity from BeeGreat. X stores/routes ciphertext, but the
BeeGreat bot is an authorized endpoint and must decrypt a user's message before
the agent can process it. X can still see metadata. Product copy and privacy
documentation must say this explicitly.

## Recommended BeeGreat topology

```text
X user
  ⇅ encrypted XChat
X webhook / X Activity subscription
  → XChat bridge (verify, dedupe, decrypt)
  → Convex identity broker (X user ID → exactly one Clerk user)
  → Convex XChat-sourced thread → Flue Bee instance: <userId>~<threadId>
  → channel-action broker / Convex transactions
  → XChat bridge (project reply, encrypt, send)
```

Use the following boundaries:

- **Shared bot identity:** one bot OAuth grant, one Chat XDK identity, and one
  X Activity subscription filtered to the bot's X user ID.
- **User routing:** reuse the verified `xIdentityLinks` domain from the X
  mention/bookmark plan. The webhook may provide an X sender ID, never a Clerk
  user ID or Hive owner key. Convex resolves the mapping and fails closed on
  missing or ambiguous links.
- **Crypto bridge:** add a dedicated `apps/xchat-bridge` beside
  `apps/imessage-bridge` if the Bun spike passes. Start with X's persistent
  Activity stream, which X describes as often simplest for bots. This keeps
  stateful crypto, X OAuth refresh, reconnection, and X API retries outside
  Convex and the Cloudflare agent worker without adding an inbound port. If
  Bun compatibility fails, use a small supported Node 18+ service rather than
  weakening key handling.
- **Agent/channel reuse:** extend the existing trusted channel-action seam and
  thread-source validator to `xchat`. Let Convex allocate the normal numeric
  channel thread, then dispatch through the existing
  `<userId>~<threadId>` convention so transcript sync, thread navigation, and
  account deletion continue to work. Reuse the iMessage response projection
  for plain-text replies and confirmed generative-UI actions.
- **Canonical state:** keep identity links, delivery receipts, thread mapping,
  and business writes in Convex. Keep the bot OAuth refresh token, X app
  secret, Juicebox PIN or private-key blob, and transient conversation keys in
  a secrets/key-storage boundary, never application clients or logs.

The similarly named “X Chat SDK” phase in the existing mention plan refers to
the Vercel Chat SDK and `@chat-adapter/x`, not X's encrypted Chat XDK. The
mention webhook and XChat bridge can share an X app/bot identity and identity
mapping, but their event formats and cryptographic responsibilities are
different.

## Authentication and delivery

The bot's OAuth 2.0 Authorization Code + PKCE grant should request
`dm.read dm.write tweet.read users.read offline.access`, plus `media.write`
when attachments are enabled. X says access tokens otherwise last two hours;
`offline.access` yields the refresh token required for an unattended bot
([OAuth guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)).

Provision the bot's Chat identity once:

1. Generate identity and signing keys with the Chat XDK.
2. Register the public keys at `POST /2/users/{id}/public_keys`.
3. Store private key state through Juicebox or a protected native key blob.
4. Load/unlock it, set the bot identity and key version, and keep signatures
   fail-closed.

Create one `chat.received` activity subscription filtered to the bot user, then
consume `GET /2/activity/stream` with the app bearer token. Reconnect with
bounded backoff and up to five minutes of stream backfill; on a longer outage,
reconcile conversation history before accepting new work. Apply any
`conversation_key_change_event` before decrypting the message, deduplicate
delivery by `event_uuid`, and deduplicate messages by the signed `message_id`.

An HTTPS webhook is also supported, but it should be the second delivery
option: implement CRC, verify `x-twitter-webhooks-signature` over the exact raw
body, durably enqueue the ciphertext, and acknowledge within ten seconds
before running the agent. X documents both modes in
[Real-Time Events](https://docs.x.com/xchat/real-time-events) and its
[webhook quickstart](https://docs.x.com/x-api/webhooks/quickstart).

Consumer eligibility still applies. Both sides must have registered for Chat,
and recipient/message-request rules can prevent or initially leave a request
unencrypted. The MVP should accept only encrypted `chat.received` traffic and
give setup guidance outside this path; it must not silently treat legacy
unencrypted DMs as XChat. See X's
[About Chat](https://help.x.com/en/using-x/about-chat).

## Limits, cost, and remaining unknowns

X lists a self-serve ceiling of 1,500 X Activity subscriptions; the shared-bot
design uses one. Published request limits are 450 activity-stream opens per 15
minutes with two concurrent connections, 500 subscription operations per 15
minutes, and 450 webhook management operations per 15 minutes
([rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)).

The current pricing page lists `chat.received` webhook delivery at $0.010 per
event, while `chat.sent` and `chat.conversation_join` are not billed. It also
lists generic DM reads at $0.010 per resource and DM interaction creates at
$0.015 per request
([pricing](https://docs.x.com/x-api/getting-started/pricing)). The public rate
table does **not** give numeric limits for `/2/chat/*`, and the public pricing
table does not map every XChat REST operation to a billing unit. Treat the
Developer Console and response `x-rate-limit-*` headers as authoritative.

Other production gates:

- The recipient must have an XChat public key; no key means no encrypted
  conversation.
- The JS/WASM binding does not export/import raw key blobs. Its documented
  server strategy is an unlocked instance backed by Juicebox; native bindings
  can use protected opaque blobs.
- Conversation-key rotation protects future messages only. It does not revoke
  access to ciphertext encrypted with an older key.
- X's consumer documentation says the protocol is not forward-secret.
- Activity streams allow at most five minutes of direct backfill, so restart
  recovery must also reconcile conversation history.
- If webhooks are enabled later, they can be duplicated, must respond within
  ten seconds, and should enqueue agent work before acknowledging.

## Suggested delivery sequence

1. Credential smoke test: register a test bot key, create one encrypted 1:1,
   fetch/decrypt history, send/retry one message, and record billing/limits.
2. Runtime spike: run the official offline Chat XDK vectors and a live
   round-trip under Bun; separately test process restart and key recovery.
3. Identity/broker work: implement the planned X identity link and an atomic
   XChat delivery claim keyed by `event_uuid` and signed `message_id`.
4. Bridge MVP: persistent `chat.received` stream, reconnect/reconciliation,
   decrypt, XChat-sourced numeric-thread dispatch, text projection,
   encrypt/send, retry idempotency, and Sentry redaction.
5. Harden and expand: refresh-token leases, optional webhook + durable queue,
   account disconnect and deletion, media, then groups/read/typing.

The MVP is done when two linked X users can independently message the shared
Bee bot, each message reaches only the matching Hive/agent thread, duplicate or
forged deliveries cause no extra work, replies survive bridge restarts, and no
plaintext, OAuth token, PIN, private key, or conversation key appears in logs.
