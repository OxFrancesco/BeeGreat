# BasedBot architecture

## Runtime shape

Cloudflare routes every request to one named Durable Object, `basedbot-main`. The single object is intentional: one XChat bot identity owns the poll cursor and the X Chat/Juicebox SDK uses process-global callback state that must not be operated concurrently across isolates.

The Durable Object owns:

- OpenCode V2 Workerd and its ChatGPT OAuth credential, model catalog, sessions, and durable events.
- Prefixed BasedBot SQLite tables for processed X events, verified agent turns, sender-to-wallet mappings, Aero intents and execution steps, encrypted outbox payloads, and X pagination state.
- A recurring alarm that polls XChat and reschedules itself even after a failed poll.

OpenCode initializes its own schema before BasedBot adds prefixed tables. This order is required because a fresh OpenCode database refuses unrelated tables before its session migration has run.

## Identity and agent boundary

X OAuth authenticates the bot account. XChat public keys decrypt messages, and Chat XDK signature verification authenticates each numeric sender ID. The tuple `(verified sender ID, conversation ID)` maps to exactly one OpenCode session and one Crossmint smart wallet owner.

Before each model turn, the exact verified message is persisted against the OpenCode session. Tool execution resolves capabilities from that persisted binding, so Durable Object eviction cannot turn a resumed tool call into an unbound request.

OpenCode's only active agent is `basedbot`. Its plugin removes the built-in tool surface and exposes two wallet tools, one tool per Aero action, and nine generic EVM tools:

- wallet address
- wallet balances
- all read-only actions from `SUGAR_ACTIONS`
- all state-changing actions from `SUGAR_TX_ACTIONS`
- `evm_token_balance`, `evm_allowance`, `evm_read`, `evm_inspect`, `evm_decode` (reads)
- `evm_transfer`, `evm_approve`, `evm_revoke`, `evm_contract_call` (plans)

Each Aero tool derives its allowed arguments and required fields from the SDK validator through a tracked export patch. The bot adds model-facing descriptions and defaults token amounts to human units. The SDK still validates conditional fields and the wallet policy still binds the sender and chain. EVM tools carry explicit zod schemas in `src/cloudflare/evm-tools.ts` and re-validate their input before dispatch. Coding, shell, filesystem, browser, MCP, skill, subagent, and arbitrary network tools are denied.

## Wallet and Aero boundary

Crossmint owns signing and broadcast. Every verified X sender deterministically owns `userId:basedbot-x-SENDER_ID:evm:smart` on the `base` chain. A production Crossmint key is required because the staging `base` alias targets a test network.

The Aero service always overwrites `chain` with `8453`. Transaction callers cannot override `wallet`; positions default to the sender's wallet while still allowing public-owner inspection. Slippage is bounded by `MAX_SLIPPAGE_BPS`.

Read actions execute immediately. Transaction actions return ordered unsigned calls. BasedBot validates their structure, hashes them, and atomically persists the proposal and steps before returning a preview. The model cannot confirm its own proposal.

`/confirm` is parsed outside OpenCode as a separate verified X event. It checks sender, conversation, expiry, wallet, state, and persisted plan digest before compare-and-setting the intent to `executing`. Each prepared Crossmint transaction ID is checkpointed before approval, allowing an interrupted multi-step action to resume from its first incomplete step.

Execution is idempotent per step. Before approving, the bot reads Crossmint's record of the prepared transaction and approves only while its status is `awaiting-approval`. After approval it reads the record again for the transaction hash and `userOperationHash`, checkpoints the hash as `submitted`, and verifies the receipt (`src/receipt.ts`, ported from evmSDK's `reconcileSmart`): the receipt's block hash must still be canonical, and a `UserOperationEvent` from EntryPoint v0.6, v0.7, or v0.8 must match the `userOpHash` and `sender`. The event's inner `success` flag decides between `succeeded` and `failed`; the bundler transaction's own status is not enough. A receipt that is not yet available keeps the intent `executing` and the step `submitted`; a repeated `/confirm` or restart recovery re-verifies without preparing or approving again.

`ENABLE_MAINNET_EXECUTION=false` blocks confirmation before any Crossmint transaction preparation or approval.

## Generic EVM boundary

