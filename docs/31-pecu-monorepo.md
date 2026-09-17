# Pecu in BeeGreat

Pecu source lives in `apps/pecu`. The bot, source package, commands, prompts, wallet identifiers, storage keys, and Cloudflare configuration use the Pecu name. BeeGreat is the source repository for future changes here.

The import is a reviewed source snapshot from the private source checkout, including its Stocks and Pecu work. `apps/pecu/SOURCE.json` records the source revision. No private Git history, environment files, credentials, runtime databases, or private test reports were imported. The original checkout remains intact. Publishing this source does not deploy any service or migrate stored conversations or wallets.

## Commands

Run these from the BeeGreat root with Bun 1.4.2 or newer.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Install the shared workspace lockfile and patches |
| `bun run pecu:check` | Bot type checks, tests, and four Worker dry-run bundles |
| `bun run pecu:stocks:check` | Stocks type checks |
| `bun run pecu:stocks:build` | Regenerate the stock catalog and build Stocks |
| `bun run pecu:site:build` | Copy the Pecu homepage and generate pinned Aero CLI docs |
| `bun run pecu:site:check` | Pecu type checks and dry-run bundle |
| `bun run pecu` | Start the bot's local Worker services |
| `bun run pecu:deploy` | Deploy Codex, EVM, Aero, then the bot to the configured personal account |

Check existing listeners before starting development. Stocks uses remote service bindings during local development, so it can reach deployed wallet state. Routine migration checks use offline fixtures and dry-run bundles.

Stocks and Pecu keep their own deployment commands and working directories under `apps/pecu/apps`. Configure their ignored environment files there. Configure bot secrets for the Pecu Workers. No credentials were copied from the original checkout.

## Dependency ownership

The root `package.json` owns the Pecu patches, including compatibility fixes for the current Effect API. Nested lockfiles are excluded. Stocks participates through `apps/pecu/apps/*`.

Pecu deliberately retains its Git-pinned Aero SDK revision and CLI patch. It does not resolve that dependency to the newer `packages/sugar` workspace. Catalog and documentation scripts locate that installed dependency with `import.meta.resolve`, independent of Bun's hoisting layout. Its EVM container pins the reviewed public SDK commit with the same Effect update.

All owned Effect consumers use `4.0.0-rc.115`, the registry's latest v4 release candidate verified on 2026-09-15. Root overrides align OpenCode and the Git-pinned Aero dependency with that runtime and its platform packages. The AWS credential provider pins the browser-compatible web identity version used by the source checkout.

The shared Aero and EVM packages receive the same Effect update, including both standalone repositories and Aero bundled inside evmSDK. The EVM exporter derives the Effect override from the package manifest rather than hardcoding an older beta.

## Feature coverage

This is a source and workspace migration. X Chat, Stocks, and Pecu are included. Bee mobile, Android, web chat, CLI, iMessage, voice, and provider contracts do not change. Existing wallet confirmation and receipt recovery behavior remains covered by Pecu tests. Build results do not prove deployed authentication, live X delivery, container startup, or wallet execution.

## Pecu naming

The bot package is `@beegreat/pecu` in `apps/pecu`. Its gateway and homepage are `@beegreat/pecu-site` in `apps/pecu/apps/site`.

The bot Workers are `pecu`, `pecu-aero`, `pecu-codex`, and `pecu-evm`. Both the Durable Object and Stocks service bindings use `PECU`. The Durable Object class is `PecuDurableObject`, its named instance is `pecu-main`, and Crossmint owners use `userId:pecu-x-SENDER_ID`. SQLite tables, database defaults, stored keys, agent IDs, and the admin Keychain service also use Pecu.

This is a fresh identity, as requested because there are no users. There is no compatibility mapping or data migration from the former names. Existing remote services are not renamed by a source commit. Deployment must provision secrets for the Pecu Workers and register the configured Pecu webhook with X. `SOURCE.json` retains the original repository URL as a historical source record.

## Clarification and reply retry

