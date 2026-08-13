# iMessage connection

iMessage is a first-class BeeGreat channel: anyone can text Bee, sign up or
sign in from the conversation, and connect every connector without opening the
app first. There is no static sender allowlist — the old `IMESSAGE_USER_MAP`
environment variable is gone.

## How senders are linked

- Sender identities live in Convex: `imessageConnections` maps one normalized
  address (phone or email) to one Clerk user; a user may link several
  addresses. `imessageLinkSessions` holds short-lived magic-link state (only a
  SHA-256 token hash is stored).
- The bridge resolves every inbound sender through the agent worker's
  `POST /bridge/identity` route (bridge-secret auth, no user header), which
  forwards to the Convex broker route `POST /internal/imessage`
  (`AGENT_CREDENTIAL_BROKER_SECRET`). Resolved users are cached in the bridge
  for five minutes; unknown senders re-check after fifteen seconds so a fresh
  link works immediately.
- An unknown sender gets one welcome message with a magic link
  (`https://<WEB_APP_URL>/link/imessage?token=…`). Opening it, signing in (or
  creating an account) with Clerk, and confirming binds that address to the
  account. Receiving the link in Messages is the proof of address control, so
  a valid token may also move an address to a new account.
- Links are single-use, expire after 15 minutes, and are minted at most five
  times per address per hour; the bridge additionally offers at most one link
  per address every two minutes.

## Reverse states

- iMessage: text `/unlink` (or `/disconnect`) to Bee.
- Web: Settings → Connections → iMessage lists linked addresses with
  per-address Disconnect.
- Mobile: Profile → Connections → iMessage, same panel.
- CLI: `bee imessage status` and `bee imessage disconnect [address]`
  (via the worker's Clerk-authenticated `POST /cli/imessage`).
- Account deletion purges `imessageConnections`, `imessageLinkSessions`, and
  any pending or delivered `imessageDeliveries`.

## Conversation and Web3 reliability

- Every inbound turn binds the durable iMessage chat thread to the verified
  `imessageConnections` row and mirrors the settled Flue transcript into the
  same `chatMessages` table used by mobile and web. Flue remains the execution
  stream; Convex is the account-wide transcript source of truth.
- `question` is a blocking text-channel component. iMessage renders numbered
  options and accepts a bounded numbered reply; selected labels return to Bee
  as ordinary language. A later blocking question wins over stale tool stages
  accumulated in the same Flue assistant envelope.
- Web3 cards use the shared `packages/tool-presentation` reducer used by the
  CLI. Raw pool/wallet addresses are humanized. Smart-wallet actions accept an
  exact `yes`/`no`; linked-wallet actions link to BeeGreat because only the
  signed-in WalletConnect client can authorize them.
- Confirmation acknowledgement is deterministic: the bridge mutates Convex,
  re-reads the action, and projects that canonical state without asking the
  model for a second status turn.
- Terminal Web3 transitions enqueue `imessageDeliveries`. The Railway bridge
  leases, sends, and acknowledges each row; failed sends back off and expired
  leases recover after a bridge restart.
- Progress is deliberately quiet: distinct material stages only, no successful
  per-tool completion bubble, and at most two delayed silence heartbeats.

## Connecting connectors from any text channel

The web app hosts signed-in connect landing pages at
`https://<WEB_APP_URL>/connect/<slug>` for `github`, `linear`, `notion`,
`google` (Workspace), `telegram`, `google-health`, `chatgpt`, `devin`, and
`web3`. OAuth providers redirect the tab to the provider's consent page;
ChatGPT renders the device-code flow; Devin/Web3 toggle their power-up.

Bee's prompt (`packages/agent/src/agents/bee.md`) instructs it to hand these
links out on text channels as a `bookmark` component — which degrades to a
tappable rich link on iMessage and a printed URL in the CLI — and to direct
app users to Profile/Settings instead.

## Configuration

- Convex: set `WEB_APP_URL` alongside the existing
  `AGENT_CREDENTIAL_BROKER_SECRET`. Production is the Vercel web app
  (`https://beegreat-web.vercel.app`); the code default is
  `https://beegreat.app` for when that domain goes live. Bee's prompt in
  `packages/agent/src/agents/bee.md` hardcodes the same origin for connect
  links — keep them in sync.
- Agent worker: no new variables; `BRIDGE_SECRET`, `CONVEX_URL`, and the
  broker secret already cover the new routes.
- Bridge: `PROJECT_ID`, `PROJECT_SECRET`, `AGENT_URL`, `BRIDGE_SECRET` only.
  `bun src/index.ts --greet <address...>` greets specific addresses so they
  learn Bee's number.