`basedbot-evm` is a Cloudflare Sandbox whose image clones [evmSDK](https://github.com/OxFrancesco/evmSDK) at the commit pinned in `containers/evm/Dockerfile` and builds its `evm` CLI. The Worker in front of it accepts one request shape, `{ command, input }`, where `command` must be in the allow list in `src/cloudflare/evm-protocol.ts`: reads (`read`, `token`, `balance`, `inspect`, `decode`, `allowance`, `identity`, `block`, `transaction`, `units`) and plan builders (`prepare-call`, `transfer`, `approve`, `revoke`). `execute`, `wallet-*`, `status`, `replace`, `attach-transaction`, socket, batch, and policy commands are absent, so the sandbox can never sign or broadcast. Every non-`units` input must carry `chainId: 8453`.

The Worker runs `printf '%s' "$EVM_INPUT" | bun dist/cli.js COMMAND --stdin` with the JSON in `EVM_INPUT`, so user-controlled bytes never reach shell parsing. Each call receives `EVM_DATABASE=/tmp/evm/UUID/operations.sqlite` and the directory is removed before the response returns. The sandbox filesystem also resets whenever the container sleeps; that is acceptable because the Durable Object is the only durable record of any plan. The only secrets in the sandbox are the RPC URL and an optional Etherscan key.

`src/evm.ts` is the Worker-side client. It resolves token symbols through the Aero SDK's canonical Base token list, converts human amounts to base units with string arithmetic after reading the token's decimals, refuses transfers that exceed the sender's balance before asking the sandbox for a plan, and requires the returned plan's `account` to equal the sender's wallet. `validateEvmPlan` in `src/policy.ts` then pins the single returned call to the declared action: native transfers carry `0x` calldata and positive value, ERC-20 transfers and approvals carry exactly the `transfer(address,uint256)` or `approve(address,uint256)` selector with 64 bytes of arguments and zero value, revokes must encode a zero allowance, and contract calls need calldata. Intents record `family: "aero" | "evm"` so both stores re-validate parameters with the right validator on load.

Aero stays in-process in `basedbot-aero`. Its cache store and tuned concurrency would be lost behind a per-call process spawn, and its role-tagged `transaction_steps` are richer than the evm CLI's `aero` wrapper.

## Hosting and authentication

The public surface contains only `GET /health`. Protected `/admin/*` routes are hidden as `404` unless the bearer token matches `ADMIN_TOKEN`.

The ChatGPT device flow is initiated through `/admin/opencode/login`. OpenCode's `chatgpt-headless` integration returns the Codex device URL and code, polls completion, and persists the renewable OAuth connection in Durable Object storage. No OpenAI API key is required.

OpenCode v2's provider implementation selects the active OAuth credential, extracts its ChatGPT account ID, refreshes it before expiry, and directs model requests to `https://chatgpt.com/backend-api/codex/responses`. The imported reference is `resources/opencode-v2/packages/core/src/plugin/provider/openai.ts`, v2 commit `00067d23a0597981b2e9d2f1c5144761fc0f6d33`.

Direct Worker requests to this endpoint received HTML 403 responses identifying the shared cross-zone Worker address `2a06:98c0:3600::103`. The identical invalid-token control from a Cloudflare Container returned JSON 401 from ChatGPT's authentication layer. Cloudflare documents that shared address in its [HTTP header reference](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

The tracked OpenCode server patch exposes a host-provided HTTP transport. It scopes that transport to the host's outgoing Effect HTTP client, preserving the SDK's separate in-process client. `codexContainerFetch` routes only the fixed Codex endpoint through the `CODEX` service binding. OAuth remains managed by OpenCode in the Durable Object.

`basedbot-codex` has no public Worker URL. It starts at most one small container, forwards only subscription-authorized requests for the configured model with `store: false`, and streams the provider response. It never retries a model request. The container's ephemeral disk holds no login or session data, so stopping it cannot discard the bot's state. The official Cloudflare Containers SDK coordinates concurrent startup and shuts the container down after five idle minutes.

The current OpenCode beta requires a single hoisted Effect 4 installation. The X Chat SDK is patched narrowly so Workerd with `nodejs_compat` selects its browser/WASM loader instead of mistaking `process.versions.node` for a real Node filesystem.

## Remaining live proof

With production credentials, verify the complete path: deployed health, ChatGPT OAuth completion, encrypted X DM receipt, verified sender binding, Crossmint wallet creation, representative reads from each Aero family, transaction preview, encrypted reply, and state continuity after Durable Object eviction. Mainnet execution is enabled by user request. A funded mainnet transaction requires the user to confirm the exact plan; do not submit one merely to validate deployment.

The EVM sandbox image was built locally for `linux/amd64` and exercised against Base mainnet with the exact shell line the Worker sends: `token` returned a live USDC balance with the expected envelope in 3.7 s under emulation, `transfer` returned a `prepared` plan with `a9059cbb` calldata, gas, gas price, an OP Stack L1 fee estimate, and a ten-minute expiry, and an over-balance `transfer` returned `SimulationReverted` with the ERC-20 revert reason. The Cloudflare-hosted sandbox, its cold-start latency, and the receipt verification against a real Crossmint user operation remain deployment acceptance checks.
