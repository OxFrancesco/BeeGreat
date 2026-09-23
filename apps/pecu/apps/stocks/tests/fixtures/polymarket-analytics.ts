import type { PolymarketSnapshot } from "../../../../src/analytics-contract";

export const polymarketFixtures: PolymarketSnapshot[] = [
 {
  "key": "[\"polymarket\",\"market_by_slug\",\"will-the-us-invade-iran-before-2027\",\"Current\"]",
  "observedAt": 1790162508010,
  "subject": "will-the-us-invade-iran-before-2027",
  "chain": "polygon",
  "period": "Current",
  "partial": false,
  "kind": "pm_odds",
  "title": "Will the U.S. invade Iran before 2027?",
  "url": "https://polymarket.com/event/will-the-us-invade-iran-before-2027",
  "endDate": "2027-01-01T04:59:00Z",
  "volume24hUsd": 318756.79368199996,
  "liquidityUsd": 1152377.0325,
  "rows": [
   {
    "label": "Yes",
    "probability": 0.145
   },
   {
    "label": "No",
    "probability": 0.855
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"event_by_slug\",\"fed-decision-in-october-20260617190323537\",\"Current\"]",
  "observedAt": 1790162508965,
  "subject": "fed-decision-in-october-20260617190323537",
  "chain": "polygon",
  "period": "Current",
  "partial": false,
  "kind": "pm_odds",
  "title": "Fed Decision in October?",
  "url": "https://polymarket.com/event/fed-decision-in-october-20260617190323537",
  "endDate": "2026-10-29T03:59:00Z",
  "volume24hUsd": 595189.0106849999,
  "liquidityUsd": 2121374.56107,
  "rows": [
   {
    "label": "25 bps increase",
    "probability": 0.535
   },
   {
    "label": "No change",
    "probability": 0.455
   },
   {
    "label": "50+ bps increase",
    "probability": 0.0095
   },
   {
    "label": "25 bps decrease",
    "probability": 0.0055
   },
   {
    "label": "50+ bps decrease",
    "probability": 0.0025
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"search\",\"bitcoin\",\"Current\"]",
  "observedAt": 1790162509059,
  "subject": "bitcoin",
  "chain": "polygon",
  "period": "Current",
  "partial": false,
  "kind": "pm_markets",
  "rows": [
   {
    "title": "What price will Bitcoin hit in September?",
    "url": "https://polymarket.com/event/what-price-will-bitcoin-hit-in-september-2026",
    "leader": "↑ 92,500",
    "probability": 0.1555,
    "volume24hUsd": 664647.044406,
    "endDate": "2026-10-01T04:00:00Z"
   },
   {
    "title": "Bitcoin above ___ on September 23?",
    "url": "https://polymarket.com/event/bitcoin-above-on-september-23-2026",
    "leader": "66,000",
    "probability": 0.9995,
    "volume24hUsd": 599031.94158,
    "endDate": "2026-09-23T16:00:00Z"
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"prices_history\",\"55115078421062885512539156303747803058407616201213034911037320915726138659123\",\"Past month\"]",
  "observedAt": 1790162508905,
  "subject": "55115078421062885512539156303747803058407616201213034911037320915726138659123",
  "chain": "polygon",
  "period": "Past month",
  "partial": false,
  "kind": "pm_history",
  "title": "Will the U.S. invade Iran before 2027?",
  "outcome": "Yes",
  "points": [
   {
    "t": 1787571000,
    "p": 0.165
   },
   {
    "t": 1787572800,
    "p": 0.165
   },
   {
    "t": 1787574600,
    "p": 0.165
   },
   {
    "t": 1787576400,
    "p": 0.165
   },
   {
    "t": 1787578200,
    "p": 0.165
   },
   {
    "t": 1787580000,
    "p": 0.165
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"book\",\"55115078421062885512539156303747803058407616201213034911037320915726138659123\",\"Current\"]",
  "observedAt": 1790162508161,
  "subject": "55115078421062885512539156303747803058407616201213034911037320915726138659123",
  "chain": "polygon",
  "period": "Current",
  "partial": false,
  "kind": "pm_book",
  "title": "Will the U.S. invade Iran before 2027?",
  "outcome": "Yes",
  "midpoint": 0.14500000000000002,
  "spread": 0.009999999999999981,
  "lastTrade": 0.14,
  "bids": [
   {
    "price": 0.14,
    "size": 97754.22
   },
   {
    "price": 0.13,
    "size": 180104.81
   },
   {
    "price": 0.12,
    "size": 486356.87
   },
   {
    "price": 0.11,
    "size": 97437.44
   },
   {
    "price": 0.1,
    "size": 78097.82
   },
   {
    "price": 0.02,
    "size": 170362.02
   },
   {
    "price": 0.01,
    "size": 4232243.15
   }
  ],
  "asks": [
   {
    "price": 0.15,
    "size": 417073.8
   },
   {
    "price": 0.16,
    "size": 182757.26
   },
   {
    "price": 0.17,
    "size": 222564.04
   },
   {
    "price": 0.18,
    "size": 85956.57
   },
   {
    "price": 0.19,
    "size": 60702.96
   },
   {
    "price": 0.98,
    "size": 7878.08
   },
   {
    "price": 0.99,
    "size": 69439.81
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"leaderboard\",\"overall\",\"Past week\"]",
  "observedAt": 1790162137971,
  "subject": "overall",
  "chain": "polygon",
  "period": "Past week",
  "partial": false,
  "kind": "pm_leaderboard",
  "board": "pnl",
  "rows": [
   {
    "rank": 1,
    "name": "totoro3miyazaki",
    "wallet": "0x0f6f76ced62a911bccef92f50faaff143854d977",
    "pnlUsd": 1817967.8169899993,
    "volume": 4272819.46659
   },
   {
    "rank": 2,
    "name": "Papeasy",
    "wallet": "0x111f73e91f85b6fe4de1ddec3de2fe32122e355b",
    "pnlUsd": 1117977.3276009448,
    "volume": 0
   },
   {
    "rank": 3,
    "name": "e46m3",
    "wallet": "0x4f1d5ae26fc31472966e951af3183308736d8de2",
    "pnlUsd": 979922.2490022726,
    "volume": 757072.4803419986
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"biggest_winners\",\"overall\",\"Past week\"]",
  "observedAt": 1790162138326,
  "subject": "overall",
  "chain": "polygon",
  "period": "Past week",
  "partial": false,
  "kind": "pm_wins",
  "rows": [
   {
    "rank": 1,
    "name": "timetowander",
    "wallet": "0x58b3380f71bd6c706dd398a5e60bde55fa3a653c",
    "title": "Fed Decision in September?",
    "url": "https://polymarket.com/event/fed-decision-in-september-762",
    "pnlUsd": 4673440.114347,
    "costUsd": 1385975.4288558525
   },
   {
    "rank": 2,
    "name": "TheReturnOfDarthMaul",
    "wallet": "0x3a8aa345d5db7ec5138298c8c4f4540259be7699",
    "title": "Fed Decision in September?",
    "url": "https://polymarket.com/event/fed-decision-in-september-762",
    "pnlUsd": 1970005.341904,
    "costUsd": 3848325.427544341
   },
   {
    "rank": 3,
    "name": "timetowander",
    "wallet": "0x58b3380f71bd6c706dd398a5e60bde55fa3a653c",
    "title": "Fed Decision in September?",
    "url": "https://polymarket.com/event/fed-decision-in-september-762",
    "pnlUsd": 1386559.794113,
    "costUsd": 9791671.053776754
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"user_pnl\",\"0x0f6f76ced62a911bccef92f50faaff143854d977\",\"Past month\"]",
  "observedAt": 1790162509145,
  "subject": "0x0f6f76ced62a911bccef92f50faaff143854d977",
  "chain": "polygon",
  "period": "Past month",
  "partial": false,
  "kind": "pm_trader",
  "name": "totoro3miyazaki",
  "points": [
   {
    "t": 1788652800,
    "pnlUsd": 104270.480389
   },
   {
    "t": 1788739200,
    "pnlUsd": 445737.418554
   },
   {
    "t": 1788825600,
    "pnlUsd": 1432393.783284
   },
   {
    "t": 1788912000,
    "pnlUsd": 90944.458294
   }
  ]
 },
 {
  "key": "[\"polymarket\",\"positions\",\"0x0f6f76ced62a911bccef92f50faaff143854d977\",\"OPEN\"]",
  "observedAt": 1790162509584,
  "subject": "0x0f6f76ced62a911bccef92f50faaff143854d977",
  "chain": "polygon",
  "period": "OPEN",
  "partial": false,
  "kind": "pm_positions",
  "rows": [
   {
    "title": "US Open ATP: Frances Tiafoe vs Alex Michelsen",
    "outcome": "Alex Michelsen",
    "url": "https://polymarket.com/event/atp-tiafoe-michels-2026-09-08",
    "size": 1183135.2778,
    "avgPrice": 0.4188,
    "currentPrice": 0,
    "valueUsd": 0,
    "pnlUsd": -505561.9861
   },
   {
    "title": "Will Real Betis Balompié win on 2026-09-08?",
    "outcome": "No",
    "url": "https://polymarket.com/event/ucl-lil-bet-2026-09-08",
    "size": 660658.3118,
    "avgPrice": 0.7237,
    "currentPrice": 0,
    "valueUsd": 0,
    "pnlUsd": -483367.3505
   },
   {
    "title": "Will AFC Bournemouth win on 2026-09-05?",
    "outcome": "Yes",
    "url": "https://polymarket.com/event/epl-new-bou-2026-09-05",
    "size": 65941.1457,
    "avgPrice": 0.5801,
    "currentPrice": 0,
    "valueUsd": 0,
    "pnlUsd": -38984.5372
   }
  ]
 }
];
