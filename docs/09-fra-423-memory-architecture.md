# 09 – FRA-423 Memory Architecture

Status: prototype decision ready for independent review
Decision date: 2026-07-10
Scope: backend schema, public Convex seams, synthetic tests, and evaluation design only

## Decision

Convex is BeeGreat's canonical memory store. Git contains only non-personal
schemas, documentation, templates, synthetic fixtures, and tests. No personal
bookmark, note, conversation, query, or derived-memory content belongs in Git.

This decision supersedes the 2026-07-04 choice of SuperMemory as canonical
long-term storage in docs 03, 05, 07, and 08. Those references remain marked as
historical so the conflict and its resolution stay visible. A semantic service
could be evaluated later only as a rebuildable derived index; it must never be
the authority for provenance, correction history, retention, or deletion.

### Options considered

| Option                   | Advantages                                                                                                                           | Rejected cost or boundary                                                                                                                         | Decision                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Git Markdown             | Human-readable diffs, familiar review, excellent for schemas and test templates                                                      | Personal content persists in clone history, owner isolation is not an application boundary, and deletion cannot reliably erase Git history        | Use only for non-personal schema, docs, templates, and tests              |
| Convex-native            | One transactional authority, Clerk-backed owner isolation, typed unions, indexed reads, immutable revisions, and explicit hard purge | V1 retrieval is lexical and bounded; private-data relevance still needs evaluation                                                                | **Selected canonical store**                                              |
| SuperMemory-style hybrid | Potential semantic recall and managed embeddings                                                                                     | Duplicates personal content, complicates provenance and deletion, creates cross-system drift, and makes the external service a privacy dependency | Defer; future service may only hold deletable/rebuildable derived indexes |

## Canonical model

The `memories` table is a discriminated union with four value schemas:

| Kind             | Canonical fields                                                  | Default retention                                         | Provenance rule                                                   |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| `bookmark`       | `title`, `url`, optional `summary`                                | Keep until owner deletion                                 | `manual` or an identified `import`                                |
| `note`           | optional `title`, `text`                                          | Keep until owner deletion                                 | `manual` or an identified `import`                                |
| `conversation`   | optional `title`, `transcript`                                    | Expire 30 days after capture                              | `conversation`, `manual`, or identified `import`                  |
| `derived-memory` | `memoryType` (`fact`, `preference`, `goal`, or `summary`), `text` | Keep until deletion, capped by the earliest source expiry | `derived`; requires one to twenty same-owner, non-derived sources |

Every canonical row also stores the server-derived `ownerKey`, descriptive
provenance, retention, `currentRevision`, and timestamps.
`ownerKey` is always `ctx.auth.getUserIdentity().tokenIdentifier`; it is never a
public argument. Existing subject-keyed BeeGreat tables are deliberately not
migrated by this prototype.

Two child tables complete the model:

- `memoryRevisions` is append-only during normal editing. Capture creates
  revision 1; correction appends the next complete value snapshot and advances
  canonical state in the same mutation. Provenance, retention, kind, and source
  graph cannot be changed through correction.
- `memorySourceLinks` records typed `supports` or `summarizes` edges from a
  derived memory to a canonical bookmark, note, or conversation. Capture checks
  that every endpoint belongs to the authenticated owner and is not expired.

All reads over collections use declared indexes. Inspection reads revisions by
`ownerKey + memoryId + revision` and links by owner plus derived/source ID.
Retrieval reads at most the 64 newest rows from the `by_owner_key` index.

The prototype also enforces encoded-size budgets with Convex's
`getConvexSize`: 16 KiB per memory value, 4 KiB per provenance object, 1 KiB
per correction reason, and 1 KiB per authenticated owner key. These are
transaction-safety limits, not database maximums. Capture and correction
cannot create a larger canonical value or revision through the public API.

## Public backend seams

The prototype intentionally exposes only these authenticated functions:

