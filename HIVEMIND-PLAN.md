# HIVEMIND — The Mind Tab

A mymind-inspired bookmark space for BeeGreat. The user saves websites, tweets, and
YouTube videos; a Convex `scraper` module fetches the content, GPT-5.6-luna summarizes
and labels it, and the result renders in a honeycomb of hexagons (plus cards and list
views) on mobile and web. Bee has full read/write access to the user's Mind.

## Decisions (confirmed)

| Question | Decision |
| --- | --- |
| Capture paths | In-app add + Bee agent tool + share sheet (`expo-share-intent`) |
| Search depth | Convex full-text search index (no vectors in v1) |
| LLM billing | User's connected ChatGPT credential by default, OpenRouter fallback |
| Platforms | Mobile (new tab) + web (`/mind` route) in this pass |
| Model | GPT-5.6-luna (`openai/gpt-5.6-luna` on OpenRouter; same model via ChatGPT credential) |

## Architecture at a glance

```
 add (app / web / share / Bee tool)
        │  bookmarks.add (mutation: dedupe, insert status=pending)
        ▼
 ctx.scheduler.runAfter(0, internal.scraper.process, { bookmarkId })
        ▼
 scraper.process ('use node' internalAction)
   ├─ kind=website → Firecrawl v2 /scrape (markdown + metadata)
   ├─ kind=tweet   → twitterapi.io /twitter/tweets?tweet_ids=…
   ├─ kind=youtube → youtubei.js transcript
   │                  └─ fallback: audio stream → ElevenLabs Scribe STT
   └─ summarize+label → GPT-5.6-luna
        ├─ default: user ChatGPT credential (chatgptAuthActions.resolveForAgent)
        └─ fallback: OpenRouter (OPENROUTER_API_KEY)
        ▼
 internal.bookmarks.saveScrape / markFailed  → status=ready|failed (reactive UI)
```

The pipeline never blocks the client: `add` returns immediately and every state
transition streams to the UI through the normal Convex subscription.

## 1. Backend — `packages/backend/convex`

### 1.1 `schema.ts` — `bookmarks` table

```ts
bookmarks: defineTable({
  ownerKey: v.string(),          // identity.tokenIdentifier (issuer|subject)
  userId: v.string(),            // Clerk subject; agent worker instance id
  url: v.string(),               // as submitted
  normalizedUrl: v.string(),     // canonical form used for dedupe
  kind: v.union(v.literal('website'), v.literal('tweet'), v.literal('youtube')),
  status: v.union(
    v.literal('pending'),        // inserted, scraper scheduled
    v.literal('processing'),     // scraper picked it up
    v.literal('ready'),
    v.literal('failed'),
  ),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  labels: v.array(v.string()),
  note: v.optional(v.string()),          // user's own note
  content: v.optional(v.string()),       // markdown / tweet text / transcript, truncated
  searchText: v.string(),                // title + labels + summary + content slice
  meta: v.optional(v.object({
    siteName: v.optional(v.string()),
    author: v.optional(v.string()),      // site author / tweet display name / channel
    handle: v.optional(v.string()),      // tweet @handle
    imageUrl: v.optional(v.string()),    // og:image / tweet media / video thumbnail
    faviconUrl: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    tweetId: v.optional(v.string()),
    videoId: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  })),
  transcriptSource: v.optional(v.union(v.literal('captions'), v.literal('scribe'))),
  errorCode: v.optional(v.string()),     // stage-scoped taxonomy, see 1.4
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_owner_key_and_created_at', ['ownerKey', 'createdAt'])
  .index('by_owner_key_and_normalized_url', ['ownerKey', 'normalizedUrl'])
  .index('by_owner_key_and_kind_and_created_at', ['ownerKey', 'kind', 'createdAt'])
  .searchIndex('search_text', {
    searchField: 'searchText',
    filterFields: ['ownerKey', 'kind'],
  })
```

Bounds: `content` truncated to 64 KB, `searchText` to 32 KB, ≤ 12 labels of ≤ 40
chars, notes ≤ 4 KB — everything stays far below the 1 MB document limit.

