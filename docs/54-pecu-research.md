# Pecu research

`@research CHAIN [1d|7d|30d]` asks Pecu why a chain moved. Four specialist
agents read chain metrics, protocol data, Nansen flows and posts on X, and an
editor writes a report that names each move, its mechanism, its catalyst, how
much of the move it explains, and the evidence. The report lands in the chat
that asked, at `pecu.app/researches/CODE`, in the Android research sheet, and
can be pulled into OnChain-Reports as a dither deck.

## Commands

| Message | Result |
| --- | --- |
| `@research base` | Starts a 7-day run for Base. `/research base` is the same. |
| `@research solana 30d` | Window `1d`, `7d` or `30d` (`24h`, `week`, `month` also parse). |
| `@research` or `/researches` | Lists the sender's runs and the runs left today. |
| `@research status CODE` or `@research CODE` | Progress, or the headline and link when done. A bare code must be in capitals. |
| `@research cancel CODE` | Stops a running run. A run cancelled before it started is free. |
| `@research delete CODE` | Removes a finished report. It still counts toward the day's limit. |

The chat model has `research_start`, `research_list`, `research_get` and
`research_cancel` (skill `research`), so "research why Base moved this week"
works too. Parsing lives in `src/domain.ts`; replies in `src/research/control.ts`.

## Chains

Curated profiles live in `apps/pecu/researches/chains/*.md`: DefiLlama name,
growthepie key, Nansen chain, price coins for context, and the X accounts
worth reading (ecosystem account, founders, the main protocols). Any other
chain DefiLlama knows resolves to a generic profile with no accounts. growthepie
covers EVM L2s and Ethereum; chains without it lose transaction and address
metrics, and the report says so. The flow specialist is skipped on chains
Nansen does not cover.

## Pipeline

`ResearchRunner` (`src/research/runner.ts`) moves a run through
`queued → collecting → researching → synthesizing → completed`, with `failed`
and `cancelled` as exits. State is in `basedbot_research_runs` and
`basedbot_research_stages` in the main Durable Object.

1. **Collect.** A disposable `UserInference` instance keyed `research:RUN:collect:N`
   builds the evidence pack (`src/integrations/chain-data.ts`): every headline
   metric as a daily series for the window and the window before, the change on
   the file's own basis (levels compare the last day with the day before the
   window, flows compare sums, averages compare means), missing days left
   missing, event days ranked by their move against the prior daily average,
   protocol TVL movers (curators whose TVL is also inside other protocols are
   marked double counted and not ranked), DEX, fee and revenue movers, stablecoin
   issuers, context prices, and DefiLlama profiles of the biggest movers with
   their X handles and dated event notes. DefiLlama 429 and 5xx responses are
   retried twice.
2. **Specialists.** Capital, Activity, Flows and Narrative each run in their own
   runtime (`research:RUN:ROLE:ATTEMPT`) on the operator's OpenRouter key, with
   the pack as their brief and only their role's tools
   (`apps/pecu/researches/agents/*/SKILL.md`, compiled by `bun run skills:build`
   into `src/research-agents.generated.json`). Each has a tool-call budget and
   submits structured findings with `research_findings`. They start 8 seconds
   apart so four OpenCode runtimes do not boot in the same second. A failed
   specialist is retried once; the run continues without it if it fails again.
3. **Editor.** The synthesis agent gets the pack and every specialist's findings
   and submits the report with `research_report`: headline, summary, causes
   (movement, mechanism, drivers, catalyst, how much it explains, evidence,
   confidence), timeline, actors, what is still unexplained, and dates to watch.
4. **Deliver.** `renderMarkdown` writes the report with the metric table, the
   causes, the timeline, protocol and issuer tables, specialist notes and every
   source URL. X Chat gets the headline, summary and top three causes as plain
   text; web threads get a research row; the notification feed and Android push
   get a `research:CODE` alert. Reports built on Nansen data end with
   `Data: Nansen (nansen.ai)`.

A run interrupted by an eviction or deploy resumes on the next sweep (cron,
XChat alarm, or boot): running stages reset and rerun in a fresh runtime. Queued
runs that wait six hours fail. Two runs advance at a time across all users.

## Limits and cost

Each sender may start `RESEARCH_DAILY_LIMIT` runs per UTC day (default 3), and
all senders together `RESEARCH_GLOBAL_DAILY_LIMIT` (default 40). One sender has
at most one active run. Failed runs and runs cancelled before they started do
not count. A measured Base 7-day run on 30 Sep 2026 took 6.2 minutes, 82
tool calls and $0.92 of OpenRouter credit, plus twitterapi.io and Nansen calls.

## X data

`src/integrations/twitter.ts` wraps all 34 twitterapi.io read endpoints as
`twitter_*` tools (skill `twitter` in chat, the Narrative specialist in
research): profiles, timelines, mentions, followers and followings, relationship
checks, tweets by ID, replies, quotes, retweeters, thread context, advanced and
bulk search with `since`/`until` dates, trends, Spaces, lists, communities and
the account's credit balance. Each endpoint keeps the provider's own parameter
casing. Responses keep text, author, UTC time, links, mentions, cashtags and
engagement and drop pictures and entity blobs; pages over 28,000 characters are
cut from the end and marked `truncated`. Write endpoints need account cookies and
a proxy and are not wired. `TWITTERAPI_IO_KEY` is a Cloudflare secret.

## Surfaces

| Surface | Research |
| --- | --- |
| X Chat | `@research` commands and natural language; completion reply in the same DM. |
| Web | `/researches` (start form, list) and `/researches/CODE` (stages while running, then the report). Account menu and profile rail link to it. |
| Android | Research sheet from the account menu; `pecu://researches?code=CODE` deep link from pushes. |
| OnChain-Reports | `PECU_ADMIN_TOKEN=… bun scripts/pull-research.js CODE` in `dither-reports/` writes the source file, report and a two-slide deck (why it moved, what happened when). |
| Operator | `GET /admin/research/CODE` returns the report, findings, pack and the source export. |

## Verification

`bun test tests/research.test.ts tests/chain-data.test.ts tests/twitter.test.ts`
covers the pipeline with fakes. `bun scripts/probe-research.ts base 7d` runs a
real run in local workerd with the production store, runner and inference
runtimes and reports minutes and OpenRouter spend; it needs `OPENROUTER_API_KEY`
and `TWITTERAPI_IO_KEY`.
