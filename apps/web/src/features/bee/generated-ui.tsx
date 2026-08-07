import { api } from '@beegreat/backend/convex/_generated/api'
import { sameEvmAddress, sendEoaTransactions } from '@beegreat/wallet-connect'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { FirstFocusPreviewCard } from './first-focus-preview'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { ReactNode } from 'react'

import type { UIComponent } from './bee-ui'
import { useEoaWallet } from '~/features/web3/use-eoa-wallet'

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
    case 'image':
      return <GeneratedImageCard {...component} />
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

function generatedImageFileName(url: string) {
  try {
    const sourceName = new URL(url).pathname.split('/').pop() ?? ''
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(sourceName)) {
      return sourceName
    }
  } catch {
    // The schema validates generated URLs; keep a safe filename fallback.
  }
  return `bee-image-${Date.now()}.png`
}

async function fetchGeneratedImage(url: string) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Image download failed (${response.status})`)
  return response.blob()
}

function GeneratedImageCard({
  url,
  alt,
  title,
}: Extract<UIComponent, { type: 'image' }>) {
  const [working, setWorking] = useState<'copy' | 'download'>()
  const [feedback, setFeedback] = useState<string>()

  const copyImage = async () => {
    setWorking('copy')
    try {
      const blob = await fetchGeneratedImage(url)
      if (!Reflect.has(window, 'ClipboardItem')) {
        throw new Error('Image clipboard is unavailable')
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      setFeedback('Image copied')
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setFeedback('Image link copied')
      } catch {
        setFeedback('Copy unavailable — use Download')
      }
    } finally {
      setWorking(undefined)
    }
  }

  const downloadImage = async () => {
    setWorking('download')
    try {
      const blob = await fetchGeneratedImage(url)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = generatedImageFileName(url)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setFeedback('Download started')
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
      setFeedback('Image opened in a new tab')
    } finally {
      setWorking(undefined)
    }
  }

  return (
    <section className="generated-image-card">
      {title ? <h3>{title}</h3> : null}
      <img src={url} alt={alt} loading="lazy" />
      <div className="generated-image-card__actions">
        <button
          className="button button--quiet"
          type="button"
          disabled={working !== undefined}
          onClick={() => void copyImage()}
        >
          <span aria-hidden="true">⧉</span>
          {working === 'copy' ? 'Copying…' : 'Copy'}
        </button>
        <button
          className="button button--primary"
          type="button"
          disabled={working !== undefined}
          onClick={() => void downloadImage()}
        >
          <span aria-hidden="true">↓</span>
          {working === 'download' ? 'Downloading…' : 'Download'}
        </button>
      </div>
      {feedback ? (
        <p className="generated-image-card__feedback" aria-live="polite">
          {feedback}
        </p>
      ) : null}
    </section>
  )
}

/**
 * Web3 money movement uses an action-bound authorization. Smart-wallet actions
 * call `web3Actions.confirm` and schedule server-side execution; linked-wallet
 * actions claim the exact plan and leave every signature in the connected EOA.
 * Free-form chat text cannot move funds. YOLO may auto-approve only smart-wallet
 * actions, in which case the card shows live progress instead of buttons.
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
  const beginEoaExecution = useMutation(api.web3Actions.beginEoaExecution)
  const recordEoaSubmission = useMutation(api.web3Actions.recordEoaSubmission)
  const reportEoaFailure = useMutation(api.web3Actions.reportEoaFailure)
  const connectedWallet = useEoaWallet()
  const [decision, setDecision] = useState<
    'idle' | 'working' | 'confirmed' | 'declined'
  >('idle')
  const [error, setError] = useState<string>()
  // The status query is ownership-scoped (null for anyone else), so it is
  // safe to subscribe immediately — needed to detect YOLO auto-confirmation.
  const live = useQuery(api.web3Actions.status, {
    actionId: actionId as Id<'web3Actions'>,
  })
  const autoConfirmed = live?.autoConfirmed === true
  const isEoaAction = live?.kind === 'execute_eoa_plan'
  const expectedEoaAddress = live?.eoaRequest?.walletAddress
  const eoaSessionMatches = Boolean(
    expectedEoaAddress &&
    connectedWallet.address &&
    connectedWallet.provider &&
    sameEvmAddress(expectedEoaAddress, connectedWallet.address),
  )

  const confirm = async () => {
    if (decision !== 'idle') return
    if (isEoaAction && !eoaSessionMatches) {
      setError(undefined)
      try {
        if (connectedWallet.isConnected) await connectedWallet.disconnect()
        await connectedWallet.connect()
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Couldn’t open WalletConnect.',
        )
      }
      return
    }
    setDecision('working')
    setError(undefined)
    let eoaClaimed = false
    try {
      if (isEoaAction) {
        const plan = await beginEoaExecution({
          actionId: actionId as Id<'web3Actions'>,
        })
        eoaClaimed = true
        try {
          await sendEoaTransactions({
            provider: connectedWallet.provider!,
            address: plan.walletAddress,
            chainId: plan.chainId,
            transactions: plan.transactions,
            onSubmitted: async ({ index, hash }) => {
              await recordEoaSubmission({
                actionId: actionId as Id<'web3Actions'>,
                index,
                hash,
              })
            },
          })
        } catch (cause) {
          await reportEoaFailure({
            actionId: actionId as Id<'web3Actions'>,
            reason: eoaFailureReason(cause),
          })
          throw cause
        }
      } else {
        await confirmAction({ actionId: actionId as Id<'web3Actions'> })
      }
      setDecision('confirmed')
      void onReply?.(
        isEoaAction
          ? 'I signed the linked-wallet action in the app. Check its status.'
          : 'I confirmed the action in the app. Check its status.',
      )
    } catch (cause) {
      setDecision(
        isEoaAction && eoaClaimed
          ? eoaFailureReason(cause) === 'user_rejected'
            ? 'declined'
            : 'confirmed'
          : 'idle',
      )
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
  const explorerLink =
    live?.socketProgress?.destinationExplorerLink ??
    [...(live?.result ?? [])].reverse().find((item) => item.explorerLink)
      ?.explorerLink
  // YOLO auto-approval resolves the card without a click; show progress
  // immediately instead of confirm buttons.
  const resolved =
    decision === 'confirmed' ||
    autoConfirmed ||
    (isEoaAction && status !== undefined && status !== 'pending')
  const loading = live === undefined

  return (
    <Card className="confirm-card">
      <p className="utility-label">
        {autoConfirmed
          ? 'Auto-approved · YOLO mode'
          : isEoaAction
            ? 'Needs your wallet signature'
            : 'Needs your confirmation'}
      </p>
      <p>{summary}</p>
      {error ? <p className="confirm-card__error">{error}</p> : null}
      {decision === 'declined' || status === 'cancelled' ? (
        <p>Declined — nothing was sent.</p>
      ) : resolved ? (
        status === 'executed' ? (
          <p aria-live="polite">
            Done ✓{' '}
            {explorerLink ? (
              <a href={explorerLink} target="_blank" rel="noreferrer">
                View transaction ↗
              </a>
            ) : null}
          </p>
        ) : status === 'failed' ? (
          <p className="confirm-card__error" aria-live="polite">
            {live?.error ?? 'Execution failed.'}
          </p>
        ) : status === 'refunded' ? (
          <p aria-live="polite">The route was refunded.</p>
        ) : status === 'expired' ? (
          <p className="confirm-card__error" aria-live="polite">
            This confirmation expired before execution.
          </p>
        ) : status === 'in_progress' ? (
          <p aria-live="polite">
            {isEoaAction
              ? `${live.result?.length ?? 0} of ${live.eoaRequest?.stepCount ?? 1} transactions submitted…`
              : (live?.socketProgress?.detail ?? 'Moving funds…')}
          </p>
        ) : (
          <p aria-live="polite">
            {isEoaAction
              ? 'Check your wallet to sign each transaction…'
              : 'Confirmed — preparing…'}
          </p>
        )
      ) : loading ? (
        // Wait for the first status read so an auto-approved action never
        // flashes confirm buttons.
        <p aria-live="polite">Checking status…</p>
      ) : (
        <div className="confirm-card__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={decision === 'working'}
            onClick={() => void confirm()}
          >
            {decision === 'working'
              ? isEoaAction
                ? 'Signing…'
                : 'Confirming…'
              : isEoaAction && !eoaSessionMatches
                ? 'Connect wallet'
                : 'Confirm'}
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

function eoaFailureReason(
  cause: unknown,
): 'user_rejected' | 'account_changed' | 'wallet_error' {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === 4001
  ) {
    return 'user_rejected'
  }
  if (
    cause instanceof Error &&
    cause.message.toLowerCase().includes('connect the wallet shown')
  ) {
    return 'account_changed'
  }
  return 'wallet_error'
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
