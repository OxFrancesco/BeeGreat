---
title: Analytics
description: The TUI Analytics dashboard, its five tabs, where each number comes from and how it behaves without a Dune API key.
group: TUI
---

## Open the dashboard

Run `aero tui`, then pick Analytics on the home menu. The dashboard loads for the chain shown in the status bar. Press `c` on Home to change chain first.

## Data sources

Every panel is tagged with its source. The Sources line at the bottom of each tab shows which sources have loaded and the first error, if any.

| Source | What it provides | Chains | Key |
| --- | --- | --- | --- |
| Sugar | Live on-chain pools, TVL, the latest epoch's votes, emissions, fees and incentives, and veNFT supply | All supported chains | none |
| Dune | Aerodrome RPV leaderboard from public query 7907454, plus two SQL queries on `dex.trades` for 24-hour DEX volume share and weekly Aerodrome volume | Base only | required |
| DefiLlama | Fees, holder revenue, volume, TVL history, market cap, and fees split between Slipstream and the older pools | Base and OP Mainnet | none |

Each load runs the three sources in parallel and fills panels as they arrive.

## Tabs

A tab bar at the top shows `1:health` to `5:arena`.

### Health

A KPI strip sits above the Health panels.

| KPI | Source |
| --- | --- |
| TVL | Sugar, or DefiLlama when Sugar has not loaded |
| VOL 24H | Dune, or DefiLlama without Dune |
| FEES 24H | DefiLlama |
| BASE SHARE | Dune |
| E/R | Sugar. Shown only when the last settled epoch had more than $1,000 of revenue or emissions. |

The panels below the strip:

- Weekly volume, a line chart of the last 16 weeks of Aerodrome volume from Dune.
- Base 24h share, bars for the five DEXs with the most 24-hour volume on Base, from Dune.
- TVL mix, a donut of TVL by pool family (Slipstream, vAMM, sAMM) with the asset lanes ETH-stable, BTC, Stables, AERO/VELO and long-tail, from Sugar.
- Weekly fees, CL vs legacy, a two-line chart from DefiLlama. When DefiLlama has less than two weeks of fees, a Turnover panel from Sugar takes its place with volume over TVL for all, CL and legacy pools and the top five pools.
- 16-week activity, a heatmap of weekly volume from Dune, or weekly fees from DefiLlama without Dune.

### Flywheel

- Best pools to vote, the top ten pools by RPV with their fees and bribes, from Sugar. Enter on a row opens that pool's epoch history.
- This epoch, a waterfall of fees plus bribes minus emissions for the latest settled epoch, with the net result, E/R and the three pools with the most votes.
- Same $10k, comparing holding, providing liquidity in the highest-APR pool and locking and voting for the best RPV pool, as weekly dollars and APR.
- Voters, the six leading voters by RPV per 10k ve from the Dune leaderboard. Without Dune, this panel shows Bribe ROI from Sugar instead, in ve votes per dollar of bribes.

### Trade

- Pools by lens, the top 20 pools with at least $100,000 of TVL, showing type, TVL, fees and asset lane. `o` picks the sort: TVL, weekly volume, weekly fees, efficiency or rewards per vote. Enter on a row opens that pool's epoch history.
- Liquidity map, a scatter of up to 40 pools by turnover and TVL, CL and basic pools in different colors, with the two largest pools named.
- Weekly volume, columns of weekly Aerodrome volume from Dune.

### Token

- Supply and locks, a donut of locked against liquid AERO or VELO, with the amount locked, total voting power, veNFT count, spot price, and income per ve per year, from Sugar. Chains without veNFT contracts show "No veNFT contracts on this chain".
- Valuation, market cap, fees over 24 hours and 30 days, market cap over annualized 30-day fees (P/S) and market cap over 30-day fees (P/F), from DefiLlama.

### Arena

Every DEX with volume on Base in the last 24 hours from Dune's `dex.trades`, up to 12, with 24-hour volume and share. Aerodrome and Velodrome rows are highlighted.

## Metrics

| Metric | How it is computed |
| --- | --- |
| E/R | Emissions in USD divided by fees plus incentives for the latest settled epoch. Below 1 means voters earned more than the protocol emitted. The KPI changes color at 1 and at 1.5. |
| RPV | Fees plus incentives divided by votes, times 10,000. Dollars earned per 10,000 votes. |
| Bribe ROI | Votes divided by incentives |
| Efficiency and turnover | Pool volume divided by TVL. The Turnover panel and the Liquidity map only use pools with at least $1,000,000 of TVL and a turnover between 0.01 and 40. |
| Same $10k | LP uses the APR of the highest-APR pool above $1,000,000 of TVL. Vote uses $10,000 of AERO or VELO at spot price earning the best pool's revenue per vote. |

## Charts

Charts are drawn with terminal characters. Line charts use braille dots, each cell a 2 by 4 grid, and filled charts use Bayer 8 by 8 ordered dithering. The dashboard uses line charts, columns, horizontal bars, donuts, a heatmap, a waterfall and a scatter map.

## Keys

| Key | Action |
| --- | --- |
| left, right, `h`, `l` | Previous or next tab |
| `1` to `5` | Jump to a tab |
| up, down, `k`, `j` | Move through ranked rows on Flywheel and Trade |
| Enter | Open the selected pool's epoch history |
| `o` | Sort pools on the Trade tab |
| `ctrl+r` | Reload the report |
| Esc | Back |

## Dune API key

Aero looks for a key in this order:

1. `SUGAR_DUNE_API_KEY`
2. `DUNE_API_KEY`
3. A `dune.env` file in the wallet directory, `~/.config/sugar-ts` or `SUGAR_WALLET_DIR`, with a line `SUGAR_DUNE_API_KEY=...` or `DUNE_API_KEY=...`

Create a key in your Dune account's API settings. Each Dune load reads the latest result of query 7907454 and starts two SQL executions against `dex.trades`, waiting up to 45 seconds for each result.

Without a key, Sugar and DefiLlama panels still load, and the Sources line shows "Set DUNE_API_KEY to load Dune Analytics". Weekly volume shows "needs Dune key", BASE SHARE stays empty, VOL 24H comes from DefiLlama, Voters is replaced by Bribe ROI, and Arena shows no data.

## Caching

- Dune and DefiLlama responses are kept in memory for 5 minutes per chain.
- Opening the dashboard again within 60 seconds of a load reuses that load instead of starting another.
- The last full report is saved as a [disk snapshot](/docs/aero/tui#disk-snapshots). The next time you open Analytics it shows at once and is replaced as live data arrives.
- `ctrl+r` drops the report and the on-chain caches and loads again. Dune and DefiLlama answers younger than 5 minutes are reused.

## Chain coverage

On Base every source is available. On OP Mainnet, Dune panels stay empty and no key warning is shown. On the other chains only Sugar panels load, such as TVL mix, Best pools to vote, This epoch and the Liquidity map.
