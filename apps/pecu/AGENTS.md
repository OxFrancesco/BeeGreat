
<!-- codeview:start -->

## Reference codebases (codeview)

The `resources/` folder contains read-only clones of reference codebases.
If you need to implement code specific to one of these codebases, read the relevant
folder to gather information, feedback, patterns, and templates before writing code.

- `resources/xchat-agent-skeleton` — Official X Chat agent skeleton with key restoration, encrypted messaging, and agent integration patterns
- `resources/crossmint-sdk` — Official Crossmint SDK monorepo with the current @crossmint/wallets-sdk for EVM smart wallets
- `resources/aerodrome-sdk-ts` — Francesco's standalone TypeScript Aerodrome Sugar SDK and aero CLI for Base
- `resources/xdk-typescript` — Official TypeScript X API SDK with X Chat inbox, events, messages, and Activity stream support
- `resources/x-chat-xdk` — Official X Chat encryption SDK including native Juicebox implementation
- `resources/xurl` — Official X CLI with OAuth and X Chat key restore flows
- `resources/pi` — Official Pi coding agent source — RPC mode, SDK embedding, sessions, extensions, tools, and terminal UI
- `resources/opencode` — Official OpenCode source — CLI model discovery, run flags, and reasoning variants
- `resources/opencode-v2` — Official OpenCode v2 branch for ChatGPT subscription OAuth and Workerd provider integration
- `resources/cloudflare-containers` — Official Cloudflare Containers SDK and runtime examples
- `resources/evm-sdk` — Francesco's @beegreat/evm SDK and evm CLI: viem-based EVM reads/writes, Crossmint smart wallet signing, WalletConnect, MCP server, and bundled Aero Sugar workspace
- `resources/cloudflare-sandbox-sdk` — Official Cloudflare Sandbox SDK source, current API types, lifecycle, tunnels, and examples for iChef runtime proof
- `resources/aave-skills` — Official Aave MCP skills for safe transactions, yield analysis, deleveraging, account activity, and transaction confirmation
- `resources/tanstack-router` — Official TanStack Router and TanStack Start source, packages, examples, hosting adapters, and Vite integration
- `resources/clerk-javascript` — Official Clerk JavaScript monorepo including the TanStack React Start SDK, middleware, auth helpers, and examples
- `resources/shadcn` — Official shadcn component registry and Tailwind component implementations

- `resources/ai-elements` — Official Vercel AI Elements shadcn registry and React components for conversations, messages, reasoning, tools, and prompts

<!-- codeview:end -->

## User-facing chat behavior

Never add visible scrollbars or custom scrollbar tracks to Pecu UI unless the user explicitly asks. Keep horizontal and vertical scrolling functional while hiding scrollbars on pages, nested lists, dialogs, textareas, and code blocks.

Production identity is persistent: keep the `basedbot` Worker names, `BasedBotDurableObject` export, `basedbot-main` object name, existing storage keys and table names, and `userId:basedbot-x-<sender>` Crossmint owners (web-only Clerk users, e.g. Google sign-in, use the sender `web-<clerk user id>` and owner `userId:basedbot-web-<clerk user id>`). Pecu is the product name. Renaming persistent identifiers requires a separate verified state migration.

The first verified message provisions the sender's Base smart wallet before command or model handling, even for greetings and `/help`. Stored wallets skip onboarding across conversations. Creation failures return an error and retry on the next new message; replayed events return their stored reply.

Write for ordinary users. Show human token amounts, recipients when relevant, minimum received amounts, network fees when available, and confirmation controls. Do not put JSON, calldata, raw wei amounts, internal plan IDs, or framework names in normal replies. Do not invent fee estimates. Keep technical output behind `b/verbose`.

Prefer natural-language requests and the short commands below. Keep the advanced Aerodrome commands in `/aero help` rather than putting their full syntax into every reply.

## Command reference

This reference describes the implemented command parser, not a guarantee that every command is deployed. On 2026-09-14, `/token`, `/send`, `/allowance`, `/approve`, `/revoke`, and `b/verbose` were pushed to `main` but still awaited production deployment. Recheck the deployed version before telling a user these commands are live.

