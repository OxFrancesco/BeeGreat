# Pecu cards on X connection

A signed-in Pecu user with a verified X connection receives one random card from the 30 Blender designs when the web app loads or their connected account changes. Existing connected users are included through the backfill script before the frontend rollout.

The first-connection drop admits at most 3,000 recipients. Each Clerk account and each verified X ID can receive it once. Refreshing, reconnecting, or repeating a request returns the original grant. Cards remain visible after disconnecting X. Inventory supports up to 10 copies of each design per user; additional earning is not enabled.

The account menu's My cards action opens the collection on both the Pecu agent and Stocks pages, including mobile browsers. The dialog also opens after a new grant. Each owned card loads its compressed Blender model on demand. Drag to rotate, pinch or scroll to zoom, turn over, or reset the view. Keyboard users can use arrows, plus/minus, and Home. Rendering occurs on interaction rather than in a continuous animation loop. A transparent image remains available if 3D loading fails. The Expo, Android, CLI, and iMessage apps do not use this Pecu Clerk connection flow. Agent providers and wallet execution are unaffected.

## Storage and authorization

The existing Pecu Durable Object stores recipients and inventory in SQLite. A single SQL insert enforces recipient capacity and unique account identities. An insert trigger adds the first inventory copy in the same transaction. Database constraints enforce editions 1–3,000 and copy counts 1–10.

The frontend server obtains Clerk identity and verified X identity itself. It ignores client-supplied identity and uses the existing service binding. Claim requests require same-origin checks. The backfill route requires the existing admin credential. Public routes return only the signed-in user's collection and aggregate remaining capacity.

The grant runs on app load, account updates, and window focus. Linking X outside an open Pecu page grants on the next visit. This release does not install a Clerk webhook.

## Existing users

Run `scripts/backfill-cards.ts` with Bun from the repository environment. Set `PECU_CARDS_CLERK_APP`, `PECU_CARDS_CLERK_INSTANCE`, and the frontend's `VITE_CLERK_PUBLISHABLE_KEY`. The script verifies that the Clerk instance matches that publishable key, scans users oldest first, and prints aggregate counts. It is a dry run unless passed `--apply`; applying also requires `ADMIN_TOKEN` or the existing Pecu admin credential in macOS Keychain. Repeating the command cannot duplicate grants.

## Validation

SQLite tests cover reconnects, duplicate identities, restart persistence, capacity, inventory bounds, and rollback on failed inventory insertion. A real workerd test sends concurrent requests to the same Durable Object and verifies exactly 3,000 grants. Browser fixtures cover collection, mobile layout, disconnected, sold-out, and error states independently of authentication.

Card artwork uses transparent PNG and WebP exports from Blender. The studio floor is hidden from rendering and transparent film is enabled; the modeled card frame and interior artwork remain intact.

The WebP thumbnails and the Draco decoder are committed under `apps/pecu/apps/stocks/public/assets/pecu-cards/`. The 30 GLB models (39 MB) are not; they are deployed with the Worker and rebuilt with `tools/pecu-cards/export-web.py`. A checkout without them still shows the WebP image for each card.
