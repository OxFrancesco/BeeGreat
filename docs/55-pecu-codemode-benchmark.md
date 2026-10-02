# Pecu Code Mode benchmark

On 2026-10-02, 40 live model-and-tool trials compared direct tool calls with
Pecu's installed `@opencode-ai/codemode@0.0.0-beta-18684` interpreter. Both used
`openai/gpt-6-sol` through OpenRouter with medium reasoning. Production was not
changed.

| Task | Direct median | Code Mode median | Correct answers per mode |
| --- | ---: | ---: | ---: |
| One read | 2.56 s | 2.45 s | 4/4 |
| Three parallel reads | 3.13 s | 2.66 s | 4/4 |
| Dependent research | 6.37 s | 6.27 s | 4/4 |
| 90-day calculation | 35.86 s | 7.04 s | 4/4 |
| One provider fails | 3.04 s | 3.42 s | 4/4 |

Code Mode made the calculation task about five times faster in this sample.
All four paired calculation runs improved by 75–81%. The smaller differences
on other tasks do not establish a general latency improvement. Both modes
already ran independent reads concurrently.

Both modes answered all 20 tasks correctly. The original strict scorer rejected
two Code Mode answers solely because chain names were lowercase. The report
separately records task accuracy with case-insensitive names and the original
strict scores, 20/20 direct and 18/20 Code Mode. Measurements and raw answers
were preserved.

Code Mode used 23.9% more input tokens and 79.8% fewer output tokens, including
provider-counted reasoning. In every calculation trial it first inspected the
full tool output, then fetched the three datasets again to compute the means.
That doubled data reads for those tasks. Across the suite, direct calls made
56 reads and Code Mode made 68. Neither mode had unexpected tool failures or
interpreter errors; the four failures per mode were deliberately injected.
Provider-reported cost was zero, so this is not evidence of a free run or actual
billing savings. The conservative token-based budget accounting was $0.68.

## Method and limits

The [runner](../apps/pecu/scripts/codemode-benchmark/README.md) captures public
DefiLlama data through Pecu's production `chainDataTool` implementation, then
replays identical strings using the production `chain_metric` and `chain_dexes`
schemas. Each mode runs four times per task, alternating order. Timings cover
the full isolated model-and-tool loop, excluding initial data capture. Expected
answers are calculated independently, with 0.1% numeric tolerance, exact day
counts, ordered results, required reads and explicit missing-data checks.

This uses a custom model loop, two tools and structured answers. It does not
exercise production OpenCode sessions, Pecu's full prompt/catalog, Cloudflare,
the ChatGPT subscription provider, wallet behavior or visible UI latency. No
artificial tool delay was added. Cache was uncontrolled and recorded; direct
calls had more cached input tokens. Four repetitions per task are exploratory.

Keep direct calls for simple requests. The evidence supports a selective
Code Mode implementation for calculations over larger datasets. Before a
production trial, describe tool output shapes, avoid duplicate reads, preserve
session/skill access controls and nested-call progress, and keep transaction
confirmation on its existing path. Then repeat through the deployed OpenCode
runtime on both provider routes.

## Evidence

Private report: https://documents.buddytools.org/pecu-codemode-20261002/

The report includes all prompts, expected answers, captured data, per-call
traces, cache/token usage and individual timings. Local artifacts are under
`output/pecu-codemode-20261002/`.

Client, entry-point, presentation, provider, contract and reverse-state changes
do not apply to this benchmark-only addition. No SDK source, deployment target,
wallet state, or production agent setting changed.