Source of truth: `src/domain.ts`, `src/agent.ts`, `src/evm.ts`, and the pinned `@beegreat/sugar` package's `src/contracts.ts`, `src/cli-args.ts`, `src/index.ts`, and `src/actions.ts`. Update this reference when the parser or SDK changes. The standalone Aero CLI has additional commands that are not automatically available in Pecu chat.

### Shared usage rules

- Wallet transaction commands operate on Base mainnet, chain ID `8453`. Public Polymarket reads query Polymarket markets and wallets, including Polygon data, without signing.
- The wallet belongs to the signature-verified X sender. Users do not provide `--wallet`, credentials, private keys, or seed phrases. Transaction wallet overrides are rejected.
- Replace `0xRECIPIENT`, `0xSPENDER`, `0xTOKEN`, `0xPOOL`, and `0xOWNER` with complete public addresses. These placeholders are not valid addresses themselves.
- Replace example position ID `123` with a position returned by `/aero positions`.
- Reads run immediately. A transaction command creates an unsigned preview. With YOLO off, reply to the specific preview with `confirm`, or send `/confirm CODE`. Both require the same X sender and conversation. Reply confirmation must use a locally stored outgoing message or a validated signed bot preview, never unverified quoted text. `/cancel CODE` cancels a pending plan.
- Use the actual six-character confirmation code returned by the bot. `ABC123` below is an example. Check the preview's expiry; the current configuration gives proposals ten minutes.
- YOLO requires the explicit `/yolo on` command. The model cannot enable it. Persist it per X sender and conversation. It must retain the execution lock, plan validation, expiry checks, event deduplication, persisted steps, and receipt verification. A generic `evm_contract_call` plan is never auto-executed by YOLO; it always waits for the user's confirmation, and its calldata may not start with an ERC-20, ERC-721, ERC-1155, or Aave delegation transfer/approve selector.
- Confirmation codes are six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1). The parser accepts any `[A-Z0-9]{6}` and upper-cases input. Lookups are scoped to the sender and conversation.
- Missing transaction-read permission must retain the prepared transaction ID for recovery. Do not advise a new swap or report failure as proof that nothing was submitted. The same applies to any error after Crossmint may have been asked to approve: the intent stays `executing` and the reply tells the user to send the same `/confirm CODE` again. Only errors before approval, a Crossmint status of `failed`, or a verified on-chain revert mark an intent `failed`.
- A pending transaction can be checked again with the same `/confirm CODE`. A repeated confirmation must not resubmit a transaction already sent. A completed proposal returns its stored result.
- Short-command amounts are human token units. For example, `0.001 ETH` means 0.001 ETH, not wei. ETH, USDC, and AERO are recognized directly. Generic token commands also accept an ERC-20 contract address. Other Aero symbols depend on SDK resolution.
- The current parser accepts `b/` as an alternative prefix, including `b/verbose`. Document the conventional `/` forms for other commands. Bare recognized commands also parse, but explicit prefixes avoid confusion with natural-language requests.

### Main commands

