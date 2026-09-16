# Aero stocks

The web app at https://aerocli.buddytools.org/aero/stocks uses TanStack Start, Clerk X sign-in, Shadcn, Tailwind, Motion, and Cloudflare Workers. There is no Convex dependency.

The landing page remains in `BeeGreat/packages/sugar/site/public`. Its Worker owns `/`; this app owns `/aero/stocks*`, legacy `/stocks*` redirects, and `/assets/*`.

The same app also runs at https://pecu.app/aero/stocks through the `apps/pecu/apps/site` routing Worker. CLI navigation points to https://pecu.app/aero/cli and its `/docs` page.

## Agent page

`/agent` is the browser conversation with the Pecu agent, served by this Worker and routed from `pecu.app/agent` by `apps/pecu/apps/site`. It uses the Pecu design system (`src/pecu.css`, tokens in `apps/pecu/docs/design-system.md`) and components ported from Vercel AI Elements under `src/components/ai-elements/` (conversation, message, prompt input, suggestions, confirmation, shimmer). The ports drop the AI SDK, Streamdown and attachment code because the agent is request/response.

The thread sidebar keeps page navigation below the thread list. Its toggle button and Cmd+Shift+S collapse or reopen it without changing the conversation. The collapsed state survives thread switches. On narrow screens, the shortcut toggles the Threads dialog. On narrow screens, the Threads dialog provides the same links. The conversation hides the scrollbar while preserving scrolling and the jump-to-latest button.

Threads are client-chosen ids in the `t` search param. The backend keys each thread as its own conversation (`stocks:USER:SENDER#THREAD`), so previews, confirmations and YOLO are scoped per thread. No `t` means the original conversation the Stocks page uses. `POST /aero/stocks/api/thread-delete` removes a thread's history. The idle and thinking snail clips under `src/assets/mascot/` ship as VP9 WebM with alpha plus HEVC with alpha for Safari.

## Backend and identity

The private `PECU` service binding calls `StocksGateway` in the existing `pecu` Worker. It delegates to the same `PecuAgent` and existing main Durable Object. SQLite stores web messages, stock snapshots, and one named allocation basket per Clerk user and verified X account. Market quotes use the existing `pecu-aero` service.

The server retrieves the Clerk user and accepts exactly one verified X OAuth provider ID. Browser-supplied sender IDs, wallet overrides, and editable user metadata cannot establish wallet ownership. The adapter looks up the existing Pecu wallet by numeric X ID. A user without one must first send `/wallet` to Pecu on X.

Web conversations have their own history and YOLO setting, initially off. They share the agent's transaction previews, confirmations, execution locks, persisted steps, and receipt recovery. Retrying a message keeps its UUID. Confirmation buttons appear only when the displayed code matches the stored preview's hash.

## Local development

Install all workspaces with `bun install` from the BeeGreat root. Configure `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in ignored `.env.local` and `.dev.vars`. Do not commit these files. `.env.local` must also exist when you build for deploy: Vite inlines `VITE_CLERK_PUBLISHABLE_KEY` at build time, and a bundle built without it renders a 500 on every page even though the Worker secret is set. Check for an existing server before starting `bun run dev`, which uses port 5198.

Service bindings are configured as remote. Local frontend development therefore uses the deployed Pecu agent and real wallet state. Do not confirm transactions as part of routine UI testing.

Run `bun run typecheck` and `bun run build` here. Run `bun run pecu:check` at the BeeGreat root. The stock catalog is regenerated from the pinned Aero SDK during development and builds.

## Deployment

Deploy the root `pecu` Worker first when changing `StocksGateway` or `src/web.ts`. Then run `bun run deploy` here. Both configurations pin Francesco's personal Cloudflare account. Install Clerk credentials as Worker secrets and keep the public build key paired with the server secret.

The current deployment uses Clerk's **development instance**, with its shared X OAuth client. It is a deployed preview. Production authentication needs a Clerk production instance and its X OAuth configuration. Authenticated wallet lookup, chat, basket persistence, and trade previews still need a real browser session test after the user accepts X consent. No real transaction was submitted during implementation.

Legacy `/stocks` URLs redirect permanently to `/aero/stocks`, preserving path suffixes and query parameters. API and Clerk return URLs use the new path.

This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
