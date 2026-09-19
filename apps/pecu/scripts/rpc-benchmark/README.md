# Pecu RPC benchmark

Compare authenticated Alchemy and Chainstack Base endpoints using read-only requests.
No wallet, signing, transaction preparation or broadcast is involved.

Run with Bun and the workspace's locked dependencies installed:

```sh
bun apps/pecu/scripts/rpc-benchmark/run.mjs /private/tmp/providers.json /private/tmp/rpc-results
```

The private JSON input has `alchemy` and `chainstack` URL fields. Keep it outside
the repository with mode 0600. The runner never prints the URLs.

For Cloudflare measurements, deploy `worker.mjs` as a separate temporary Worker
in the personal Cloudflare account. Enable `nodejs_compat`, set a 120000 ms CPU
limit, and set `BENCHMARK_TOKEN` as a Worker secret. Do not deploy it over Pecu.
Then run:

```sh
bun apps/pecu/scripts/rpc-benchmark/run.mjs /private/tmp/providers.json /private/tmp/rpc-results https://YOUR-BENCHMARK.workers.dev /private/tmp/benchmark-token
```

The token file contains the same secret and must have mode 0600. Requests carry
provider URLs in the authenticated POST body, never in query strings. Only the
two Base provider hostnames are accepted. The Worker has no signing methods.
An optional `AERO` service binding enables a single bounded `production-pools`
check against the deployed Aero service. Delete the temporary Worker after use.

Each operation runs three rounds of ten measurements per provider. Two warmups
per RPC round are excluded. Providers alternate first position. Contract reads,
balances, logs and simulations use a shared recent block; log parity compares
standard event fields with stable key ordering. Block-number reads intentionally
use the moving chain tip. Concurrent samples time four simultaneous contract
reads, paced to stay below the free request limits. No transport retries are used.

The Aero case calls Pecu's actual pool handler with `limit: 5`, preserving its
cache and concurrency settings. It records one excluded first call per provider
and round. These first calls are not guaranteed cold across reused Worker isolates.

`samples.json` preserves measurements and correctness checks. `summary.json`
contains p50 and p95 of successful samples, counts and errors. Failed samples
are counted separately; any error or parity failure makes the runner exit 1.
Cloudflare results describe the recorded colo, not every user region or full
chat latency. Local Bun 1.4.2 can receive undecoded zstd responses from Chainstack;
the Cloudflare runtime did not exhibit that problem.
