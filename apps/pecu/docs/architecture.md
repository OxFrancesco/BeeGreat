# Pecu architecture

## Runtime shape

Cloudflare routes every request to one named Durable Object, `pecu-main`. The single object is intentional: one XChat bot identity owns the poll cursor and the X Chat/Juicebox SDK uses process-global callback state that must not be operated concurrently across isolates.

The Durable Object owns:

- OpenCode V2 Workerd and its ChatGPT OAuth credential, model catalog, sessions, and durable events.
- Prefixed Pecu SQLite tables for processed X events, verified agent turns, sender-to-wallet mappings, funding accounts and deposit records, Aero intents and execution steps, encrypted outbox payloads, and X pagination state.
- A recurring alarm that polls XChat and reschedules itself even after a failed poll.

OpenCode initializes its own schema before Pecu adds prefixed tables. This order is required because a fresh OpenCode database refuses unrelated tables before its session migration has run.

## Identity and agent boundary

X OAuth authenticates the bot account. XChat public keys decrypt messages, and Chat XDK signature verification authenticates each numeric sender ID. The tuple `(verified sender ID, conversation ID)` maps to exactly one OpenCode session and one Crossmint smart wallet owner.

Before each model turn, the exact verified message is persisted against the OpenCode session. Tool execution resolves capabilities from that persisted binding, so Durable Object eviction cannot turn a resumed tool call into an unbound request.

OpenCode's only active agent is `pecu`. Its plugin removes the built-in tool surface and exposes two wallet tools, one tool per Aero action, and nine generic EVM tools:

- wallet address
- wallet balances
- all read-only actions from `SUGAR_ACTIONS`
- all state-changing actions from `SUGAR_TX_ACTIONS`
- `evm_token_balance`, `evm_allowance`, `evm_read`, `evm_inspect`, `evm_decode` (reads)
- `evm_transfer`, `evm_approve`, `evm_revoke`, `evm_contract_call` (plans)
- `deposit_instructions`, `deposit_setup`, `deposit_status` (Whop funding)

Each Aero tool derives its allowed arguments and required fields from the SDK validator through a tracked export patch. The bot adds model-facing descriptions and defaults token amounts to human units. The SDK still validates conditional fields and the wallet policy still binds the sender and chain. EVM tools carry explicit zod schemas in `src/cloudflare/evm-tools.ts` and re-validate their input before dispatch. Coding, shell, filesystem, browser, MCP, skill, subagent, and arbitrary network tools are denied.

## Wallet and Aero boundary

Crossmint owns signing and broadcast. Every verified X sender deterministically owns `userId:basedbot-x-SENDER_ID:evm:smart` on the `base` chain. Web users signed in through Clerk without a linked X account are the sender `web-<clerk user id>` and own `userId:basedbot-web-<clerk user id>:evm:smart`; `src/web-identity.ts` is the only place that decides which of the two a signed-in user is. A production Crossmint key is required because the staging `base` alias targets a test network.

The Aero service always overwrites `chain` with `8453`. Transaction callers cannot override `wallet`; positions default to the sender's wallet while still allowing public-owner inspection. Slippage is bounded by `MAX_SLIPPAGE_BPS`.

Read actions execute immediately. Transaction actions return ordered unsigned calls. Pecu validates their structure, hashes them, and atomically persists the proposal and steps before returning a preview. The model cannot confirm its own proposal.

`/confirm` is parsed outside OpenCode as a separate verified X event. It checks sender, conversation, expiry, wallet, state, and persisted plan digest before compare-and-setting the intent to `executing`. Each prepared Crossmint transaction ID is checkpointed before approval, allowing an interrupted multi-step action to resume from its first incomplete step.