### 1.2 `scraperShared.ts` — pure V8-safe helpers (unit-testable)

- `detectBookmarkKind(url)` → `{ kind: 'tweet', tweetId }` for
  `x.com|twitter.com/<user>/status/<id>`; `{ kind: 'youtube', videoId }` for
  `youtube.com/watch?v=`, `youtube.com/shorts/<id>`, `youtube.com/live/<id>`,
  `youtu.be/<id>`; `{ kind: 'website' }` otherwise. Rejects non-http(s) schemes.
- `normalizeBookmarkUrl(url)` → lowercase host, strip fragments + tracking params
  (`utm_*`, `si`, `fbclid`, …), canonical tweet/video URL for those kinds.
- `buildSearchText({ title, labels, summary, content })` with truncation.
- `truncateContent(text, limit)` — UTF-8-safe.

### 1.3 `bookmarks.ts` — app-facing functions (V8)

Auth follows the `memories.ts` pattern (`ownerKey = identity.tokenIdentifier`,
`userId = identity.subject`). Every read/write is scoped to `ownerKey`.

- `list({ kind?, label?, paginationOpts })` — paginated query over
  `by_owner_key_and_created_at` (or the kind index), newest first; label filter
  applied post-index (labels are small arrays).
- `search({ query, kind? })` — `withSearchIndex('search_text')`, top 24 hits.
- `get({ bookmarkId })` — full document, ownership-checked.
- `labels()` — distinct labels with counts for the filter chips (bounded scan of
  newest 500 rows).
- `add({ url, note? })` (mutation) — validate + detect kind + normalize; if a row
  with the same `normalizedUrl` exists, return it (idempotent); else insert
  `status: 'pending'` and `ctx.scheduler.runAfter(0, internal.scraper.process, …)`.
- `update({ bookmarkId, title?, labels?, note? })` — user edits; rebuilds `searchText`.
- `remove({ bookmarkId })` — hard delete.
- `retry({ bookmarkId })` — only when `failed`; increments `retryCount`, resets to
  `pending`, reschedules `internal.scraper.process`.

Internal (pipeline writers, all keyed by `bookmarkId`):

- `internal.bookmarks.getForProcessing` (internalQuery)
- `internal.bookmarks.markProcessing`
- `internal.bookmarks.saveScrape({ title, summary, labels, content, meta, transcriptSource? })`
  — sets `status: 'ready'`, rebuilds `searchText`, preserves user-edited fields if
  the user renamed/labeled while processing.
- `internal.bookmarks.markFailed({ errorCode, errorMessage })`

### 1.4 `scraper.ts` — the scraper module (`'use node'`)

`export const process = internalAction({ args: { bookmarkId: v.id('bookmarks') } })`

Stages and integrations:

1. **Fetch** (by kind)
   - **Website — Firecrawl**: `POST https://api.firecrawl.dev/v2/scrape`
     `{ url, formats: ['markdown'], onlyMainContent: true }` with
     `Authorization: Bearer ${env.FIRECRAWL_API_KEY}`. Use `data.markdown` as
     content and `data.metadata` (title, description, ogImage, favicon) for meta.
   - **Tweet — twitterapi.io**: `GET https://api.twitterapi.io/twitter/tweets?tweet_ids=<id>`
     with `X-API-Key: ${env.TWITTERAPI_IO_API_KEY}`. Content = tweet text (plus
     quoted tweet text when present); meta = author name/handle/avatar, first
     media image, createdAt.
   - **YouTube — youtubei.js (`Innertube`)**: `getInfo(videoId)` → title, channel,
     thumbnail, duration; try `getTranscript()` first (`transcriptSource: 'captions'`).
     If unavailable/empty/blocked: guard `duration ≤ 60 min`, download the
     `bestefficiency` audio-only stream to a buffer (~≤ 30 MB), then
     **ElevenLabs Scribe**: `POST https://api.elevenlabs.io/v1/speech-to-text`
     (multipart: `model_id=scribe_v1`, `file=audio`) with
     `xi-api-key: ${env.ELEVENLABS_API_KEY}` (`transcriptSource: 'scribe'`).
