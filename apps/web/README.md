# BeeGreat web

The TanStack web twin uses the same Clerk application, Convex deployment, and
Flue Bee agent as the mobile app. Copy `.env.example` to `.env.local`, then set:

- `VITE_CONVEX_URL` to the shared Convex deployment
- `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the shared Clerk app
- `VITE_AGENT_URL` to the Bee worker (`http://localhost:3583` for local work)

From the repository root, start the existing services and web app in separate
terminals:

```sh
bun run backend
bun run agent
bun run web
```

The web app deliberately does not proxy or duplicate backend functionality.
Conversation history is mirrored into Convex and uses the same thread IDs as
mobile, while live responses stream from the same authenticated Flue agent.
