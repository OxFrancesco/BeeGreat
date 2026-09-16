# Renaming the `basedbot` Workers to `pecu`

Status on 2026-09-16: **paused before the cutover.** Preparation is done and
production still runs on `basedbot`. Nothing in this file has touched user
state yet. Resume from "Step 3".

## Why this is a migration, not a rename

Cloudflare cannot rename a Worker. The name change means deploying new scripts
called `pecu`, `pecu-aero`, `pecu-codex` and `pecu-evm`, moving the Durable
Object storage into `pecu`, then deleting the `basedbot*` scripts.

Durable Object storage belongs to the script that defines the class. Cloudflare
supports a **Transfer migration** (`transferred_classes` with `from_script`)
that moves every stored object of a class from one script to another with its
data intact. That is how `BasedBotDurableObject` (wallet map, chat and web
history, previews, YOLO flags, deposits, X OAuth state) and `UserInference`
(per-user ChatGPT connections) move without loss.

Worker **secrets are write-only** and do not transfer. Each value must be
re-entered on the new script from wherever it was issued.

Identifiers that stay exactly as they are, on purpose: class names
`BasedBotDurableObject` and `UserInference`, object name `basedbot-main`,
SQLite tables `basedbot_*`, storage key `basedbot-x-oauth`, Crossmint owners
`userId:basedbot-x-<sender>` and `userId:basedbot-web-<clerk id>`. None of them
is user-visible and each is baked into stored data.

## Already done (safe, no production impact)

- `pecu-aero` deployed (version `a50c7dc8`). Secret `ALCHEMY_RPC_URL` set to the
  public endpoint `https://base-mainnet.g.alchemy.com/public` as an interim.
- `pecu-codex` deployed (version `f05c1a68`), container image
  `pecu-codex-codexcontainer` pushed, application `a03b0286-...`.
- `pecu-evm` deployed (version `292f9f13`), container image
  `pecu-evm-evmsandbox` pushed, application `a0388d98-...`.
- `pecu` exists as a **draft** Worker (created by `wrangler secret bulk`, never
  deployed, no Durable Object classes). It holds 8 of the 15 secrets, recovered
  from this Mac's Keychain (`com.oddofrancesco.basedbot.*`) and
  `~/.xurl/auth.yml` (app `basedbot`, user `BeeGreatAI`):
  `ADMIN_TOKEN CHAT_PIN CROSSMINT_API_KEY CROSSMINT_WALLET_SECRET
  X_ACCESS_TOKEN X_OAUTH_CLIENT_ID X_OAUTH_CLIENT_SECRET X_OAUTH_REFRESH_TOKEN`.
- `.pecu-secrets.json` added to `apps/pecu/.gitignore`.
- The config edits below were applied, dry-run verified with `bun run build`,
  then **reverted** so a routine deploy cannot trigger the transfer by accident.

These new Workers cost nothing while idle. If you abandon the rename, delete
them: `bunx wrangler delete --name pecu` (and `pecu-aero`, `pecu-codex`,
`pecu-evm`).

## Step 1 — Config changes to re-apply

`apps/pecu/wrangler.jsonc`

```diff
-  "name": "basedbot",
+  "name": "pecu",
...
-    { "binding": "AERO", "service": "basedbot-aero" },
-    { "binding": "CODEX", "service": "basedbot-codex" },
-    { "binding": "EVM", "service": "basedbot-evm" }
+    { "binding": "AERO", "service": "pecu-aero" },
+    { "binding": "CODEX", "service": "pecu-codex" },
+    { "binding": "EVM", "service": "pecu-evm" }
...
-  "migrations": [
-    {
-      "tag": "v1",
-      "new_sqlite_classes": ["BasedBotDurableObject"]
-    },
-    { "tag": "v2-user-inference", "new_sqlite_classes": ["UserInference"] }
-  ],
+  // The `pecu` script received its Durable Object storage from the original
+  // `basedbot` script via a Transfer migration. Class names, object names and
+  // table names keep their `basedbot` spelling so stored state needed no
+  // rewrite. Never rewrite this tag; only append.
+  "migrations": [
+    {
+      "tag": "v1-transfer-from-basedbot",
+      "transferred_classes": [
+        { "from": "BasedBotDurableObject", "from_script": "basedbot", "to": "BasedBotDurableObject" },
+        { "from": "UserInference", "from_script": "basedbot", "to": "UserInference" }
+      ]
+    }
+  ],
...
-    "X_WEBHOOK_URL": "https://basedbot.oddofrancesco000.workers.dev/x/webhook",
+    "X_WEBHOOK_URL": "https://pecu.oddofrancesco000.workers.dev/x/webhook",
```

