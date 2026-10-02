# Pecu MCP

Pecu exposes `/mcp` through the Stocks Worker and the existing private
`StocksGateway` service binding. The site Worker forwards that endpoint and
`/.well-known/oauth-protected-resource/mcp` to Stocks.

The server uses MCP `2026-07-28` through the official TypeScript SDK 2.2. Each
HTTP request creates a fresh server. The SDK validates modern envelopes and
routing headers. Legacy clients use stateless Streamable HTTP through the same
factory. GET and DELETE session operations return 405.

`src/tool-catalog.ts` defines the registrations shared with OpenCode.
`src/mcp-catalog.ts` adds transport annotations and the scope of each tool.
The catalog has 189 public registrations and the `run_tools` wrapper. The
`research_findings` and `research_report` hooks remain inside research runs,
where their role and submission budget can be verified. `load_skills` returns
the requested instructions in MCP without storing protocol state.

## Account and permissions

Clerk remains the authorization server. Pecu advertises its existing instance
through protected-resource metadata and accepts resource-bound OAuth access
tokens. It verifies each token through Clerk's official introspection API,
then loads the account and uses the same `webSenderId` mapping as the web app.
Browser session tokens, missing audiences, revoked tokens and unavailable
accounts fail before tool dispatch. OAuth credentials never reach the agent
or upstream tool services.

Read tools require `pecu:read`. Action tools require both `pecu:read` and
`pecu:write` and challenge
read-only clients with HTTP 403. `run_tools` is available to read clients, but
each nested call checks its own scope. The Worker-safe JSON Schema validator
rejects unknown arguments, including attempted account overrides.

See [Clerk setup](../apps/pecu/docs/mcp-auth-setup.md). The existing Clerk
instance has both Pecu scopes and the permitted Codex CIMD client configured.
The canonical resource is `https://pecu.app/mcp`.

## Execution and recovery

Each OAuth client receives a deterministic web thread under the verified
account. Direct tools share the web thread lock, wallet provisioning and
event deduplication. Requests store their argument fingerprint and result.
The caller can repeat a UUID `Idempotency-Key` with the same input; changing
the input while reusing the UUID fails.
If a write starts but its result is lost, a retry does not dispatch it again.
Check the action's current state before creating a new request. Interrupted
direct reads can recover; interrupted `run_tools` requests fail closed because
the script may already have changed data.

MCP marks every tool event preview-only. Existing YOLO settings cannot cause
an MCP call to sign or submit a transaction. The backend persists the same
plans and decoded transaction previews as chat, and the web/native Android
history can display them. The user confirms or cancels from the signed-in
Pecu thread. The MCP catalog provides no confirmation, YOLO or grant-approval
tool.

## Applied clients and providers

Pecu web and native Android use the existing thread, history and preview
contracts. X chat and both inference providers keep the same tool registration
and business dispatch. The Bee CLI, iMessage bridge and Expo Bee client are
separate products and do not consume the Pecu backend. No client-specific wire
contract changes are required. The standalone EVM and Aero SDKs are unchanged.

## Verification

Run `bun run --cwd apps/pecu verify:mcp`. The HTTP script drives the real
endpoint with the official modern and legacy clients. The backend script uses
the real agent, web history and SQLite with external-service fixtures. It
checks persisted previews, replay safety, scope checks and account isolation.
The third script starts an isolated local Cloudflare Workerd fixture and checks
the same HTTP transport and schemas with both official client versions.
The scripts use fixture OAuth verification and external services. They do not
perform a live OAuth login or send a financial transaction.

The agent backend, Stocks and site router are deployed. On 2026-10-02, a real
Codex Google sign-in completed consent for both Pecu scopes and the CIMD
callback. Codex discovered all 190 tools, exactly matching the shared catalog,
and called `wallet_address` successfully through the Pecu backend. The
resource-bound token passed the server's audience, revocation and permission
checks. The probe used no model turns and requested no transaction. This
verifies authenticated read access and completed write consent; no live write
operation or financial transaction was tested.
