# Firecrawl integration for BeeGreat

- Date: 2026-08-05
- Status: research complete; implementation not started
- Scope: current Firecrawl Cloud/API/MCP surface, recurring monitoring, and
  recommended BeeGreat integration boundaries
- Source snapshot: Firecrawl `b1371d2` (`v2.11.182`), Firecrawl MCP `5ac34e4`
  (`3.23.3`), and Firecrawl docs `b670095`

## Verdict

BeeGreat should add a built-in **Firecrawl specialist subagent** backed by the
Firecrawl Cloud v2 HTTP API and a server-side credential broker. Cloud is the
only documented way to obtain the complete requested surface: the open-source
edition includes the core scrape, crawl, map, search, batch, extract, JSON, and
change-tracking capabilities, but not Agent, Browser Sandbox, Actions,
enhanced proxies, or proxy rotation
([official comparison](https://docs.firecrawl.dev/contributing/open-source-or-cloud)).

The feature described as “check every once in a while if a page has changed”
is **Firecrawl Monitor**. It is different from the lower-level
`changeTracking` scrape format:

- `changeTracking` compares one scrape/crawl/batch result with the previous
  team-and-tag-scoped snapshot, but does not schedule the next run.
- Monitor owns recurring schedules, retained history, page/site/web targets,
  meaningful-change judging, and webhook/email/Slack notification
  ([change tracking](https://docs.firecrawl.dev/features/change-tracking),
  [monitoring](https://docs.firecrawl.dev/features/monitoring)).

Installing or copying only the official MCP toolset is not enough to satisfy
“all Firecrawl tools.” The current MCP server exposes 27 tools but omits the
batch-scrape lifecycle, several async cancellation/error operations, scrape
status, and standalone browser lifecycle. BeeGreat should use the official MCP
tool names and behavior as its agent-facing baseline, then add typed v2 REST
wrappers for the missing operations. The
[v2 OpenAPI contract](https://github.com/firecrawl/firecrawl-docs/blob/b670095b20b01d8e1330e7aa9b361778a0a812e4/api-reference/v2-openapi.json)
is the authoritative inventory.

## Current official MCP surface

At commit `5ac34e4`, `firecrawl-mcp` registers these 27 tools. This list comes
from the [official tool guide](https://docs.firecrawl.dev/mcp-server/tools) and
the exact registration sources for
[core tools](https://github.com/firecrawl/firecrawl-mcp-server/blob/5ac34e45f998bc4bd6cbea8946044c0ec0594871/src/index.ts),
[monitoring](https://github.com/firecrawl/firecrawl-mcp-server/blob/5ac34e45f998bc4bd6cbea8946044c0ec0594871/src/monitor.ts), and
[research](https://github.com/firecrawl/firecrawl-mcp-server/blob/5ac34e45f998bc4bd6cbea8946044c0ec0594871/src/research.ts).

| Group | Current tools | Behavior |
| --- | --- | --- |
| Page/site retrieval | `firecrawl_scrape`, `firecrawl_map`, `firecrawl_crawl`, `firecrawl_check_crawl_status` | Retrieve one page, discover URLs without bodies, collect a site, and re-read crawl state/results |
| Search | `firecrawl_search`, `firecrawl_developer_search` | General web/news/image/category search and a dedicated developer-source index |
| Structured/file data | `firecrawl_parse`, `firecrawl_extract` | Parse a local/non-public file or run LLM extraction |
| Autonomous research | `firecrawl_agent`, `firecrawl_agent_status` | Start an async Agent job and poll its status/result |
| Page interaction | `firecrawl_interact`, `firecrawl_interact_stop` | Open a URL or reuse a scrape browser session, act by prompt/code, and stop it |
| Academic/code research | `firecrawl_research_search_papers`, `firecrawl_research_inspect_paper`, `firecrawl_research_related_papers`, `firecrawl_research_read_paper`, `firecrawl_research_search_github` | Read-only literature, citation-graph, paper-content, and public-repository search |
| Recurring monitors | `firecrawl_monitor_create`, `firecrawl_monitor_list`, `firecrawl_monitor_get`, `firecrawl_monitor_update`, `firecrawl_monitor_run`, `firecrawl_monitor_delete`, `firecrawl_monitor_checks`, `firecrawl_monitor_check` | Full monitor configuration and check-result lifecycle |
| Feedback | `firecrawl_search_feedback`, `firecrawl_feedback` | Optional result/endpoint quality feedback; registration can be disabled |

The hosted MCP modes differ:

- account OAuth or API key: full MCP surface, still subject to plan and feature
  availability;
- keyless hosted: Search, Scrape, and Parse only, with a rolling network limit;
- local MCP plus cloud key: API-backed tools, but direct local-file Parse does
  not work;
- local MCP plus self-hosted API URL: only tools supported by the services in
  that deployment.

The local server requires Node 22 and the published package uses the Node SDK
([MCP package manifest](https://github.com/firecrawl/firecrawl-mcp-server/blob/5ac34e45f998bc4bd6cbea8946044c0ec0594871/package.json)).
BeeGreat should therefore not try to spawn the stdio MCP package inside its
Cloudflare agent worker. Direct REST calls through the existing Convex broker
fit the deployed runtime and security model better.

## Complete v2 capability surface relevant to the specialist

### Scrape

`POST /v2/scrape` retrieves one known URL synchronously; `GET /v2/scrape/{jobId}`
retrieves an async scrape. Supported output formats are
Markdown, summary, cleaned HTML, raw HTML, links, images, screenshot, JSON,
change tracking, branding, product, menu (private beta), audio, video,
question, and highlights. Options cover main-content filtering, inclusion and
exclusion tags, cache/freshness controls, headers, render waits, mobile mode,
TLS behavior, timeout, parsers, browser actions, location, ad blocking,
proxy mode, cache storage, cache-only lockdown, PII redaction, persistent
browser profiles, threat protection, and audit metadata
([Scrape guide](https://docs.firecrawl.dev/features/scrape),
[OpenAPI `ScrapeOptions`](https://github.com/firecrawl/firecrawl-docs/blob/b670095b20b01d8e1330e7aa9b361778a0a812e4/api-reference/v2-openapi.json)).

Important operational details:

- default `maxAge` is two days; set it to `0` for a fresh fetch;
- change tracking bypasses cache;
- screenshots expire after 24 hours and audio/video signed URLs after one hour;
- public PDFs and other public document URLs belong in Scrape, not Parse;
- browser Actions exist on Scrape, but Interact is now the recommended agent
  path for more reliable multi-step work.

### Batch scrape

Batch scrape runs the same scrape behavior over multiple known URLs. The full
async lifecycle is:

1. `POST /v2/batch/scrape` — start;
2. `GET /v2/batch/scrape/{id}` — status, paginated results;
3. `GET /v2/batch/scrape/{id}/errors` — per-URL errors;
4. `DELETE /v2/batch/scrape/{id}` — cancel.

It supports concurrency, invalid-URL handling, webhooks, and the normal scrape
formats/options. Results are directly retrievable for 24 hours after
completion
([Batch Scrape guide](https://docs.firecrawl.dev/features/batch-scrape),
[SDK lifecycle](https://github.com/firecrawl/firecrawl/blob/b1371d2fc1c2819304fac2a1be92c83ba24592a4/apps/js-sdk/firecrawl/src/v2/methods/batch.ts)).
None of these four operations is registered by the current MCP server.

### Crawl

Crawl is for multi-page site or section collection; Map is preferable when
only URLs are needed. The REST lifecycle includes start, status/results,
errors, cancel, list active crawls, and preview parameters generated from a
natural-language crawl prompt. Controls include included/excluded paths,
discovery depth, sitemap mode, subdomain/external-link behavior, URL
deduplication, concurrency, delay, and the full nested `scrapeOptions`
([Crawl guide](https://docs.firecrawl.dev/features/crawl),
[v2 routes](https://github.com/firecrawl/firecrawl/blob/b1371d2fc1c2819304fac2a1be92c83ba24592a4/apps/api/src/routes/v2.ts)).

Crawls are async and can be consumed through polling, WebSocket, or webhooks.
Status responses can carry a `next` URL when a response is incomplete or over
10 MB; callers must follow it until absent. Results remain directly
retrievable for 24 hours. The MCP `firecrawl_crawl` internally waits for a
result and `firecrawl_check_crawl_status` can revisit it, but MCP does not
expose cancel, errors, active crawls, or parameter preview.

### Map and Search

- Map synchronously discovers URLs under a site without fetching every page
  body. It supports a URL search term, sitemap policy, subdomains, query
  parameter handling, location, and a result limit. It is deliberately fast
  and may be less exhaustive than Crawl
  ([Map guide](https://docs.firecrawl.dev/features/map)).
- Search synchronously returns web, news, image, and specialized category
  results, optionally with each result scraped. It supports domain, location,
  language, time, and result-type filters. The current category surface
  includes GitHub, research, PDF, and developer results
  ([Search guide](https://docs.firecrawl.dev/features/search)).
- Dedicated developer and academic endpoints provide ranked source passages,
  paper metadata/content, similar papers, and repository results; the MCP
  server exposes these as the six developer/research tools listed above.

### Parse, Extract, and Agent

- Parse uploads a local or otherwise non-public HTML, PDF, office, or
  spreadsheet document up to 50 MB. Hosted MCP cannot read a caller's file, so
  it uses a two-call signed-upload handoff; public document URLs should use
  Scrape
  ([Parse guide](https://docs.firecrawl.dev/features/parse)).
- Extract is an async, structured LLM extraction over provided URLs (including
  wildcard domains), optionally expanding with web search. It remains
  implemented as start/status, but Firecrawl recommends Agent as its successor
  ([extractor decision guide](https://docs.firecrawl.dev/developer-guides/usage-guides/choosing-the-data-extractor),
  [Extract guide](https://docs.firecrawl.dev/features/extract)).
- Agent performs autonomous search, navigation, and structured gathering. It
  requires a prompt and optionally accepts URLs, a JSON schema,
  `spark-1-mini`/`spark-1-pro`, and `maxCredits`. Its lifecycle is start,
  status, and cooperative cancel. States are `processing`, `completed`,
  `failed`, and `cancelled`; completed results remain directly retrievable for
  24 hours
  ([Agent guide](https://docs.firecrawl.dev/features/agent),
  [Agent SDK lifecycle](https://github.com/firecrawl/firecrawl/blob/b1371d2fc1c2819304fac2a1be92c83ba24592a4/apps/js-sdk/firecrawl/src/v2/methods/agent.ts)).

The specialist should prefer Scrape for one known page, Batch for many known
pages, Map for URL discovery, Crawl for a whole site, Search when the source is
unknown, and Agent only for complex autonomous multi-source work. That routing
both reduces cost and keeps output inside the subagent's context rather than
Bee's main conversation.

### Interact and standalone Browser Sandbox

There are two browser lifecycles:

| Need | Lifecycle | Recommendation |
| --- | --- | --- |
| Continue a page already scraped | `POST /v2/scrape/{scrapeId}/interact`, then `DELETE` the same path | Preferred agent/MCP path |
| Standalone sandbox/CDP/live view/profile | `POST /v2/interact`, `GET /v2/interact`, `POST /v2/interact/{sessionId}/execute`, `DELETE /v2/interact/{sessionId}` | API/SDK-only advanced path |

Both support prompting or Node/Python/Bash execution; Bash includes
`agent-browser`. Sessions return CDP, live-view, and interactive-live-view URLs
and support persistent profiles. Default maximum lifetime is 10 minutes and
default idle lifetime is 5 minutes. Explicitly close every session so profiles
save and billing stops
([Interact guide](https://docs.firecrawl.dev/features/interact),
[Browser guide](https://docs.firecrawl.dev/features/browser)).

The former `firecrawl_browser_*` MCP tools are deprecated and no longer
registered. Current MCP exposes only `firecrawl_interact` and
`firecrawl_interact_stop`; standalone Browser Sandbox remains a current v2
API/SDK product surface.

## Recurring monitoring and page changes

Monitor accepts one to 50 targets, which may mix:

| Target | Check behavior |
| --- | --- |
| `scrape` | Re-scrape one or more known URLs and diff them |
| `crawl` | Crawl a site and detect new, changed, removed, same, or errored pages |
| `search` | Re-run queries and report newly discovered canonical URLs across the web |

Schedules accept cron or natural language such as `every 30 minutes`,
`hourly`, or `daily at 9am`, with a minimum interval of five minutes and an
explicit timezone. Retention defaults to 30 days and can be set as high as 365
days. A manual run endpoint is available in addition to the schedule
([Monitoring guide](https://docs.firecrawl.dev/features/monitoring)).

Page and crawl targets diff Markdown by default. Adding `changeTracking` with
`modes: ["json"]` produces field-level `{ previous, current }` differences
against a JSON schema or extraction prompt. Mixed mode requests both JSON and
`git-diff`. A plain-language `goal` plus `judgeEnabled` classifies whether each
changed page is meaningful, with confidence, reason, and meaningful changes.
Search targets discover new results rather than diffing known content.

Monitor operations are create, list, get, update/pause, delete, run now, list
checks, and get check detail. Check states are `queued`, `running`,
`completed`, `failed`, `partial`, and `skipped_overlap`; page states are
`same`, `new`, `changed`, `removed`, and `error`. Check detail is paginated and
contains estimated/final credit use, summary counts, inline diffs, and JSON
snapshots when requested.

The correct BeeGreat default for “watch this page” is therefore:

1. create a `scrape` monitor with `maxAge: 0`;
2. require an explicit timezone and let Firecrawl normalize the schedule;
3. include a concise `goal` only when the user wants meaningful-change
   filtering;
4. configure both `monitor.page` and `monitor.check.completed` webhooks;
5. let the specialist inspect check history/diffs on demand.

Do not create a Convex cron per user page. Firecrawl owns the recurrence;
Convex only needs a reconciliation watchdog for missed webhook delivery.

## Webhooks and async jobs

Firecrawl can push these event families
([overview](https://docs.firecrawl.dev/webhooks/overview),
[event reference](https://docs.firecrawl.dev/webhooks/events)):

| Operation | Events |
| --- | --- |
| Crawl | `started`, `page`, `completed` |
| Batch scrape | `started`, `page`, `completed` |
| Extract | `started`, `completed`, `failed` |
| Agent | `started`, `action`, `completed`, `failed`, `cancelled` |
| Monitor | `monitor.page`, `monitor.check.completed` |

The endpoint must be HTTPS and return `2xx` within 10 seconds. Failed
deliveries retry after 1, 5, and 15 minutes, then stop. Every request carries
`X-Firecrawl-Signature`; verify its HMAC-SHA256 over the exact raw request body
with a timing-safe comparison before parsing or enqueuing
([webhook security](https://docs.firecrawl.dev/webhooks/security)).

For BeeGreat, the webhook should verify, durably deduplicate, enqueue internal
work, and acknowledge before running any agent. A background reconciliation
job should poll non-terminal Firecrawl jobs and monitor checks in case all
webhook attempts fail. Persist the user ownership and the output BeeGreat must
retain; Firecrawl's direct job-result window is only 24 hours for batch, crawl,
extract, and Agent jobs.

## Cloud and self-hosting differences

Firecrawl's official comparison is unambiguous:

| Capability | Open source | Cloud |
| --- | --- | --- |
| Scrape, crawl, map, search, batch, extract | Yes | Yes |
| JSON/LLM-ready formats and change tracking | Yes | Yes |
| Agent, Browser Sandbox, Actions | No | Yes |
| Enhanced proxies and rotation | No | Yes |
| Dashboard and enterprise controls | No | Yes |

Self-hosting also requires the operator to provide the components that Cloud
manages. In particular, AI formats/extract need an OpenAI-compatible or
experimental Ollama provider; search uses Google by default or a configured
SearXNG endpoint; Fire-engine anti-block/robot handling is unavailable; and
local webhook targets require `ALLOW_LOCAL_WEBHOOKS`. Product and menu formats
require their dedicated extraction services. API keys are optional only when
self-host authentication is disabled
([self-host guide](https://docs.firecrawl.dev/contributing/self-host),
[repository guide](https://github.com/firecrawl/firecrawl/blob/b1371d2fc1c2819304fac2a1be92c83ba24592a4/SELF_HOST.md),
[menu notes](https://docs.firecrawl.dev/features/menu)).

BeeGreat should integrate Cloud now. It is what the Doppler API key addresses,
and it avoids advertising Agent/browser/actions that a default self-host cannot
provide.

## Recommended BeeGreat architecture

```text
User
  -> Bee orchestrator
  -> Firecrawl specialist subagent (all web tools isolated here)
  -> authenticated Bee worker -> Convex internal Firecrawl broker
  -> Firecrawl Cloud v2 API

Firecrawl webhook
  -> public Convex HTTP action (raw-body HMAC + dedupe)
  -> per-user Firecrawl job/monitor ledger
  -> notification / agent follow-up path
```

This matches the current codebase:

- `packages/agent/src/agents/bee.ts` already mounts built-in and opt-in Flue
  subagents while keeping specialist tools out of Bee's main prompt.
- `packages/agent/src/shared/imagine-subagent.ts` and
  `shared/powerups/devin.ts` are the closest tool/broker patterns.
- `packages/backend/convex/http.ts` already has authenticated internal routes
  for the Worker and public webhook routes.
- `packages/backend/convex/crons.ts` already uses watchdog jobs for durable
  external workflows.

Recommended boundaries:

1. Add Firecrawl as a **built-in specialist**, not an opt-in power-up, because
   live web retrieval is general agent infrastructure and the request is to
   make the full surface available. The large schema/tool set remains isolated
   in the subagent rather than consuming Bee's main context.
2. Keep `FIRECRAWL_API_KEY` only in the Convex server environment. The agent,
   browser/mobile apps, Flue prompt, tool inputs, outputs, and logs must never
   receive it. Fetch it from Doppler during deployment/configuration; never
   commit the resolved value.
3. Use direct `fetch` against `/v2` in a small Convex Firecrawl client instead
   of embedding the Node-22 MCP server. Validate response shape, exact API
   origin, redirect behavior, timeouts, response-size limits, and pagination.
4. Add a per-user job/monitor ledger. One Firecrawl API key is team scoped, so
   upstream list/status endpoints can otherwise expose another BeeGreat user's
   monitor, browser, job, or result. Every opaque Firecrawl id must be claimed
   by the initiating Clerk user before later inspect/update/cancel/delete.
5. Treat browser code, forms, profile mutation, Agent starts, crawls, batch
   jobs, monitor creation, and meaningful-change judging as billable/open-world
   actions. Give every start tool an explicit limit (`limit`, `maxCredits`, URL
   count, crawl depth, or browser TTL). Destructive cancel/delete and actions
   that submit or publish require explicit user intent.
6. Add a public Firecrawl webhook route using a separate
   `FIRECRAWL_WEBHOOK_SECRET`, verify raw-body HMAC, deduplicate event ids, and
   acknowledge within 10 seconds. Store only normalized results and correlation
   metadata, never arbitrary provider payloads or page content in logs.
7. Stop browser/interact sessions in `finally`, redact CDP/profile URLs from
   Sentry and normal tool narration, and never let machine ids reach user-facing
   copy. A user-facing live view should be an explicit UI capability, not raw
   model prose.

## Agent-facing tool inventory to implement

Preserve the official 27 MCP names above, then add the API operations MCP omits:

| Additional tool | v2 operation |
| --- | --- |
| `firecrawl_scrape_status` | `GET /scrape/{jobId}` |
| `firecrawl_batch_scrape` | `POST /batch/scrape` |
| `firecrawl_batch_scrape_status` | `GET /batch/scrape/{id}` |
| `firecrawl_batch_scrape_errors` | `GET /batch/scrape/{id}/errors` |
| `firecrawl_batch_scrape_cancel` | `DELETE /batch/scrape/{id}` |
| `firecrawl_crawl_errors` | `GET /crawl/{id}/errors` |
| `firecrawl_crawl_cancel` | `DELETE /crawl/{id}` |
| `firecrawl_crawl_active` | `GET /crawl/active`, filtered through BeeGreat's ownership ledger |
| `firecrawl_crawl_params_preview` | `POST /crawl/params-preview` |
| `firecrawl_extract_status` | `GET /extract/{id}` |
| `firecrawl_agent_cancel` | `DELETE /agent/{jobId}` |
| `firecrawl_browser_create` | `POST /interact` |
| `firecrawl_browser_list` | `GET /interact`, filtered through BeeGreat's ownership ledger |
| `firecrawl_browser_execute` | `POST /interact/{sessionId}/execute` |
| `firecrawl_browser_delete` | `DELETE /interact/{sessionId}` |

Do not expose team-wide credit history, token history, activity logs, queue
status, threat-policy mutation, or support endpoints to the general web
specialist. They are account-administration/control-plane APIs, not crawling
tools, and a shared Firecrawl team key makes them cross-user by default. A
separate admin-only budget view can be added later.

The specialist instructions should route simple requests to the cheapest
specific operation, use structured JSON when it avoids excessive context,
return source URLs and compact evidence, preserve job ids internally for
follow-up, poll only when useful, and never report completion before a
terminal provider state.

## Delivery sequence and acceptance gates

1. Credential smoke test from the Convex deployment: Scrape one benign URL and
   read team credit status without logging the key.
2. Build the typed Cloud client and per-user ownership ledger; cover all async
   start/status/error/cancel paths before mounting tools.
3. Add the specialist with Scrape, Map, Search, Parse, Batch, and Crawl; verify
   output-size limits and source preservation.
4. Add Extract and Agent with explicit credit ceilings, durable status, cancel,
   webhook handling, and 24-hour-result reconciliation.
5. Add Monitor create/manage/check tools and prove a five-minute test monitor
   delivers a signed page event and a signed completion event exactly once to
   the correct user.
6. Add Interact, then standalone Browser only after session cleanup,
   state-changing-action policy, profile ownership, and signed-URL redaction
   tests exist.
7. Add specialized developer/academic search and optional feedback tools.

The integration is complete when Bee can delegate every tool above without the
main Bee receiving the provider credential, two users cannot inspect or mutate
one another's jobs/monitors/sessions, retries cannot create duplicate work,
long jobs survive agent/Worker restarts, recurring checks notify the correct
user, browser sessions are always closed, and no API key, webhook secret, CDP
URL, raw machine id, or scraped sensitive content appears in logs or ordinary
user-facing narration.