Do **not** add a `new_sqlite_classes` entry for the destination; Cloudflare
creates the classes as part of the transfer.

`apps/pecu/wrangler.aero.jsonc`, `wrangler.codex.jsonc`, `wrangler.evm.jsonc`:
change `"name"` to `pecu-aero`, `pecu-codex`, `pecu-evm`.

`apps/pecu/apps/stocks/wrangler.jsonc`: services `basedbot-aero` → `pecu-aero`
and `basedbot` → `pecu` (keep `"entrypoint": "StocksGateway"`).

`apps/pecu/worker-configuration.d.ts`: update the `X_WEBHOOK_URL` literal and
the three `/* basedbot-* */` comments (or regenerate with `wrangler types`).

`apps/pecu/scripts/probe-chatgpt.ts`: base URL → `https://pecu.oddofrancesco000.workers.dev`.

Verify: `cd apps/pecu && bun run build` (four dry-runs must pass).

## Step 2 — Remaining secrets (manual)

Seven values exist only in third-party dashboards. Create
`apps/pecu/.pecu-secrets.json` with the keys you have:

```json
{
  "X_BEARER_TOKEN": "",
  "X_CONSUMER_SECRET": "",
  "WHOP_API_KEY": "",
  "WHOP_WEBHOOK_SECRET": "",
  "ALCHEMY_RPC_URL": "https://base-mainnet.g.alchemy.com/v2/<key>",
  "NANSEN_API_KEY": "",
  "EXA_API_KEY": ""
}
```

| Secret | Source | Missing at cutover means |
| --- | --- | --- |
| `X_BEARER_TOKEN` | X Developer Portal → Pecu app → Keys and tokens → Bearer Token (regenerating is fine) | No realtime DM webhook; 60 s polling still works |
| `X_CONSUMER_SECRET` | Same page → API Key and Secret → secret | `/x/webhook` returns 404; CRC cannot be answered |
| `WHOP_API_KEY` | Whop → Developer → API keys | `/deposit` disabled |
| `WHOP_WEBHOOK_SECRET` | Whop → Developer → Webhooks → `ws_...` | Deposit webhooks rejected |
| `ALCHEMY_RPC_URL` | Alchemy → Base Mainnet app → HTTPS URL | Public RPC fallback (rate-limited) |
| `NANSEN_API_KEY` | Nansen API settings | `/nansen` off |
| `EXA_API_KEY` | Exa dashboard | `/polymarket` off |

Upload, then delete the file:

```sh
cd apps/pecu
WRANGLER_WRITE_LOGS=false bunx wrangler secret bulk .pecu-secrets.json --config wrangler.jsonc
# ALCHEMY_RPC_URL is also the one secret pecu-aero needs:
jq -r .ALCHEMY_RPC_URL .pecu-secrets.json | WRANGLER_WRITE_LOGS=false bunx wrangler secret put ALCHEMY_RPC_URL --config wrangler.aero.jsonc
rm .pecu-secrets.json
bunx wrangler secret list --config wrangler.jsonc   # expect 15 names
```

At minimum set the four X and Whop values before cutting over.

### About `X_OAUTH_REFRESH_TOKEN`

The Worker keeps its refreshed X tokens in Durable Object storage under
`basedbot-x-oauth`, tagged with the SHA-256 of the `X_OAUTH_REFRESH_TOKEN`
secret it was first seeded with (`restoreXOAuthState` in
`src/cloudflare/worker.ts`). After the transfer that stored state is reused
**only if** the secret on `pecu` hashes to the same seed. The value uploaded
came from xurl and dates from 2026-08-31, which matches the original setup, but
this cannot be verified without the original value. If `/health` shows X
polling errors after cutover, re-authenticate with `xurl auth` for
`@BeeGreatAI`, upload the new token as `X_OAUTH_REFRESH_TOKEN` and
`X_ACCESS_TOKEN`, and the Worker will re-seed on its next alarm.

## Step 3 — Cutover (one-way)

