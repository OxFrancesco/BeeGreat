import { api } from '@beegreat/backend/convex/_generated/api'
import { compareDrafts, formatSaveState } from '@beegreat/tool-presentation'
import { Link, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import beeDoctor from '../../../../mobile/assets/images/bee-doctor.png?url'
import {
  MOODS,
  calendarDays,
  currentLocalDay,
  dateFromLocalKey,
  formatJournalDate,
  localDateKey,
  monthStartForDate,
  occurredAtForDate,
  shiftMonth,
} from './health-utils'
import { HealthLoading } from './health-pages'
import type { ChangeEvent } from 'react'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type {
  JournalDraft,
  JournalSaveState,
} from '@beegreat/tool-presentation'

type JournalEntry = FunctionReturnType<
  typeof api.journalEntries.listRecent
>[number]
type JournalPhoto = FunctionReturnType<
  typeof api.journalEntries.listPhotos
>[number]

export function JournalPage() {
  const { isAuthenticated } = useConvexAuth()
  const { localDate, timeZone } = useMemo(currentLocalDay, [])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())
  const [selectedDate, setSelectedDate] = useState<string>()
  const [monthStart, setMonthStart] = useState(() =>
    monthStartForDate(localDate),
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()
  const imported = useRef(false)
  const entries = useQuery(
    api.journalEntries.listRecent,
    isAuthenticated ? { limit: 100, throughDate: localDate } : 'skip',
  )
  const searchResults = useQuery(
    api.journalEntries.search,
    isAuthenticated && deferredQuery ? { query: deferredQuery } : 'skip',
  )
  const selectedEntries = useQuery(
    api.journalEntries.listDay,
    isAuthenticated && selectedDate ? { localDate: selectedDate } : 'skip',
  )
  const monthDays = useQuery(
    api.journalEntries.listMonth,
    isAuthenticated ? { monthStart } : 'skip',
  )
  const health = useQuery(
    api.healthJournal.listRecent,
    isAuthenticated ? { limit: 31, throughDate: localDate } : 'skip',
  )
  const createDraft = useMutation(api.journalEntries.createDraft)
  const updateEntry = useMutation(api.journalEntries.update)
  const removeEntry = useMutation(api.journalEntries.remove)
  const importLegacy = useMutation(api.journalEntries.importLegacy)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated || imported.current) return
    imported.current = true
    void importLegacy({}).catch(() => {
      imported.current = false
    })
  }, [importLegacy, isAuthenticated])

  const visible = deferredQuery
    ? searchResults
    : selectedDate
      ? selectedEntries
      : entries
  const healthByDate = new Map(
    (health ?? []).map((entry) => [entry.localDate, entry]),
  )

  async function createEntry() {
    if (creating) return
    setCreating(true)
    setError(undefined)
    try {
      const target = selectedDate ?? localDate
      const entry = await createDraft({
        localDate: target,
        timeZone,
        occurredAt: occurredAtForDate(target),
      })
      await navigate({
        to: '/health/journal/$entryId',
        params: { entryId: entry.id },
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not start a new entry.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function toggle(entry: JournalEntry, field: 'isPinned' | 'isFavorite') {
    setError(undefined)
    try {
      await updateEntry({ entryId: entry.id, [field]: !entry[field] })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update this entry.',
      )
    }
  }

  async function remove(entry: JournalEntry) {
    if (
      !window.confirm(
        `Delete “${entry.title || 'this entry'}”? This cannot be undone.`,
      )
    )
      return
    setError(undefined)
    try {
      await removeEntry({ entryId: entry.id })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete this entry.',
      )
    }
  }

  return (
    <section
      className="health-content journal-page"
      aria-labelledby="journal-title"
    >
      <div className="health-section-heading">
        <div>
          <h2 id="journal-title">Journal</h2>
          <p>{formatJournalDate(selectedDate ?? localDate)}</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          disabled={creating}
          onClick={() => void createEntry()}
        >
          {creating ? 'Opening…' : 'New entry'}
        </button>
      </div>

      <div className="journal-tools">
        <label className="journal-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your memories"
            aria-label="Search journal entries"
          />
        </label>
        {selectedDate ? (
          <button type="button" onClick={() => setSelectedDate(undefined)}>
            Show all
          </button>
        ) : null}
      </div>

      <JournalCalendar
        monthStart={monthStart}
        days={monthDays ?? []}
        selectedDate={selectedDate}
        today={localDate}
        onChangeMonth={setMonthStart}
        onSelect={setSelectedDate}
      />

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {visible === undefined ? (
        <HealthLoading label="Opening your journal…" />
      ) : visible.length ? (
        <div className="journal-timeline">
          {visible.map((entry) => (
            <article className="journal-card" key={entry.id}>
              {entry.attachmentCount > 0 ? (
                <img
                  className="journal-card__cover"
                  src={entry.coverPhoto.url}
                  alt=""
                />
              ) : null}
              <div className="journal-card__content">
                <div className="journal-card__meta">
                  <time dateTime={entry.localDate}>
                    {formatJournalDate(entry.localDate)}
                  </time>
                  {healthByDate.get(entry.localDate)?.mood ? (
                    <span>
                      {
                        MOODS.find(
                          (mood) =>
                            mood.value ===
                            healthByDate.get(entry.localDate)?.mood,
                        )?.label
                      }
                    </span>
                  ) : null}
                </div>
                <Link
                  to="/health/journal/$entryId"
                  params={{ entryId: entry.id }}
                >
                  <h3>{entry.title || 'Untitled memory'}</h3>
                  <p>{entry.body || 'Add a thought to this memory.'}</p>
                </Link>
                {entry.tags.length ? (
                  <div className="journal-tags">
                    {entry.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                <div className="journal-card__actions">
                  <button
                    type="button"
                    aria-pressed={entry.isPinned}
                    onClick={() => void toggle(entry, 'isPinned')}
                  >
                    {entry.isPinned ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={entry.isFavorite}
                    onClick={() => void toggle(entry, 'isFavorite')}
                  >
                    {entry.isFavorite ? 'Favorite' : 'Favorite'}
                  </button>
                  <button
                    className="is-danger"
                    type="button"
                    onClick={() => void remove(entry)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="journal-empty">
          <img src={beeDoctor} alt="" />
          <h3>
            {deferredQuery
              ? 'No memories match that search'
              : 'A clear page is waiting'}
          </h3>
          <p>
            {deferredQuery
              ? 'Try a different word or clear the search.'
              : 'Capture one honest thought from today.'}
          </p>
        </div>
      )}
    </section>
  )
}

function JournalCalendar({
  monthStart,
  days,
  selectedDate,
  today,
  onChangeMonth,
  onSelect,
}: {
  monthStart: string
  days: Array<{ localDate: string; entryCount: number; hasPhoto: boolean }>
  selectedDate?: string
  today: string
  onChangeMonth: (month: string) => void
  onSelect: (date?: string) => void
}) {
  const summary = new Map(days.map((day) => [day.localDate, day]))
  return (
    <div className="journal-calendar">
      <header>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onChangeMonth(shiftMonth(monthStart, -1))}
        >
          ←
        </button>
        <strong>
          {new Intl.DateTimeFormat(undefined, {
            month: 'long',
            year: 'numeric',
          }).format(dateFromLocalKey(monthStart))}
        </strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onChangeMonth(shiftMonth(monthStart, 1))}
        >
          →
        </button>
      </header>
      <div className="journal-calendar__weekdays" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="journal-calendar__days">
        {calendarDays(monthStart).map((day) => {
          const info = summary.get(day.key)
          return (
            <button
              key={day.key}
              type="button"
              className={`${day.inMonth ? '' : 'is-outside'}${day.key === today ? ' is-today' : ''}${day.key === selectedDate ? ' is-selected' : ''}`}
              aria-label={`${formatJournalDate(day.key)}${info ? `, ${info.entryCount} entries` : ''}`}
              onClick={() =>
                onSelect(day.key === selectedDate ? undefined : day.key)
              }
            >
              {day.day}
              {info ? <i className={info.hasPhoto ? 'has-photo' : ''} /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Draft comparison and save-state copy are shared with the mobile editor.
type Draft = JournalDraft
type SaveState = JournalSaveState

export function JournalEditorPage({ entryId }: { entryId: string }) {
  const id = entryId as Id<'journalEntries'>
  const entry = useQuery(api.journalEntries.get, { entryId: id })
  const photos = useQuery(api.journalEntries.listPhotos, { entryId: id })
  const health = useQuery(
    api.healthJournal.getByDate,
    entry ? { localDate: entry.localDate } : 'skip',
  )
  const updateEntry = useMutation(api.journalEntries.update)
  const removeEntry = useMutation(api.journalEntries.remove)
  const generateUploadUrl = useMutation(
    api.journalEntries.generatePhotoUploadUrl,
  )
  const addPhoto = useMutation(api.journalEntries.addPhoto)
  const removePhoto = useMutation(api.journalEntries.removePhoto)
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<Array<string>>([])
  const [tagInput, setTagInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()
  const hydrated = useRef<string | undefined>(undefined)
  const persisted = useRef<Draft>({ title: '', body: '', tags: [] })

  useEffect(() => {
    if (!entry || hydrated.current === entry.id) return
    hydrated.current = entry.id
    const draft = { title: entry.title, body: entry.body, tags: entry.tags }
    persisted.current = draft
    setTitle(draft.title)
    setBody(draft.body)
    setTags(draft.tags)
    setSaveState('saved')
  }, [entry])

  useEffect(() => {
    if (!entry || hydrated.current !== entry.id) return
    const draft = { title, body, tags }
    if (compareDrafts(draft, persisted.current)) {
      setSaveState('saved')
      return
    }
    setSaveState('unsaved')
    const timeout = window.setTimeout(() => {
      setSaveState('saving')
      void updateEntry({ entryId: id, ...draft })
        .then((saved) => {
          persisted.current = {
            title: saved.title,
            body: saved.body,
            tags: saved.tags,
          }
          setSaveState('saved')
        })
        .catch((cause) => {
          setSaveState('error')
          setError(
            cause instanceof Error
              ? cause.message
              : 'This entry is not saved yet.',
          )
        })
    }, 650)
    return () => window.clearTimeout(timeout)
  }, [body, entry, id, tags, title, updateEntry])

  function addTag() {
    const tag = tagInput.trim().replace(/\s+/g, ' ')
    if (!tag || tag.length > 30 || tags.length >= 10) return
    if (!tags.some((current) => current.toLowerCase() === tag.toLowerCase()))
      setTags([...tags, tag])
    setTagInput('')
  }

  async function saveAndClose() {
    setSaveState('saving')
    setError(undefined)
    try {
      const saved = await updateEntry({ entryId: id, title, body, tags })
      persisted.current = {
        title: saved.title,
        body: saved.body,
        tags: saved.tags,
      }
      await navigate({ to: '/health/journal' })
    } catch (cause) {
      setSaveState('error')
      setError(
        cause instanceof Error ? cause.message : 'This entry is not saved yet.',
      )
    }
  }

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(
      0,
      Math.max(0, 10 - (photos?.length ?? 0)),
    )
    if (!files.length) return
    setUploading(true)
    setError(undefined)
    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl({})
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!response.ok) throw new Error('The photo upload did not finish.')
        const { storageId } = (await response.json()) as {
          storageId: Id<'_storage'>
        }
        await addPhoto({
          entryId: id,
          storageId,
          mimeType: file.type,
          fileName: file.name,
        })
      }
      event.target.value = ''
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not add that photo.',
      )
    } finally {
      setUploading(false)
    }
  }

  async function moveDate(nextDate: string) {
    if (!entry) return
    const previous = new Date(entry.occurredAt)
    const next = dateFromLocalKey(nextDate)
    next.setHours(
      previous.getHours(),
      previous.getMinutes(),
      previous.getSeconds(),
      0,
    )
    if (next.getTime() > Date.now()) next.setTime(Date.now())
    try {
      await updateEntry({
        entryId: id,
        localDate: localDateKey(next),
        occurredAt: next.getTime(),
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || entry.timeZone,
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not change the date.',
      )
    }
  }

  async function share() {
    if (!entry) return
    const text = [
      title.trim(),
      formatJournalDate(entry.localDate),
      body.trim(),
      tags.length
        ? tags.map((tag) => `#${tag.replace(/\s+/g, '')}`).join(' ')
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    try {
      const shareApi = Reflect.get(navigator, 'share') as
        undefined | ((data: ShareData) => Promise<void>)
      if (shareApi)
        await shareApi.call(navigator, {
          title: title || 'BeeGreat journal entry',
          text,
        })
      else {
        await navigator.clipboard.writeText(text)
        setError('Entry copied to your clipboard.')
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError('Could not share this entry.')
    }
  }

  async function deleteEntry() {
    if (!window.confirm('Delete this memory permanently?')) return
    await removeEntry({ entryId: id })
    await navigate({ to: '/health/journal' })
  }

  if (entry === undefined) return <HealthLoading label="Opening your memory…" />
  if (entry === null)
    return (
      <section className="journal-empty">
        <h2>This entry is no longer here.</h2>
        <Link className="button button--quiet" to="/health/journal">
          Back to Journal
        </Link>
      </section>
    )
  const mood = health?.mood
    ? MOODS.find((item) => item.value === health.mood)
    : null

  return (
    <section className="journal-editor">
      <header className="journal-editor__bar">
        <button
          className="journal-editor-back"
          type="button"
          aria-label="Save and return to Journal"
          onClick={() => void saveAndClose()}
        >
          ←
        </button>
        <span className={saveState === 'error' ? 'is-error' : ''} role="status">
          {saveStateLabel(saveState)}
        </span>
        <button
          className="button button--primary"
          type="button"
          onClick={() => void saveAndClose()}
        >
          Done
        </button>
      </header>
      <div className="journal-editor__meta">
        <label>
          Date{' '}
          <input
            type="date"
            max={localDateKey()}
            value={entry.localDate}
            onChange={(event) => void moveDate(event.target.value)}
          />
        </label>
        <time>
          {new Date(entry.occurredAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
        {mood ? (
          <span style={{ background: mood.softColor }}>{mood.label}</span>
        ) : null}
      </div>
      <div className="journal-prompt">
        What do you want to remember from this day?
      </div>
      <input
        className="journal-title-input"
        aria-label="Journal entry title"
        maxLength={160}
        placeholder="Give this memory a title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className="journal-body-input"
        aria-label="Journal entry"
        maxLength={50_000}
        placeholder="Write freely…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      <section className="journal-editor__section">
        <h2>Photos</h2>
        {photos?.length ? (
          <div className="journal-photos">
            {photos.map((photo) => (
              <Photo
                key={photo.id}
                photo={photo}
                onRemove={() => {
                  if (window.confirm('Remove this photo?'))
                    void removePhoto({ attachmentId: photo.id })
                }}
              />
            ))}
          </div>
        ) : (
          <p>No photos in this memory yet.</p>
        )}
        <label className="button button--quiet journal-file-button">
          {uploading ? 'Uploading…' : 'Add photos'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading || (photos?.length ?? 0) >= 10}
            onChange={(event) => void uploadPhotos(event)}
          />
        </label>
      </section>

      <section className="journal-editor__section">
        <h2>Tags</h2>
        <div className="journal-tags">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => setTags(tags.filter((item) => item !== tag))}
            >
              {tag} ×
            </button>
          ))}
        </div>
        <div className="journal-tag-input">
          <input
            maxLength={30}
            value={tagInput}
            placeholder="Add a tag"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addTag()
              }
            }}
          />
          <button type="button" onClick={addTag}>
            Add
          </button>
        </div>
      </section>
      {error ? (
        <p
          className={
            error.includes('clipboard') ? 'inline-success' : 'inline-error'
          }
          role="status"
        >
          {error}
        </p>
      ) : null}
      <footer className="journal-editor__actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={() => void share()}
        >
          Share
        </button>
        <button
          className="button journal-delete"
          type="button"
          onClick={() => void deleteEntry()}
        >
          Delete entry
        </button>
      </footer>
    </section>
  )
}

function Photo({
  photo,
  onRemove,
}: {
  photo: JournalPhoto
  onRemove: () => void
}) {
  return (
    <figure>
      <img src={photo.url} alt={photo.fileName ?? 'Journal photo'} />
      <button
        type="button"
        aria-label={`Remove ${photo.fileName ?? 'photo'}`}
        onClick={onRemove}
      >
        ×
      </button>
    </figure>
  )
}

function saveStateLabel(state: SaveState) {
  // Web's error copy stays "Not saved"; mobile says "Couldn’t save".
  return formatSaveState(state, { error: 'Not saved' })
}
