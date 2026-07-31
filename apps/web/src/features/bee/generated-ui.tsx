import { api } from '@beegreat/backend/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { FirstFocusPreviewCard } from './first-focus-preview'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { ReactNode } from 'react'

import type { UIComponent } from './bee-ui'

export function GeneratedUI({
  components,
  onReply,
}: {
  components: Array<UIComponent>
  onReply?: (text: string) => void | Promise<void>
}) {
  if (components.length === 0) return null
  return (
    <div className="generated-stack">
      {components.map((component, index) => (
        <UIComponentView
          key={`${component.type}-${index}`}
          component={component}
          onReply={onReply}
        />
      ))}
    </div>
  )
}

function UIComponentView({
  component,
  onReply,
}: {
  component: UIComponent
  onReply?: (text: string) => void | Promise<void>
}) {
  switch (component.type) {
    case 'text':
      return <p>{component.body}</p>
    case 'metric':
      return (
        <Card className="generated-card--metric">
          <p className="utility-label">{component.label}</p>
          <div className="metric-row">
            <strong>{component.value}</strong>
            {component.delta ? <span>{component.delta}</span> : null}
          </div>
        </Card>
      )
    case 'chart':
      return <BarChartCard {...component} />
    case 'tasks':
      return <TaskListCard {...component} />
    case 'highlight':
      return (
        <section className="highlight-card">
          <p className="utility-label">{component.title}</p>
          <p>{component.body}</p>
        </section>
      )
    case 'bookmark':
      return <BookmarkCard {...component} />
    case 'devin':
      return <DevinCard {...component} onReply={onReply} />
    case 'first_focus':
      return <FirstFocusPreviewCard preview={component} />
    case 'confirm': {
      const web3ActionId = component.payload?.web3ActionId
      if (typeof web3ActionId === 'string' && web3ActionId.length > 0) {
        return (
          <Web3ConfirmCard
            summary={component.summary}
            actionId={web3ActionId}
            onReply={onReply}
          />
        )
      }
      return (
        <Card className="confirm-card">
          <p className="utility-label">Needs your confirmation</p>
          <p>{component.summary}</p>
          {onReply ? (
            <div className="confirm-card__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => void onReply('Yes')}
              >
                Yes
              </button>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void onReply('No')}
              >
                No
              </button>
            </div>
          ) : null}
        </Card>
      )
    }
  }
}

/**
 * Web3 money movement: the app is the authoritative confirmer. Clicking
 * Confirm runs the signed-in `web3Actions.confirm` mutation (which schedules
 * server-side execution) and only then tells Bee. A chat "yes" alone can
 * never move funds.
 */
function Web3ConfirmCard({
  summary,
  actionId,
  onReply,
}: {
  summary: string
  actionId: string
  onReply?: (text: string) => void | Promise<void>
}) {
  const confirmAction = useMutation(api.web3Actions.confirm)
  const cancelAction = useMutation(api.web3Actions.cancel)
  const [decision, setDecision] = useState<
    'idle' | 'working' | 'confirmed' | 'declined'
  >('idle')
  const [error, setError] = useState<string>()
  // Subscribe only once the confirm mutation proved the id valid and owned.
  const live = useQuery(
    api.web3Actions.status,
    decision === 'confirmed'
      ? { actionId: actionId as Id<'web3Actions'> }
      : 'skip',
  )

  const confirm = async () => {
    if (decision !== 'idle') return
    setDecision('working')
    setError(undefined)
    try {
      await confirmAction({ actionId: actionId as Id<'web3Actions'> })
      setDecision('confirmed')
      void onReply?.('I confirmed the action in the app. Check its status.')
    } catch (cause) {
      setDecision('idle')
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t confirm the action.',
      )
    }
  }

  const decline = () => {
    if (decision !== 'idle') return
    setDecision('declined')
    cancelAction({ actionId: actionId as Id<'web3Actions'> }).catch(() => {
      // Cancelling a stale or unknown action is a no-op.
    })
    void onReply?.('No, I declined the action.')
  }

  const status = live?.status
  const explorerLink = live?.result?.find((item) => item.explorerLink)
    ?.explorerLink

  return (
    <Card className="confirm-card">
      <p className="utility-label">Needs your confirmation</p>
      <p>{summary}</p>
      {error ? <p className="confirm-card__error">{error}</p> : null}
      {decision === 'declined' ? (
        <p>Declined — nothing was sent.</p>
      ) : decision === 'confirmed' ? (
        status === 'executed' ? (
          <p>
            Done ✓{' '}
            {explorerLink ? (
              <a href={explorerLink} target="_blank" rel="noreferrer">
                View transaction ↗
              </a>
            ) : null}
          </p>
        ) : status === 'failed' ? (
          <p className="confirm-card__error">
            {live?.error ?? 'Execution failed.'}
          </p>
        ) : (
          <p>Confirmed — executing…</p>
        )
      ) : (
        <div className="confirm-card__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={decision === 'working'}
            onClick={() => void confirm()}
          >
            {decision === 'working' ? 'Confirming…' : 'Confirm'}
          </button>
          <button
            className="button button--quiet"
            type="button"
            disabled={decision === 'working'}
            onClick={decline}
          >
            No
          </button>
        </div>
      )}
    </Card>
  )
}

function bookmarkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function BookmarkCard({
  title,
  url,
  note,
}: Extract<UIComponent, { type: 'bookmark' }>) {
  const host = bookmarkHost(url)
  return (
    <a
      className="bookmark-card"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open bookmark ${title} on ${host}`}
    >
      <header className="bookmark-card__header">
        <img
          className="bookmark-card__favicon"
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
          alt=""
          loading="lazy"
        />
        <h3>{title}</h3>
        <b aria-hidden="true">↗</b>
      </header>
      <p>{note?.trim() || host}</p>
    </a>
  )
}

function DevinCard({
  title,
  status,
  statusDetail,
  sessionId,
  sessionUrl,
  summary,
  pullRequests,
  onReply,
}: Extract<UIComponent, { type: 'devin' }> & {
  onReply?: (text: string) => void | Promise<void>
}) {
  const live = useQuery(api.devinData.get, { sessionId })
  const currentStatus = live?.status ?? status
  const currentDetail = live?.statusDetail ?? statusDetail
  const currentPullRequests = live?.pullRequests ?? pullRequests
  const detail = (currentDetail ?? currentStatus).replaceAll('_', ' ')
  return (
    <section className="devin-card">
      <header className="devin-card__header">
        <span className="devin-card__mark" aria-hidden="true">
          D
        </span>
        <div>
          <h3>{title}</h3>
        </div>
        <span className="devin-card__status">{detail}</span>
      </header>
      {summary ? <p>{summary}</p> : null}
      {currentPullRequests.length ? (
        <div className="devin-card__prs">
          <span className="utility-label">Pull requests</span>
          {currentPullRequests.map((pullRequest, index) => (
            <a
              href={pullRequest.url}
              key={pullRequest.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>Pull request {index + 1}</span>
              {pullRequest.state ? <small>{pullRequest.state}</small> : null}
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      ) : null}
      <footer className="devin-card__actions">
        <a
          className="button devin-card__open"
          href={sessionUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open in Devin <span aria-hidden="true">↗</span>
        </a>
        {onReply ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={() =>
              void onReply(
                `Check Devin session ${sessionId} and show me the latest update and pull requests.`,
              )
            }
          >
            Refresh
          </button>
        ) : null}
      </footer>
    </section>
  )
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`generated-card ${className}`}>{children}</section>
}

function BarChartCard({
  title,
  unit,
  data,
}: Extract<UIComponent, { type: 'chart' }>) {
  const max = Math.max(...data.map((point) => point.value), 1)
  return (
    <Card>
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((point) => (
          <div className="bar-chart__item" key={point.label}>
            <span>{point.label}</span>
            <div className="bar-chart__row">
              <div className="bar-chart__track">
                <div
                  className="bar-chart__fill"
                  style={{
                    width: `${Math.max((point.value / max) * 100, 2)}%`,
                  }}
                />
              </div>
              <strong>
                {point.value}
                {unit ? ` ${unit}` : ''}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TaskListCard({
  title,
  items,
}: Extract<UIComponent, { type: 'tasks' }>) {
  const live = useQuery(api.tasks.statuses, {
    taskIds: items.map((item) => item.id),
  })
  const toggle = useMutation(api.tasks.toggle)
  const liveById = new Map(
    live?.map((task): [string, typeof task] => [task.id, task]),
  )

  return (
    <Card>
      <h3>{title}</h3>
      <div className="task-card-list">
        {items.map((item) => {
          const liveTask = liveById.get(item.id)
          const liveStatus = liveTask?.status
          const done = liveStatus ? liveStatus === 'done' : item.done
          const interactive = liveTask !== undefined
          return (
            <button
              type="button"
              className="task-card-row"
              key={item.id}
              role="checkbox"
              aria-checked={done}
              disabled={!interactive}
              onClick={() => {
                if (liveTask) void toggle({ taskId: liveTask.id })
              }}
            >
              <span className={`task-check${done ? ' is-done' : ''}`}>
                {done ? '✓' : ''}
              </span>
              <span className="task-card-row__copy">
                <span className={done ? 'is-complete' : ''}>{item.title}</span>
                {item.due ? <small>{item.due}</small> : null}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
