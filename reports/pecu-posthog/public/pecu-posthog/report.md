# Pecu PostHog tracking

19 September 2026

Pecu now has pageviews, landing-link clicks, signed-in identity linking, agent message outcomes, and first-message wallet provisioning events. Web and X Chat share the backend instrumentation.

The unused Default project was renamed Pecu with Francesco's approval after PostHog rejected a new project because of the account's plan limit. Data goes to the EU region.

## LLM token usage and estimated cost

The agent now emits one AI generation event per primary model step, including tool loops and failed attempts. ChatGPT and OpenRouter events share hashed traces and conversation IDs. Durable log cursors prevent replaying older usage and preserve events across compaction.

Input includes cache tokens; output includes reasoning tokens. Both breakdowns are also recorded. Costs are explicitly labeled estimates: ChatGPT values represent API-equivalent usage, not subscription charges, and OpenRouter estimates are not invoice reconciliation. Missing/zero catalog pricing remains unknown unless PostHog can match a price. Auxiliary title/compaction calls and TypeSafe classifier usage are excluded.

346 tests passed, including harness failure isolation, cursor progression, fallback grouping, token accounting, and privacy. TypeScript and the Worker build passed. PostHog read back two synthetic events with 140 input, 50 output, 40 cached, and 30 reasoning tokens, each with the supplied $0.00123 test estimate and environment=verification. No real LLM call was made for this check. Exclude verification events from production cost reports.

[AI generations](https://eu.posthog.com/project/278624/ai-observability/generations) · [Manual AI capture](https://posthog.com/docs/ai-observability/installation/manual-capture)

## Original analytics verification

- 341 Pecu tests passed. Two Workerd tests needed a rerun outside the sandbox to bind localhost ports.
- Pecu, Stocks, and landing TypeScript checks passed. Worker, web, and landing builds passed.
- The bundled browser SDK passed transport, private-property redaction, account reset, and duplicate-pageview checks in Happy DOM. Bot filtering was disabled only in that verification environment.
- A synthetic backend SDK event was read back through the PostHog plugin with environment set to verification. It did not invoke the agent or create a wallet.
- Live Chrome navigation from the landing page to Agent returned HTTP 200 from PostHog. The plugin read back landing and Agent pageviews with clean URLs, including after a thread query appeared in the browser.
- Live landing navigation-click events were also read back from PostHog. Clicks use immediate fetch delivery because the verification browser blocks beacon requests. No browser settings were changed.
- No funds moved.

## Deployment

All three services were deployed to Francesco's personal Cloudflare account. The live landing analytics file matched the built file byte for byte, and the production CSP allows the EU endpoint.

## Data boundaries

Chat text, replies, emails, wallet addresses, transaction amounts, credentials, confirmation codes, private URL segments, and query strings are excluded. Session replay, automatic content capture, automatic exceptions, performance capture, and GeoIP enrichment are disabled. Signed-in identity uses a domain-prefixed SHA-256 sender digest; this is pseudonymous tracking.

Message completed means the handler saved a reply. It does not certify a transaction or model response. Wallet provisioned may mean an existing wallet was retrieved and cached. Delivery is best effort, not an accounting record.

## Scope

The Pecu Worker, Agent/Stocks web app, and landing site are affected. Bee mobile, Android, CLI, iMessage, voice, and Hive are separate products and were not changed. The Aero, EVM, and Codex container workers do not need updates.

Source changes remain uncommitted in BeeGreat. Run the browser check with `bun run --cwd apps/pecu/apps/stocks verify:analytics`.

[PostHog project](https://eu.posthog.com/project/278624/settings/project) · [SDK documentation](https://posthog.com/docs/libraries/cloudflare-workers)
