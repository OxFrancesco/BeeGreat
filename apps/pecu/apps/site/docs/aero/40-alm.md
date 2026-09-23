---
title: ALM
description: Run aero serve on your own machine to keep concentrated liquidity positions in range, with dry-run by default, simulation, a TWAP guard, rate limits and manual recovery.
group: Automation
---

## What aero serve does

`aero serve` watches the concentrated liquidity (CL) positions listed in a config file. Every poll it reads each pool's current tick and asks the position's strategy whether to hold or move the range. When a move is due and every guard allows it, it withdraws the position and deposits it into the new range. It runs on your machine with your wallet. There are no vault contracts and no fee to Aero.

It is dry-run by default. Without `--execute` it logs, and optionally notifies you about, what it would do and never signs.

> [!WARNING]
> With `--execute`, `aero serve` signs and sends transactions from your local wallet without asking you per rebalance. Execution from a regular wallet is experimental and has not been fork-tested. Every recenter pays swap fees and slippage, and a bad range or a fast market can cost you funds. Run dry-run first, read what it would do, and keep the managed amounts small.

## Before you start

- At least one CL position on the chain, owned by the wallet you will manage. Positions already managed by an on-chain ALM vault are skipped.
- An RPC endpoint that supports `eth_simulateV1`, set with `SUGAR_RPC_URI_<chainId>`. Without it, `--execute` refuses to broadcast unless you pass `--allow-unsimulated`.
- For `--execute`, the local encrypted wallet from `aero wallet create` or `aero wallet restore`. Browser and WalletConnect wallets cannot sign unattended. See [Wallets](/docs/aero/wallets).

## Set up

1. Write the config from your current positions:

   ```sh
   aero alm init
   ```

   It lists your CL positions with liquidity or stake and writes one entry per pool. If several positions share a pool, pass `--position-id 123` to choose one. `--strategy` sets the strategy for every entry. It refuses to overwrite an existing file without `--force`.

2. Edit the config to tune the strategy, width, cooldown and limits. The fields are below.

3. Run a dry-run pass and read the output:

   ```sh
   aero serve --once
   ```

4. Check each position's range and gate:

   ```sh
   aero alm status
   ```

5. Start the daemon. It asks for the wallet passphrase once at startup, or reads `SUGAR_WALLET_PASSPHRASE`:

   ```sh
   aero serve --execute
   ```

`--once` runs a single pass and exits, which suits cron. `--interval` overrides the poll interval in seconds. Every log line starts with an ISO timestamp.

In dry-run, the managed wallet is `--wallet`, or the connected wallet of any kind. With `--execute`, it is always the local wallet's address.

## Config file

The config is JSON at `alm.json` in the wallet directory, so `~/.config/sugar-ts/alm.json` by default. `AERO_ALM_CONFIG` points to another file, and `--config` on each command overrides both. `aero alm init` writes it with mode 0600.

```json
{
  "version": 1,
  "chain": 8453,
  "pollSeconds": 30,
  "telegram": false,
  "positions": [
    {
      "pool": "0xPOOL",
      "positionId": "123",
      "strategy": "original",
      "cooldownMinutes": 60,
      "maxRebalancesPerDay": 4
    }
  ]
}
```

| Top-level field | Default | Meaning |
| --- | --- | --- |
| `version` | required | Always `1` |
| `chain` | `8453` | Chain id |
| `pollSeconds` | `30` | Seconds between passes, at least 1 |
| `telegram` | `false` | Send notifications through `buddytg` |
| `positions` | required | At least one entry, one per pool |

