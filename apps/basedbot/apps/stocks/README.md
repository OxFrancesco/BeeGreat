# Aero stocks

The web app at https://aerocli.buddytools.org/aero/stocks uses TanStack Start, Clerk X sign-in, Shadcn, Tailwind, Motion, and Cloudflare Workers. There is no Convex dependency.

The landing page remains in `BeeGreat/packages/sugar/site/public`. Its Worker owns `/`; this app owns `/aero/stocks*`, legacy `/stocks*` redirects, and `/assets/*`.

The same app also runs at https://pecu.app/aero/stocks through the `apps/basedbot/apps/pecu` routing Worker. CLI navigation points to https://pecu.app/aero/cli and its `/docs` page.

## Backend and identity

The private `BASED_BOT` service binding calls `StocksGateway` in the existing `basedbot` Worker. It delegates to the same `BasedBotAgent` and existing main Durable Object. SQLite stores web messages, stock snapshots, and one named allocation basket per Clerk user and verified X account. Market quotes use the existing `basedbot-aero` service.

The server retrieves the Clerk user and accepts exactly one verified X OAuth provider ID. Browser-supplied sender IDs, wallet overrides, and editable user metadata cannot establish wallet ownership. The adapter looks up the existing BasedBot wallet by numeric X ID. A user without one must first send `/wallet` to BasedBot on X.

Web conversations have their own history and YOLO setting, initially off. They share the agent's transaction previews, confirmations, execution locks, persisted steps, and receipt recovery. Retrying a message keeps its UUID. Confirmation buttons appear only when the displayed code matches the stored preview's hash.

## Local development

Install all workspaces with `bun install` from the BeeGreat root. Configure `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in ignored `.env.local` and `.dev.vars`. Do not commit these files. Check for an existing server before starting `bun run dev`, which uses port 5198.

Service bindings are configured as remote. Local frontend development therefore uses the deployed BasedBot agent and real wallet state. Do not confirm transactions as part of routine UI testing.

Run `bun run typecheck` and `bun run build` here. Run `bun run basedbot:check` at the BeeGreat root. The stock catalog is regenerated from the pinned Aero SDK during development and builds.

## Deployment

Deploy the root `basedbot` Worker first when changing `StocksGateway` or `src/web.ts`. Then run `bun run deploy` here. Both configurations pin Francesco's personal Cloudflare account. Install Clerk credentials as Worker secrets and keep the public build key paired with the server secret.

The current deployment uses Clerk's **development instance**, with its shared X OAuth client. It is a deployed preview. Production authentication needs a Clerk production instance and its X OAuth configuration. Authenticated wallet lookup, chat, basket persistence, and trade previews still need a real browser session test after the user accepts X consent. No real transaction was submitted during implementation.

Legacy `/stocks` URLs redirect permanently to `/aero/stocks`, preserving path suffixes and query parameters. API and Clerk return URLs use the new path.

This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
