# Pecu Chainstack rollout

On September 19, 2026, Pecu's production Aero worker moved to Chainstack's free
Base endpoint. Its deployed code was preserved. The existing `ALCHEMY_RPC_URL`
secret now contains the Chainstack URL on `basedbot-aero` only.

The main worker retains Alchemy for smart-wallet receipt verification, including
old blocks. The EVM container retains Alchemy for historical reads and because
local Bun 1.4.2 received undecoded zstd responses from Chainstack. Explicit
`Accept-Encoding: gzip, deflate` or `identity` resolved the isolated local probe;
the EVM container has not yet been changed or validated with that workaround.

Chainstack Free rejected historical state with HTTP 403. Current-state calls and
`eth_simulateV1` worked. Do not remove Alchemy or route historical queries through
the free Chainstack endpoint without preserving archive access.

## Measurements

An isolated Cloudflare Worker in FCO compared the account endpoints. Thirty
samples per provider and operation, in three rounds, excluded warmups. The table
shows median / p95 milliseconds. All 360 measured samples passed. The concurrent
case represents four RPC calls per sample.

| Operation | Alchemy | Chainstack |
| --- | ---: | ---: |
| Block number | 118 / 178 | 34 / 37 |
| Balance | 118 / 120 | 36 / 38 |
| Contract read | 118 / 128 | 36 / 38 |
| Logs | 227 / 246 | 68 / 72 |
| Simulation | 116 / 123 | 36 / 39 |
| Four concurrent reads | 120 / 167 | 38 / 102 |

The initial log comparison compared full serialized responses and reported a
difference. A follow-up compared canonical standard log fields and passed all
twenty measurements with no errors. That correction did not change RPC timing.

Pecu's actual Aero handler returned the same five pools on both endpoints.
Ten measured calls per provider gave Alchemy 119 / 144 ms and Chainstack
37 / 45 ms, a 69% reduction in median handler time. This is a bounded pool read,
not a full market scan, swap, stock purchase or end-to-end chat measurement.

Five read-only calls through the production Aero service after the switch
passed: 309, 50, 42, 41 and 44 ms. The first call includes startup effects.
No transaction was prepared, signed or broadcast.

## Release evidence

- Previous Aero version: `4932ce89-8fe3-48a2-bc3b-fb6343c79e27`.
- Chainstack secret-change version: `c03dd4e9-1101-4413-a632-e39f911a2927`.
- Pecu typecheck passed. Its 336 tests passed: 334 in the sandbox, then the two
  Workerd tests passed outside it after sandbox port restrictions blocked them.
- Reusable benchmark: `apps/pecu/scripts/rpc-benchmark/`.
- Measurements: `apps/pecu/scripts/rpc-benchmark/evidence/2026-09-19/`.

The user clarified that the intended skill was `/verification`. The installed
Vercel verification skill was applied to this story: a signed-in user requests
five Aero pools and receives the result in Pecu chat. Its provenance has not been
confirmed as the user's Poteto-created skill.

The production browser session restored authentication after loading. Sending
`/aero pools --limit 5` in a new thread returned Base pool data, including the
first two pool addresses. The visible reply ends after the second pool's type;
it does not display all five records. This is a rendering/completeness limitation,
so full-story verification is partial. The independent service checks returned
all five pools. Browser response latency and per-request server traces were not
measured, and no end-to-end chat speedup is claimed. No funds moved.

## Scope and rollback

All Pecu channels using the shared Aero service receive the same provider change.
No client UI, wire contract, model provider, signing policy or BeeGreat client
was changed. Other Aero SDK consumers keep their existing RPC configuration.

Rollback is to restore the prior Aero deployment or put the retained Alchemy
Base endpoint back into the Aero worker's `ALCHEMY_RPC_URL` secret. Verify the
current deployment first; never roll back over a newer unrelated release.
Keep credentials outside tracked files and logs.