| Command | What it does | How to use it |
| --- | --- | --- |
| `/help` | Shows the short command list. | Send `/help`. |
| `/start` | Alias for `/help`. | Send `/start`. |
| `/wallet` | Creates or retrieves the sender's Base smart wallet and shows its address. | Send `/wallet`, then use the returned address when funding the wallet on Base. |
| `/stocks` | Shows stock holdings with a value-weighted chart on web and a text response in X Chat. | Send `/stocks` or ask which stocks you own. |
| `/balance` | Shows ETH, USDC, and AERO balances. | Send `/balance`. Use `/token` for another token. |
| `/deposit` | Shows the Whop funding page and bank or crypto deposit details for adding money. Asks for an email on first use. | `/deposit` or `/deposit 50` |
| `/deposit setup EMAIL` | Creates the sender's Whop funding account with the given email. Whop uses it for deposit receipts. | `/deposit setup you@example.com` |
| `/deposit status` | Lists the sender's recent deposits and whether the USDC was sent. | `/deposit status` |
| `/quote AMOUNT TOKEN to TOKEN` | Gets a swap price without creating a transaction plan. | `/quote 0.001 ETH to USDC` |
| `/swap AMOUNT TOKEN to TOKEN` | Creates a swap preview with a confirmation code. | `/swap 0.000001 ETH to USDC` |
| `/token TOKEN` | Reads the balance of ETH, USDC, AERO, or a token contract. | `/token USDC` or `/token 0xTOKEN` |
| `/send AMOUNT TOKEN to ADDRESS` | Creates a transfer preview. Rejects a transfer to the sender's own wallet. | `/send 1 USDC to 0xRECIPIENT` or `/send 0.000001 ETH to 0xRECIPIENT` |
| `/allowance TOKEN for ADDRESS` | Reads how much an address is permitted to spend from the sender's ERC-20 balance. | `/allowance USDC for 0xSPENDER` |
| `/approve AMOUNT TOKEN for ADDRESS` | Previews setting an exact ERC-20 spending allowance. It does not transfer tokens. | `/approve 1 USDC for 0xSPENDER` |
| `/revoke TOKEN for ADDRESS` | Previews setting an ERC-20 spending allowance to zero. ETH does not have allowances. | `/revoke USDC for 0xSPENDER` |
| `/aave help` | Shows Aave lending, borrowing, and position examples. The five official workflows load for natural-language Aave requests. | `/aave help` |
| `/polymarket QUESTION` | Searches public Polymarket markets directly. Read-only, no API key. | `/polymarket What are the odds of a Fed rate cut?` |
| `/polymarket help` | Lists direct public reads. | `/polymarket help` |
| `/polymarket read ENDPOINT JSON` | Calls a direct public read with validated arguments. | `/polymarket read leaderboard {"limit":5}` |
| `/polymarket research QUESTION` | Starts optional deeper research through Exa. | `/polymarket research Compare Fed market probabilities` |
| `/polymarket status` | Retrieves the latest research without starting another paid run. | `/polymarket status` |
| `/yolo` | Shows whether YOLO is enabled for you in this chat. Defaults to off. | `/yolo` |
| `/yolo on` | Executes new transaction requests without a confirmation prompt. Does not execute existing previews. | `/yolo on` |
| `/yolo off` | Restores confirmation prompts for new requests. Does not undo submitted transactions. | `/yolo off` |
| `/confirm CODE` | Executes the exact unexpired stored plan, or rechecks an already submitted plan. | `/confirm ABC123` |
| `/cancel CODE` | Cancels a pending plan so it cannot later execute. It cannot undo a submitted transaction. | `/cancel ABC123` |
| `b/verbose` | Shows the latest stored technical result as JSON for this sender and conversation. Does not rerun a tool or turn JSON on for future replies. | Send `b/verbose` after a wallet lookup, balance check, quote, or preview. `/verbose` is an alias. |
| `b/verbose PAGE` | Reads another page of a long technical result. | `b/verbose 2`; `/verbose 2` also works. Page numbers start at 1. |
| `/aero help` | Shows the advanced Aerodrome command reference. | `/aero`, `/aero help`, `/aero --help`, and `/aero -h` all show the same help. |
| `/nansen` or `/nansen help` | Shows the Nansen analytics commands. | `/nansen` |
| `/nansen token TOKEN [chain] [timeframe]` | Shows a token snapshot: price, market cap, liquidity, volume, holders. | `/nansen token 0xTOKEN base 7d` |
| `/nansen flows TOKEN [chain] [timeframe]` | Shows net token inflows and outflows per holder cohort. | `/nansen flows 0xTOKEN` |
| `/nansen wallet [ADDRESS] [chain]` | Shows token balances for an address, defaulting to the sender's wallet on Base. | `/nansen wallet` or `/nansen wallet 0xADDRESS ethereum` |
| `/nansen pnl [ADDRESS] [chain]` | Shows realized and unrealized P&L by token for an address. | `/nansen pnl` |
| `/nansen markets [words]` | Lists Polymarket markets ranked by 24h volume, optionally filtered by search words. | `/nansen markets fed rate cut` |

