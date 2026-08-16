/** The local-day deadline a highlight defaults to when Bee schedules one. */
export function endOfLocalDay(dayOffset = 0): number {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function formatHighlightExpiry(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
