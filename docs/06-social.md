# 06 – Social: "Bee Greater with Friends"

Flagged in the braindump as potentially one of the most important pages.

## Leaderboards (decided)

- **All-time global leaderboard** — ranked by lifetime honeycomb score, **never resets**
- **Monthly global leaderboard** — resets on the 1st of each month, keeps things contestable
- **Friends leaderboard** — scoped to your friends; can be reset only if **every friend agrees** (unanimous vote)

## Parties — "Honey Wars" (rules v1, designed per delegation)

Design brief: easy to understand and fun. One sentence: *whoever's hive earns the most honey during the party wins.*

- **Setup**: 2-8 friends, one creates the party and picks a duration — **1 week, 2 weeks, or 1 month**
- **Modes**:
  - **Same goal**: everyone attaches the same goal (e.g. "ship our side projects")
  - **Free-for-all**: each member attaches one of their own goals
- **Scoring**: honey earned *from the attached goal only*, during the party window. No normalization tricks — same honey rules as everywhere else (see [04](04-gamification.md)), so it's instantly understandable
- **Buy-in (optional, default on)**: each member stakes **50 honey** into the "party pot"; winner takes the pot
- **Live view**: party screen shows all members' hives side by side filling up in realtime
- **Anti-grief**: postponement/abandonment penalties still apply inside the party — quitting a goal mid-party kills your bee *and* forfeits your stake
- **End**: winner announced, gets pot + a party achievement; results shareable as an image (like the Bee Card)

## Bee Card

A big shareable card ("big red card" in the braindump) that users exchange:

- **Unique handle** (hard requirement — handles must be unique app-wide)
- **Honeycomb score**
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

Post-MVP (Phase 3 in the [roadmap](07-mvp-scope-and-roadmap.md)) — but handle uniqueness should be built into signup from day one so early users get good handles and no migration is needed.
