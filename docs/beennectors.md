# BeeGreat Beennectors

GitHub, Linear, and Notion are account/workspace connections called
**Beennectors**. They are intentionally separate from Power-ups: there is no
PowerBee toggle, entitlement row, or power-up loader involved.

## Architecture

- Convex owns OAuth state, encrypted credentials, refresh leases, provider API
  calls, account/workspace routing, and delivery deduplication.
- The Bee Worker receives only filtered API results through the authenticated
  `/internal/beennectors` broker. OAuth tokens never reach web, mobile, or the
  agent runtime.
- `@flue/github`, `@flue/linear`, and `@flue/notion` verify the exact webhook
  body before a delivery can be mapped and dispatched to Bee.
- Bee loads one `beennectors` specialist when at least one provider is linked.
  GitHub/Linear comments require an explicit user request; Notion is read-only.

## Provider setup

Use one shared OAuth callback:

```text
https://YOUR_DEPLOYMENT.convex.site/beennectors/oauth/callback
```

Set the Convex variables listed in
[`packages/backend/.env.example`](../packages/backend/.env.example). The
credential key must decode to exactly 32 bytes. GitHub requests `read:user` and
`repo`; Linear requests `read` and `comments:create`; Notion access is limited
to the pages selected in its authorization picker.

Configure these signed webhook endpoints on the deployed Bee Worker:

```text
https://YOUR_BEE_WORKER/channels/github/webhook
https://YOUR_BEE_WORKER/channels/linear/webhook
https://YOUR_BEE_WORKER/channels/notion/webhook
```

Set the corresponding Worker secrets from
[`packages/agent/.env.example`](../packages/agent/.env.example). Subscribe only
to events Bee handles:

- GitHub: issues, issue comments, pull requests, pull-request review comments.
- Linear: issue and comment resource events. Agent-session events can be added
  later after enabling an app actor and its dedicated scopes.
- Notion: page and comment events for pages explicitly shared with the public
  integration. Set new webhook subscriptions to the current `2026-03-11` API
  version.

The webhook resolver first matches the event actor to the OAuth owner and only
falls back to a workspace match when that workspace belongs to exactly one
BeeGreat user. Ambiguous events are acknowledged but never dispatched.

## Available Bee actions

- List recent/relevant GitHub issues and PRs, assigned Linear issues, or recent
  shared Notion pages.
- Search each connected provider.
- Read a GitHub issue/PR and comments, a Linear issue and comments, or a Notion
  page plus its first 100 blocks.
- Add GitHub or Linear comments after an explicit user request.

Disconnecting removes the encrypted credential and makes a best-effort request
to revoke the upstream token.
