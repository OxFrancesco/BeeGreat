import { api } from '@beegreat/backend/convex/_generated/api'
import {
  bookmarkKindGlyph as kindGlyph,
  bookmarkKindLabel as kindLabel,
  bookmarkRelativeDate as relativeDate,
  bookmarkSourceLabel,
} from '@beegreat/tool-presentation'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'

import { captureWebFailure } from '~/lib/sentry'

type Bookmark = FunctionReturnType<typeof api.bookmarks.search>[number]
type BookmarkKind = Bookmark['kind']
type ViewMode = 'hex' | 'cards' | 'list'

const KIND_OPTIONS: ReadonlyArray<{
  value: BookmarkKind | undefined
  label: string
}> = [
  { value: undefined, label: 'All' },
  { value: 'website', label: 'Sites' },
  { value: 'tweet', label: 'Tweets' },
  { value: 'youtube', label: 'Videos' },
]

const VIEW_OPTIONS: ReadonlyArray<{ value: ViewMode; label: string }> = [
  { value: 'hex', label: 'Honeycomb' },
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' },
]

export function MindPage() {
  const [view, setView] = useState<ViewMode>(() => readViewPreference())
  const [kind, setKind] = useState<BookmarkKind>()
  const [label, setLabel] = useState<string>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<Id<'bookmarks'>>()
  const [adding, setAdding] = useState(false)

  const labels = useQuery(api.bookmarks.labels, {})
  const searched = useQuery(
    api.bookmarks.search,
    debouncedSearch ? { query: debouncedSearch, kind } : 'skip',
  )
  const listed = usePaginatedQuery(
    api.bookmarks.list,
    { kind, label },
    { initialNumItems: 24 },
  )

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      220,
    )
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    window.localStorage.setItem('beegreat.mind.view', view)
  }, [view])

  const bookmarks = useMemo(() => {
    const source = debouncedSearch ? searched : listed.results
    if (!source) return undefined
    return label
      ? source.filter((bookmark) => bookmark.labels.includes(label))
      : source
  }, [debouncedSearch, label, listed.results, searched])

  return (
    <main className="mind-page">
      <header className="mind-header">
        <div className="mind-title">
          <span className="mind-title__mark" aria-hidden="true">
            ⬡
          </span>
          <div>
            <p className="utility-label">Saved knowledge</p>
            <h1>Mind</h1>
          </div>
        </div>

        <div className="mind-header__actions">
          <ViewSwitcher value={view} onChange={setView} />
          <button
            className="button button--primary mind-add-button"
            type="button"
            onClick={() => setAdding(true)}
          >
            <span aria-hidden="true">＋</span>
            Save link
          </button>
        </div>
      </header>

      <section className="mind-toolbar" aria-label="Search and filter Mind">
        <label className="mind-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search saved links</span>
          <input
            type="search"
            value={search}
            placeholder="Search everything you saved"
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          ) : null}
        </label>

        <div className="mind-kind-filter" aria-label="Filter by link type">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.label}
              className={kind === option.value ? 'is-active' : undefined}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {labels?.length ? (
        <div className="mind-labels" aria-label="Filter by label">
          <button
            className={!label ? 'is-active' : undefined}
            type="button"
            aria-pressed={!label}
            onClick={() => setLabel(undefined)}
          >
            All labels
          </button>
          {labels.map((item) => (
            <button
              key={item.label}
              className={label === item.label ? 'is-active' : undefined}
              type="button"
              aria-pressed={label === item.label}
              onClick={() =>
                setLabel((current) =>
                  current === item.label ? undefined : item.label,
                )
              }
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="mind-library" aria-live="polite">
        {bookmarks === undefined ? (
          <MindLoading view={view} />
        ) : bookmarks.length === 0 ? (
          <MindEmpty
            searching={Boolean(debouncedSearch || label || kind)}
            onAdd={() => setAdding(true)}
            onReset={() => {
              setSearch('')
              setKind(undefined)
              setLabel(undefined)
            }}
          />
        ) : (
          <BookmarkCollection
            bookmarks={bookmarks}
            view={view}
            onSelect={setSelectedId}
          />
        )}

        {!debouncedSearch && listed.status === 'CanLoadMore' ? (
          <button
            className="button button--quiet mind-load-more"
            type="button"
            onClick={() => listed.loadMore(24)}
          >
            Gather more
          </button>
        ) : null}
        {!debouncedSearch && listed.status === 'LoadingMore' ? (
          <p className="mind-loading-more">Gathering more…</p>
        ) : null}
      </section>

      {adding ? <AddBookmarkDialog onClose={() => setAdding(false)} /> : null}
      {selectedId ? (
        <BookmarkDetail
          bookmarkId={selectedId}
          onClose={() => setSelectedId(undefined)}
        />
      ) : null}
    </main>
  )
}

function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (view: ViewMode) => void
}) {
  return (
    <div className="mind-view-switcher" aria-label="Change bookmark view">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'is-active' : undefined}
          type="button"
          aria-label={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <ViewIcon view={option.value} />
        </button>
      ))}
    </div>
  )
}

