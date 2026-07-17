# Devin power-up

BeeGreat's Devin power-up hands coding work to Devin Cloud through Devin's v3
Organization API. Bee can start a session, refresh recent sessions, inspect the
latest messages and status, and send follow-up instructions into the same
session. Every response includes the Devin session URL and any pull requests
reported by the API.

## Capability

- Starts resumable `normal` or `fast` Devin sessions with an optional repository
  list and ACU ceiling.
- Tracks only sessions launched through BeeGreat and binds each one to its
  BeeGreat user before inspection or follow-up is allowed.
- Reads live `status` and `status_detail`, including when Devin is waiting for
  the user or for approval.
- Shows recent Devin messages, the direct session URL, and pull-request URLs and
  states.
- Sends additional instructions to an existing session. Devin automatically
  resumes a suspended session when it receives a message.

BeeGreat polls active sessions for up to two hours and streams cached status and
PR changes into any open Devin card through Convex. Polling pauses when Devin
finishes, errors, or needs user input; asking Bee for an update or tapping
Refresh checks immediately and re-arms polling when appropriate. BeeGreat does
not claim push notifications while the app is closed.

## Devin setup

1. In Devin, open **Settings → Service users** for the organization.
2. Create a service user. The Member role is sufficient for standard session
   creation, viewing, and follow-ups.
3. Generate the one-time API key, which starts with `cog_`.
4. Copy the organization ID shown on the same settings page.

The service user needs `ManageOrgSessions` to create sessions and send
follow-ups, and `ViewOrgSessions` to read status and messages.

## Convex environment

Store both values in Convex; never put the Devin key in an `EXPO_PUBLIC_` or web
environment variable:

```sh
bunx convex env set DEVIN_API_KEY 'cog_…'
bunx convex env set DEVIN_ORG_ID 'org-…'
```

The agent Worker already reaches Convex through
`AGENT_CREDENTIAL_BROKER_SECRET`, so it does not need a copy of the Devin key.

## Use

1. Open Profile → Power-ups and enable Devin.
2. Ask Bee to hand a coding task to Devin, including the repository and desired
   outcome.
3. Open the returned Devin card to inspect or follow up directly, or ask Bee to
   check the session or send a specific follow-up.
4. Pull requests appear on the card as soon as Devin reports them.

Fast mode is approximately twice as fast and four times as expensive according
to Devin's API documentation. Bee uses normal mode unless the request explicitly
calls for fast mode.