2. **Summarize + label — GPT-5.6-luna**
   - Prompt: content (truncated to the model budget) + kind + URL → strict JSON
     `{ title, summary (2–4 sentences), labels (3–6 lowercase topical tags) }`.
   - **Default path**: `ctx.runAction(internal.chatgptAuthActions.resolveForAgent,
     { userId })`; on `status: 'ok'` call the ChatGPT-subscription Responses API
     with the access token (mirror the Codex provider in `resources/pi` —
     `chatgpt-account-id` header etc.) using model `gpt-5.6-luna`.
   - **Fallback** (credential `missing | reauth | busy | unavailable`, or the
     subscription call fails): `POST https://openrouter.ai/api/v1/chat/completions`
     with `model: 'openai/gpt-5.6-luna'` and `OPENROUTER_API_KEY`.
   - If both fail, still `saveScrape` with scraped metadata (title from source,
     no summary, `labels: []`) and `errorCode: 'summary-failed'` so the bookmark
     is usable; do not hard-fail the whole pipeline on the LLM stage.
3. **Persist** via the internal mutations above.

Error taxonomy (`errorCode`): `invalid-url`, `scrape-failed`, `tweet-not-found`,
`transcript-unavailable`, `audio-too-long`, `transcription-failed`,
`summary-failed`, `unknown`. Errors surface as a retryable failed card.

Helper split for testability: `scrapeWebsite`, `scrapeTweet`, `scrapeYoutube`,
`summarizeBookmark` accept an injected `fetch` so vitest can run them without
network access.

### 1.5 `agentMind.ts` + `http.ts` — Bee access