function ViewIcon({ view }: { view: ViewMode }) {
  if (view === 'hex') return <span aria-hidden="true">⬡</span>
  if (view === 'cards') return <span aria-hidden="true">▦</span>
  return <span aria-hidden="true">☷</span>
}

function BookmarkCollection({
  bookmarks,
  view,
  onSelect,
}: {
  bookmarks: Array<Bookmark>
  view: ViewMode
  onSelect: (id: Id<'bookmarks'>) => void
}) {
  return (
    <div className={`mind-collection mind-collection--${view}`}>
      {bookmarks.map((bookmark, index) => (
        <BookmarkItem
          key={bookmark._id}
          bookmark={bookmark}
          view={view}
          index={index}
          onSelect={() => onSelect(bookmark._id)}
        />
      ))}
    </div>
  )
}

function BookmarkItem({
  bookmark,
  view,
  index,
  onSelect,
}: {
  bookmark: Bookmark
  view: ViewMode
  index: number
  onSelect: () => void
}) {
  const title = bookmark.title ?? pendingTitle(bookmark)
  const source = sourceLabel(bookmark)
  const image = bookmark.meta?.imageUrl

  if (view === 'hex') {
    return (
      <button
        className={`mind-hex mind-status--${bookmark.status}`}
        style={{ '--mind-index': index }}
        type="button"
        aria-label={`${title}, ${kindLabel(bookmark.kind)}, ${bookmark.status}`}
        onClick={onSelect}
      >
        <span className="mind-hex__shape">
          {image ? <img src={image} alt="" loading="lazy" /> : null}
          <span className="mind-hex__wash" />
          <span className="mind-kind-badge" aria-hidden="true">
            {kindGlyph(bookmark.kind)}
          </span>
          <span className="mind-hex__copy">
            <strong>{title}</strong>
            <small>{source}</small>
          </span>
        </span>
      </button>
    )
  }

  if (view === 'list') {
    return (
      <button
        className={`mind-row mind-status--${bookmark.status}`}
        type="button"
        onClick={onSelect}
      >
        <BookmarkImage bookmark={bookmark} />
        <span className="mind-row__copy">
          <strong>{title}</strong>
          <small>
            {source} · {relativeDate(bookmark.createdAt)}
          </small>
        </span>
        <span className="mind-row__labels">
          {bookmark.labels.slice(0, 2).map((item) => (
            <small key={item}>{item}</small>
          ))}
        </span>
        <span className="mind-row__arrow" aria-hidden="true">
          →
        </span>
      </button>
    )
  }

  return (
    <button
      className={`mind-card mind-status--${bookmark.status}`}
      type="button"
      onClick={onSelect}
    >
      {image ? (
        <span className="mind-card__image">
          <img src={image} alt="" loading="lazy" />
        </span>
      ) : (
        <span className="mind-card__placeholder" aria-hidden="true">
          {kindGlyph(bookmark.kind)}
        </span>
      )}
      <span className="mind-card__body">
        <span className="mind-card__source">
          <span>{kindGlyph(bookmark.kind)}</span>
          {source}
          <small>{relativeDate(bookmark.createdAt)}</small>
        </span>
        <strong>{title}</strong>
        {bookmark.summary ? <p>{bookmark.summary}</p> : null}
        {bookmark.status !== 'ready' ? (
          <StatusPill status={bookmark.status} />
        ) : null}
        {bookmark.labels.length ? (
          <span className="mind-card__labels">
            {bookmark.labels.slice(0, 4).map((item) => (
              <small key={item}>{item}</small>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function BookmarkImage({ bookmark }: { bookmark: Bookmark }) {
  const image = bookmark.meta?.faviconUrl ?? bookmark.meta?.imageUrl
  return (
    <span className="mind-row__image" aria-hidden="true">
      {image ? (
        <img src={image} alt="" loading="lazy" />
      ) : (
        kindGlyph(bookmark.kind)
      )}
    </span>
  )
}

function StatusPill({ status }: { status: Bookmark['status'] }) {
  return (
    <span className={`mind-status-pill mind-status-pill--${status}`}>
      {status === 'pending'
        ? 'Waiting'
        : status === 'processing'
          ? 'Reading'
          : status === 'failed'
            ? 'Needs attention'
            : 'Ready'}
    </span>
  )
}

function AddBookmarkDialog({ onClose }: { onClose: () => void }) {
  const add = useMutation(api.bookmarks.add)
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [clipboardUrl, setClipboardUrl] = useState<string>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    inputRef.current?.focus()
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (/^https?:\/\//i.test(text.trim())) setClipboardUrl(text.trim())
      })
      .catch(() => undefined)
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!url.trim() || working) return
    setWorking(true)
    setError(undefined)
    try {
      await add({ url: url.trim(), note: note.trim() || undefined })
      onClose()
    } catch (cause) {
      captureWebFailure(cause, 'mind.bookmark.add')
      setError(errorMessage(cause, 'That link could not be saved.'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <DialogSurface title="Save to Mind" onClose={onClose}>
      <form className="mind-add-form" onSubmit={(event) => void save(event)}>
        <div className="mind-dialog__intro">
          <span aria-hidden="true">⬡</span>
          <div>
            <h2>Give this link a place to grow.</h2>
            <p>Mind will read it, summarize it, and find useful labels.</p>
          </div>
        </div>

        {clipboardUrl && clipboardUrl !== url ? (
          <button
            className="mind-clipboard"
            type="button"
            onClick={() => setUrl(clipboardUrl)}
          >
            <span>Paste copied link</span>
            <small>{clipboardUrl}</small>
          </button>
        ) : null}

        <label className="mind-field">
          <span>Link</span>
          <input
            ref={inputRef}
            type="url"
            required
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label className="mind-field">
          <span>
            Note <small>optional</small>
          </span>
          <textarea
            rows={3}
            maxLength={4000}
            placeholder="Why are you keeping this?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mind-dialog__actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={!url.trim() || working}
          >
            {working ? 'Saving…' : 'Save link'}
          </button>
        </div>
      </form>
    </DialogSurface>
  )
}

function BookmarkDetail({
  bookmarkId,
  onClose,
}: {
  bookmarkId: Id<'bookmarks'>
  onClose: () => void
}) {
  const bookmark = useQuery(api.bookmarks.get, { bookmarkId })
  const update = useMutation(api.bookmarks.update)
  const remove = useMutation(api.bookmarks.remove)
  const retry = useMutation(api.bookmarks.retry)
  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  if (bookmark === undefined) {
    return (
      <DialogSurface title="Opening bookmark" onClose={onClose} wide>
        <div className="mind-detail-loading">Gathering the whole thought…</div>
      </DialogSurface>
    )
  }

  if (bookmark === null) {
    return (
      <DialogSurface title="Bookmark unavailable" onClose={onClose} wide>
        <div className="mind-detail-missing">
          <span aria-hidden="true">◇</span>
          <h2>This bookmark is no longer here.</h2>
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </DialogSurface>
    )
  }

  async function retryBookmark() {
    setWorking(true)
    setError(undefined)
    try {
      await retry({ bookmarkId })
    } catch (cause) {
      captureWebFailure(cause, 'mind.bookmark.retry')
      setError(errorMessage(cause, 'This bookmark could not be retried.'))
    } finally {
      setWorking(false)
    }
  }

  async function removeBookmark() {
    if (!window.confirm('Delete this bookmark from Mind?')) return
    setWorking(true)
    setError(undefined)
    try {
      await remove({ bookmarkId })
      onClose()
    } catch (cause) {
      captureWebFailure(cause, 'mind.bookmark.remove')
      setError(errorMessage(cause, 'This bookmark could not be deleted.'))
      setWorking(false)
    }
  }

  return (
    <DialogSurface
      title={bookmark.title ?? 'Saved link'}
      onClose={onClose}
      wide
    >
      {editing ? (
        <EditBookmarkForm
          bookmark={bookmark}
          working={working}
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            setWorking(true)
            setError(undefined)
            try {
              await update({ bookmarkId, ...values })
              setEditing(false)
            } catch (cause) {
              captureWebFailure(cause, 'mind.bookmark.update')
              setError(errorMessage(cause, 'Your changes could not be saved.'))
            } finally {
              setWorking(false)
            }
          }}
        />
      ) : (
        <article className="mind-detail">
          {bookmark.meta?.imageUrl ? (
            <div className="mind-detail__hero">
              <img src={bookmark.meta.imageUrl} alt="" />
              <span>{kindGlyph(bookmark.kind)}</span>
            </div>
          ) : null}

          <div className="mind-detail__heading">
            <div>
              <p className="utility-label">
                {kindLabel(bookmark.kind)} · {sourceLabel(bookmark)}
              </p>
              <h2>{bookmark.title ?? pendingTitle(bookmark)}</h2>
            </div>
            <StatusPill status={bookmark.status} />
          </div>

          {bookmark.status === 'failed' ? (
            <section className="mind-detail__failure" role="alert">
              <strong>This link needs another look.</strong>
              <p>
                {bookmark.errorMessage ?? 'Mind could not read this source.'}
              </p>
              <button
                className="button button--quiet"
                type="button"
                disabled={working}
                onClick={() => void retryBookmark()}
              >
                {working ? 'Retrying…' : 'Try again'}
              </button>
            </section>
          ) : null}

          {bookmark.summary ? (
            <section className="mind-detail__section">
              <p className="utility-label">Summary</p>
              <p className="mind-detail__summary">{bookmark.summary}</p>
            </section>
          ) : null}

          {bookmark.labels.length ? (
            <section className="mind-detail__section">
              <p className="utility-label">Labels</p>
              <div className="mind-detail__labels">
                {bookmark.labels.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          ) : null}

          {bookmark.note ? (
            <section className="mind-detail__section mind-detail__note">
              <p className="utility-label">Your note</p>
              <p>{bookmark.note}</p>
            </section>
          ) : null}

          {bookmark.content ? (
            <details className="mind-detail__content">
              <summary>
                {bookmark.kind === 'youtube'
                  ? 'Read transcript'
                  : 'Read captured text'}
                <span aria-hidden="true">＋</span>
              </summary>
              {bookmark.transcriptSource ? (
                <small>
                  Transcript from{' '}
                  {bookmark.transcriptSource === 'scribe'
                    ? 'audio transcription'
                    : 'captions'}
                </small>
              ) : null}
              <div>{bookmark.content}</div>
            </details>
          ) : null}

          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="mind-detail__actions">
            <a
              className="button button--primary"
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
            >
              Open source ↗
            </a>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="mind-delete"
              type="button"
              disabled={working}
              onClick={() => void removeBookmark()}
            >
              Delete
            </button>
          </footer>
        </article>
      )}
    </DialogSurface>
  )
}

function EditBookmarkForm({
  bookmark,
  working,
  onCancel,
  onSave,
}: {
  bookmark: NonNullable<FunctionReturnType<typeof api.bookmarks.get>>
  working: boolean
  onCancel: () => void
  onSave: (values: {
    title: string
    labels: Array<string>
    note: string
  }) => Promise<void>
}) {
  const [title, setTitle] = useState(bookmark.title ?? '')
  const [labels, setLabels] = useState(bookmark.labels.join(', '))
  const [note, setNote] = useState(bookmark.note ?? '')

  return (
    <form
      className="mind-edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave({
          title,
          labels: labels
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          note,
        })
      }}
    >
      <div>
        <p className="utility-label">Edit bookmark</p>
        <h2>Shape this thought.</h2>
      </div>
      <label className="mind-field">
        <span>Title</span>
        <input
          value={title}
          maxLength={240}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="mind-field">
        <span>
          Labels <small>comma separated</small>
        </span>
        <input
          value={labels}
          onChange={(event) => setLabels(event.target.value)}
        />
      </label>
      <label className="mind-field">
        <span>Note</span>
        <textarea
          rows={5}
          maxLength={4000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="mind-dialog__actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={working}
        >
          {working ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function DialogSurface({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div
      className="mind-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`mind-dialog${wide ? ' mind-dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="mind-dialog__close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </section>
    </div>
  )
}

function MindEmpty({
  searching,
  onAdd,
  onReset,
}: {
  searching: boolean
  onAdd: () => void
  onReset: () => void
}) {
  return (
    <div className="mind-empty">
      <div className="mind-empty__comb" aria-hidden="true">
        <span>⬡</span>
        <span>⬡</span>
        <span>⬡</span>
      </div>
      <h2>
        {searching
          ? 'Nothing is buzzing around that yet.'
          : 'Your Mind has room to grow.'}
      </h2>
      <p>
        {searching
          ? 'Try a broader word or clear the filters.'
          : 'Save a site, tweet, or video. Mind will keep the useful parts close.'}
      </p>
      <button
        className="button button--primary"
        type="button"
        onClick={searching ? onReset : onAdd}
      >
        {searching ? 'Clear filters' : 'Save your first link'}
      </button>
    </div>
  )
}

function MindLoading({ view }: { view: ViewMode }) {
  return (
    <div
      className={`mind-loading mind-loading--${view}`}
      aria-label="Loading saved links"
    >
      {Array.from({ length: view === 'list' ? 6 : 9 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

function readViewPreference(): ViewMode {
  if (!('window' in globalThis)) return 'hex'
  const saved = window.localStorage.getItem('beegreat.mind.view')
  return saved === 'cards' || saved === 'list' ? saved : 'hex'
}

function pendingTitle(bookmark: Pick<Bookmark, 'status' | 'url'>) {
  if (bookmark.status === 'failed') return 'Could not read this link'
  if (bookmark.status === 'processing') return 'Reading this link…'
  if (bookmark.status === 'pending') return 'Waiting to be read…'
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return 'Saved link'
  }
}

function sourceLabel(bookmark: {
  url: string
  kind: BookmarkKind
  meta?: {
    handle?: string
    author?: string
    siteName?: string
  }
}) {
  // Web strips a stored leading "@" and falls back to the crawled site name
  // before the hostname; mobile shows the stored handle verbatim.
  return bookmarkSourceLabel(bookmark, {
    normalizeHandle: true,
    preferSiteName: true,
    unparseableUrlLabel: kindLabel(bookmark.kind),
  })
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}
