import { api } from '@beegreat/backend/convex/_generated/api'
import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import { endOfLocalDay, formatHighlightExpiry } from './bee-ui'
import {
  clearPendingFirstFocus,
  registerPendingFirstFocus,
} from './first-focus-confirmation'
import type { FirstFocusPreview } from './bee-ui'
import { captureWebFailure } from '~/lib/sentry'

type PreviewStatus = 'editing' | 'saving' | 'saved' | 'cancelling' | 'cancelled'

function isSameLocalDay(left: number, right: number) {
  const leftDate = new Date(left)
  const rightDate = new Date(right)
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  )
}

export function FirstFocusPreviewCard({
  preview,
}: {
  preview: FirstFocusPreview
}) {
  const confirmPlan = useMutation(api.firstFocus.confirmPlan)
  const [goalTitle, setGoalTitle] = useState(preview.goalTitle)
  const [projectTitle, setProjectTitle] = useState(preview.projectTitle)
  const [taskTitle, setTaskTitle] = useState(preview.taskTitle)
  const [highlightExpiresAt, setHighlightExpiresAt] = useState(
    preview.highlightExpiresAt ?? endOfLocalDay(),
  )
  const [status, setStatus] = useState<PreviewStatus>('editing')
  const [error, setError] = useState<string>()
  const busy = status === 'saving' || status === 'cancelling'
  const valid = Boolean(
    goalTitle.trim() && projectTitle.trim() && taskTitle.trim(),
  )

  const save = useCallback(async () => {
    if (!valid || busy) return false
    setStatus('saving')
    setError(undefined)
    try {
      await confirmPlan({
        requestId: preview.requestId,
        confirmed: true,
        goalTitle: goalTitle.trim(),
        projectTitle: projectTitle.trim(),
        taskTitle: taskTitle.trim(),
        highlightExpiresAt,
      })
      clearPendingFirstFocus(preview.requestId)
      setStatus('saved')
      return true
    } catch (cause) {
      captureWebFailure(cause, 'first_focus.confirm_plan')
      setStatus('editing')
      setError(
        cause instanceof Error ? cause.message : 'The plan could not be saved.',
      )
      return false
    }
  }, [
    busy,
    confirmPlan,
    goalTitle,
    highlightExpiresAt,
    preview.requestId,
    projectTitle,
    taskTitle,
    valid,
  ])

  useEffect(() => {
    if (status !== 'editing') return
    return registerPendingFirstFocus(preview.requestId, save)
  }, [preview.requestId, save, status])

  async function cancel() {
    if (busy) return
    setStatus('cancelling')
    setError(undefined)
    try {
      await confirmPlan({
        requestId: preview.requestId,
        confirmed: false,
        goalTitle: goalTitle.trim() || preview.goalTitle,
        projectTitle: projectTitle.trim() || preview.projectTitle,
        taskTitle: taskTitle.trim() || preview.taskTitle,
        highlightExpiresAt,
      })
      clearPendingFirstFocus(preview.requestId)
      setStatus('cancelled')
    } catch (cause) {
      captureWebFailure(cause, 'first_focus.cancel_plan')
      setStatus('editing')
      setError(
        cause instanceof Error
          ? cause.message
          : 'The preview could not be cancelled.',
      )
    }
  }

  if (status === 'saved') {
    return (
      <section className="first-focus first-focus--saved" aria-live="polite">
        <div className="first-focus__result-mark" aria-hidden="true">
          ✓
        </div>
        <div>
          <h3>Your first focus is live</h3>
          <p>The Goal, Project, Task, and Highlight were created together.</p>
        </div>
        <Link className="button button--primary" to="/hive">
          Meet your GolieBee
        </Link>
      </section>
    )
  }

  if (status === 'cancelled') {
    return (
      <section className="generated-card" aria-live="polite">
        <h3>Preview cancelled</h3>
        <p>Nothing was created. Tell Bee when you’re ready to try again.</p>
      </section>
    )
  }

  return (
    <section className="first-focus">
      <header className="first-focus__header">
        <div className="first-focus__bee-wrap">
          <img src={beeUrl} alt="" className="first-focus__bee" />
        </div>
        <div>
          <p className="utility-label">Your first focus</p>
          <h3>Review everything before Bee creates it.</h3>
        </div>
      </header>

      <div className="first-focus__fields">
        <PreviewField label="Goal" value={goalTitle} onChange={setGoalTitle} />
        <PreviewField
          label="Project"
          value={projectTitle}
          onChange={setProjectTitle}
        />
        <PreviewField
          label="First task · Highlight"
          value={taskTitle}
          onChange={setTaskTitle}
        />
      </div>

      <fieldset className="expiry-picker" disabled={busy}>
        <legend>
          <span>Highlight until</span>
          <strong>{formatHighlightExpiry(highlightExpiresAt)}</strong>
        </legend>
        <div className="expiry-picker__options">
          <ExpiryOption
            label="Today"
            selected={isSameLocalDay(highlightExpiresAt, endOfLocalDay())}
            onSelect={() => setHighlightExpiresAt(endOfLocalDay())}
          />
          <ExpiryOption
            label="Tomorrow"
            selected={isSameLocalDay(highlightExpiresAt, endOfLocalDay(1))}
            onSelect={() => setHighlightExpiresAt(endOfLocalDay(1))}
          />
        </div>
      </fieldset>

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="first-focus__actions">
        <button
          type="button"
          className="button button--quiet"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {status === 'cancelling' ? 'Cancelling…' : 'Cancel'}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {status === 'saving' ? 'Creating…' : 'Create my focus'}
        </button>
      </div>
      <p className="first-focus__hint">You can also say or type “Yes”.</p>
    </section>
  )
}

function PreviewField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="preview-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </label>
  )
}

function ExpiryOption({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label className={`expiry-option${selected ? ' is-selected' : ''}`}>
      <input
        type="radio"
        name="highlight-expiry"
        checked={selected}
        onChange={onSelect}
      />
      {label}
    </label>
  )
}
