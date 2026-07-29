export type Mood = 'awful' | 'bad' | 'okay' | 'good' | 'great'

export const MOODS = [
  { value: 'awful', label: 'Awful', color: '#D96F5C', softColor: '#F8DDD7' },
  { value: 'bad', label: 'Bad', color: '#C98B48', softColor: '#F6E5D1' },
  { value: 'okay', label: 'Okay', color: '#D9A63E', softColor: '#F8EDCE' },
  { value: 'good', label: 'Good', color: '#75A469', softColor: '#E1EDDD' },
  { value: 'great', label: 'Great', color: '#449487', softColor: '#D9ECE8' },
] as const satisfies ReadonlyArray<{
  value: Mood
  label: string
  color: string
  softColor: string
}>

export const HYDRATION_GOAL_ML = 2_000
export const MAX_HYDRATION_ML = 10_000

export function localDateKey(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromLocalKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) throw new RangeError(`Invalid local date key: ${key}`)
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  )
  if (localDateKey(date) !== key)
    throw new RangeError(`Invalid local date key: ${key}`)
  return date
}

export function shiftLocalDateKey(key: string, days: number) {
  const date = dateFromLocalKey(key)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function formatJournalDate(key: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dateFromLocalKey(key))
}

export function currentLocalDay() {
  return {
    localDate: localDateKey(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

export function occurredAtForDate(localDate: string) {
  const now = new Date()
  const occurrence = dateFromLocalKey(localDate)
  occurrence.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0)
  return Math.min(Date.now(), occurrence.getTime())
}

export function monthStartForDate(localDate: string) {
  return `${localDate.slice(0, 7)}-01`
}

export function shiftMonth(monthStart: string, delta: number) {
  const date = dateFromLocalKey(monthStart)
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  return monthStartForDate(localDateKey(date))
}

export function calendarDays(monthStart: string) {
  const first = dateFromLocalKey(monthStart)
  const leading = first.getDay()
  const start = new Date(first)
  start.setDate(start.getDate() - leading)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: localDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
    }
  })
}