### Advanced Aerodrome reads

| Command | What it does | Example |
| --- | --- | --- |
| `/aero stocks` | Lists supported tokenized stocks with market and sender-holding information when available. | `/aero stocks` |
| `/aero positions` | Lists the sender's liquidity positions. `--owner` can inspect a specified public address. | `/aero positions` or `/aero positions --owner 0xOWNER` |
| `/aero pools` | Finds pools, optionally filtered by token pair and pool type. | `/aero pools --token0 USDC --token1 AERO --pool-type volatile --limit 5 --full` |
| `/aero epochs-latest` | Reads the latest reward-period data, optionally filtered by pool type. | `/aero epochs-latest --pool-type cl` |
| `/aero epochs` | Reads historical reward-period data for a pool. | `/aero epochs --lp 0xPOOL --limit 5 --offset 0` |
| `/aero quote` | Gets a swap quote using explicit flags. | `/aero quote --from-token ETH --to-token USDC --amount 0.001 --use-decimals` |

Read options:

- `pools`: `--token0`, `--token1`, `--pool-type`, `--limit`, and `--full`.
- `epochs-latest`: `--pool-type`.
- `epochs`: required `--lp`; optional `--pool-type`, `--limit`, and `--offset`.
- `positions`: optional `--owner`; the bot uses the sender's wallet when it is omitted.
- `quote`: required `--from-token`, `--to-token`, and `--amount`; optional `--use-decimals`.
- Pool types are `stable`, `volatile`, and `cl`. Limits must be 1 through 100. Offsets must be nonnegative integers.

### Advanced Aerodrome transaction previews

With YOLO off, every command in this table needs confirmation by replying `confirm` to the preview or sending `/confirm CODE`. With YOLO on, new transaction requests execute immediately. The amounts are syntax examples, not test spending instructions.

| Command | What it does | Example |
| --- | --- | --- |
| `/aero swap` | Previews a swap with an optional slippage limit. | `/aero swap --from-token ETH --to-token USDC --amount 0.000001 --use-decimals --slippage 0.005` |
| `/aero deposit` | Previews adding liquidity to a pool. Amounts correspond to that pool's token0 and token1. | `/aero deposit --pool 0xPOOL --amount0 1 --amount1 1 --use-decimals` |
| `/aero withdraw` | Previews removing a fraction of a liquidity position. | `/aero withdraw --position 123 --fraction 0.5 --collect` |
| `/aero stake` | Previews staking a liquidity position. | `/aero stake --position 123` |
| `/aero unstake` | Previews unstaking a position. | `/aero unstake --position 123` |
| `/aero claim-emissions` | Previews claiming a position's emissions rewards. | `/aero claim-emissions --position 123` |
| `/aero claim-fees` | Previews claiming a position's accumulated trading fees. | `/aero claim-fees --position 123` |
| `/aero create-venft` | Previews locking AERO into a voting position for a specified duration. | `/aero create-venft --amount 1 --lock-duration-seconds 31536000 --use-decimals` |
| `/aero stock-buy` | Previews buying a supported tokenized stock. The amount is USDC to spend. | `/aero stock-buy --stock NVDAc --amount 1` |
| `/aero stock-sell` | Previews selling a supported tokenized stock. The amount is stock tokens to sell. | `/aero stock-sell --stock NVDAc --amount 0.001` |
| `/aero index-rebalance` | Previews trades to reach target stock percentages, optionally adding USDC. An already balanced index creates no plan. | `/aero index-rebalance --allocations NVDAc=50,AAPLc=50 --cash 1` |

Transaction options and amount rules:

- `swap`: `--from-token`, `--to-token`, `--amount`, `--use-decimals`, and `--slippage`.
- `deposit`: choose an existing `--pool`, or specify `--token0`, `--token1`, and `--pool-type`. Do not combine those two pool-selection forms. Creating or selecting a CL pool by token pair also requires `--tick-spacing`. An example is `/aero deposit --token0 USDC --token1 AERO --pool-type volatile --amount0 1 --amount1 1 --use-decimals`.
- Deposit amount options are `--amount0`, `--amount1`, and `--use-decimals`. A new basic pool needs both amounts. Existing basic pools can quote the other side from one amount. CL deposits use appropriate price or tick bounds for the chosen range.
- CL deposit options are `--price-lower`, `--price-upper`, `--tick-lower`, `--tick-upper`, and `--initial-price`. Their values depend on the actual pool. Do not invent bounds for the user. Basic pools reject CL-only price and tick flags.
- `deposit` and `withdraw` also accept `--slippage` and `--deadline-minutes`.
- `withdraw`, `stake`, `unstake`, `claim-emissions`, and `claim-fees` require `--position` or `--pool`. For a basic pool position, use the pool address. `--position 0` alone is ambiguous and requires `--pool` too.
- `withdraw --fraction 0.5` removes half the position. Fractions must be greater than 0 and at most 1. Optional flags are `--burn`, `--collect`, and `--unwrap-native`. Fee collection defaults to enabled; `--no-collect` disables it.
- `unstake --amount` accepts the SDK's integer amount, not a human token decimal. Omit it for the SDK's default full unstake. This action does not accept `--use-decimals`.
- `claim-fees` also accepts `--burn` and `--unwrap-native`. Do not enable either without understanding the selected position and the user's request.
- `create-venft` requires `--amount` and a positive integer `--lock-duration-seconds`. The example duration `31536000` is 365 days. Actual permissible locks depend on the contract.
- `quote`, `swap`, `deposit`, and `create-venft` need `--use-decimals` when amounts are human token units. Without it, their amounts are integer base units. The short `/quote` and `/swap` commands add it automatically.
- `stock-buy`, `stock-sell`, and `index-rebalance --cash` already use human units and do not accept `--use-decimals`. Stock symbols come from `/aero stocks`. Allocations use comma-separated `SYMBOL=percent` entries totaling 100. Omitted cash defaults to zero.
- `stock-buy`, `stock-sell`, and `index-rebalance` also accept `--slippage`.
- Slippage is a fraction: `--slippage 0.005` means 0.5%. The bot currently defaults to 1% and rejects values above its configured maximum. A lower custom value is allowed.
- Flags accept `--name value` or `--name=value`. Use hyphenated flag names in documentation. Boolean flags accept `--flag`, `--flag true`, `--flag=false`, or `--no-flag`. Do not assume a flag supported by one action is supported by another.

The model also has an `aero_stock_trades` tool for composite stock orders. When one message asks for several stock buys or sells, it combines them into a single basket preview: one confirmation code, approvals followed by one router action, and one persisted intent. It is not a slash command.

### Natural-language requests

Users do not need to memorize the command list. Examples:

- "What's my wallet address?"
- "Check my balance."
- "Quote 0.001 ETH to USDC."
- "Preview a swap of 0.000001 ETH to USDC."
- "Show my liquidity positions."
- "Show my USDC allowance for 0xSPENDER."

The model also has tools for contract reads, verified ABI inspection, data decoding, and simulated contract-call previews. Those are natural-language capabilities, not `/read`, `/inspect`, `/decode`, `/contract-call`, or `/evm` slash commands. Supply the contract address, function signature and arguments when needed. These capabilities must preserve the same wallet ownership and transaction confirmation rules as explicit commands.


## Aave and Polymarket integrations

The five official Aave skills are vendored under `skills/aave/` and bundled into the deployed agent. Their source is `resources/aave-skills`, managed with codeview. `aave_skill` loads one workflow, `aave_schema` returns exact tool arguments, and `aave_call` runs the supported official MCP tools at `https://mcp.aave.com`. Keep third-party instructions subordinate to the verified wallet, chain, confirmation, and JSON-display rules.

Aave reads cover the chains the service reports. Pecu signs only Base v3 supply, borrow, withdraw, and repay plans through `prepare_action`. Discovery, account and reserve inspection, and simulation run before every plan. Error warnings stop the build; other warnings reach the user. Token approval is a separate action and must be identified as such. Once confirmed, the user can ask to continue. Signed orders, liquidations, and other prepared actions are not enabled. Deleveraging, yield analysis, history, and post-transaction position checks use the official workflows.