- `agentMind.ts` internal functions (args: `userId` string, matched against rows):
  `searchBookmarks({ userId, query, kind? })`, `listBookmarks({ userId, kind?, label?, limit? })`
  (compact summaries — id, kind, title, summary, labels, url),
  `getBookmark({ userId, bookmarkId })` (full content/transcript),
  `saveBookmark({ userId, url, note? })` (insert + schedule pipeline; needs the
  user's `ownerKey`, resolved from their `hives` row like `agentFocus` does).
- `http.ts`: new `POST /internal/mind` route, exact same broker-secret guard as
  `/internal/focus`, dispatching `operation: 'search' | 'list' | 'get' | 'save'`.

### 1.6 `convex.config.ts` — declared env

```ts
FIRECRAWL_API_KEY: v.optional(v.string()),
TWITTERAPI_IO_API_KEY: v.optional(v.string()),
ELEVENLABS_API_KEY: v.optional(v.string()),
OPENROUTER_API_KEY: v.optional(v.string()),
```

Set via `bunx convex env set <NAME> <value>`.

### 1.7 Tests (`vitest` + `convex-test`)

- `scraperShared.test.ts` — kind detection (x.com, twitter.com, shorts, youtu.be,
  live, plain sites, garbage input), URL normalization, truncation.
- `bookmarks.test.ts` — add schedules the scraper + dedupes by normalized URL,
  owner scoping (user B cannot read/edit user A), update/remove/retry rules,
  search index round-trip, label aggregation.
- `scraper.test.ts` — each scrape helper against mocked `fetch` fixtures;
  Scribe fallback when transcript fails; LLM fallback order (ChatGPT → OpenRouter
  → degraded save); failure taxonomy.
- `agentMind.test.ts` — operations scoped by userId; save schedules processing.

## 2. Agent — `packages/agent`

New `src/shared/mind-tools.ts` (mirroring `bee-tools.ts` / `focus-client.ts`):

- `search_mind` — "Search the user's Mind (saved websites, tweets, YouTube videos) by meaning or keyword."
- `list_bookmarks` — optional kind/label filters.
- `get_bookmark` — full content/transcript by id, for deep questions.
- `save_bookmark` — save a URL the user shares in conversation.

All call `POST {convexSiteUrl}/internal/mind` with the credential-broker secret,
30 s timeout, same error shaping as the focus client. Register in the Bee agent
tool list and add a short "Mind" section to `agents/bee.md` (when to search vs.
save; never invent bookmarks).

## 3. Mobile — `apps/mobile`

### 3.1 Tab + routes

- `(tabs)/_layout.tsx`: add `mind` trigger (label **Mind**, template-rendered icon,
  placed between Hive and Talk).
- `(tabs)/mind/_layout.tsx` — Stack; `index.tsx` — the Mind screen;
  `[bookmarkId].tsx` — detail.

### 3.2 Mind screen (`index.tsx` + `components/mind/`)

- **Views** (segmented `view-switcher.tsx`, persisted preference):
  - `hex` (default, the signature view): honeycomb grid of pointy-top hexes built
    with the existing Skia `makeHexPath` (`hex-avatar.tsx`), image-filled
    (og-image / tweet media / video thumbnail) with honey-stroke, offset rows,
    kind glyph badge; pending cells shimmer, failed cells show retry.
  - `cards`: 2-column masonry-style cards — image, title, summary snippet, kind
    badge, labels.
  - `list`: compact rows — favicon/kind icon, title, domain/handle/channel, time.
- **Search + filters**: `headerSearchBarOptions` search bar driving
  `api.bookmarks.search`; horizontal label chips from `api.bookmarks.labels`;
  kind filter (All / Sites / Tweets / Videos).
- **Add**: FAB/`+` opens `add-bookmark-sheet.tsx` (formSheet) — URL field with
  clipboard suggestion (`expo-clipboard`), optional note, calls
  `api.bookmarks.add`; new bookmark appears instantly as a pending cell and
  fills in reactively.
- **Pagination**: `usePaginatedQuery` with infinite scroll.
- Empty state in the warm Hive voice; entering animations honoring reduced motion.

### 3.3 Detail (`[bookmarkId].tsx`)

Hero image + hex-styled kind badge; title (editable), summary, labels (add/remove),
note, "Open" link-out, collapsible full content/transcript (with captions/Scribe
source note for videos), re-scrape (retry), delete. Failed state explains the
error and offers retry.

### 3.4 Share sheet

`expo-share-intent` config plugin (iOS share extension target + Android intent
filters). On a shared URL: deep-link to the Mind tab, auto-call
`api.bookmarks.add`, show a "Saved to Mind" confirmation. Requires a new dev
build (the project already builds custom targets for widgets).

## 4. Web — `apps/web`

- `routes/_app/mind.tsx` (+ `mind.$bookmarkId.tsx` or detail panel) and
  `features/mind/` mirroring the mobile feature: hex view via CSS `clip-path`
  honeycomb grid, cards via CSS columns, list; search input, label chips, add
  form with paste detection; same Convex functions; Tailwind styling in the Hive
  design language.
- Update `PARITY.md` with the new Mind rows.

## 5. Verification

- [ ] `bun run test:run` and `bun run typecheck` in `packages/backend`
- [ ] `bun run lint` in `apps/mobile`; `bun run build && bun run lint` in `apps/web`
- [ ] Set the four env vars, then end-to-end on a dev deployment: save a website,
      a tweet, a captioned YouTube video, and a captionless one (Scribe path)
- [ ] Bee chat: "save this link", "what did I save about X?", "open that video I
      bookmarked" resolve through the mind tools
- [ ] New dev build; share from Safari/X/YouTube on device → bookmark appears
- [ ] Reduced motion, VoiceOver labels on cells, 44 px touch targets

## Risks & notes

- **YouTube blocking**: datacenter IPs sometimes can't fetch transcripts/streams;
  Scribe fallback covers captionless videos, and failures degrade to a retryable
  failed card, never a stuck spinner. Audio capped at ~60 min.
- **GPT-5.6-luna via subscription token**: model availability under the ChatGPT
  credential is verified at implementation time against `resources/pi`; the
  OpenRouter path always works and the pipeline degrades gracefully.
- **Share capture** opens the app rather than an in-sheet native UI; a true
  in-sheet extension is a follow-up.
- **Doc 09 / FRA-423**: the memory system defines a `bookmark` memory *kind*;
  Mind keeps its own `bookmarks` table. Linking memories to bookmarks is a later
  slice, deliberately out of scope here.
- **Tab count**: Mind is the 4th nav tab; Talk stays a separate search-role pill.