Be online for this; it takes a few minutes. Pending previews expire after ten
minutes anyway, so the ideal moment is when the last DM is a few minutes old.

```sh
cd apps/pecu
curl -s https://basedbot.oddofrancesco000.workers.dev/health | jq '.deposits.pending, .xchat.lastActivityAt'
# 1. Redeploy the helpers so their names match (idempotent; code unchanged):
WRANGLER_WRITE_LOGS=false bunx wrangler deploy --config wrangler.aero.jsonc
WRANGLER_WRITE_LOGS=false bunx wrangler deploy --config wrangler.codex.jsonc --containers-rollout=none
WRANGLER_WRITE_LOGS=false bunx wrangler deploy --config wrangler.evm.jsonc --containers-rollout=none
# 2. THE TRANSFER. From here basedbot no longer owns the storage.
WRANGLER_WRITE_LOGS=false bunx wrangler deploy
# 3. Repoint the web app:
cd apps/stocks && WRANGLER_WRITE_LOGS=false bun run deploy && cd ../..
```

After step 2 the `basedbot` cron (every minute) keeps firing against a class it
no longer owns and logs errors. That is harmless but noisy; delete `basedbot`
promptly after verification (Step 5).

## Step 4 — Verify

```sh
curl -s https://pecu.oddofrancesco000.workers.dev/health | jq
```

Expect `ok: true`, `xchat.polling: true`, `deposits.configured: true` (if Whop
secrets were set), `lastSuccessfulPollAt` advancing each minute.

- **X webhook**: the cron's `ensureRealtimeSetup` creates a webhook for the new
  URL and moves the subscriptions to it automatically. Check
  `xchat.realtimeReady: true` and `xchat.delivery: "webhook"`. If X refuses a
  second webhook (per-app limit), use the admin route:
  `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://pecu.oddofrancesco000.workers.dev/admin/xchat/realtime/replace`.
  Fallback either way is polling, so DMs are never fully down.
- **DM round trip**: send `/balance` to @BeeGreatAI from a known account; the
  reply must show the **same wallet address as before** (proves the transfer).
- **Web**: sign in at https://pecu.app/agent; existing threads, history and
  wallet chip must be present. Send a message and get a reply.
- **Whop webhook** still points at the old URL. Re-register it:
  `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"accountId":"<whop account id>"}' https://pecu.oddofrancesco000.workers.dev/admin/whop/webhook/configure`
- Keychain service `com.oddofrancesco.basedbot.admin-token` is still read by
  `scripts/probe-chatgpt.ts`; the token value is unchanged, no action needed.

## Step 5 — Delete the old scripts

Only after Step 4 passes:

```sh
bunx wrangler delete --name basedbot
bunx wrangler delete --name basedbot-aero
bunx wrangler delete --name basedbot-codex
bunx wrangler delete --name basedbot-evm
```

Deleting `basedbot` removes its now-empty Durable Object namespaces and the
old `workers.dev` URL. Anything still pointing at
`basedbot.oddofrancesco000.workers.dev` (old X webhook entry, old Whop webhook)
starts failing, which is the intended end state once the new ones are
registered.

## Step 6 — Docs and commit

Update the `basedbot` mentions in `README.md` (production URL, "keep the
basedbot Worker names"), `AGENTS.md`, `docs/architecture.md`,
`docs/thread-switching.md`, `apps/stocks/README.md`, and
`.devin/skills/deploy/SKILL.md` if pecu is added there. Keep the sentence that
class names, object names, table names and Crossmint owners retain the
`basedbot` spelling. Then commit the config changes together with this file's
"Status" line updated to "completed on <date>".

## Rollback

- **Before Step 3.2** (transfer): nothing to roll back; delete the `pecu*`
  scripts if abandoning.
- **After the transfer**: storage now lives in `pecu`. To go back, deploy
  `basedbot` again with a reverse transfer
  (`from_script: "pecu"`, same class names) and repoint the stocks bindings.
  Do not try to redeploy `basedbot` with its original `new_sqlite_classes`
  migrations; that would create empty namespaces, not restore data.
- **Wallets are safe in every scenario.** Crossmint owners are deterministic
  (`userId:basedbot-x-<sender>`), and `WalletService.getOrCreate` fetches an
  existing wallet by owner before it would ever create one. A lost Durable
  Object loses history, previews and settings, never funds.
