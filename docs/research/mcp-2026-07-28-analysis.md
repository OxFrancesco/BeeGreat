# MCP 2026-07-28: implications for BeeGreat tools

Research date: 2026-08-09

## Decision

The new MCP revision materially improves MCP as a production boundary for
remote, reusable tool services. BeeGreat should adopt it selectively, not move
all tools behind MCP.

Recommended first pilot: expose the four GitHub/Linear/Notion Beennector
operations through a first-party, stateless MCP server while keeping Convex as
the credential, entitlement, and provider-operation authority. Keep the
existing direct path behind a feature flag during comparison.

Do not migrate Web3 execution/confirmation, Agent Jobs, `question`,
`current_time`, completion-ledger tools, or other Bee-runtime control tools yet.
The current Flue adapter does not provide the Bee-facing support needed to use
MCP Tasks or MRTR approval flows end to end.

## What changed in the specification

The July release is a generally available specification revision, accompanied
by updated Tier 1 SDKs. The official release post and normative changelog cover
these changes:

| Change | Consequence for a tool service |
| --- | --- |
| Stateless core | `initialize`, `initialized`, and `Mcp-Session-Id` are gone. Every request carries its version, client identity, and capabilities; any replica can handle it. Application state remains valid but must use explicit handles. |
| `server/discover` | Servers must advertise supported versions, identity, and capabilities. Calling discovery first is optional for clients. |
| Multi Round-Trip Requests (MRTR) | A server can return `input_required`; the client gathers elicitation/sampling/roots answers and retries the original request with `inputResponses`. No held-open bidirectional transport is needed. |
| Header routing | Streamable HTTP requests carry `Mcp-Method`, plus `Mcp-Name` for named operations. Gateways can route, meter, rate-limit, and observe calls without parsing JSON bodies. Servers still must verify header/body agreement and perform authorization. |
| Cacheable catalogs | Tool, prompt, and resource list results carry `ttlMs` and `cacheScope`; tool order should be deterministic. Private results must stay within the same authorization context. |
| Tasks extension | Long operations may return durable task handles, be polled with `tasks/get`, receive input through `tasks/update`, and be cancelled cooperatively. Tasks is optional and both sides must advertise support. |
| Authorization hardening | Issuer validation is required when `iss` is returned; credentials are issuer-bound; DCR must identify native versus web clients and is itself deprecated in favor of Client ID Metadata Documents. |
| Deprecations | New implementations should not adopt Roots, Sampling, Logging, legacy HTTP+SSE, or DCR. The protocol promises a minimum twelve-month deprecation window. |

Primary sources:

