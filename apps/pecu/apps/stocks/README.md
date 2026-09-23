# Aero stocks

The web app at https://aerocli.buddytools.org/aero/stocks uses TanStack Start, Clerk sign-in (X and Google), Shadcn, Tailwind, Motion, and Cloudflare Workers. There is no Convex dependency.

The landing page remains in `BeeGreat/packages/sugar/site/public`. Its Worker owns `/`; this app owns `/aero/stocks*`, legacy `/stocks*` redirects, and `/assets/*`.

The same app also runs at https://pecu.app/aero/stocks through the `apps/pecu/apps/site` routing Worker. CLI navigation points to https://pecu.app/aero/cli and its `/docs` page.

## Agent page

`/agent` is the browser conversation with the Pecu agent, served by this Worker and routed from `pecu.app/agent` by `apps/pecu/apps/site`. It uses the Pecu design system (`src/pecu.css`, tokens in `apps/pecu/docs/design-system.md`) and components ported from Vercel AI Elements under `src/components/ai-elements/` (conversation, message, prompt input, suggestions, confirmation, shimmer). The ports drop the AI SDK and attachment code. Agent and Stocks replies share Streamdown Markdown rendering with GFM tables, lists, code blocks and KaTeX math. Use `$...$` for inline math and `$$...$$` for display math; escape literal dollar signs as `\$`. Raw HTML is skipped. Responses currently arrive in full after the backend completes the turn.

The wallet address in the top bar previews Base trading P&L on hover and opens the full P&L page at `#pnl` on click. `GET /stocks/api/pnl?days=7|30|90|365` serves both through the gateway's `pnl` operation, with a ten-minute Nansen cache per wallet and period. See `apps/pecu/docs/nansen-charts.md`.

Polymarket reads attach cards to replies through the shared `AnalyticsCard`, alongside the Nansen charts. `bun run build:polymarket-showcase` builds `/polymarket-showcase` from `polymarket-showcase/data.json`; the site build runs it. See `docs/42-pecu-polymarket.md` at the monorepo root.

The thread sidebar keeps page navigation below the thread list. Its toggle button and Cmd+Shift+S collapse or reopen it without changing the conversation. The collapsed state survives thread switches. On narrow screens, the shortcut toggles the Threads dialog. On narrow screens, the Threads dialog provides the same links. All Pecu pages and nested scroll areas hide horizontal and vertical scrollbars while preserving native scrolling and the jump-to-latest button.

Threads are client-chosen ids in the `t` search param. The backend keys each thread as its own conversation (`stocks:USER:SENDER#THREAD`), so previews, confirmations and YOLO are scoped per thread. No `t` means the original conversation the Stocks page uses. `POST /aero/stocks/api/thread-delete` removes a thread's history. The idle and thinking snail clips under `src/assets/mascot/` ship as VP9 WebM with alpha plus HEVC with alpha for Safari.

## Profile page

`/profile` shows the Pecu wallet and the viewer's organizations and Safes. `/profile/safe/$address` has the shared transaction queue, owners and settings (spending limits, modules, removal). `GET /stocks/api/profile` and `GET /stocks/api/profile-safe?safe=0x…` read through the gateway's `profile` and `profile-safe` operations; `POST /stocks/api/profile` sends one typed action from `apps/pecu/src/safe-profile-contract.ts` through `profile-action`. Actions that sign return the usual preview, confirmed with the same code flow. Browser wallets connect through EIP-6963 (`src/lib/browser-wallet.ts`), sign SafeTx typed data and can execute directly. `bunx vite --config tests/browser/profile.vite.config.ts` serves a fixture at `/profile.html` with fictional data and a simulated wallet; add `?connected`, `?empty`, `&path=/profile/safe/0x…` and `&tab=owners`. See `docs/39-safe-organization-wallets.md` at the monorepo root.

## Backend and identity

The private `PECU` service binding calls `StocksGateway` in the existing `pecu` Worker. It delegates to the same `PecuAgent` and existing main Durable Object. SQLite stores web messages, stock snapshots, and one named allocation basket per Clerk user and Pecu sender. Market quotes use the existing `pecu-aero` service.

The server retrieves the Clerk user and resolves one Pecu sender from it (`src/web-identity.ts`, `webSenderId`). Browser-supplied sender IDs, wallet overrides, and editable user metadata cannot establish wallet ownership.

- A user with exactly one verified X OAuth account keeps the numeric X ID as sender. The adapter looks up the existing Pecu wallet by that ID, so the web app and X DMs share one wallet, and a user without one must first send `/wallet` to Pecu on X.
- A user with no verified X account (Google or any other Clerk method) gets the web-only sender `web-<clerk user id>`. The agent provisions its Base smart wallet on the first message, under the Crossmint owner `userId:basedbot-web-<clerk user id>`, and `state.senderKind` is `web` so the UI does not point the user to X. This wallet is separate from any X wallet.
- Two verified X accounts on one Clerk user are ambiguous and rejected.

Linking or unlinking an X account in the Clerk profile therefore changes which sender, wallet, and history the signed-in user sees; the previous wallet is not merged or moved.

Web conversations have their own history and YOLO setting, initially off. They share the agent's transaction previews, confirmations, execution locks, persisted steps, and receipt recovery. Retrying a message keeps its UUID. Confirmation buttons appear only when the displayed code matches the stored preview's hash.

## Local development

Install all workspaces with `bun install` from the BeeGreat root. Configure `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in ignored `.env.local` and `.dev.vars`. Do not commit these files. `.env.local` must also exist when you build for deploy: Vite inlines `VITE_CLERK_PUBLISHABLE_KEY` at build time, and a bundle built without it renders a 500 on every page even though the Worker secret is set. Check for an existing server before starting `bun run dev`, which uses port 5198.

Service bindings are configured as remote. Local frontend development therefore uses the deployed Pecu agent and real wallet state. Do not confirm transactions as part of routine UI testing.

Run `bun run typecheck` and `bun run build` here. Run `bun run pecu:check` at the BeeGreat root. The stock catalog is regenerated from the pinned Aero SDK during development and builds.

## Deployment

Deploy the root `pecu` Worker first when changing `StocksGateway` or `src/web.ts`. Then run `bun run deploy` here. Both configurations pin Francesco's personal Cloudflare account. Install Clerk credentials as Worker secrets and keep the public build key paired with the server secret.

The current deployment uses Clerk's **development instance**, with its shared X and Google OAuth clients. It is a deployed preview. Production authentication needs a Clerk production instance with its own X and Google OAuth configuration (Google requires a Google Cloud OAuth client whose authorized redirect URI is the Clerk instance's callback). Google is enabled in the Clerk dashboard under User & Authentication → Social connections; no code change is needed to add or remove a provider, only to change how a provider maps to a Pecu sender. Authenticated wallet lookup, chat, basket persistence, and trade previews still need a real browser session test after the user accepts X consent. No real transaction was submitted during implementation.

Legacy `/stocks` URLs redirect permanently to `/aero/stocks`, preserving path suffixes and query parameters. API and Clerk return URLs use the new path.

This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
