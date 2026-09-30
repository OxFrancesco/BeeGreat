---
name: pecu-onchain
description: Chain-level metrics from DefiLlama and growthepie. TVL, stablecoin supply, DEX volume, app fees and revenue, activity, protocol movers and prices.
tools: ["chain_*"]
triggers: '\b(tvl|total value locked|defillama|growthepie|stablecoin (supply|market cap|mcap)|dex volume|app (fees|revenue)|active addresses|daily active|transaction count|chain (metrics|activity|fees|revenue|stats)|protocol (tvl|fees|revenue)|biggest (movers|protocols)|which protocols)\b'
---

# Chain metrics

- Pass the chain id the user named, such as base, ethereum or solana; default to base. Windows are complete UTC days ending yesterday.
- chain_overview answers "how is Base doing"; chain_metric dates a move; chain_protocols, chain_dexes and chain_fees name the protocols behind it; chain_stablecoins names the issuer; chain_prices separates price from deposits.
- Say whether a number is a level on one day, a sum over the window or a daily average. TVL changes include token price moves.
- Cite DefiLlama or growthepie by name. For a full explanation of why a chain moved, suggest @research with the chain name.
