import { api } from '@beegreat/backend/convex/_generated/api'
import { SignInButton, SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { currentLocalDay } from './health-utils'
import { HealthLoading } from './health-pages'
import type { FunctionReturnType } from 'convex/server'

const WATER_AMOUNTS = [250, 330, 500, 750] as const
type TapAction = FunctionReturnType<typeof api.nfcActions.list>[number]
type HydrationTapAction = TapAction & {
  definition: { type: 'hydration'; amountMl: number }
}
type TapExecution = FunctionReturnType<typeof api.nfcActions.execute>

function isHydrationAction(action: TapAction): action is HydrationTapAction {
  return action.definition.type === 'hydration'
}

declare global {
  interface Window {
    NDEFReader?: new () => {
      write: (message: {
        records: Array<{ recordType: 'url'; data: string }>
      }) => Promise<void>
    }
  }
}

export function TapActionsPage() {
  const actions = useQuery(api.nfcActions.list)
  const createAction = useMutation(api.nfcActions.create)
  const updateAction = useMutation(api.nfcActions.update)
  const removeAction = useMutation(api.nfcActions.remove)
  const [label, setLabel] = useState('Water bottle')
  const [amount, setAmount] = useState(250)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const supportsWebNfc = hasWebNfc()
  const hydrationActions = actions?.filter(isHydrationAction)

  async function writeTag(action: Pick<TapAction, 'label' | 'tagUrl'>) {
    setError(undefined)
    setMessage(undefined)
    try {
      if (!window.NDEFReader) {
        await navigator.clipboard.writeText(action.tagUrl)
        setMessage(
          'Tap link copied. Open BeeGreat on an NFC-capable phone to write it to a tag.',
        )
        return
      }
      const writer = new window.NDEFReader()
      await writer.write({
        records: [{ recordType: 'url', data: action.tagUrl }],
      })
      setMessage(`${action.label} is ready to tap.`)
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : window.NDEFReader
            ? 'Could not write the NFC tag.'
            : 'Could not copy the tap link. Open this page in a secure browser and try again.',
      )
    }
  }

  async function create() {
    if (creating || !label.trim()) return
    setCreating(true)
    setError(undefined)
    setMessage(undefined)
    try {
      const action = await createAction({
        label: label.trim(),
        definition: { type: 'hydration', amountMl: amount },
      })
      setLabel('Water bottle')
      setAmount(250)
      await writeTag(action)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not create the tap action.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <section
      className="health-content tap-actions-page"
      aria-labelledby="tap-actions-title"
    >
      <div className="health-section-heading">
        <div>
          <h2 id="tap-actions-title">Tap actions</h2>
          <p>One tag, one useful action.</p>
        </div>
        <Link className="button button--quiet" to="/health/water">
          Back to Water
        </Link>
      </div>
      <div className="tap-intro">
        <span aria-hidden="true">⌁</span>
        <p>
          The tag stores a private BeeGreat link. Change its amount here later
          without rewriting the tag.
        </p>
      </div>
      {hydrationActions === undefined ? (
        <HealthLoading label="Loading your tap actions…" />
      ) : hydrationActions.length ? (
        <div className="tap-action-list">
          {hydrationActions.map((action) => (
            <TapActionCard
              key={action._id}
              action={action}
              onWrite={() => void writeTag(action)}
              onUpdate={async (patch) => {
                setError(undefined)
                try {
                  await updateAction({ actionId: action._id, ...patch })
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'Could not update the action.',
                  )
                  throw cause
                }
              }}
              onRemove={() => {
                if (
                  !window.confirm(
                    `Delete “${action.label}”? Its tag will stop working immediately.`,
                  )
                )
                  return
                void removeAction({ actionId: action._id }).catch((cause) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'Could not delete the action.',
                  ),
                )
              }}
            />
          ))}
        </div>
      ) : null}
      <section className="tap-create-card">
        <h3>Create a water action</h3>
        <label>
          Name
          <input
            maxLength={60}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bottle name"
          />
        </label>
        <AmountPicker value={amount} onChange={setAmount} />
        <button
          className="button button--primary"
          type="button"
          disabled={creating || !label.trim()}
          onClick={() => void create()}
        >
          {creating
            ? 'Creating…'
            : supportsWebNfc
              ? 'Create & write tag'
              : 'Create & copy tap link'}
        </button>
      </section>
      {message ? (
        <p className="inline-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function TapActionCard({
  action,
  onWrite,
  onUpdate,
  onRemove,
}: {
  action: HydrationTapAction
  onWrite: () => void
  onUpdate: (patch: {
    label?: string
    enabled?: boolean
    definition?: { type: 'hydration'; amountMl: number }
  }) => Promise<void>
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(action.label)
  const [amount, setAmount] = useState(action.definition.amountMl)
  const [saving, setSaving] = useState(false)
  const supportsWebNfc = hasWebNfc()
  return (
    <article className="tap-action-card">
      <div className="tap-action-card__heading">
        <span aria-hidden="true">●</span>
        <div>
          <h3>{action.label}</h3>
          <p>Add {action.definition.amountMl} ml of water</p>
        </div>
        <button
          className={`switch${action.enabled ? ' is-on' : ''}`}
          type="button"
          role="switch"
          aria-label={`${action.label} tap action`}
          aria-checked={action.enabled}
          onClick={() => void onUpdate({ enabled: !action.enabled })}
        >
          <span />
        </button>
      </div>
      {editing ? (
        <div className="tap-action-editor">
          <label>
            Name
            <input
              maxLength={60}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <AmountPicker value={amount} onChange={setAmount} />
          <div>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={saving || !label.trim()}
              onClick={() => {
                setSaving(true)
                void onUpdate({
                  label: label.trim(),
                  definition: { type: 'hydration', amountMl: amount },
                })
                  .then(() => setEditing(false))
                  .finally(() => setSaving(false))
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          <p>The same NFC tag will use the new amount—no rewrite needed.</p>
        </div>
      ) : (
        <div className="tap-action-card__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={onWrite}
          >
            {supportsWebNfc ? 'Write NFC tag' : 'Copy tap link'}
          </button>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button className="tap-delete" type="button" onClick={onRemove}>
            Delete
          </button>
        </div>
      )}
    </article>
  )
}

function AmountPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="tap-amounts" role="radiogroup" aria-label="Water amount">
      {WATER_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          role="radio"
          aria-checked={value === amount}
          className={value === amount ? 'is-selected' : ''}
          onClick={() => onChange(amount)}
        >
          {amount} ml
        </button>
      ))}
    </div>
  )
}

