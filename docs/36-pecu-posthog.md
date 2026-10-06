# Pecu analytics

Pecu uses PostHog project 278624 in the EU region. The unused Default project was renamed to Pecu because the account plan prevented creating another project. The project token in `apps/pecu/src/analytics-config.ts` is a public ingestion token, not a personal API key.

| Event | Trigger | Properties |
| --- | --- | --- |
| `$pageview` | Public page load or web route change | Public documentation path or redacted app route; site/docs/app/other |
| `pecu_navigation_clicked` | Landing links to agent, X Chat, Stocks, Aero CLI/docs, or evmSDK | Fixed destination name |
| `$identify` | Signed-in web account | Hashed sender ID, anonymous ID |
| `pecu_message_received` | Shared agent claims a new message | web/x channel |
| `pecu_message_completed` | Shared agent saves a reply | channel, duration in milliseconds |
| `pecu_message_failed` | Shared agent catches an error and saves its error reply | channel, duration in milliseconds |
| `pecu_wallet_provisioned` | First-message wallet lookup/creation succeeds | No wallet details |

Completed means the handler returned a reply. It does not mean a transaction succeeded or that model output was correct. Provisioned can mean an existing Crossmint wallet was retrieved and cached. Replayed completed messages and busy claims emit no new events. Delivery is best effort; it is not a financial ledger.

Browser tracking runs only on `pecu.app`. The landing build bundles the SDK locally, and its CSP allows connections only to the EU ingestion endpoint. Browser events use an allowlist of properties, strip query strings, hashes, dynamic paths, referrers, and person metadata, and disable autocapture, replay, exceptions, performance capture, surveys, and feature flag requests. Browser Do Not Track is respected and GeoIP enrichment is disabled. Link clicks use immediate SDK fetch delivery so they are not left in the page queue during navigation. Account changes reset the anonymous identity before identifying the next user.

Web and X use a SHA-256 digest of the same domain-prefixed sender ID. This is pseudonymous tracking, not anonymization. No chat text, replies, emails, wallet addresses, transaction amounts, confirmation codes, credentials, or provider error messages are sent.

The Worker uses `POSTHOG_ENABLED=true` in its production Wrangler configuration and drains each SDK client through Durable Object `waitUntil`. Set `POSTHOG_ENABLED=false` in `.dev.vars` for local Worker runs or in the deployed configuration to disable backend capture. The `.env.example` default is false. Browser tracking is disabled on localhost and preview hostnames.

## Coverage

The landing site, documentation, public showcases, SDK landing pages at pecu.app, and Stocks/Agent web root share browser tracking. Public pages use `surface=site`, documentation uses `docs`, and Stocks, Agent, Profile, and Researches use `app`. Unknown routes use `other`. SDK tracking is injected by the Pecu gateway, not into the standalone SDK sites.

Known documentation pages retain their full public path, such as `/docs/pecu/security`. The allowlist is generated from the documentation filenames by `scripts/build-analytics-pages.ts` before either browser build. Both browser typechecks reject a stale allowlist. Unknown documentation suffixes fall back to their product root; private app routes still collapse to `/agent`, `/profile`, `/stocks`, or `/researches`. Queries and fragments remain excluded. Historical events retain their old buckets and surface labels; compare detailed page reports from the October 6, 2026 release onward.

The shared Pecu agent handler covers web and X Chat, including direct commands and model requests regardless of inference provider. Bee mobile, Android, CLI, iMessage, voice, and Hive are separate products and are not instrumented by this change. No EVM or Aero SDK code, wire contracts, transaction execution behavior, or persistent wallet identifiers changed.

Verify the bundled browser SDK with `bun run --cwd apps/pecu/apps/stocks verify:analytics`. This check uses Happy DOM with mocked transport and disables bot filtering only in that test.

For browser path coverage, bundle `apps/pecu/apps/stocks/scripts/verify-page-reporting.browser.ts`
with Bun's browser target and IIFE format, then evaluate it in an isolated
`pecu.app` tab. Read `globalThis.pecuPageReportingResult`. It exercises every public
docs path, site and private app routes, deduplication, and query/fragment redaction.
The harness returns `null` after the real `before_send` sanitizer to discard every
event before transport and uses a separate consent prefix.

