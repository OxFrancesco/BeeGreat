---
name: Deploy
description: Use when deploying BeeGreat to production — pushing Convex functions, deploying the Cloudflare agent worker (beegreat-agent), redeploying the Railway iMessage bridge, or checking whether the deployed state matches the repo. Contains the required order, the accounts each target lives on, verification commands, and the Durable Object migration rules that must not be broken.
metadata:
    version: "1.0"
---

# Deploy Skill

## Deployment targets and where they live

| Target | Source | Where it runs | Account/Project |
| --- | --- | --- | --- |
| Convex backend | `packages/backend/convex` | Convex Cloud `quirky-hyena-231` (the dev deployment — currently serves all clients; prod `youthful-rhinoceros-185` is unused) | team `oddofrancesco000-gmail-com`, project `beegreat` |
| Agent worker | `packages/agent` | Cloudflare Worker `beegreat-agent` → `https://beegreat-agent.oddofrancesco000.workers.dev` | Cloudflare account **oddofrancesco000@gmail.com** (`157a8b025a13404b16f11ad7078e53f1`) — NOT admin@oddofrancesco.com, NOT Mentasuave01 |
| iMessage bridge | `apps/imessage-bridge` | Railway project **BeeGreat**, `production` env, service `f8b5c392` | Railway account OxFrancesco; repo is linked in `~/.railway/config.json` |
| Web (TanStack) | `apps/web` | No production hosting yet — local dev only (`bun run web`) | — |
| Mobile | `apps/mobile` | Expo dev builds from source; `.env` points `EXPO_PUBLIC_AGENT_URL` at the deployed worker | — |

## Required order

The worker and every client move together (Flue SDK wire compatibility).
Deploy in this order so nothing speaks the wrong protocol for long:

1. **Convex** — `cd packages/backend && bunx convex dev --once`
2. **Worker** — `cd packages/agent && bun run deploy` (vite build + wrangler deploy)
3. **iMessage bridge** — `bunx @railway/cli up --detach` from the **repo root**
   (the bridge imports workspace packages, so the whole monorepo is uploaded;
   the service's root/start command are configured in the Railway dashboard)
4. Restart any local dev clients (web/mobile) if the SDK major changed.

## Pre-deploy checks

```sh
# Right Cloudflare account? Must show oddofrancesco000@gmail.com
bunx wrangler whoami

# Typecheck + tests for the worker (run from packages/agent;
# do NOT `bun test packages/agent` from the root — it also matches resources/pi)
cd packages/agent && bunx tsc --noEmit && bun test ./test

# Backend typecheck
cd packages/backend && bun run typecheck
```

If wrangler complains about multiple accounts in non-interactive mode:
`CLOUDFLARE_ACCOUNT_ID=157a8b025a13404b16f11ad7078e53f1 bun run deploy`

## Verify after deploying

```sh
# Worker: newest deployment should be seconds old, health should be ok
bunx wrangler deployments list --name beegreat-agent | tail -12
curl -s https://beegreat-agent.oddofrancesco000.workers.dev/health   # {"ok":true}

# Railway bridge: newest deployment SUCCESS
bunx @railway/cli deployment list --json | head

# Convex: "Convex functions ready!" from the push output is the confirmation
```

## Durable Object migration rules (do not break)

- `packages/agent/wrangler.jsonc` `migrations` entries v1–v4 are **history —
  never rewrite deployed tags, only append new ones**.
- Bee's durable identity is **`bee-v2`** (`Bee.agentName = 'bee-v2'` in
  `src/agents/bee.ts`) → generated DO class `FlueBeeV2Agent`, binding
  `FLUE_BEE_V2_AGENT`. The public HTTP mount stays `/agents/bee` (app.ts).
- Cloudflare **cannot delete and recreate the same DO class in one deploy**
  (error 10061). If agent storage must ever be reset again, move to a new
  identity (`bee-v3` → `FlueBeeV3Agent`), append a migration deleting the old
  class and creating the new one, and update `FLUE_BEE_V2_AGENT` references in
  `app.ts` and the tests under `packages/agent/test/`.
- Deleting a DO class permanently drains its storage (agent conversation
  context). Convex keeps the user-visible chat history. Get explicit user
  confirmation before any deploy that deletes a class.

## Known issues

- **Container image push 401s**: every `wrangler deploy` fails at the end with
  `Unauthorized` on `/containers/me` ("cloudchamber build image operation
  failed") — the Sandbox container image never uploads. This predates Flue 2
  (same failure on the 2026-08-02/03 deploys). The Worker itself still
  deploys: wrangler uploads the script first and Cloudflare activates it
  ("Automatic deployment on upload"), so treat this error as
  container-only until Containers is enabled on the account. Always confirm
  with `wrangler deployments list` + `/health` afterwards.
- Convex CLI typecheck needs `@types/node` and `vite` (for
  `convex/test.setup.ts`'s `vite/client` types) as backend devDependencies —
  bun's isolated linker does not hoist them from other workspaces.
- Railway does NOT auto-deploy from GitHub for this service — deploys happen
  via `railway up` from the CLI, which uploads the local working tree
  (including uncommitted changes).

## Secrets

- Worker secrets (BRIDGE_SECRET, OPENROUTER key, etc.) live in Cloudflare and
  survive deploys; local dev reads `packages/agent/.dev.vars`.
- Railway service variables are set in the dashboard (`PROJECT_ID`,
  `PROJECT_SECRET`, `AGENT_URL`, `BRIDGE_SECRET`, `IMESSAGE_USER_MAP`).
- The Worker and Convex must share `AGENT_CREDENTIAL_BROKER_SECRET`.