function hasWebNfc() {
  return typeof window !== 'undefined' && Boolean(window.NDEFReader)
}

export function PublicTapPage({ publicId }: { publicId: string }) {
  const valid = /^[a-f0-9]{32}$/.test(publicId)
  return (
    <main className="public-tap-page">
      <section>
        <img src="/logo.png" width="72" height="72" alt="BeeGreat" />
        {!valid ? (
          <>
            <h1>Tap action unavailable</h1>
            <p>This tap-action link is not valid.</p>
          </>
        ) : (
          <>
            <SignedOut>
              <h1>Sign in to run your tap action</h1>
              <p>
                BeeGreat checks that this private action belongs to you before
                changing your water.
              </p>
              <SignInButton mode="modal">
                <button className="button button--primary" type="button">
                  Sign in to BeeGreat
                </button>
              </SignInButton>
              <a
                className="button button--quiet"
                href={`beegreat://tap/${publicId}`}
              >
                Open the mobile app
              </a>
            </SignedOut>
            <SignedIn>
              <TapExecution publicId={publicId} />
            </SignedIn>
          </>
        )}
      </section>
    </main>
  )
}

/** Per-action-type copy; the run → success/duplicate → undo flow is shared. */
const TAP_PRESENTATIONS: Record<
  TapExecution['action']['definition']['type'],
  {
    glyph: string
    glyphClass: string
    duplicateTitle: string
    successTitle: (result: TapExecution) => string
    successBody: (result: TapExecution) => string
    undoneTitle: string
    undoneBody: string
    cta: { to: string; label: string }
  }
> = {
  hydration: {
    glyph: '●',
    glyphClass: 'tap-result-icon is-water',
    duplicateTitle: 'Already logged',
    successTitle: (result) =>
      `Added ${result.outcome.type === 'hydration' ? result.outcome.appliedMl : 0} ml`,
    successBody: (result) => `${result.action.label} updated today’s water.`,
    undoneTitle: 'Water entry undone',
    undoneBody: 'The water from this tap was removed.',
    cta: { to: '/health/water', label: 'View Water' },
  },
  reminder: {
    glyph: '✓',
    glyphClass: 'tap-result-icon',
    duplicateTitle: 'Already counted',
    successTitle: (result) => `${result.action.label} counted`,
    successBody: (result) =>
      `Completion ${result.action.completionCount} is saved.`,
    undoneTitle: 'Reminder count undone',
    undoneBody: 'The completion from this tap was removed.',
    cta: { to: '/goals', label: 'Open Goals' },
  },
}

function TapExecution({ publicId }: { publicId: string }) {
  const { localDate, timeZone } = useMemo(currentLocalDay, [])
  const execute = useMutation(api.nfcActions.execute)
  const undo = useMutation(api.nfcActions.undo)
  const started = useRef(false)
  const [result, setResult] = useState<TapExecution>()
  const [status, setStatus] = useState<
    'running' | 'success' | 'undone' | 'error'
  >('running')
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void execute({ publicId, localDate, timeZone })
      .then((value) => {
        setResult(value)
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }, [execute, localDate, publicId, timeZone])

  if (status === 'running') return <HealthLoading label="Running tap action…" />
  if (status === 'error' || !result)
    return (
      <>
        <h1>Tap action unavailable</h1>
        <p>
          It may be disabled, deleted, or registered to another BeeGreat
          account.
        </p>
        <Link className="button button--primary" to="/health/water">
          View Water
        </Link>
      </>
    )
  const presentation = TAP_PRESENTATIONS[result.action.definition.type]
  if (status === 'undone')
    return (
      <>
        <div className="tap-result-icon">↶</div>
        <h1>{presentation.undoneTitle}</h1>
        <p>{presentation.undoneBody}</p>
        <Link className="button button--primary" to={presentation.cta.to}>
          {presentation.cta.label}
        </Link>
      </>
    )
  const canUndo =
    !result.duplicate &&
    (result.outcome.type === 'hydration'
      ? result.outcome.appliedMl > 0
      : result.outcome.appliedCount > 0)
  return (
    <>
      <div className={presentation.glyphClass}>{presentation.glyph}</div>
      <h1>
        {result.duplicate
          ? presentation.duplicateTitle
          : presentation.successTitle(result)}
      </h1>
      <p>
        {result.duplicate
          ? 'The repeated tap was ignored.'
          : presentation.successBody(result)}
      </p>
      {canUndo ? (
        <button
          className="button button--quiet"
          type="button"
          disabled={undoing}
          onClick={() => {
            setUndoing(true)
            void undo({ executionId: result.executionId })
              .then(() => setStatus('undone'))
              .catch(() => setStatus('error'))
              .finally(() => setUndoing(false))
          }}
        >
          {undoing ? 'Undoing…' : 'Undo'}
        </button>
      ) : null}
      <Link className="button button--primary" to={presentation.cta.to}>
        {presentation.cta.label}
      </Link>
    </>
  )
}
