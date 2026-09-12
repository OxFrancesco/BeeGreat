import { api } from '@beegreat/backend/convex/_generated/api'
import { useQuery } from 'convex/react'
import { useState } from 'react'

const trackers = ['mood', 'water', 'journal'] as const
const accents = ['#75A469', '#55BEE2', '#E4A72C']
function ringPath(radius: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * Math.PI / 180
    return `${i ? 'L' : 'M'}${50 + radius * Math.cos(angle)} ${50 + radius * Math.sin(angle)}`
  }).join(' ') + ' Z'
}
const dateOf = (key: string) => new Date(`${key}T12:00:00Z`)
const monthKey = (date: Date) => date.toISOString().slice(0, 7)
export function HealthStreaks({ localDate }: { localDate: string }) {
  const [month, setMonth] = useState(localDate.slice(0, 7))
  const first = dateOf(`${month}-01`)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12))
  const throughDate = last.toISOString().slice(0, 10) < localDate ? last.toISOString().slice(0, 10) : localDate
  const stats = useQuery(api.healthJournal.overview, { throughDate })
  const offset = (first.getUTCDay() + 6) % 7
  const rows = Math.ceil((offset + last.getUTCDate()) / 7)
  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1, 12))
    setMonth(monthKey(next))
  }
  return <section className="health-comb-calendar" aria-label="Streak calendar">
    <header><h3>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3><button aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button><button aria-label="Next month" disabled={month >= localDate.slice(0, 7)} onClick={() => changeMonth(1)}>›</button></header>
    <div className="health-ring-legend">{trackers.map((key, i) => <div key={key}><span style={{ color: accents[i] }}>{key[0].toUpperCase() + key.slice(1)}</span><strong>{stats ? stats[key].windowDays ? `${stats[key].current}${stats[key].currentCapped ? '+' : ''} ${stats[key].current === 1 ? 'day' : 'days'}` : '—' : '—'}</strong></div>)}</div>
    {!stats ? <p role="status">Loading calendar…</p> : <>
      <div className="health-comb-grid" style={{ aspectRatio: `6.63 / ${1 + (rows - 1) * .75}` }}>
        {Array.from({ length: last.getUTCDate() }, (_, index) => {
          const key = `${month}-${String(index + 1).padStart(2, '0')}`
          const item = stats.calendar.find(value => value.localDate === key)
          const row = Math.floor((offset + index) / 7)
          const col = (offset + index) % 7
          const progress = [item?.mood ? 1 : 0, item?.water ?? 0, item?.journal ? 1 : 0]
          const future = key > localDate
          const description = `${dateOf(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}. ${future ? 'Future day' : `Mood ${item?.mood ? 'logged' : 'not logged'}. Water ${Math.round((item?.water ?? 0) * 100)} percent. Journal ${item?.journal === null ? 'history unavailable' : item?.journal ? 'logged' : 'not logged'}`}`
          return <div key={key} className="health-comb-day" role="img" aria-label={description} title={description} data-future={future} data-today={key === localDate} style={{ left: `${.866 * (col + row % 2 * .5) / 6.63 * 100}%`, top: `${row * .75 / (1 + (rows - 1) * .75) * 100}%` }}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><path className="health-comb-cell" d="M50 3 Q52 3 54 5 L88 25 Q91 27 91 30 L91 70 Q91 73 88 75 L54 95 Q50 98 46 95 L12 75 Q9 73 9 70 L9 30 Q9 27 12 25 L46 5 Q48 3 50 3Z" />{progress.map((value, i) => <g key={i} fill="none" stroke={accents[i]} strokeWidth="4.3" strokeLinejoin="round"><path d={ringPath(38 - i * 9)} opacity=".16" />{value > 0 && <path d={ringPath(38 - i * 9)} pathLength="1" strokeDasharray={value < 1 ? `${value} 1` : undefined} strokeLinecap="round" />}</g>)}<text x="50" y="51" textAnchor="middle" dominantBaseline="middle">{index + 1}</text></svg>
          </div>
        })}
      </div>
    </>}
  </section>
}