An initial October 6 verification run accidentally ingested 68 pageviews at
05:08:24 UTC under distinct ID `01a10f9c-eb41-7bfa-aea4-3d9aaa66492a`.
Every saved Pecu dashboard insight excludes that ID. Raw event queries must also
exclude it; the historical events were not deleted or rewritten.

Deploy the Pecu Worker, Stocks web app, and landing site together when changing shared event capture. The October 6 page-reporting change only requires the Stocks web app and landing site. The Aero, EVM, and Codex container workers do not need a deployment for browser-only changes.

## Search visibility

Use [Search Console performance](https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fpecu.app%2F) for Google impressions, clicks, and queries, and [Page indexing](https://search.google.com/search-console/index?resource_id=https%3A%2F%2Fpecu.app%2F) for indexed-page counts and exclusions. PostHog measures recorded visits after arrival. Compare the same dates and canonical page paths in both tools; their totals measure different things and need not match. Referrer and campaign capture remain disabled.

On October 6, 2026, the authenticated [Sitemaps report](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fpecu.app%2F) showed `Success`, 63 discovered pages, and a last read of October 4. Both performance and page indexing still showed `Processing data, please check again in a day or so`. These are pending reports, not zero clicks or zero indexed pages. Once available, compare consecutive complete seven-day periods and record the top queries/pages, clicks, impressions, click-through rate, and indexing exclusions alongside PostHog site/docs/app visits.

References: [Cloudflare Workers integration](https://posthog.com/docs/libraries/cloudflare-workers), [browser configuration](https://posthog.com/docs/libraries/js/config), [property redaction](https://posthog.com/tutorials/web-redact-properties).

## LLM usage and estimated costs

The per-user inference Worker emits `$ai_generation` for each primary model step on ChatGPT and OpenRouter, including tool-loop steps and failed attempts that reach a terminal runtime event. The durable session log survives compaction; a per-session sequence cursor avoids replaying earlier telemetry. Fallback attempts share a trace. Conversation, trace, span, and sender identifiers are hashed before capture. Model latency runs from the outbound HTTP request through response streaming, excluding tool execution. The HTTP start is persisted in the inference Durable Object and matched to its session, provider, model and step. Retries in the step include their waits. `latency_source=http_request` identifies these measurements; `stream_only` identifies records with no matching request timing and must not be treated as full request latency. `stream_duration_ms` reports streaming separately. `$ai_time_to_first_token` measures the first runtime stream event. Original start timestamps are preserved rather than replaced by the end-of-turn delivery time. Tool calls emit `$ai_span` with duration, tool name and error status under the same hashed trace and generation parent. Arguments, output and error text remain excluded.

Input totals include cache reads/writes. Output totals include reasoning. Cache and reasoning breakdowns are also sent, without counting them twice. Usage absent from a failed event stays absent. The runtime can normalize missing provider usage to zero on successful events; these are runtime-reported counts, not a billing ledger.

Costs are estimates, explicitly marked `cost_is_estimate=true`. Positive runtime catalog estimates populate `$ai_total_cost_usd`; missing/zero catalog prices are left for PostHog model-price matching and may remain unavailable. `cost_source` identifies the supplied estimate source. `billing` distinguishes `chatgpt_subscription` from `openrouter_api`: ChatGPT estimates are API-equivalent usage values, not subscription charges. Subscription fees, actual OpenRouter invoices, provider-internal retries without terminal usage, and auxiliary title/compaction calls are not billed or reconciled here. TypeSafe routing does not expose usage through Pecu's current classifier contract and is excluded.

No prompts, generated text, tool arguments/results, or provider error strings are captured. Telemetry errors cannot fail a response. Capture is best effort, not exactly-once accounting. Only the Pecu Worker needs redeployment for this extension.

Run package tests with `bun run --cwd apps/pecu test`. `bun run --cwd apps/pecu scripts/verify-inference-analytics.ts` submits two synthetic events labeled `environment=verification`; exclude that environment from production reports. It makes no model request or transaction.

Reference: [Manual AI capture](https://posthog.com/docs/ai-observability/installation/manual-capture), [cost calculation](https://posthog.com/docs/ai-observability/calculating-costs).


Tool spans also report `output_bytes` before runtime truncation,
`returned_output_bytes`, and `output_truncated`. Polymarket spans include
`source_output_bytes` before compact presentation and `output_partial` for explicitly
omitted model-facing fields. These booleans distinguish a successful API call from a
complete usable tool response. Only sizes and flags are captured, never output text
or omitted field paths.