| Function                | Contract                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.memories.capture`  | Validate and normalize one value, derive owner from auth, create canonical row plus revision 1, and validate/create source links for derived memory                                                                     |
| `api.memories.inspect`  | Return only the caller's retained canonical value, immutable revisions, provenance, retention, and source references; return `null` for missing, expired, or foreign rows                                               |
| `api.memories.correct`  | Require ownership and the same kind, append a new immutable revision, and advance canonical content; an identical retry is a no-op                                                                                      |
| `api.memories.remove`   | Hard-delete the owner's canonical row, all revisions, and all incoming/outgoing source links; deleting a source also purges linked derived memories so paraphrased personal content and broken provenance do not remain |
| `api.memories.retrieve` | Rank a 64-row owner-indexed candidate window with the deterministic local scorer and return at most 20 retained results                                                                                                 |

There is no UI, agent-facing caller-supplied owner API, external retrieval
service, embedding pipeline, deployment step, or background retention job in
this prototype.

## Retention, correction, and deletion

- `keep-until-deleted` has no implicit expiry.
- `expire-at` must be a finite future timestamp at capture. `NaN` and both
  infinities are rejected. Expired rows are immediately unavailable to
  inspect, retrieve, derive from, or correct.
- Derived memory may not outlive an expiring source; its effective expiry is
  capped to the earliest source expiry.
- Expiry is a logical access boundary in this prototype. An automatic physical
  expiry sweeper is not implemented, so `expire-at` is not yet a physical
  erasure SLA. The owner can still call `remove` on an expired ID for immediate
  hard purge.
- Correction retains a maximum of 50 immutable revisions in this bounded
  prototype. User deletion removes every revision rather than retaining an
  audit copy with personal text.
- A source can have at most eight linked derived memories. Capture reads every
  source's indexed fan-out and rejects the ninth before inserting any row.
- `remove` is idempotent and returns counts for purged canonical rows,
  revisions, and links. Foreign IDs receive the same non-revealing result as a
  missing ID.

### Transaction-safety envelope

The public API can create at most 50 revisions per memory, 20 source links per
derived memory, and eight derived dependents per source. The worst public
source cascade therefore deletes at most 9 canonical rows, 450 revisions, and
160 links: 619 documents total. With the encoded payload limits above, the
document payload read/deleted by that cascade remains below 10 MiB, leaving
headroom beneath Convex's current 16 MiB read and 16 MiB write transaction
limits. It also stays far below the 32,000 scanned-document, 4,096 index-range,
and 16,000 written-document limits documented in
[Convex transaction limits](https://docs.convex.dev/production/state/limits#transactions).

Retrieval reads at most 64 canonical rows. Even if every value and provenance
object is exactly at its accepted maximum, that is below 1.5 MiB of canonical
document payload before ranking, and at most 20 bounded rows are returned.
`convex-test` does not emulate transaction resource limits, so the automated
tests exercise every public boundary while the enforced caps and arithmetic
provide the production-limit guarantee.

## Privacy boundaries

- Authentication and authorization are server-side on every public function.
  Client-provided owner IDs do not exist in the contracts.
- `provenance.source` and `externalId` are descriptive metadata, not authority;
  they can themselves be personal and therefore remain in Convex, never Git.
- Cross-owner inspection, correction, source linking, retrieval, and deletion
  are denied without revealing whether the foreign row exists.
- Retrieval operates only on an owner-indexed, bounded in-database window and
  sends no text to another service.
- Tests use reserved `example.test` URLs and invented owners/content. They do
  not contain exported bookmarks, human queries, account identifiers, or
  secrets.
- Logs and deletion receipts contain counts/IDs, not memory text.

## Retrieval v1 and evaluation set

`memoryRelevance.ts` is the pure relevance seam. It tokenizes Unicode text,
weights title/statement matches above body/URL matches, adds a bonus only for
an exact contiguous token sequence, removes zero-score candidates, and breaks
ties by update time then ID. Thus `art` does not match the token `cart`. The
database query remains responsible for authenticated owner scoping, expiry
filtering, and the 64-row bound.

The table below is a **proposed synthetic evaluation set** that is safe to keep
in Git. Its `fixtureId` labels describe fixtures for a future aggregate
evaluation runner; not all ten fixture rows exist in the current automated
suite, and no aggregate scoring runner is implemented in this prototype.

|   # | Query                                        | Expected top `fixtureId`        | Kind           | Why it should win                                       |
| --: | -------------------------------------------- | ------------------------------- | -------------- | ------------------------------------------------------- |
|   1 | `deterministic local retrieval`              | `derived-local-retrieval`       | derived-memory | Exact preference statement                              |
|   2 | `bounded indexed queries`                    | `bookmark-convex-indexes`       | bookmark       | Title/summary describe the indexed-query guide          |
|   3 | `synthetic fixtures ranking`                 | `note-retrieval-evaluation`     | note           | Exact evaluation wording in the note                    |
|   4 | `garden watering schedule`                   | `conversation-garden-plan`      | conversation   | Exact conversation topic, unrelated to backend fixtures |
|   5 | `token identifier owner isolation`           | `note-privacy-boundary`         | note           | Auth/privacy note contains all concepts                 |
|   6 | `hard purge revisions source links`          | `bookmark-deletion-policy`      | bookmark       | Deletion reference names all three purge targets        |
|   7 | `conversation expires after thirty days`     | `conversation-retention-window` | conversation   | Exact retention rule                                    |
|   8 | `derived memory source expiry`               | `derived-retention-summary`     | derived-memory | Exact derived-retention summary                         |
|   9 | `correction immutable revision history`      | `note-revision-history`         | note           | Exact correction/history rule                           |
|  10 | `git markdown convex supermemory comparison` | `bookmark-storage-comparison`   | bookmark       | Storage-option comparison reference                     |

A future evaluation runner should report top-1 accuracy, recall@3, owner-leak
count, and whether expired/deleted items are absent. The current automated
suite exercises the public retrieval seam with representative rows of every
kind, maximum payload and candidate bounds, exact-token phrase matching,
foreign-owner exclusion, and expired/deleted-item exclusion. It does not yet
calculate aggregate top-1 or recall@3 metrics. The proposed set is a design
artifact, not evidence of measured retrieval quality.

## Remaining private-data gate

Empirical FRA-423 acceptance still requires the approved private export of 20
bookmarks and at least ten human relevance queries. That material must be
loaded through a private, authenticated development path and must not be added
to source control, test snapshots, logs, or review artifacts. Until that gate
is supplied and evaluated, this slice is safe for independent code/design
review but is not evidence of personal-data retrieval quality or production
readiness.