- [MCP 2026-07-28 release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Authoritative 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [Normative changelog from 2025-11-25](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [Versioning and compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview)

The release is breaking across the modern/legacy boundary. A modern-only client
does not automatically work with a legacy-only server. A dual-era client or
server must perform the documented probe/fallback behavior. Extensions such as
Tasks and MCP Apps remain separately negotiated; core MCP support does not imply
extension support.

## Why this is relevant to BeeGreat

BeeGreat already has an MCP client path:

- `@flue/runtime` is pinned to `2.0.3`, which pins
  `@modelcontextprotocol/client` `2.0.0`, the stable TypeScript line that
  implements the new revision ([package](../../packages/agent/package.json),
  [lockfile](../../bun.lock)).
- Firecrawl already uses `useMcpConnection`/`createMcpConnection`, discovers the
  provider's live tool catalog, and mounts those tools into an isolated crawler
  specialist ([agent mount](../../packages/agent/src/agents/bee.ts),
  [adapter](../../packages/agent/src/shared/firecrawl-subagent.ts)).
- Most first-party tools are already thin HTTP adapters over authenticated
  Convex routes. Beennectors is four tools over one broker endpoint, making it a
  natural boundary experiment
  ([specialist](../../packages/agent/src/shared/beennectors/subagent.ts),
  [broker](../../packages/backend/convex/http.ts)).
- BeeGreat's stateful domains already use explicit handles: bookmark IDs, Web3
  action IDs, Devin session IDs, Job IDs and run IDs. That matches the new MCP
  state model; business state can remain in Convex.

This means BeeGreat does not need a broad MCP client upgrade. The decision is
where a network/service contract improves ownership, reuse, scaling, or policy.

## Current Flue limitations

The MCP SDK dependency speaks the new protocol, but BeeGreat consumes it through
Flue's narrower tool adapter. Inspection of the pinned Flue implementation shows:

1. Tools declaring required MCP Task execution are rejected or skipped.
2. Flue constructs its MCP client without wiring an elicitation handler to
   BeeGreat's `question`/`beeui` flow. The underlying SDK can auto-run MRTR only
   when those handlers exist.
3. Flue discovers a catalog when it creates a connection and caches the adapted
   tool definitions for the agent instance. It does not expose a Bee-level
   refresh lifecycle based on list TTLs or `list_changed` notifications.
4. `useMcpConnection` is root-agent only. Giving MCP tools to an isolated
   subagent requires the same imperative discovery-and-mount pattern already
   used for Firecrawl.
5. MCP tool names are adapted to `mcp__<server>__<tool>`. Moving root tools
   would require tool-presentation aliases so machine names do not leak into the
   UI.

Therefore, stateless calls, version negotiation, structured schemas, ordinary
tool execution, required headers, and SDK-level caching are available now.
Tasks, Bee-native approvals through MRTR, live catalog refresh, and MCP Apps are
not available end to end in the current host.

## Candidate assessment

| Capability | Recommendation | Reason |
| --- | --- | --- |
| Firecrawl | Keep on MCP | It is a third-party, independently evolving catalog and already proves the specialist pattern. Add an allowlist if catalog growth starts consuming excessive context. |
| GitHub/Linear/Notion Beennectors | Pilot first | Four stable JSON tools, already one stateless broker, isolated in a specialist, and plausibly reusable by Bee, Codex, or other agents. Per-tool headers improve policy and observability. |
| Google Workspace | Keep current for now | Its guarded `gog` sandbox, short-lived injected credential, fixed safety profile, and redaction boundary are more important than protocol portability. |
| Imagine/FAL | Revisit after Tasks | Media generation can take minutes and would benefit from durable task handles, but today's Flue path would still hold the call open. |
| Devin | Revisit after Tasks or multi-host demand | Devin session IDs already form good explicit handles. MCP adds value mainly if several hosts need the same integration or Task support becomes usable. |
| Agent Jobs | Keep native | Convex already owns schedules, durable run ledgers, retries, signals, and approval state. MCP Tasks would duplicate rather than replace this control plane today. It may later be useful as an external projection of Jobs. |
| Web3/Sugar | Keep native | The server-authoritative two-phase confirmation gate is the security boundary. Header routing is attractive, but not enough to justify adding a new protocol surface before MRTR/Tasks and authorization are proven in Bee. If exposed later, expose read/quote/prepare/status—not confirmation or signing. |
| Mind/bookmarks, goals/tasks | Keep native unless another host needs them | They are Bee-owned, latency-sensitive domain commands with one caller and strong coupling to Convex/user experience. Portability benefit is currently small. |
| `question`, `current_time`, completion/wait tools | Never remote by default | These are host/control-plane tools coupled to the current conversation, delivery signal, user interface, or execution ledger. |
| Bee Sites/sandbox tools | Keep native | They depend on the current sandbox/workspace and runtime-owned resources. |

## Proposed Beennectors pilot

The pilot should be a first-party MCP facade, not direct use of each vendor's
hosted MCP server.

1. Keep encrypted provider credentials, refresh leases, ownership checks, and
   provider calls in Convex.
2. Expose the current list/search/get/comment contract as a deterministic
   four-tool MCP catalog. Preserve comment as an explicitly requested write and
   keep Notion read-only.
3. Authenticate each MCP request with a short-lived, audience-bound,
   user-scoped token. Derive the user from verified claims; do not make
   `userId` a model-authored argument. The current deployment-wide broker
   secret should not become the authorization model of an externally reusable
   MCP server.
4. Use `Mcp-Method`/`Mcp-Name` for observability and coarse WAF/rate-limit
   policy, while repeating entitlement, ownership, and operation checks inside
   the server.
5. Mark authenticated catalogs `cacheScope: "private"`, return a realistic
   TTL, and keep ordering stable.
6. Mount the discovered tools only inside the Beennectors specialist, using the
   proven Firecrawl pattern. Keep the root orchestrator's prompt surface small.
7. Run direct and MCP implementations behind a feature flag and compare
   correctness, cold-start behavior, p50/p95 latency, failure recovery, catalog
   stability, traces, and token/context cost before removing the direct path.
8. Test principal isolation, expired/revoked tokens, header/body mismatch,
   legacy/modern negotiation, malformed schemas/results, timeouts, retry
   idempotency, and the comment-write approval policy.

The pilot is successful only if it demonstrates reuse or materially better
governance/operations without harming latency or reliability. “It is standard”
is not sufficient by itself.

## Later gates

- Adopt MCP Tasks only after Flue advertises, returns, persists, polls, updates,
  and cancels task handles end to end. Keep a core synchronous/status-tool
  fallback because extension support varies across hosts.
- Adopt MRTR approvals only after Bee can render the request in web/mobile/
  iMessage, suspend safely, retry with integrity-protected `requestState`, and
  preserve the existing server-authoritative confirmation checks.
- Consider MCP Apps as a portability layer for rich third-party chat hosts, not
  as a replacement for BeeGreat's native `beeui` in its own clients.
- Serve a dual-era endpoint only if real consumers require legacy support;
  otherwise target `2026-07-28` and fail clearly.

## Selection rule

Move a tool family to MCP when at least two are true:

- more than one agent/host needs it;
- it has an independent deployment or ownership lifecycle;
- its catalog changes independently of Bee;
- centralized OAuth/scopes, rate limits, WAF policy, or audit are valuable;
- it is naturally addressed by explicit durable handles;
- it will benefit from a supported MCP extension.

Keep it native when it is host-privileged, UI/control-plane specific, used only
by Bee, exceptionally latency-sensitive, or safer because its authority remains
inside the current runtime boundary.

## Conclusion

MCP 2026-07-28 is now credible production infrastructure for BeeGreat's remote
integration layer. It should become the standard boundary for shareable
connector services, starting with Beennectors, while Flue tools remain the
standard boundary for Bee's own orchestration and tightly coupled domain
commands.
