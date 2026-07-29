import { api } from '@beegreat/backend/convex/_generated/api'
import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import beeDoctor from '../../../../mobile/assets/images/bee-doctor.png?url'
import beeAwful from '../../../../mobile/assets/images/moods/bee-awful.png?url'
import beeBad from '../../../../mobile/assets/images/moods/bee-bad.png?url'
import beeOkay from '../../../../mobile/assets/images/moods/bee-okay.png?url'
import beeGood from '../../../../mobile/assets/images/moods/bee-good.png?url'
import beeGreat from '../../../../mobile/assets/images/moods/bee-great.png?url'
import {
  HYDRATION_GOAL_ML,
  MAX_HYDRATION_ML,
  MOODS,
  currentLocalDay,
  formatJournalDate,
  shiftLocalDateKey,
} from './health-utils'
import type { Mood } from './health-utils'

const MOOD_IMAGES: Record<Mood, string> = {
  awful: beeAwful,
  bad: beeBad,
  okay: beeOkay,
  good: beeGood,
  great: beeGreat,
}

export function HealthLayout() {
  return (
    <main className="health-page">
      <header className="health-header">
        <Link className="health-back" to="/goals" aria-label="Back to Goals">
          ←
        </Link>
        <div>
          <h1>Bee Healthy</h1>
          <p>A quiet daily check-in for your mood, water, and memories.</p>
        </div>
        <img src={beeDoctor} alt="Bee wearing a doctor coat" />
      </header>
      <nav className="health-tabs" aria-label="Bee Healthy">
        <Link
          to="/health"
          activeOptions={{ exact: true }}
          activeProps={{ className: 'is-active' }}
        >
          <span aria-hidden="true">☺</span> Mood
        </Link>
        <Link to="/health/water" activeProps={{ className: 'is-active' }}>
          <span aria-hidden="true">●</span> Water
        </Link>
        <Link to="/health/journal" activeProps={{ className: 'is-active' }}>
          <span aria-hidden="true">✎</span> Journal
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}

export function HealthSummaryCard() {
  const { localDate } = currentLocalDay()
  const entry = useQuery(api.healthJournal.getByDate, { localDate })
  const mood = entry?.mood
    ? MOODS.find((item) => item.value === entry.mood)
    : null
  const hydration = Math.min(
    100,
    Math.round(((entry?.hydrationMl ?? 0) / HYDRATION_GOAL_ML) * 100),
  )
  const summary =
    entry === undefined
      ? "Loading today's ritual…"
      : mood || (entry?.hydrationMl ?? 0) > 0
        ? `${mood?.label ?? 'Mood not checked'} · ${hydration}% hydrated`
        : 'Mood, water, and one honest thought'

  return (
    <Link className="health-summary-card" to="/health">
      <img src={beeDoctor} alt="" />
      <span>
        <strong>Bee Healthy</strong>
        <small>{summary}</small>
      </span>
      <b aria-hidden="true">→</b>
    </Link>
  )
}

export function MoodPage() {
  const { localDate, timeZone } = useMemo(currentLocalDay, [])
  const entry = useQuery(api.healthJournal.getByDate, { localDate })
  const history = useQuery(api.healthJournal.listRecent, {
    limit: 7,
    throughDate: localDate,
  })
  const setMood = useMutation(api.healthJournal.setMood)
  const [optimisticMood, setOptimisticMood] = useState<Mood>()
  const [error, setError] = useState<string>()
  const selected = optimisticMood ?? entry?.mood

  async function chooseMood(mood: Mood) {
    setOptimisticMood(mood)
    setError(undefined)
    try {
      await setMood({ localDate, timeZone, mood })
      setOptimisticMood(undefined)
    } catch (cause) {
      setOptimisticMood(undefined)
      setError(
        cause instanceof Error ? cause.message : 'Could not save your mood.',
      )
    }
  }

  return (
    <section
      className="health-content health-content--mood"
      aria-labelledby="mood-title"
    >
      <div className="health-section-heading">
        <div>
          <h2 id="mood-title">How are you?</h2>
          <p>{formatJournalDate(localDate)}</p>
        </div>
      </div>
      {entry === undefined ? (
        <HealthLoading label="Checking in…" />
      ) : (
        <div
          className="mood-picker"
          role="radiogroup"
          aria-label="Today's mood"
        >
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              role="radio"
              aria-checked={selected === mood.value}
              className={selected === mood.value ? 'is-selected' : ''}
              style={
                {
                  '--mood': mood.color,
                  '--mood-soft': mood.softColor,
                } as React.CSSProperties
              }
              onClick={() => void chooseMood(mood.value)}
            >
              <img src={MOOD_IMAGES[mood.value]} alt="" />
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <WeekPulse today={localDate} entries={history ?? []} />
    </section>
  )
}

function WeekPulse({
  today,
  entries,
}: {
  today: string
  entries: Array<{ localDate: string; mood: Mood | null; hydrationMl: number }>
}) {
  const byDate = new Map(entries.map((entry) => [entry.localDate, entry]))
  const days = Array.from({ length: 7 }, (_, index) =>
    shiftLocalDateKey(today, index - 6),
  )
  return (
    <section className="week-pulse" aria-label="Last seven days">
      <h3>Last 7 days</h3>
      <div>
        {days.map((day) => {
          const entry = byDate.get(day)
          const mood = entry?.mood
            ? MOODS.find((item) => item.value === entry.mood)
            : null
          const hydration = Math.min(
            100,
            ((entry?.hydrationMl ?? 0) / HYDRATION_GOAL_ML) * 100,
          )
          return (
            <div className={day === today ? 'is-today' : ''} key={day}>
              <span>
                {new Intl.DateTimeFormat(undefined, {
                  weekday: 'narrow',
                }).format(new Date(`${day}T12:00:00`))}
              </span>
              <i
                style={{
                  background: mood?.softColor,
                  borderColor: mood?.color,
                }}
                title={mood?.label ?? 'No mood'}
              />
              <b>
                <span style={{ height: `${hydration}%` }} />
              </b>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function WaterPage() {
  const { localDate, timeZone } = useMemo(currentLocalDay, [])
  const entry = useQuery(api.healthJournal.getByDate, { localDate })
  const adjustHydration = useMutation(api.healthJournal.adjustHydration)
  const [optimistic, setOptimistic] = useState<number>()
  const [lastAdded, setLastAdded] = useState<number>()
  const [error, setError] = useState<string>()
  const request = useRef(0)
  const hydration = optimistic ?? entry?.hydrationMl ?? 0

  useEffect(() => {
    if (!lastAdded) return
    const timeout = window.setTimeout(() => setLastAdded(undefined), 5_000)
    return () => window.clearTimeout(timeout)
  }, [lastAdded])

  async function change(deltaMl: number, showUndo = false) {
    const next = Math.min(MAX_HYDRATION_ML, Math.max(0, hydration + deltaMl))
    const applied = next - hydration
    if (!applied) return
    const version = ++request.current
    setOptimistic(next)
    setError(undefined)
    try {
      const result = await adjustHydration({
        localDate,
        timeZone,
        deltaMl: applied,
      })
      if (version === request.current) {
        setOptimistic(undefined)
        if (showUndo && result.appliedDeltaMl > 0)
          setLastAdded(result.appliedDeltaMl)
      }
    } catch (cause) {
      if (version === request.current) setOptimistic(undefined)
      setError(
        cause instanceof Error ? cause.message : 'Could not update your water.',
      )
    }
  }

  const percent = Math.min(
    100,
    Math.round((hydration / HYDRATION_GOAL_ML) * 100),
  )
  return (
    <section
      className="health-content health-content--water"
      aria-labelledby="water-title"
    >
      <div className="health-section-heading">
        <div>
          <h2 id="water-title">Water</h2>
          <p>{formatJournalDate(localDate)}</p>
        </div>
        <Link className="button button--quiet" to="/health/tap-actions">
          Tap actions
        </Link>
      </div>
      {entry === undefined ? (
        <HealthLoading label="Filling your bottle…" />
      ) : (
        <div className="hydration-card">
          <div
            className="water-vessel"
            aria-label={`${hydration} of ${HYDRATION_GOAL_ML} millilitres`}
          >
            <span style={{ height: `${percent}%` }} />
            <strong>{percent}%</strong>
          </div>
          <div className="hydration-copy">
            <p>
              <strong>{hydration.toLocaleString()}</strong> /{' '}
              {HYDRATION_GOAL_ML.toLocaleString()} ml
            </p>
            <span>
              {Math.max(0, HYDRATION_GOAL_ML - hydration).toLocaleString()} ml
              to today's goal
            </span>
            <div className="water-actions">
              {[250, 330, 500, 750].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => void change(amount, true)}
                >
                  +{amount} ml
                </button>
              ))}
              <button
                type="button"
                disabled={hydration === 0}
                onClick={() => void change(-250)}
              >
                −250 ml
              </button>
            </div>
          </div>
        </div>
      )}
      {lastAdded ? (
        <div className="health-undo" role="status">
          <span>Added {lastAdded} ml.</span>
          <button
            type="button"
            onClick={() => {
              const amount = lastAdded
              setLastAdded(undefined)
              void change(-amount)
            }}
          >
            Undo
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

export function HealthLoading({ label }: { label: string }) {
  return (
    <div className="health-loading" aria-live="polite">
      <span />
      {label}
    </div>
  )
}
