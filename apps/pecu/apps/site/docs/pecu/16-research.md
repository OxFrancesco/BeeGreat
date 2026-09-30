---
title: Research
description: Ask Pecu why a chain moved and get a report that ties each move to its cause, with the evidence.
group: Use
---

Send `@research` and a chain name. Four specialists read chain metrics, protocol data, Nansen flows and posts on X, and an editor writes the report. It takes 5 to 15 minutes.

```text
@research base
@research solana 30d
@research ethereum 1d
```

The window is `7d` unless you add `1d` or `30d`. It covers complete UTC days up to yesterday and compares them with the same span before.

## What the report contains

- The headline metrics: DeFi TVL, stablecoin supply, DEX volume, app fees and revenue, transactions, active addresses, network fees and median transaction cost, with the change against the prior window.
- Why it moved: each cause names the movement, the mechanism, the catalyst and its date, how much of the move it explains, and links to the data and posts behind it. Every cause carries a confidence level.
- A dated timeline of announcements, launches and incentive changes.
- What is still unexplained, and dates to watch.
- The protocol, issuer and fee tables the specialists worked from, their notes, and every source.

Pecu keeps correlation and cause apart. A post on the same day as a move is a lead until the data or a first-party source ties them together, and the report says which is which.

## Commands

| Message | What it does |
| --- | --- |
| `@research CHAIN [1d\|7d\|30d]` | Starts a run. `/research` works the same. |
| `@research` | Lists your runs and how many you have left today. |
| `@research status ABC123` | Shows progress, or the headline and link when it is done. |
| `@research cancel ABC123` | Stops a run. A run cancelled before it started is free. |
| `@research delete ABC123` | Removes a finished report. |

You can also ask in plain words, such as "research why Base moved this week".

## Where results appear

The finished report comes back in the chat where you asked, and at `pecu.app/researches`, where you can start runs, follow each specialist's progress, cancel, run again or delete. On Android, open Research from the account menu; a notification opens the report.

## Limits

You can start 3 runs per UTC day and have one running at a time. Failed runs do not count. Chains without growthepie coverage have no transaction or address metrics, and chains Nansen does not cover skip the flow specialist; the report says what was missing.