Polymarket defaults to 52 direct public read tools in `src/integrations/polymarket/catalog.generated.ts`, backed by Gamma, CLOB and Data API v2 through the Effect service. Use `/polymarket help` for discovery and `/polymarket read ENDPOINT JSON` for direct calls. Preserve source timestamps and `next.input` filters on pagination. A Polymarket wallet is not implicitly the sender's Base wallet. Exa is optional and only selected explicitly with `/polymarket research QUESTION` or a request for deeper research. It uses the `polymarket` data source and minimal effort. Store `EXA_API_KEY` as a Cloudflare secret, never in code or skills. Persist the run ID per incoming event and the latest run per sender/conversation. Status checks must reuse the saved run. Report sources and observation time, and describe probabilities as market-implied odds. No betting or trading tools are exposed. Market, list, history, order book, leaderboard, biggest-win, user P&L and positions reads attach Polymarket cards on web, with the same text in X Chat. Refresh `/polymarket-showcase` data with `bun scripts/polymarket/showcase.ts`.

Whop deposits give users a fiat on-ramp. `WHOP_API_KEY` and `WHOP_WEBHOOK_SECRET` are Cloudflare secrets, never in code. Each sender gets one connected account keyed by their verified ID; `/deposit` reuses it. Confirmed `deposit.succeeded` webhooks relay the same dollar amount in Base USDC from the treasury wallet automatically, with no confirmation step. Repeat bank and crypto details exactly as the tool returns them; never invent payment details, fees, or timing. Deposits over the automatic caps wait for manual review.

Nansen analytics is read-only. `NANSEN_API_KEY` is a Cloudflare secret, never in code. Every user-visible Nansen reply must end with `Data: Nansen (nansen.ai)`. Nansen's redistribution terms forbid labels endpoints, all `smart-money/*` endpoints, the PnL leaderboards, and `tgm/holders`, and `tgm/dex-trades` must always send `only_smart_money: false`. The allowed path list is pinned by `tests/integrations-nansen.test.ts`; keep it in sync with any catalog change. Analytics answers report what the data shows and are not financial advice.

## Pecu visual consistency

Pecu and Pecu Agent share `theme/amber-minimal.json`, generated `theme/theme.css`,
and `theme/clay.css`. Keep the original claymation snail and clay depth in controls.
Amber-minimal owns UI colors and typography; the clay layer owns material and shape.
Do not add a second palette or override the upstream tokens in product stylesheets.
The one exception is the homepage Aero tile: it uses Aero's palette from
`theme/aero.css`, copied from the pinned Aero TUI and checked by `design:check`.
Read `docs/design-system.md` before UI work and run `bun run design:check` afterwards.
Update the `/design` specimens with new visual patterns. Charts may retain distinct
series colors; their data-driven styles have explicit lint exceptions.

Portfolio analytics: `/nansen portfolio [ADDRESS]` returns wallet tokens and DeFi positions separately. See `docs/nansen-charts.md`.

## Organization wallets

Safe tools run through the shared EVM tool set and confirmation flow. `safe_create` uses explicit owners and threshold; it does not replace the personal Crossmint wallet. `safe_approve` records exactly one owner's permanent on-chain approval. `safe_execute` requires the existing on-chain threshold. `safe_cancel_propose` and `safe_owner_propose` produce proposals requiring that same threshold. Never describe multiple backend-controlled wallets as independently controlled signers. See `docs/39-safe-organization-wallets.md` at the monorepo root for scope and verification.

Safe extensions use the same confirmation boundary. Budgets bypass per-payment quorum within the owner-approved allowance. Roles restrict a member to selected targets, selectors and static arguments; a secondary Safe can be a member without changing the treasury threshold. Passkey signer deployment is separate from adding an owner. Signer replacement requires the surviving quorum. Pimlico ERC-4337 submission runs in evmSDK with a persistent local journal, not in Pecu's disposable unsigned sandbox. Pecu relays confirmed Safe calls through its existing Crossmint path.
