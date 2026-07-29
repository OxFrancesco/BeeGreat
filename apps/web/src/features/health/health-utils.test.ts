import { describe, expect, test } from 'bun:test'

import {
  calendarDays,
  dateFromLocalKey,
  localDateKey,
  monthStartForDate,
  shiftLocalDateKey,
  shiftMonth,
} from './health-utils'

describe('health date utilities', () => {
  test('round trips local calendar keys', () => {
    expect(localDateKey(dateFromLocalKey('2026-07-20'))).toBe('2026-07-20')
    expect(() => dateFromLocalKey('2026-02-30')).toThrow()
  })

  test('moves across month and year boundaries', () => {
    expect(shiftLocalDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01')
    expect(monthStartForDate('2026-07-20')).toBe('2026-07-01')
  })

  test('builds complete six-week calendar grids', () => {
    const days = calendarDays('2026-07-01')
    expect(days).toHaveLength(42)
    expect(days.some((day) => day.key === '2026-07-20' && day.inMonth)).toBe(
      true,
    )
  })
})
