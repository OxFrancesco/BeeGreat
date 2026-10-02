# Pecu Code Mode comparison

Runs live OpenRouter completions through a direct-tool loop or the installed
OpenCode Code Mode interpreter. Both use Pecu's `chain_metric` and `chain_dexes`
schemas and the same captured production tool responses from public DefiLlama
reads. Nothing signs, prepares a transaction, or changes the deployed agent.

```sh
bun apps/pecu/scripts/codemode-benchmark/run.ts /tmp/pecu-codemode-run 4
bun apps/pecu/scripts/codemode-benchmark/report.ts /tmp/pecu-codemode-run /tmp/pecu-codemode-report
```

The runner reads `OPENROUTER_API_KEY` from the environment or Pecu's existing
`.dev.vars`; credentials are never written into the evidence. Use a new output
directory for each run. It persists every completed trial before continuing.

- `PECU_BENCH_SNAPSHOT=/path/snapshot.json` reuses captured public outputs.
- `PECU_BENCH_MODEL` and `PECU_BENCH_EFFORT` override Pecu's default fallback model.
- `PECU_BENCH_CASES=single-read,large-aggregation` selects tasks.
- `PECU_BENCH_BUDGET_USD=5` sets the between-request spending guard. One in-flight
  request may exceed the remaining budget. Accounting uses the greater of
  provider cost and uncached estimates of $2/M input and $10/M output tokens;
  override-model prices can differ. Runs also have step, tool and time limits.

Five tasks cover one read, parallel reads, dependent research, arithmetic over
90 daily values per chain, and a deliberately failed provider. Both modes may
parallelize. Order alternates across tasks and repetitions. There are no
simulated network delays. Answers are checked against independent calculations,
including missing data, ordering, exact day counts and 0.1% numeric tolerance.

This tests a custom isolated model loop, not the production OpenCode session
runtime, Pecu's full prompts/catalog, Cloudflare, subscription inference,
transaction behavior, or visible UI performance. Capturing the data happens
outside timed runs. Provider cache and load are uncontrolled. Small samples
are exploratory. Read the traces before interpreting a faster answer as better.

The pilot, if any, is separate from the scored run. Do not change prompts or
grading midway through a scored run. Keep failed trials in the report.