| Position field | Default | Meaning |
| --- | --- | --- |
| `pool` | required | CL pool address. Each pool may appear once. |
| `positionId` | none | NFT id as a decimal string. Without it, Aero picks your position in the pool. |
| `strategy` | `original` | See [Strategies](#strategies) |
| `widthTicks` | current range width | Target range width in ticks, a multiple of the pool's tick spacing |
| `tickNeighborhood` | `0` | Ticks inside each edge that already count as out of range, for `original` and `expand`. Must be under half the width. |
| `expandStepTicks` | about a tenth of the default width | `expand` only. Ticks added to each side per step, a multiple of the tick spacing. |
| `maxWidthTicks` | twice the width | `expand` only. Past this width, reset to a centered range. The default is twice the default width when that is larger. |
| `cooldownMinutes` | `60` | Minimum minutes between rebalance attempts |
| `maxRebalancesPerDay` | `4` | Most rebalance attempts in any 24 hours, at least 1 |
| `slippage` | `0.01` | Deposit and withdraw tolerance, above 0 and at most 0.5 |
| `swapSlippage` | `0.005` | Swap tolerance, above 0 and at most 0.5 |
| `twapSeconds` | `300` | TWAP window in seconds |
| `maxTwapDeviationTicks` | `50` | Largest allowed gap between spot and TWAP tick |
| `compound` | `true` | Reinvest gauge emissions into the position |
| `minCompoundEmissionsDecimal` | `1` | Emissions, in whole tokens, needed before compounding |

The width defaults to the position's current on-chain width. If that is unknown, Aero uses Mellow's widths by tick spacing: 1 tick for spacing 1, 1,000 for 50, 4,000 for 100, 6,000 for 200, and 30 times the spacing otherwise.

An invalid file stops `aero serve` and `aero alm status` with the reason.

## Strategies

| Strategy | Behavior |
| --- | --- |
| `original` | When the tick leaves the range, minus the neighborhood, open a new range of the same width centered on the tick |
| `lazy-syncing` | Act only when the tick is fully outside the range. Place the new range right next to the tick so the withdrawn single token deposits without a swap. |
| `lazy-ascending` | `lazy-syncing` that only follows upward moves |
| `lazy-descending` | `lazy-syncing` that only follows downward moves |
| `expand` | Widen the range on both sides by `expandStepTicks` until the tick is inside. Past `maxWidthTicks`, reset to a centered range of `widthTicks`. |

A strategy also holds when the new range would equal the current one.

## What a rebalance does

Each phase is built from fresh chain state, simulated, then sent, with the receipt awaited before the next:

1. Claim pending emissions, if the position is staked and has any.
2. Unstake the position from its gauge.
3. Withdraw all liquidity, collect fees and burn the empty NFT.
4. Swap the surplus token so the balances match the new range. A pool leg of wrapped ETH is traded as native ETH.
5. Deposit into the new range, which mints a new NFT.
6. Stake the new NFT if the gauge is live.

After the deposit, Aero checks that the minted NFT belongs to the wallet, sits in the right pool and range, holds liquidity and is not staked yet. If not, it stops and the cycle needs [recovery](#recovery).

While a position stays in range, Aero compounds emissions when `compound` is on, the position is staked, earned emissions reach `minCompoundEmissionsDecimal`, and the last compound was at least 24 hours ago. A compound claims the emissions, swaps them into both pool tokens by value, unstakes, adds the liquidity to the same range and stakes again.

In dry-run the log shows lines starting with `DRY-RUN would rebalance`, `DRY-RUN plan` and `DRY-RUN would compound`, with the reason, the planned steps and the approximate swap.

## Safety rails

### Dry-run by default

Nothing is signed without `--execute`. Dry-run reads the pool tick every pass and refreshes position data every 15 minutes. Execute mode reads both fresh on every pass.

### Simulation

Each phase, approvals included, is simulated as one block with `eth_simulateV1` from the managed wallet before anything is signed. A revert stops the phase with the failing step and reason. If the RPC does not support the method, execute mode stops unless you passed `--allow-unsimulated`, in which case it logs a warning and sends without simulating.

### TWAP guard

Before a rebalance, before every transaction of every phase, and before compounding, Aero compares the spot tick with a time-weighted average over `twapSeconds`. It reads the average from the pool's own oracle. If the pool's history is too short, it uses ticks it sampled itself, weighted by time, and only when they cover the full window with no gap longer than two poll intervals. With neither, it waits. If spot and average differ by more than `maxTwapDeviationTicks`, it skips and logs a possible manipulation or wick.

The local fallback is an estimate from polling, not an on-chain oracle, and does not protect against every form of MEV. After a restart on a young pool, expect to wait at least one full window.

### Cooldown and daily cap

A rebalance attempt counts when its cycle starts, even if a later phase fails. `cooldownMinutes` and `maxRebalancesPerDay` are checked against those attempts and survive restarts. Compounds are limited to one per 24 hours per position.

### Execute-mode checks

- The RPC's chain id must match the config's `chain`.
- The signer must be the managed wallet.
- Each pass takes a lock on the state file, so two daemons cannot run passes for the same state at once.
- If one position fails, the rest of that pass is skipped. The next pass tries again.

State lives in `alm-state.json` in the wallet directory: recent attempts, the last compound, the managed NFT id and any open cycle. Writes are atomic. If the file cannot be read, `aero serve` refuses to start rather than reset your limits.

## Telegram notifications

Set `"telegram": true` to run `buddytg notify --html` with each message. The `buddytg` CLI must be installed, set up and on your `PATH`.

- In dry-run, what it would rebalance, once per intended range, and what it would compound.
- In execute mode, completed rebalances and compounds with their transaction hashes.
- Errors, once per distinct message per position.

A failed or slow notification, with a 10-second limit, is logged and never stops the loop.

## Recovery

A cycle is one rebalance or compound. Before sending, Aero records the wallet, pool, NFT, target range, starting balances and a journal id per phase. If a cycle stops partway, it stays open. While any cycle for a wallet and chain is open, no new cycle starts for that wallet on that chain, even if the old NFT was burned. On each pass the daemon logs "requires manual recovery; run aero alm recover --id" with the cycle id. In execute mode it also checks known receipts. It never repeats a phase on its own.

### Find the cycle

```sh
aero alm status
```

With an open cycle, status prints `manual recovery required` and the cycle, including its id and phases.

### Check receipts

```sh
aero alm recover --id CYCLE_ID
```

`recover` looks up receipts for every submitted transaction in the cycle's journals and prints the result. It signs nothing and restarts nothing. It takes the state lock, so stop a running `aero serve --execute` first.

### Repair and resolve

Inspect your balances, NFT ownership and staking, and finish or undo the partial work with normal commands such as `aero deposit` and `aero stake`. Then record what you did:

```sh
aero alm resolve --id CYCLE_ID --note "Verified receipts and restaked the new position"
```

`resolve` checks receipts again and requires that:

- every phase journal exists and belongs to the same wallet and chain,
- no transaction is pending or has an unknown outcome,
- the NFT to manage, from `--position-id` or else the replacement or original NFT, is a funded CL position in the same pool owned by the wallet.

It then asks you to confirm, cancels unsubmitted steps, marks the cycle resolved and tracks that NFT from now on. Cooldowns and caps stay in effect. Run `aero serve --once` in dry-run before restarting with `--execute`.

`aero executions resume` refuses ALM phases. Recovery goes through `aero alm recover` and `resolve` only.

### When resolve refuses

A send with no known hash, a missing or corrupt journal or state file, or a stale lock needs your own investigation of the wallet's activity. Do not delete state or lock files to force a retry.

## Disabled and experimental

- Safe execution is disabled in this release. `aero alm safe-setup` exits with an error, and `aero serve --execute` refuses a config with a `safe` section. Dry-run still observes a Safe listed in the config.
- Keeper roles deployed with earlier versions are not revoked by this release. Safe owners must review and revoke them, or disable the Roles module. The earlier role allowed unrestricted router commands and does not protect against a compromised keeper.
- Execution from a regular wallet (EOA) is experimental pending fork tests.
- Automatic resumption of phases, locking across several machines, and trading from the managed wallet while the daemon runs are not supported.

## Licensing

The strategy code replicates Mellow Protocol's PulseStrategyModule, which is licensed under BUSL-1.1. Whether Aero's version is a derivative work, and whether production use is permitted, is unresolved. Read [Licensing](/docs/aero/licensing) before running it in production.
