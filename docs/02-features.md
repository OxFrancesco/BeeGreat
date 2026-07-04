# 02 – Features

Full catalog from the braindump, organized and prioritized with MoSCoW. Build order lives in [07 – MVP Scope & Roadmap](07-mvp-scope-and-roadmap.md).

## 1. Voice agent home (Must)

The main page of the app.

- Voice input first; agent sits on top of the screen
- While responding, the agent collapses into a **Dynamic Island**-style pill; below it, auto-generated content streams in: cards, text, charts, task lists
- Agent can query user data (screen time, tasks, goals, health) and render the right visualization
- **Auto-labeling of tracked time**: Linear → work, YouTube/Instagram → doomscrolling, etc.
- **Highlight view**: always-available, super concise, information-dense summary

## 2. Goals, projects & tasks (Must)

- Up to **3 active goals**; a goal is a macro-project (e.g. "get healthier") containing projects; projects contain tasks
- Each project gets a **generated bee** (FAL, styled to the goal — see [04](04-gamification.md))
- Project page: tasks, subtasks, labels, tree view, to-do list — "all the usual shenanigans"
- Due dates with a twist: **postponing/changing a due date costs honey**
- Goals can be changed, but changing/deleting a goal **wipes its honey and kills its bees**

## 3. Daily summary / Hive page (Must)

- Daily summary of your highlight slots
- Visual metaphor: you're **filling your hive with honey** as you make progress
- Honey mechanics detailed in [04 – Gamification](04-gamification.md)

## 4. Automatic time tracking (Must for Mac, Should for mobile)

- Cross-device screen time: iPhone, iPad, Mac
- Desktop companion: **native Swift macOS menu-bar app** with Rize.io-level tracking (decided)
- iOS/iPadOS: seamless in-app focus sessions as fallback (Apple doesn't expose raw per-app screen time)
- Auto-categorization of app/site usage into work / leisure / doomscrolling

## 5. Journal (Should)

- Voice-to-text journal, always manually editable
- Photo uploads
- Can surface achievements (e.g. "connected GitHub, committed X times today")

## 6. Achievements (Should)

- Achievement system tied to goals, streaks, and integrations
- GitHub connection: commit counts as achievements
- Health goals via Apple Health / Google Health (a highlight can be "improve my health")

## 7. Gamification: hive, honey, honeycomb score (Must — core differentiator)

See [04 – Gamification](04-gamification.md). Summary:

- Forest-like stake: neglect goals → your hive suffers; achieve → collect rewards
- More active goals = more honey production, but >3 goals = honey loss from brain fatigue
- Postponing due dates = honey loss
- Honeycomb score is the public-facing metric

## 8. Bee Greater with Friends (Should — post-MVP)

See [06 – Social](06-social.md).

- Global leaderboard + friends leaderboard
- **Parties**: multiple friends join together on the same goal or different goals and "fight" each other
- **Bee Card**: shareable card with unique handle, honeycomb score, socials — usable for networking

## 9. Integrations (Could — staged)

| Integration | Purpose |
|---|---|
| GitHub | Commit-based achievements, work evidence in journal |
| Apple Health | Health-related goals/highlights |
| Google Health API | Same, Android |
| Device screen time | Time tracking + auto-labeling |

## 10. Platforms (context, not a feature)

- Mobile + iPad app (Expo)
- **Web app twin** (TanStack) sharing the exact same backend
- Desktop companion for time tracking (Electron or Swift)

## Explicitly NOT features (anti-goals)

- A full-blown task manager with unlimited projects/lists
- Anything that shows the user more than their current highlights by default
- Calendar/email clients, generic productivity suite features
