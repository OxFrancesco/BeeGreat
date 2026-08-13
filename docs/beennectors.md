# BeeGreat Beennectors

GitHub, Linear, Notion, and Google Workspace are account/workspace connections called
**Beennectors**. They are intentionally separate from Power-ups: there is no
PowerBee toggle, entitlement row, or power-up loader involved.

## Architecture

- Convex owns OAuth state, encrypted credentials, refresh leases, provider API
  calls, account/workspace routing, and delivery deduplication.
- The Bee Worker receives filtered provider results through the authenticated
  `/internal/beennectors` broker. For Google Workspace only, it receives a
  short-lived access token for a single guarded `gog` invocation. The token is
  injected as command environment, redacted from output, and never reaches web,
  mobile, the model prompt, or tool arguments.
- `@flue/github`, `@flue/linear`, and `@flue/notion` verify the exact webhook
  body before a delivery can be mapped and dispatched to Bee.
- Bee loads one `beennectors` specialist when GitHub, Linear, or Notion is linked,
  and a separate `google-workspace` specialist when Google is linked.
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

On mobile, Profile exposes **Work connectors** near the top of the sheet. It
opens one dedicated screen for GitHub, Linear, Notion, and Google Workspace so
each account is one tap away without scrolling through the rest of Profile.
The web twin keeps the same connect, status, and disconnect actions in Settings;
CLI and iMessage hand users the matching `/connect/:provider` web route.

For Google Workspace, create a separate **testing** Cloud project for local and
simulator use and a production project with only production domains/callbacks.
Create a Web OAuth client with the applicable callback and set
`GOOGLE_BEENNECTOR_CLIENT_ID` / `GOOGLE_BEENNECTOR_CLIENT_SECRET`. Enable the
Gmail, Calendar, Drive, Docs, Sheets, Slides, People, Tasks, and Forms APIs. The
consent request includes offline access so Convex can refresh the encrypted
per-user credential without keeping a CLI keyring. Users select service groups
before authorization; the backend rejects Google OAuth without the current
disclosure version and at least one selected group. Google-derived model turns
use a dedicated OpenRouter provider route with `data_collection: deny` and
`zdr: true`.

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
- Search and read Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts, Forms,
  and Tasks through `gog`; organize Gmail, prepare drafts, change Calendar
  events, and change Tasks after a direct, explicit request. Drive/editor data
  and Contacts/Forms are read-only; email sends, deletes, sharing, admin, and
  auth changes are blocked in the compiled CLI profile.

## Google CLI safety

The agent container builds `openclaw/gogcli` at the commit pinned in
`packages/agent/Dockerfile` and compiles its `agent-safe` safety profile into
`/usr/local/bin/gog-agent-safe`. The specialist has one argv-based tool, not a
general shell. BeeGreat fixes `--json`, `--no-input`, `--wrap-untrusted`, and the
connected account, and rejects attempts to override those flags. The baked
profile blocks email sends, deletes, sharing changes, admin commands, and auth
writes before a Google handler runs.

Disconnecting removes the encrypted credential and makes a best-effort request
to revoke the upstream token. For Google, the durable refresh grant is revoked
instead of only the short-lived access token. Public Google Workspace launch is
blocked until an owned domain is verified, brand/scope verification completes,
and the restricted-scope security assessment is accepted.
