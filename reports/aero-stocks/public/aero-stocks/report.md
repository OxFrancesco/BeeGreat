# Aero stocks and indices

Implemented in BeeGreat on 7 September 2026. The installed `aero` command points to this checkout.

- Buy with USDC and sell stock token units for all ten tracked Base stocks.
- Create, list, inspect, edit, and delete saved index weights.
- Rebalance wallet holdings with an explicit USDC contribution. A 0% weight exits a stock.
- TUI stock table, buy/sell forms, index editor with weight bars, and current/target preview.
- One atomic router transaction for every rebalance. Approvals account for total per-token spending.

## Verification

| Check | Result |
| --- | --- |
| Sugar tests | 305 passed |
| Backend confirmation tests | 9 passed |
| Sugar, backend, agent type checks | Passed |
| Sugar and changed shared-file lint | Passed |
| CLI and worker build | Passed |
| Installed CLI | Resolves to this checkout; new command help verified |
| Built CLI index lifecycle | Create, show, update, delete, list passed in isolated storage |
| Live Base quotes | All ten stock contracts returned quotes |
| Native Base fork | Buy, sell, fund a 50/50 index, and exit NVDA into AAPL passed |
| Atomic failure | An impossible second-leg minimum reverted the basket; all asset balances stayed unchanged |
| TUI keyboard paths | Create, edit, delete, and rapid stock selection passed |
| TUI frame timing | Three runs, 21 ms p95 and maximum frame gaps |

The fork uses Base's native B20 implementation. No mainnet transaction was broadcast. It uses live route quotes and forked wallet state. Fork balances and successful receipts verify execution, but are not a live-wallet sign-off.

Computer Use failed to start. Native screenshots and a CAP recording were unavailable. The attached terminal text files come from the actual TUI renderer during keyboard tests.

## Usage

```sh
aero tui
aero stocks buy --stock NVDAc --amount 25 --dry-run
aero stocks sell --stock NVDAc --amount 0.1 --dry-run
aero index create --name tech --allocations 'NVDAc=50,AAPLc=50'
aero index rebalance --name tech --cash 100 --dry-run
```

A connected wallet or `--wallet` is required to build plans. Remove `--dry-run` to review and sign through Aero.

Indices are local recipes. They include all wallet holdings of their named stocks, so overlapping indices share holdings. Existing USDC is excluded except for the explicit cash contribution. Fees and token precision can leave small allocation differences. There is no background rebalancing schedule.

## Shared clients

The stock operations use the shared Sugar contract. Bee tools expose them through mobile, web, Bee CLI, iMessage, voice, and either model-provider path. Existing confirmation UI and plain text show each trade and minimum receipts. Refreshing a plan cannot raise an input, reduce a minimum, change assets, or add trades without another confirmation.

Named index files remain local to Aero. Other clients pass allocations inline. Shared agent and Convex changes are implemented and type-checked, but have not been deployed to hosted Bee. No mobile or web portfolio screen was added. No repository push or package publication was performed.

## Sources

- [Dromos stock dashboard](https://dromos.kitchen/dashboards/coinbase-tokenized-stocks)
- [Official stock contract directory](https://brand.base.org/stocks)
- [Base B20 fork-testing instructions](https://github.com/base/base-std/blob/main/LIVE_PRECOMPILE_TESTING.md)

Base's official directory describes availability in eligible jurisdictions outside the US. The integration uses the published contract addresses and live on-chain data.
