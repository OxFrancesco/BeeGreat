import { api } from '@beegreat/backend/convex/_generated/api'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import vesselUrl from '../../../../mobile/assets/images/hive-vessel.png?url'
import { Achievements } from './achievements'
import { formatHighlightExpiry, getGolieBeeName } from './hive-utils'
import type { FunctionReturnType } from 'convex/server'

const HONEY_CAPACITY = 100
type CurrentHive = FunctionReturnType<typeof api.firstFocus.getCurrent>
type Completion = FunctionReturnType<typeof api.firstFocus.completeHighlight>

export function HivePage() {
  const current = useQuery(api.firstFocus.getCurrent, {})
  const completeHighlight = useMutation(api.firstFocus.completeHighlight)
  const navigate = useNavigate()
  const [completion, setCompletion] = useState<{
    result: Completion
    goalTitle?: string
    highlightTitle: string
  }>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  if (!current) {
    return <div className="hive-loading">Gathering your Hive…</div>
  }

  const highlight = current.activeHighlight
  const highlightedGoal = highlight
    ? current.activeGoals.find((goal) => goal.goalId === highlight.goalId)
    : undefined
  const displayedGoal = highlightedGoal ?? current.activeGoals.at(0)

  async function complete() {
    if (!highlight || working) return
    setWorking(true)
    setError(undefined)
    try {
      const result = await completeHighlight({
        requestId: `complete-highlight:${highlight.highlightId}`,
        taskId: highlight.taskId,
      })
      setCompletion({
        result,
        goalTitle: highlightedGoal?.title,
        highlightTitle: highlight.title,
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'This Highlight could not be completed.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="product-page hive-page">
      <header className="product-header hive-header">
        <div>
          <p className="utility-label">Your living progress</p>
          <h1>Hive</h1>
        </div>
        <HiveBalances hive={current.hive} />
      </header>

      <div className="hive-dashboard">
        <HoneyVessel balance={current.hive.honeyBalance} />

        <section className="hive-focus-column">
          {completion ? (
            <div className="hive-celebration" role="status">
              <span aria-hidden="true">✦</span>
              <div>
                <strong>
                  {completion.goalTitle
                    ? `${completion.goalTitle} moved forward`
                    : `${completion.highlightTitle} is complete`}
                </strong>
                <p>
                  +{completion.result.honeyAwarded} Honey · +
                  {completion.result.scoreAwarded} Honeycomb Score
                </p>
              </div>
            </div>
          ) : null}

          {highlight ? (
            <section className="highlight-focus-card">
              <div className="highlight-focus-card__copy">
                <p className="utility-label">
                  Highlight · until {formatHighlightExpiry(highlight.expiresAt)}
                </p>
                <h2>{highlight.title}</h2>
                {highlightedGoal ? <p>For {highlightedGoal.title}</p> : null}
              </div>
              {displayedGoal ? (
                <GolieBee
                  seed={displayedGoal.golieBee.seed}
                  celebrating={Boolean(completion)}
                />
              ) : null}
              {error ? (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="button button--primary complete-highlight"
                type="button"
                disabled={working}
                onClick={() => void complete()}
              >
                <span aria-hidden="true">✓</span>
                {working ? 'Completing…' : 'Complete Highlight'}
              </button>
            </section>
          ) : (
            <section className="no-highlight">
              <div aria-hidden="true">◎</div>
              <h2>
                {current.activeGoals.length > 0
                  ? 'Choose your next Highlight'
                  : 'Create your first focus'}
              </h2>
              <p>
                {current.activeGoals.length > 0
                  ? 'Ask Bee to point your attention at one meaningful next step.'
                  : 'Tell Bee what outcome matters, then review the plan before anything is created.'}
              </p>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void navigate({ to: '/bee' })}
              >
                Talk to Bee
              </button>
            </section>
          )}
        </section>
      </div>

      <Achievements achievements={current.economy.achievements} />
    </main>
  )
}

function HiveBalances({ hive }: { hive: CurrentHive['hive'] }) {
  return (
    <div className="hive-page-balances" aria-label="Hive balances">
      <div>
        <span>◇</span>
        <strong>{hive.honeyBalance}</strong>
        <small>Honey</small>
      </div>
      <div>
        <span>⬡</span>
        <strong>{hive.honeycombScore}</strong>
        <small>Score</small>
      </div>
      <div>
        <span>◆</span>
        <strong>{hive.royalJellyBalance}</strong>
        <small>Jelly</small>
      </div>
    </div>
  )
}

function HoneyVessel({ balance }: { balance: number }) {
  const clamped = Math.min(Math.max(balance, 0), HONEY_CAPACITY)
  const ratio = clamped / HONEY_CAPACITY
  const overflow = Math.max(balance - HONEY_CAPACITY, 0)
  return (
    <section className="honey-vessel-card">
      <div
        className="honey-vessel"
        role="progressbar"
        aria-label="Hive Honey vessel"
        aria-valuemin={0}
        aria-valuemax={HONEY_CAPACITY}
        aria-valuenow={clamped}
        aria-valuetext={
          overflow > 0
            ? `${balance} Honey, vessel full with ${overflow} in overflow`
            : `${balance} of ${HONEY_CAPACITY} Honey`
        }
      >
        <div className="honey-vessel__cavity">
          <div
            className="honey-vessel__fill"
            style={{ height: `${ratio * 100}%` }}
          >
            <span />
          </div>
        </div>
        <img src={vesselUrl} alt="" />
      </div>
      <div className="honey-vessel__legend">
        <p className="utility-label">Honey reserve</p>
        <strong>{balance}</strong>
        <span>{Math.round(ratio * 100)}% of the first vessel</span>
      </div>
    </section>
  )
}

function GolieBee({
  seed,
  celebrating,
}: {
  seed: string
  celebrating: boolean
}) {
  const name = getGolieBeeName(seed)
  return (
    <div
      className={`goliebee${celebrating ? ' is-celebrating' : ''}`}
      aria-label={`${name}, your GolieBee`}
    >
      <div>
        <img src={beeUrl} alt="" />
        {celebrating ? <span>✦</span> : null}
      </div>
      <p>
        <strong>{name}</strong>
        <small>{celebrating ? 'Buzzing with progress' : 'Your GolieBee'}</small>
      </p>
    </div>
  )
}
