# Pecu

Pecu creates the verified sender's Base smart wallet when processing their first message, including a greeting or `/help`. Later messages reuse the stored wallet across conversations. If creation fails, Pecu returns an error and retries on the sender's next new message.

Production runs at `https://basedbot.oddofrancesco000.workers.dev`. The Cloudflare workers, Durable Object identity, stored table names, model sessions, and Crossmint `userId:basedbot-x-<sender>` owners retain their original identifiers so the Pecu rename preserves existing wallets, authentication, chat history, and transaction recovery. Deploy from this directory with `bun run cloudflare:deploy`; the product remains named Pecu.

Pecu is a minimal encrypted XChat agent hosted in one Cloudflare Durable Object. OpenCode V2 Workerd is the agent harness, ChatGPT OAuth supplies Codex (`openai/gpt-5.6-sol`), Crossmint creates one Base smart wallet per verified X sender, and the complete Aero Sugar SDK/CLI surface is available through typed tools. Generic Base EVM actions (any token balance, contract reads, transfers, allowances, arbitrary contract calls) run through the `evm` CLI from [evmSDK](https://github.com/OxFrancesco/evmSDK) inside a Cloudflare Sandbox.

Model requests use a private Cloudflare Container with Bun's native HTTP client. The Durable Object retains the OAuth credential, refresh flow, sessions, and tools. The container streams requests to the fixed Codex endpoint, stores no credentials or conversation state, and sleeps after five idle minutes. This avoids the rejected Worker network path without requiring a Mac service or a separately billed OpenAI API key.

EVM reads and unsigned plans use a second private service, `pecu-evm`. Its Sandbox image clones evmSDK at a pinned commit and the Worker runs one allow-listed `evm` command per request with the JSON input passed through an environment variable. The sandbox holds only an RPC URL, writes its journal to a per-call `/tmp` directory that is deleted before the response returns, and cannot sign: `execute`, wallet connection, and journal recovery commands are not in the allow list. The Durable Object validates each returned plan, persists it as a confirmation-gated intent, and signs through Crossmint exactly as it does for Aero plans.

The chain is fixed to Base mainnet (`8453`). Reads run immediately. Every state-changing Aero action creates and persists an exact unsigned plan first; only `/confirm CODE` from the same signature-verified X user and conversation may execute it. The production configuration in [wrangler.jsonc](wrangler.jsonc) enables confirmed mainnet execution and pins the bot to `@BeeGreatAI`, user ID `2086819052069007360`. The config parser defaults execution to locked when the setting is absent.

Chat replies show token amounts, minimum received amounts, recipients, and confirmation controls in plain language. Raw JSON is hidden by default. Send `b/verbose` or `/verbose` to see the latest technical result for your own conversation, and `b/verbose 2` for the next page. This does not create a new quote or transaction, or enable verbose output for future replies. Network fees are marked unavailable when the service has no complete smart-wallet fee estimate.

## What the agent can do

OpenCode receives two wallet tools, three deposit tools, twenty `nansen_*` analytics tools, one typed tool per Aero SDK action, nine generic EVM tools, and no shell, filesystem, browser, coding, MCP, subagent, or arbitrary-network tools:

- `wallet_address` and `wallet_balances` operate on the sender's Crossmint smart wallet.
- `deposit_instructions`, `deposit_setup`, and `deposit_status` cover adding money through Whop.
- The `nansen_*` tools answer read-only analytics questions: token info, flows, who bought or sold, transfers, DEX trades, wallet balances, transactions, PnL, counterparties, related wallets, and Polymarket market data. Wallet tools default to the sender's Pecu wallet; the default chain is Base.
- Each `aero_ACTION` tool derives its argument names and required fields from the SDK validator. Token amounts default to human units.
- `evm_token_balance`, `evm_allowance`, `evm_read`, `evm_inspect`, and `evm_decode` read any Base token or contract. `evm_transfer`, `evm_approve`, `evm_revoke`, and `evm_contract_call` build simulated plans.
- Transaction tools can only persist a confirmation-gated plan.

Confirmation checks the outcome, not just the submission. After Crossmint approves a step, the Durable Object reads the receipt and requires a `UserOperationEvent` from a known EntryPoint whose `userOpHash` and `sender` match the approved operation and whose inner `success` flag is set. A bundler transaction that succeeds while the wrapped user operation reverts is reported as reverted. A step that is not yet included keeps the intent executing; sending the same `/confirm CODE` again re-checks without resubmitting.

The slash-command interface remains deterministic. It uses the SDK's CLI grammar, including `--flag value`, `--flag=value`, hyphen-to-underscore mapping, boolean flags, and `--use-decimals`.

```text
/wallet
/balance
/deposit
/deposit 50
/deposit setup you@example.com
/deposit status
/aero positions
/aero stocks
/aero stock-buy --stock NVDAc --amount 10
/aero stock-sell --stock NVDAc --amount 0.01
/aero index-rebalance --allocations NVDAc=50,AAPLc=50 --cash 10
/aero pools --token0 USDC --token1 AERO --pool-type stable --limit 10
/aero epochs-latest --pool-type cl
/aero quote --from-token ETH --to-token USDC --amount 0.01 --use-decimals
/aero swap --from-token ETH --to-token USDC --amount 0.01 --use-decimals
/aero deposit --pool 0x… --amount0 10 --amount1 10 --use-decimals
/aero withdraw --position 123 --fraction 0.5 --collect
/aero stake --position 123
/aero unstake --position 123
/aero claim-emissions --position 123
/aero claim-fees --position 123
/aero create-venft --amount 100 --lock-duration-seconds 31536000 --use-decimals
/token USDC
/token 0x…
/allowance USDC for 0xSPENDER
/send 10 USDC to 0x…
/send 0.01 ETH to 0x…
/approve 10 USDC for 0xSPENDER
/revoke USDC for 0xSPENDER
/confirm ABC123
/cancel ABC123
/nansen help
```

`/send`, `/approve`, and `/revoke` accept ETH, USDC, AERO, or a public token address. Amounts are human units; the bot reads the token's decimals and the sender's balance before it asks the sandbox to build the plan. Arbitrary contract calls are available to the agent through `evm_contract_call` and are simulated before a plan is stored.

Stock buy amounts use human USDC units. Stock sell amounts use human stock token units. Index allocations use `SYMBOL=percent` pairs totaling 100, with an optional USDC contribution in `cash`. The SDK checks wallet funds before it can build those plans. Stock reads include the verified sender's holdings and preserve unavailable-price errors. Already-balanced indexes return without creating a confirmation code. Pecu resolves ETH, USDC, and AERO through the SDK's canonical Base token definitions; explicit addresses and other symbols retain the SDK's validation.

The standalone operator CLI is still available and remains unsigned-only:

```sh
bun run aero:check-version
bun run aero --help
bun run aero pools --chain 8453 --token0 USDC --limit 5
```

## Local verification

Requirements: Bun, a running Docker-compatible engine for container development and deployment, Wrangler access to the personal Cloudflare account, `xurl`, an X developer app with Chat read/write scopes, and a production Crossmint server key with `wallets.read`, `wallets.create`, `wallets:balance.read`, `wallets:transactions.create`, `wallets:transactions.sign`, and `wallets:transactions.read`. The read scope is required to reconcile prepared and submitted transactions.

```sh
cd ../..
bun install --frozen-lockfile
cd apps/pecu
bun run check
bun run cloudflare:dev -- --port 8793
```

Install from the BeeGreat root with Bun 1.4.2 or newer. Root workspace configuration owns dependency patches and aligns Effect and its platform packages on the latest v4 release candidate. The complete migration notes and root commands are in [Pecu integration](../../docs/31-pecu-monorepo.md).

Without secrets, `GET /health` intentionally returns `503` while proving that the Worker, Durable Object, SQLite migrations, and OpenCode host booted. Admin routes return `404` unless a valid `Authorization: Bearer …` header is present.

## X and XChat setup

Run the bot-account OAuth flow locally and open only its authorization URL in Helium:

```sh
bun run x:login
```

Create a local ignored `.env` containing the production Crossmint key, stable wallet secret, X access token, and strong XChat PIN. Register or adopt the bot account's XChat keys once:

```sh
bun run xchat:setup --confirm
bun run doctor
```

End users do not visit a separate login page. Their decrypted XChat message carries the signature-verified numeric X sender ID; that identity owns the OpenCode session and Crossmint wallet.

## Deploy to Cloudflare

For a new installation, deploy the private Codex, EVM, and Aero services first and keep transaction execution disabled while configuring the bot:

```sh
bunx wrangler login
bunx wrangler deploy --config wrangler.codex.jsonc
bunx wrangler deploy --config wrangler.evm.jsonc
bunx wrangler secret put ALCHEMY_RPC_URL --config wrangler.evm.jsonc
bunx wrangler deploy --config wrangler.aero.jsonc
bunx wrangler secret put ALCHEMY_RPC_URL --config wrangler.aero.jsonc
bunx wrangler deploy --var ENABLE_MAINNET_EXECUTION:false
bunx wrangler secret put ALCHEMY_RPC_URL
bunx wrangler secret put ADMIN_TOKEN
bunx wrangler secret put CROSSMINT_API_KEY
bunx wrangler secret put CROSSMINT_WALLET_SECRET
bunx wrangler secret put X_ACCESS_TOKEN
bunx wrangler secret put CHAT_PIN
```

`ALCHEMY_RPC_URL` stores the full dedicated Base Alchemy URL as a Worker secret and takes precedence over `BASE_RPC_URL`. The health endpoint reports only its hostname.

Set the same dedicated RPC secret on `pecu-aero` and `pecu-evm`. Both compute reads and unsigned plans through private service bindings. The bot retains wallet signing, stored plans, and confirmation checks. `pecu-evm` optionally accepts `ETHERSCAN_API_KEY` so `evm_inspect` can discover verified ABIs; without it, callers must supply signatures. Later releases use `bun run cloudflare:deploy`, which deploys both containers and the Aero service before the bot. Local development starts them through `bun run dev`.

The EVM sandbox image pins evmSDK by commit in [containers/evm/Dockerfile](containers/evm/Dockerfile). To move to a newer evmSDK, update `EVM_SDK_COMMIT`, refresh `resources/evm-sdk` with `codeview update`, and redeploy `wrangler.evm.jsonc`. Build the image locally with `docker build --platform linux/amd64 -f containers/evm/Dockerfile .` to check the clone and `bun run build` still succeed.

`CHAT_BOT_USER_ID` is optional and may also be stored as a secret; otherwise the Worker resolves the bot ID through X. `CHAT_PEER_USER_IDS` in [wrangler.jsonc](wrangler.jsonc) adds known peers to inbox discovery. It is not an allowlist. Set the bot account's X message-request privacy to Everyone so new users can contact it. The Mirai onboarding test also needed manual acceptance of the initial request before X enabled encryption. Automatic request acceptance is not verified.

Connect the deployed OpenCode host to ChatGPT with the protected device-login route:

```sh
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR-WORKER.workers.dev/admin/opencode/login
```

Open the returned `https://auth.openai.com/codex/device` URL in Helium, enter the returned code, then poll the returned attempt ID:

```sh
curl \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR-WORKER.workers.dev/admin/opencode/login/status/ATTEMPT_ID
curl https://YOUR-WORKER.workers.dev/health
```

Keep `ENABLE_MAINNET_EXECUTION=false` while testing wallets, reads, and transaction previews. Enabling it requires a deliberate configuration change and redeploy. See [docs/architecture.md](docs/architecture.md) for the boundaries and remaining live proof.

## OpenRouter fallback

Each user's AI replies normally run on their own connected ChatGPT subscription. When the operator sets an `OPENROUTER_API_KEY` Worker secret, three cases instead run the same turn on OpenRouter through OpenCode's built-in `openrouter` provider, billed to the operator's OpenRouter credits: the user has no ChatGPT connection, the user's stored usage limit is still active, or the ChatGPT request fails mid-turn with a provider error. The fallback uses the same models (`openai/gpt-5.6-sol` at medium effort, `openai/gpt-5.6-luna` at low effort) on the same conversation session, and the user sees a normal reply with no indication of the route. Requests are pinned to OpenAI's endpoint on OpenRouter (`provider.only = ["openai"]`), so an OpenAI outage fails the fallback instead of routing to Azure or Bedrock. Without the secret, the existing connect-ChatGPT and usage-limit replies are unchanged.

```sh
bunx wrangler secret put OPENROUTER_API_KEY
```

`GET /health` reports `opencode.fallback.configured`, and the profile's status payload carries `fallback.configured` and `fallback.active` so the web UI can say when replies are using the built-in model.

## Add funds with Whop

`/deposit` (or asking to add funds, top up, or fund the wallet) returns the user's Whop funding page plus any enabled bank-transfer and crypto deposit methods. The first request asks for an email and creates a per-user Whop connected account with `/deposit setup EMAIL`; later requests reuse it. Bank rails may require Whop identity verification, and the hosted page shows whatever rails Whop enables for the account. Crypto deposits need at least $10. Base is skipped in the Whop method list because users can send USDC or ETH on Base straight to their Pecu wallet address.

When Whop confirms a deposit it posts a `deposit.succeeded` webhook; the Worker verifies the Standard Webhooks HMAC signature and the Durable Object records the ledger activity. Each eligible deposit becomes a `deposit` intent: an exact ERC-20 `transfer` of the same dollar amount in Base USDC, sent automatically from the treasury wallet to the depositor's wallet. Deposits above `DEPOSIT_RELAY_MAX_USD` (default $500), above the 24-hour `DEPOSIT_RELAY_DAILY_MAX_USD` (default $2000), awaiting Whop settlement, or exceeding the treasury balance are held and retried by the boot and alarm sweeps. Deposit relays never use a confirmation code and `/confirm` refuses them. `GET /admin/deposits` shows the treasury address, its USDC balance, and recent deposits; `POST /admin/deposits/{id}/relay` force-retries a held deposit while still enforcing everything except the per-deposit and daily caps. `/deposit status` lists the user's five most recent deposits.

To enable it:

```sh
bunx wrangler secret put WHOP_API_KEY
bunx wrangler secret put WHOP_WEBHOOK_SECRET
```

Then create the webhook in the Whop dashboard or through `POST /webhooks` with `url: https://<worker>/whop/webhook`, `events: ["deposit.succeeded"]`, `child_resource_events: true` (deposits post on the connected accounts, not the platform), and `api_version_date: 2026-09-13`. If the dashboard does not expose the date, call authenticated `POST /admin/whop/webhook/configure` with JSON `{ "accountId": "biz_..." }`. It pins the single existing webhook matching this Worker's URL, verifies the returned settings, and omits secrets from its response. It refuses missing, ambiguous, or paginated matches.

Fund the treasury wallet shown by `GET /admin/deposits` with USDC on Base. Funds deposited to the connected accounts are swept back to Pecu's platform account manually in the Whop dashboard; the treasury wallet only sends USDC out. `WHOP_API_URL` accepts `https://sandbox-api.whop.com/api/v1` for sandbox testing.

Live Whop deposits were not exercised in this change; the webhook verification, recording, hold reasons, and relay path are covered by tests against fakes.

## Nansen analytics

`/nansen help` (or asking in plain words, like "Who is buying AERO on Base today?") answers read-only on-chain questions through Nansen: token snapshots and flow intelligence, who bought or sold a token, transfers and DEX trades, a token screener and price candles, wallet balances, transactions, PnL, counterparties, and related wallets, plus Polymarket screeners, order books, trades, holders, and per-market PnL. The short commands `/nansen token 0xTOKEN`, `/nansen flows 0xTOKEN`, `/nansen wallet [0xADDRESS]`, `/nansen pnl [0xADDRESS]`, and `/nansen markets [words]` call the same endpoints without the model. Wallet queries default to the sender's Pecu wallet and the default chain is Base.

Every Nansen reply ends with `Data: Nansen (nansen.ai)`. Most calls cost 1 to 5 credits on Nansen's plan; `GET /health` reports whether the key is configured. To enable it:

```sh
bunx wrangler secret put NANSEN_API_KEY
```

Nansen's redistribution terms shape the catalog. Address labels, all smart-money endpoints, the PnL leaderboards, and `tgm/holders` are not wired at all, and `nansen_token_dex_trades` always sends `only_smart_money: false`. A test pins the allowed endpoint list.

## Aave and Polymarket

Ask for Aave rates, positions, history, risk reduction, or a Base supply/borrow/withdraw/repay preview. The five official skills live in `skills/aave`; their tool schemas and runtime content are bundled in `src/integrations`. `prepare_action` runs discovery, inspection, and simulation before creating an exact confirmation plan. An allowance approval does not complete the later supply or repayment.

Use `/polymarket QUESTION` for read-only research, and `/polymarket status` to retrieve a running result. Set `EXA_API_KEY` with `bunx wrangler secret put EXA_API_KEY`. Research uses minimal effort and retains run IDs so retries do not deliberately start a new paid run. A network interruption before Exa returns a run ID remains ambiguous and is not automatically retried by the HTTP client.

This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
