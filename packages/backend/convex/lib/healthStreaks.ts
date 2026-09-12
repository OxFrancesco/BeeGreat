export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function trackerStreak(completed: Set<string>, throughDate: string, startDate: string) {
  const windowDays = Math.max(0, Math.round((Date.parse(`${throughDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000) + 1)
  let cursor = completed.has(throughDate) ? throughDate : shiftDay(throughDate, -1)
  let current = 0
  while (cursor >= startDate && completed.has(cursor)) {
    current++
    cursor = shiftDay(cursor, -1)
  }
  let best = 0
  let run = 0
  let completedDays = 0
  for (let day = startDate; day <= throughDate; day = shiftDay(day, 1)) {
    run = completed.has(day) ? run + 1 : 0
    if (run) completedDays++
    best = Math.max(best, run)
  }
  return { current, currentCapped: current > 0 && cursor < startDate, best, windowDays, completedDays,
    days: Array.from({ length: 7 }, (_, index) => {
      const localDate = shiftDay(throughDate, index - 6)
      return { localDate, done: localDate < startDate ? null : completed.has(localDate) }
    }),
  }
}