Pecu exposes `ask_user` to its OpenCode agent. It delivers a question and optional
numbered choices as a normal chat reply on X. The web clients render typed choices
as buttons. A click sends the selected option in the same conversation. The
backend rejects stale choices, unknown options, and choices from other owners.
Questions persist across Worker restarts. A choice always requires a transaction
preview, even with YOLO enabled. Cancel ends the clarification without requiring
a transaction confirmation code. Asking blocks further transaction proposals in
that turn. Choosing a funding token does not confirm a swap.

When `stock_buy` reports insufficient USDC, Pecu fetches current wallet balances
and asks about swapping funded ETH or AERO, depositing USDC, or cancelling. The
balance list currently covers ETH, USDC, and AERO, not every token. A funding
quote still needs to establish the amount, available liquidity, and ETH for fees.
The swap and stock purchase use separate previews and confirmations.

The Agent and Stocks web chats offer Retry on the latest eligible answer. Retry
replaces that reply without duplicating the user message. Earlier visible history
is supplied to a fresh model session without the discarded answer. The backend
validates ownership, original text, and latest-message status. Transport retries
reuse the same request ID. Transaction-linked replies and commands cannot be
regenerated; their existing status and confirmation controls remain available.
Regenerated proposals require confirmation even when the chat has YOLO enabled.

These changes apply to Pecu X and its two web chat views. Bee mobile, Android,
CLI, iMessage, and voice use a different agent and are unchanged. Only Pecu's
OpenCode provider path is involved. The backend and Stocks web Worker must both
be deployed. Responses still arrive as completed messages rather than streamed
text deltas.

While a reply is generating, the web clients show "Pecu is answering…". They
automatically refresh unresolved replies after a reload. "Resume response" is
available only when the browser has no active request; it reuses the existing
request ID and does not create a second transaction.

## Per-user ChatGPT connections

The profile's AI connection page connects a ChatGPT subscription to the verified
X account. Both `/agent` and Stocks use the same profile component. X chat and
web chat select `UserInference` by that X sender, so each account has its own
OpenCode SQLite database, credentials, sessions, and last provider response.
The shared subscription is never a fallback. Wallet commands remain available
without a subscription. Other Bee clients and providers are separate products
and are not changed by this Pecu feature.

The profile shows the configured model and reasoning, connection status, and the
last provider response time. It does not claim a subscription tier, remaining
quota, or that a successful HTTP response proves a completed answer. Connect
starts OpenCode's ChatGPT device flow. Cancel and Disconnect stop future AI
requests; disconnect leaves wallets and chat history intact. Users authorize
ChatGPT in OpenAI's browser flow. Credentials never enter browser responses.

Deploy the agent Worker with the `v2-user-inference` SQLite migration, then the
Stocks web Worker. The old admin OpenCode login routes return 410. Health reports
per-user connection scope rather than the retired shared account's status.
Existing users must connect once. Old AI sessions and the old shared credential
are retained in the main database but are not used by the new runtime. Visible
chat history remains; new AI conversations start in the user's isolated store.

Validation includes user isolation, no shared fallback, failed disconnect
blocking future replies, OAuth attempt reuse, restart recovery, concurrent-turn
locks, the tool allowlist, and a real Workerd RPC check without credentials.
A full live OAuth and model-reply check requires the user to authorize ChatGPT.

## Stock holdings chart

Pecu chat, Stocks chat, and the Holdings tab share a Dither Kit pie chart.
`/stocks` and stock ownership questions use tool-produced snapshots saved per
event. Allocation uses estimated USDC value and identifies unavailable balances
or prices. See [stock holdings](../apps/pecu/docs/stock-holdings-chart.md).

ChatGPT connection is available directly from the Pecu profile menu. The
`/agent#chatgpt` link opens the same panel. A fresh missing-connection reply opens
it once, while older replies retain an explicit Connect ChatGPT button. Device
sign-in shows a copyable code with clipboard feedback. Connection management is
shared by Pecu and Stocks web chat; X Chat receives the direct connection link.

Expired ChatGPT device sign-in attempts are cleared before polling the provider.
The profile remains usable after a code expires, including when the provider has
already removed the attempt. Saved credentials still determine connection status.
