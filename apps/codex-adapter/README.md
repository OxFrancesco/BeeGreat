# Flue-Codex adapter

Flue-Codex is a narrow, stateless streaming adapter between a Flue/Pi agent
and ChatGPT's Codex Responses endpoint. It exists so the agent runtime can be
hosted separately from the network path used for ChatGPT subscription calls.

The adapter does **not** perform OAuth, refresh credentials, persist tokens,
or log request bodies. BeeGreat keeps encrypted ChatGPT credentials in Convex,
refreshes them there, and supplies the short-lived access token only for the
duration of each agent request.

## Security boundary

- Only `POST /api/codex/responses` is proxied.
- Calls require `x-flue-codex-adapter-secret`.
- Only the Codex protocol's required request headers are forwarded.
- Cookies, the adapter secret, and arbitrary client headers are dropped.
- Only safe response metadata and the streaming response body are returned.
- `FLUE_CODEX_ADAPTER_SECRET` must be configured as a Vercel secret and as an
  agent Worker secret. Never commit it.

## Local checks

```sh
bun install
bun run --cwd apps/codex-adapter test
bun run --cwd apps/codex-adapter typecheck
```

## Deploy

Link the directory to its own Vercel project, add
`FLUE_CODEX_ADAPTER_SECRET`, and deploy the directory. The agent provider base
URL must be the deployment URL followed by `/api`.

This is intentionally deployed as part of the repository, not published as a
package.

## Production flow

1. The app completes OpenAI's device-code sign-in and Convex encrypts the
   access and refresh credentials at rest.
2. For each message, Bee's Worker calls Convex's authenticated credential
   broker. Convex refreshes an expiring token under a lease so concurrent
   devices cannot race the refresh.
3. Flue registers Pi's native `openai-codex-responses` provider for that user,
   targeting this adapter and forcing the SSE transport.
4. Pi sends the request with `gpt-5.6-sol` and low reasoning. The adapter
   authenticates the Worker, decompresses Pi's zstd request, forwards it to
   the fixed ChatGPT Codex endpoint, and streams the response back.
5. Conversation metadata and messages are mirrored through Convex so the
   simulator and physical devices subscribe to the same account-scoped state.

If ChatGPT is disconnected or the credential broker is temporarily
unavailable, Bee falls back to its configured OpenRouter provider instead of
leaving a submission without a response.
