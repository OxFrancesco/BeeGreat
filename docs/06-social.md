# 06 – Social: "Bee Greater with Friends"

Flagged in the braindump as potentially one of the most important pages.

## Leaderboards (decided)

- **All-time global leaderboard** — ranked by permanent Honeycomb Score, **never resets**
- **Monthly global leaderboard** — resets on the 1st of each month, keeps things contestable
- **Friends leaderboard** — scoped to your friends; can be reset only if **every friend agrees** (unanimous vote)

## Parties — "Honey Wars" (rules v1, designed per delegation)

> **Historical proposal:** these 2026-07-04 rules predate the canonical separation of cosmetic Honey and permanent Honeycomb Score. They remain a design input, not an approved implementation contract. Any future party scoring must use verified Honeycomb Score progress rather than spendable Honey.

Design brief: easy to understand and fun. One sentence: _whoever's Hive records the most verified progress during the party wins._

- **Setup**: 2-8 friends, one creates the party and picks a duration — **1 week, 2 weeks, or 1 month**
- **Modes**:
  - **Same goal**: everyone attaches the same goal (e.g. "ship our side projects")
  - **Free-for-all**: each member attaches one of their own goals
- **Historical scoring proposal**: Honey earned from the attached Goal only. This is superseded because Honey is spendable cosmetic currency; future scoring should use attributed Honeycomb Score gained during the window.
- **Historical buy-in proposal**: each member stakes 50 Honey. Whether cosmetic currency can be used for optional social stakes remains undecided.
- **Live view**: party screen shows all members' hives side by side filling up in realtime
- **Anti-grief**: postponement/abandonment penalties still apply inside the party — quitting a goal mid-party kills your bee _and_ forfeits your stake
- **End**: winner announced, gets pot + a party achievement; results shareable as an image (like the Bee Card)

## Bee Card

A big shareable card ("big red card" in the braindump) that users exchange:

- **Unique handle** (hard requirement — handles must be unique app-wide)
- **Honeycomb Score** (permanent verified progress; never the spendable Honey balance)
- **Socials** (links) → the card doubles as a **networking tool**
- Achievements showcase (optional)
- Shareable as image (rendered/stored via R2) and via deep link

## Handle policy (decided)

- Handles are unique app-wide, claimed at signup
- **Renames allowed** (old handle is released; consider a short cooldown to prevent handle-sniping abuse)
- **No reserved-name list** for launch
- Basic validation + moderation for offensive handles still applies

## Requirements & implications

- Friend graph in Convex (requests, accepts, blocks)
- Server-authoritative scores (anti-cheat) — a competitive leaderboard is only fun if it's fair
- Privacy: opt-out of global leaderboard; control what the Bee Card exposes
- Moderation basics for handles and card content

## Status

Post-MVP (Phase 3 in the [roadmap](07-mvp-scope-and-roadmap.md)). FRA-459 explicitly defers handles and all social foundations from the first-focus proof; the earlier “signup from day one” recommendation remains historical and should be revisited before social implementation.
