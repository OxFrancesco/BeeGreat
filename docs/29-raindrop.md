# Raindrop bookmarks

The Kotlin app opens Raindrop from Mind, Work connectors, or the Android share
sheet. Browse root and nested collections, search, load more bookmarks, open
links, and edit titles, notes, tags, favorites, and collection placement. New
bookmarks default to Unsorted. Trash is recoverable through the same editor.

## Connection

Connect uses OAuth when the backend has `RAINDROP_CLIENT_ID` and
`RAINDROP_CLIENT_SECRET`. Register `beegreat://raindrop` as the app's redirect URI.
The callback completes under the signed-in BeeGreat identity, with expiring,
single-use state. Refresh tokens stay on the backend.

Without OAuth configuration, Connect opens a personal test-token form. Create
the token in [Raindrop integration settings](https://app.raindrop.io/settings/integrations).
The form does not persist the token on Android. Convex verifies the Raindrop
account and encrypts the token using the existing `BEENNECTOR_CREDENTIALS_KEY`,
with owner-specific authenticated encryption context.

Disconnect deletes BeeGreat's credentials and invalidates pending connection
attempts and sync workers. It keeps imported Mind bookmarks. A personal token
can also be revoked in Raindrop's integration settings.

## Sync into Mind

Connection starts a background import. An hourly job and the Sync button repeat
it in pages of 50 bookmarks. Raindrop saves also request a sync. Each page checks
the connection and run before writing. Failed runs expose a retry message.

Mind deduplicates by normalized URL. Existing Mind bookmarks keep their notes,
titles, and labels. For new imports, Raindrop titles, tags, and notes update when
the remote bookmark changes. BeeGreat's existing scraper processes the page for
chat search and summaries. Deleting an imported copy from Mind suppresses its
reimport. Deleting or trashing a bookmark in Raindrop keeps its Mind copy.

This is an incoming sync. Editing an ordinary Mind bookmark does not write back
to Raindrop. Use the Raindrop editor to update Raindrop. Disconnecting does not
delete either library. Account deletion removes Raindrop credentials, sessions,
and import mappings with the rest of the user's BeeGreat data.

## Clients and providers

Kotlin owns the Raindrop connection and editing UI requested for this feature.
Synced bookmarks use the existing shared Mind contract, so Expo, web, CLI,
iMessage, and voice can read them through their existing Mind or agent paths.
OpenRouter and Codex use those same bookmark tools. No new `beeui` shape or agent
worker deployment is required. Expo and web do not have a dedicated Raindrop
management screen in this change.

The backend target is the deployment configured in Android's `CONVEX_URL`.
Raindrop OAuth registration and an authenticated account check remain separate
from compiling or deploying this code.

## Verification

Backend regression tests cover issuer isolation, signed-out access, single-use
OAuth state, disconnect races, deduplication, preservation of existing notes,
suppression after Mind deletion, refresh ownership, unsafe URLs, and API errors.
Kotlin contract tests cover large bookmark IDs, Convex float encoding, nullable
status fields, and Trash IDs. Build the APK and run Android lint before delivery.

API references: [authentication](https://developer.raindrop.io/v1/authentication/token),
[collections](https://developer.raindrop.io/v1/collections/methods),
[bookmark paging](https://developer.raindrop.io/v1/raindrops/multiple),
[bookmark editing](https://developer.raindrop.io/v1/raindrops/single).
