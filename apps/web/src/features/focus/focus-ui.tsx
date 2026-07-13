import { useEffect, useId, useState } from 'react'

import type {
  CSSProperties,
  FormEvent,
  PropsWithChildren,
  ReactNode,
} from 'react'

export function FocusPage({ children }: PropsWithChildren) {
  return <main className="product-page focus-page">{children}</main>
}

export function PageHeader({
  title,
  eyebrow,
  back,
  actions,
}: {
  title: string
  eyebrow?: string
  back?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="product-header">
      <div className="product-header__title">
        {back}
        <div>
          {eyebrow ? <p className="utility-label">{eyebrow}</p> : null}
          <h1>{title}</h1>
        </div>
      </div>
      {actions ? (
        <div className="product-header__actions">{actions}</div>
      ) : null}
    </header>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <a className="back-link" href={to} aria-label={label}>
      ←
    </a>
  )
}

export function InlineCreate({
  label,
  onCreate,
  compact = false,
  autoFocus = false,
  onCancel,
}: {
  label: string
  onCreate: (title: string) => Promise<unknown>
  compact?: boolean
  autoFocus?: boolean
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(autoFocus)
  const [value, setValue] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const title = value.trim()
    if (!title || working) return
    setWorking(true)
    setError(undefined)
    try {
      await onCreate(title)
      setValue('')
      setOpen(false)
      onCancel?.()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `Could not add ${label}.`,
      )
    } finally {
      setWorking(false)
    }
  }

  if (!open) {
    return (
      <button
        className={`inline-create-trigger${compact ? ' is-compact' : ''}`}
        type="button"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">＋</span>
        {label}
      </button>
    )
  }

  return (
    <form className="inline-create" onSubmit={submit}>
      <input
        autoFocus
        value={value}
        maxLength={160}
        aria-label={label}
        placeholder={label}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        className="button button--primary"
        type="submit"
        disabled={!value.trim() || working}
      >
        {working ? 'Adding…' : 'Add'}
      </button>
      <button
        className="button button--quiet"
        type="button"
        onClick={() => {
          setOpen(false)
          setValue('')
          onCancel?.()
        }}
      >
        Cancel
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </form>
  )
}

export function CombProgress({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const percentage = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div
      className="comb-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      style={{ '--comb-progress': `${percentage}%` } as CSSProperties}
    >
      <span>{percentage}%</span>
    </div>
  )
}

export function EntityMenu({
  label,
  onRename,
  onDelete,
  onDue,
}: {
  label: string
  onRename: () => void
  onDelete: () => void
  onDue?: () => void
}) {
  return (
    <details className="entity-menu">
      <summary aria-label={`${label} actions`}>•••</summary>
      <div>
        <button type="button" onClick={onRename}>
          Rename
        </button>
        {onDue ? (
          <button type="button" onClick={onDue}>
            Set due date
          </button>
        ) : null}
        <button className="is-danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </details>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: PropsWithChildren<{
  title: string
  description?: string
  onClose: () => void
}>) {
  const titleId = useId()
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
      </section>
    </div>
  )
}

export function RenameModal({
  noun,
  initialValue,
  onClose,
  onSave,
}: {
  noun: string
  initialValue: string
  onClose: () => void
  onSave: (value: string) => Promise<unknown>
}) {
  const [value, setValue] = useState(initialValue)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  return (
    <Modal title={`Rename ${noun}`} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!value.trim() || working) return
          setWorking(true)
          setError(undefined)
          void onSave(value.trim())
            .then(onClose)
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : `Could not rename ${noun}.`,
              )
            })
            .finally(() => setWorking(false))
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="modal-actions">
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
            disabled={!value.trim() || working}
          >
            {working ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function DeleteModal({
  noun,
  name,
  detail,
  onClose,
  onDelete,
}: {
  noun: string
  name: string
  detail: string
  onClose: () => void
  onDelete: () => Promise<unknown>
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  return (
    <Modal
      title={`Delete ${noun}?`}
      description={`“${name}” ${detail}`}
      onClose={onClose}
    >
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="modal-actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="button button--danger"
          type="button"
          disabled={working}
          onClick={() => {
            setWorking(true)
            setError(undefined)
            void onDelete()
              .then(onClose)
              .catch((cause: unknown) => {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : `Could not delete ${noun}.`,
                )
              })
              .finally(() => setWorking(false))
          }}
        >
          {working ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}
