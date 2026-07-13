# BeeGreat web

The TanStack web twin uses the same Clerk application, Convex deployment, Flue
Bee agent, conversation IDs, and generated-UI contract as the mobile app. Copy
`.env.example` to `.env.local`, then set:

- `VITE_CONVEX_URL` to the shared Convex deployment
- `VITE_CONVEX_SITE_URL` to that deployment's HTTP actions origin
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the shared Clerk app
- `VITE_AGENT_URL` to the Bee worker (`http://localhost:3583` for local work)
- the Sentry variables described in
  [`docs/13-sentry-observability.md`](../../docs/13-sentry-observability.md)

From the repository root, start the existing services and web app in separate
terminals:

```sh
bun run backend
bun run agent
bun run web
```

The authenticated product routes are:

- `/bee` — streaming Bee chat, conversation history, generated UI, voice input,
  and spoken replies
- `/goals`, `/goals/:goalId`, `/projects/:projectId` — the complete Goal,
  Project, Task, Subtask, due-date, and target-date workflow
- `/hive` — balances, Honey vessel, current Highlight, GolieBee, completion
  feedback, and Achievements
- `/settings` — profile, ChatGPT, power-ups, Google Health, spoken replies, and
  sign-out

The web app does not proxy or fork backend functionality. Every mobile Convex
operation is called directly by the web client, conversation history uses the
same thread IDs, and live responses stream from the same authenticated `bee`
agent. See [PARITY.md](PARITY.md) for the audited feature map and platform
adaptations.

Verify the web twin with:

```sh
bun run --cwd apps/web lint
bun run --cwd apps/web test
bun run --cwd apps/web build
```
