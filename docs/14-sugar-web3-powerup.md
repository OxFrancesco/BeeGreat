# Sugar CLI in the Web3 powerup

The Web3 specialist exposes every action from the pinned Velodrome/Aerodrome
Sugar CLI.

## Action coverage

Read-only tools:

- `sugar_pools`
- `sugar_positions`
- `sugar_epochs_latest`
- `sugar_epochs`
- `sugar_quote`

Unsigned transaction builders:

- `sugar_swap`
- `sugar_deposit`
- `sugar_withdraw`
- `sugar_stake`
- `sugar_unstake`
- `sugar_claim_emissions`
- `sugar_claim_fees`

Sugar supports Optimism (`10`), Base (`8453`), Unichain (`130`), Lisk (`1135`),
Mode (`34443`), Fraxtal (`252`), Ink (`57073`), Soneium (`1868`), Superseed
(`5330`), and Celo (`42220`). Write actions return ordered
`{from,to,data,value}` JSON only. They do not sign or broadcast, and the bridge
has no private-key input.

## Runtime layout

The Flue powerup calls the guarded `web3.runSugar` Convex action. Convex checks
that the user enabled the Web3 powerup and forwards the validated action to the
authenticated Bun service in `apps/sugar-bridge`. The bridge invokes the pinned
Sugar CLI with a shell-free argument array and returns stdout unchanged so raw
wei values are not rounded by JavaScript.

## Deploy and configure

Build `apps/sugar-bridge/Dockerfile` with the repository root as build context.
Set `SUGAR_BRIDGE_SECRET` on the bridge and configure any desired per-chain RPC
overrides listed in `apps/sugar-bridge/.env.example`.

Configure Convex with the same secret and the bridge origin:

```sh
bunx convex env set SUGAR_BRIDGE_URL 'https://sugar.example.com'
bunx convex env set SUGAR_BRIDGE_SECRET
```

Run the focused checks with Bun:

```sh
bun test packages/sugar apps/sugar-bridge
bun run --cwd packages/sugar typecheck
bun run --cwd apps/sugar-bridge typecheck
bun run --cwd packages/backend typecheck
bun run --cwd packages/agent build
```