Execution is idempotent per step. Before approving, the bot reads Crossmint's record of the prepared transaction and approves only while its status is `awaiting-approval`. After approval it reads the record again for the transaction hash and `userOperationHash`, checkpoints the hash as `submitted`, and verifies the receipt (`src/receipt.ts`, ported from evmSDK's `reconcileSmart`): the receipt's block hash must still be canonical, and a `UserOperationEvent` from EntryPoint v0.6, v0.7, or v0.8 must match the `userOpHash` and `sender`. The event's inner `success` flag decides between `succeeded` and `failed`; the bundler transaction's own status is not enough. A receipt that is not yet available keeps the intent `executing` and the step `submitted`; a repeated `/confirm` or restart recovery re-verifies without preparing or approving again.

`ENABLE_MAINNET_EXECUTION=false` blocks confirmation before any Crossmint transaction preparation or approval.

## Generic EVM boundary

`pecu-evm` is a Cloudflare Sandbox whose image clones [evmSDK](https://github.com/OxFrancesco/evmSDK) at the commit pinned in `containers/evm/Dockerfile` and builds its `evm` CLI. The Worker in front of it accepts one request shape, `{ command, input }`, where `command` must be in the allow list in `src/cloudflare/evm-protocol.ts`: reads (`read`, `token`, `balance`, `inspect`, `decode`, `allowance`, `identity`, `block`, `transaction`, `units`) and plan builders (`prepare-call`, `transfer`, `approve`, `revoke`). `execute`, `wallet-*`, `status`, `replace`, `attach-transaction`, socket, batch, and policy commands are absent, so the sandbox can never sign or broadcast. Every non-`units` input must carry `chainId: 8453`.

The Worker runs `printf '%s' "$EVM_INPUT" | bun dist/cli.js COMMAND --stdin` with the JSON in `EVM_INPUT`, so user-controlled bytes never reach shell parsing. Each call receives `EVM_DATABASE=/tmp/evm/UUID/operations.sqlite` and the directory is removed before the response returns. The sandbox filesystem also resets whenever the container sleeps; that is acceptable because the Durable Object is the only durable record of any plan. The only secrets in the sandbox are the RPC URL and an optional Etherscan key.

`src/evm.ts` is the Worker-side client. It resolves token symbols through the Aero SDK's canonical Base token list, converts human amounts to base units with string arithmetic after reading the token's decimals, refuses transfers that exceed the sender's balance before asking the sandbox for a plan, and requires the returned plan's `account` to equal the sender's wallet. `validateEvmPlan` in `src/policy.ts` then pins the single returned call to the declared action: native transfers carry `0x` calldata and positive value, ERC-20 transfers and approvals carry exactly the `transfer(address,uint256)` or `approve(address,uint256)` selector with 64 bytes of arguments and zero value, revokes must encode a zero allowance, and contract calls need calldata. Intents record `family: "aero" | "evm"` so both stores re-validate parameters with the right validator on load.

Aero stays in-process in `pecu-aero`. Its cache store and tuned concurrency would be lost behind a per-call process spawn, and its role-tagged `transaction_steps` are richer than the evm CLI's `aero` wrapper.

## Deposits and treasury relay

Whop provides the fiat on-ramp. `/deposit setup EMAIL` creates a per-user Whop connected account (`POST /accounts` with `send_customer_emails: false`) under Pecu's platform account and stores it in `funding_accounts` keyed by the verified sender ID; the row also keeps the sender's latest conversation and encoded event so deposit notifications can be sent back through the XChat outbox. `/deposit` and `/deposit AMOUNT` then call `POST /deposits` for that account and return the hosted funding page plus its bank and crypto methods. Account and deposit creation both carry deterministic idempotency keys derived from the sender ID or the incoming event ID.

`POST /whop/webhook` accepts Whop Standard Webhooks. `verifyWhopWebhook` recomputes HMAC-SHA256 over `webhook-id.webhook-timestamp.rawBody` with the literal UTF-8 bytes of the `ws_...` secret, accepts any valid `v1,<base64>` entry in the signature header, and rejects bodies older than 300 seconds. Only verified bytes are parsed; non-`deposit.succeeded` events are acknowledged and ignored. The Durable Object records each ledger activity with `INSERT OR IGNORE`, so a redelivered webhook is a no-op.

Deposits move through `received`, `relaying`, `relayed`, `held`, and `failed`. Held deposits carry a reason: `over_limit` (above `DEPOSIT_RELAY_MAX_USD`), `daily_limit` (above `DEPOSIT_RELAY_DAILY_MAX_USD` across the last 24 hours), `insufficient_treasury`, `execution_locked` (`ENABLE_MAINNET_EXECUTION` off), `pending_settlement` (Whop `available_at` still in the future), `risk_review`, `unsupported_currency`, or `unknown_account`. The boot sweep after `resumeExecuting` and every alarm re-evaluate pending deposits and skip the three terminal reasons.

An eligible deposit creates a `deposit`-family intent with `sourceEventId` `deposit:<ledger id>` and a single planned call: `transfer(recipient, amount)` on Base USDC, from the treasury wallet, with zero native value. `validateDepositPlan` pins the token, recipient, amount, calldata length, and selector before the plan is persisted, and execution reuses the same checkpointed prepare/approve/receipt-verify path as user intents, but signs as `treasury` (Crossmint owner `userId:pecu-treasury`) and needs no confirmation code. `/confirm` and `/cancel` refuse deposit intents. Success, holds, and failures reach the user through the outbox with `deposit:` correlation keys; web-origin accounts without a stored X event rely on `/deposit status` instead.

`GET /admin/deposits` returns the treasury address, its USDC balance, and the 50 most recent deposits. `POST /admin/deposits/{id}/relay` retries a held deposit with only the two caps bypassed; every other check still applies.

## Nansen analytics

`src/integrations/nansen.ts` holds a curated catalog of twenty read-only Nansen endpoints covering token god mode (information, flow intelligence, flows, who-bought-sold, transfers, DEX trades, OHLCV, screener), wallet profiler (balances, transactions, PnL, counterparties, related wallets), and prediction markets (market and event screeners, order book, trades, top holders, PnL, address summary). Each catalog entry owns its path, description, zod input, request-body builder, and summarizer. `per_page` is capped at 25 so chat replies stay short. Every reply ends with `Data: Nansen (nansen.ai)` and the raw response goes to `b/verbose` through `saveDetails`.

The catalog is the whole attack surface for Nansen's redistribution terms: address labels, every `smart-money/*` endpoint, the PnL leaderboards, and `tgm/holders` are not wired, and `tgm/dex-trades` always sends `only_smart_money: false`. `tests/integrations-nansen.test.ts` pins the allowed path list so a future catalog edit fails the suite before it ships.

`/nansen` short commands in `src/domain.ts` map to catalog entries without model mediation; everything else reaches the `nansen_*` tools through OpenCode. Wallet tools resolve `address` to the sender's verified Pecu wallet when omitted. Error envelopes map to user-safe text (rate limits carry the retry delay, credit and access failures name the operator action), and no Nansen call retries automatically.

## Hosting and authentication

The public surface contains `GET /health`, `POST /x/webhook` (signature-checked against the X webhook secret), and `POST /whop/webhook` (signature-checked against `WHOP_WEBHOOK_SECRET`, and it returns 404 until that secret is configured). Protected `/admin/*` routes are hidden as `404` unless the bearer token matches `ADMIN_TOKEN`.

The ChatGPT device flow is initiated through `/admin/opencode/login`. OpenCode's `chatgpt-headless` integration returns the Codex device URL and code, polls completion, and persists the renewable OAuth connection in Durable Object storage. No OpenAI API key is required.

OpenCode v2's provider implementation selects the active OAuth credential, extracts its ChatGPT account ID, refreshes it before expiry, and directs model requests to `https://chatgpt.com/backend-api/codex/responses`. The imported reference is `resources/opencode-v2/packages/core/src/plugin/provider/openai.ts`, v2 commit `00067d23a0597981b2e9d2f1c5144761fc0f6d33`.

Direct Worker requests to this endpoint received HTML 403 responses identifying the shared cross-zone Worker address `2a06:98c0:3600::103`. The identical invalid-token control from a Cloudflare Container returned JSON 401 from ChatGPT's authentication layer. Cloudflare documents that shared address in its [HTTP header reference](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

The tracked OpenCode server patch exposes a host-provided HTTP transport. It scopes that transport to the host's outgoing Effect HTTP client, preserving the SDK's separate in-process client. `codexContainerFetch` routes only the fixed Codex endpoint through the `CODEX` service binding. OAuth remains managed by OpenCode in the Durable Object.

ChatGPT answers an exhausted subscription with HTTP 429 and `{"error":{"type":"usage_limit_reached","resets_at":…}}`. OpenCode treats every 429 as a transient rate limit and retries with 2, 4, 8 and 16 second backoff, so a spent plan used to cost about 30 seconds per message before the same error surfaced (measured 2026-09-17 on thread `2dc5f4ce`: five 429s, 34 s turn). `src/usage-limit.ts` parses that body in the `http.response` plugin hook, stores the limit in the per-user inference storage, and the `retry` hook refuses the retry. Later turns skip the provider until `resets_at` (capped at 24 hours; 60 seconds when the body carries no reset time), and the reply tells the user when the limit lifts and that wallet commands still work. Any successful provider response clears the record, as does disconnecting ChatGPT. The same hook caps every other provider retry at one attempt. `/inference` exposes the active limit as `usageLimit` for the profile view.

When the operator sets `OPENROUTER_API_KEY`, the harness also configures OpenCode's bundled `openrouter` provider with that key and each turn picks a route before it prompts: a missing ChatGPT connection or an active stored usage limit sends the turn to `openai/gpt-5.6-sol` or `openai/gpt-5.6-luna` through OpenRouter on the same session, while a healthy connection keeps the Codex models. A ChatGPT turn that ends in a `provider.*` assistant error switches the session model to OpenRouter and re-prompts the same text, so a mid-turn provider failure still answers. The `http.response` and `retry` plugin hooks scope usage-limit parsing, clearing, and the profile's last-response record to the `openai` provider, so an OpenRouter response never stores or clears the user's ChatGPT limit and an OpenRouter retry is never refused because of it. The profile payload reports `fallback.configured` (the secret exists) and `fallback.active` (replies would route to OpenRouter now). Requests are pinned to OpenAI's endpoint on OpenRouter (`provider.only = ["openai"]`), so an OpenAI outage fails the fallback instead of routing to Azure or Bedrock. Without the secret, routing is unchanged.

`pecu-codex` has no public Worker URL. It starts at most one small container, forwards only subscription-authorized requests for the configured model with `store: false`, and streams the provider response. It never retries a model request. The container's ephemeral disk holds no login or session data, so stopping it cannot discard the bot's state. The official Cloudflare Containers SDK coordinates concurrent startup and shuts the container down after five idle minutes.

The current OpenCode beta requires a single hoisted Effect 4 installation. The X Chat SDK is patched narrowly so Workerd with `nodejs_compat` selects its browser/WASM loader instead of mistaking `process.versions.node` for a real Node filesystem.

## Remaining live proof

With production credentials, verify the complete path: deployed health, ChatGPT OAuth completion, encrypted X DM receipt, verified sender binding, Crossmint wallet creation, representative reads from each Aero family, transaction preview, encrypted reply, and state continuity after Durable Object eviction. Mainnet execution is enabled by user request. A funded mainnet transaction requires the user to confirm the exact plan; do not submit one merely to validate deployment.

The EVM sandbox image was built locally for `linux/amd64` and exercised against Base mainnet with the exact shell line the Worker sends: `token` returned a live USDC balance with the expected envelope in 3.7 s under emulation, `transfer` returned a `prepared` plan with `a9059cbb` calldata, gas, gas price, an OP Stack L1 fee estimate, and a ten-minute expiry, and an over-balance `transfer` returned `SimulationReverted` with the ERC-20 revert reason. The Cloudflare-hosted sandbox, its cold-start latency, and the receipt verification against a real Crossmint user operation remain deployment acceptance checks.
