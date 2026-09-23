---
title: Licensing
description: Which license covers which part of Aero, what the NOTICE file records, and what the repository's licensing review leaves unresolved.
group: Reference
---

Aero is not under a single license. Different parts of the code carry different terms.

| Material | Terms | File |
| --- | --- | --- |
| Original contributions by Francesco Oddo | MIT | `LICENSE` |
| The TypeScript port of the Velodrome Python Sugar SDK | Apache-2.0, Copyright 2025 Velodrome Finance | `LICENSE.Apache-2.0`, `NOTICE` |
| ALM strategy code in `src/alm/`, to the extent it derives from Mellow's PulseStrategyModule | BUSL-1.1, licensor G3M Labs S. A. | `LICENSE.Mellow-BUSL-1.1` |

The MIT grant does not replace the licenses and notices that apply to third-party material. `LICENSE` says so at the top.

## Apache-2.0 port

The ported modules include the chain, client, pool, position, price, quote, token and transaction code, configuration, helpers, models, types, the swap planner, Superswap, the action layer and the ABI files. Each ported TypeScript file starts with a header that names the upstream source and the modifications.

`NOTICE` maps these modules to their upstream Python files and records the reference revision that was inspected. It lists 15 ABI files that matched the Python reference byte for byte, notes that `erc20.json` differs, and names the ABI files that still need an exact-source check.

## Mellow BUSL-1.1

`src/alm/strategy.ts` describes itself as replicating Mellow's PulseStrategyModule, which is licensed under BUSL-1.1. The license parameters name February 15, 2028 as the change date and GPL-2.0-or-later as the change license. Production use is allowed only for uses on Mellow's published grant list, and the list inspected on 2026-09-06 named none.

Whether the `src/alm/` code is a derivative work is unresolved. `LICENSE.Mellow-BUSL-1.1` is included to preserve the upstream terms, not as a production-use grant. Dry-run mode is not clearance either. Obtain permission or a qualified provenance review before relying on the ALM strategies in production.

## Open questions

The repository's licensing review, dated 2026-09-06, is a technical review and not a legal opinion or a finding of non-infringement. It leaves these points open.

- The official Velodrome TypeScript SDK, `sdk.js`, is marked `UNLICENSED` and no reuse grant was found. Aero does not depend on it, and a full source-history comparison is still open.
- ABI provenance. Several ABI artifacts need a check against an exact upstream source and revision.
- Protocol contracts. Aerodrome's contracts use a mix of BSL-1.1, GPL-3.0 and MIT. Calling a deployed contract over RPC is distinct from distributing its code, but no blanket exemption is assumed for generated ABIs.
- Trademarks and logos. The Apache and BSL texts grant no trademark or logo rights. Protocol names describe compatibility or source attribution only.

## Redistribution

Keep `LICENSE`, `LICENSE.Apache-2.0`, `LICENSE.Mellow-BUSL-1.1` and `NOTICE` with source copies, mirrors and bundled builds. The package metadata lists all four. When you bundle dependencies, include their licenses too. Do not describe the whole package as MIT-only or as cleared for unrestricted production use.

Read the full [licensing review](https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK#licensing-review-2026-09-06) and [NOTICE](https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK/blob/main/NOTICE) before reuse or redistribution.
