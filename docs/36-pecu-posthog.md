# Pecu analytics

Pecu uses PostHog project 278624 in the EU region. The unused Default project was renamed to Pecu because the account plan prevented creating another project. The project token in `apps/pecu/src/analytics-config.ts` is a public ingestion token, not a personal API key.

| Event | Trigger | Properties |
| --- | --- | --- |
| `$pageview` | Landing page load or web route change | Normalized route, site/app |
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

The landing site and Stocks/Agent web root share browser tracking. The shared Pecu agent handler covers web and X Chat, including direct commands and model requests regardless of inference provider. Bee mobile, Android, CLI, iMessage, voice, and Hive are separate products and are not instrumented by this change. No EVM or Aero SDK code, wire contracts, transaction execution behavior, or persistent wallet identifiers changed.

Verify the bundled browser SDK with `bun run --cwd apps/pecu/apps/stocks verify:analytics`. This check uses Happy DOM with mocked transport and disables bot filtering only in that test.

Deploy the Pecu Worker, Stocks web app, and landing site together. The Aero, EVM, and Codex container workers do not need a deployment for this change.

References: [Cloudflare Workers integration](https://posthog.com/docs/libraries/cloudflare-workers), [browser configuration](https://posthog.com/docs/libraries/js/config), [property redaction](https://posthog.com/tutorials/web-redact-properties).

## LLM usage and estimated costs

The per-user inference Worker emits `$ai_generation` for each primary model step on ChatGPT and OpenRouter, including tool-loop steps and failed attempts that reach a terminal runtime event. The durable session log survives compaction; a per-session sequence cursor avoids replaying earlier telemetry. Fallback attempts share a trace. Conversation, trace, span, and sender identifiers are hashed before capture. Provider response-body duration excludes tool execution when that boundary is available.

Input totals include cache reads/writes. Output totals include reasoning. Cache and reasoning breakdowns are also sent, without counting them twice. Usage absent from a failed event stays absent. The runtime can normalize missing provider usage to zero on successful events; these are runtime-reported counts, not a billing ledger.

Costs are estimates, explicitly marked `cost_is_estimate=true`. Positive runtime catalog estimates populate `$ai_total_cost_usd`; missing/zero catalog prices are left for PostHog model-price matching and may remain unavailable. `cost_source` identifies the supplied estimate source. `billing` distinguishes `chatgpt_subscription` from `openrouter_api`: ChatGPT estimates are API-equivalent usage values, not subscription charges. Subscription fees, actual OpenRouter invoices, provider-internal retries without terminal usage, and auxiliary title/compaction calls are not billed or reconciled here. TypeSafe routing does not expose usage through Pecu's current classifier contract and is excluded.

No prompts, generated text, tool arguments/results, or provider error strings are captured. Telemetry errors cannot fail a response. Capture is best effort, not exactly-once accounting. Only the Pecu Worker needs redeployment for this extension.

Run package tests with `bun run --cwd apps/pecu test`. `bun run --cwd apps/pecu scripts/verify-inference-analytics.ts` submits two synthetic events labeled `environment=verification`; exclude that environment from production reports. It makes no model request or transaction.

Reference: [Manual AI capture](https://posthog.com/docs/ai-observability/installation/manual-capture), [cost calculation](https://posthog.com/docs/ai-observability/calculating-costs).
