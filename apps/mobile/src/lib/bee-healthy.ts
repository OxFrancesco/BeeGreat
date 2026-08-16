// The mood vocabulary is shared with web via @beegreat/tool-presentation.
export {
  MOODS,
  type Mood,
  type MoodOption,
} from '@beegreat/tool-presentation';

export const HYDRATION_GOAL_ML = 2_000;
export const MAX_HYDRATION_ML = 10_000;

const LOCAL_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar-day key that deliberately uses the device's local timezone. */
export function localDateKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Cannot create a local date key from an invalid date');
  }

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a local calendar key without the UTC shift caused by `new Date("YYYY-MM-DD")`. */
export function dateFromLocalKey(key: string) {
  const match = LOCAL_DATE_KEY_PATTERN.exec(key);
  if (!match) {
    throw new RangeError(`Invalid local date key: ${key}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    throw new RangeError(`Invalid local date key: ${key}`);
  }

  return date;
}

/** Moves a local calendar key safely across month, year, and DST boundaries. */
export function shiftLocalDateKey(key: string, days: number) {
  if (!Number.isInteger(days)) {
    throw new RangeError('Local date shifts must use a whole number of days');
  }

  const date = dateFromLocalKey(key);
  // Noon avoids the rare timezone transition that occurs exactly at midnight.
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function isTodayLocalKey(key: string, now = new Date()) {
  return key === localDateKey(now);
}

export function formatJournalDate(key: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dateFromLocalKey(key));
}
