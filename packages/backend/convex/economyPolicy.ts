export const DAY_MS = 24 * 60 * 60 * 1000
export const GENIUS_WINDOW_MS = 7 * DAY_MS
export const TASK_REWARD_WINDOW_MS = DAY_MS
export const TASK_REWARD_CAP = 8
export const TASK_HONEY_AWARD = 5
export const TASK_SCORE_AWARD = 1
export const ROYAL_JELLY_WEEKLY_AWARD = 1
export const FOCUS_SHIELD_COST = 1
export const FOCUS_SHIELD_DURATION_MS = DAY_MS
export const RESURRECTION_COST = 3
export const ACHIEVEMENT_SCORE_AWARD = 5

export const GOAL_TASK_ACHIEVEMENT_RANKS = [1, 5, 25] as const
export const COMPLETED_GOAL_ACHIEVEMENT_RANKS = [1, 2, 3] as const

/** Daily Brain Fatigue attached to each Goal's activation rank. */
export function fatigueDailyRateForRank(rank: number) {
  if (rank === 4) return 1
  if (rank === 5) return 2
  if (rank === 6 || rank === 7) return 1
  return 0
}

export function totalDailyFatigue(activeGoalCount: number) {
  let total = 0
  for (let rank = 1; rank <= Math.min(activeGoalCount, 7); rank += 1) {
    total += fatigueDailyRateForRank(rank)
  }
  return total
}

export function materializeFatigue(
  elapsedMs: number,
  dailyRate: number,
  carriedHoneyMs: number,
) {
  const numerator =
    Math.max(0, carriedHoneyMs) + Math.max(0, elapsedMs) * dailyRate
  return {
    wholeHoney: Math.floor(numerator / DAY_MS),
    remainderHoneyMs: numerator % DAY_MS,
  }
}

/** Returns the covered duration after clamping and merging overlapping intervals. */
export function coveredDurationMs(
  from: number,
  to: number,
  intervals: Array<{ from: number; to: number }>,
) {
  const normalized = intervals
    .map((interval) => ({
      from: Math.max(from, interval.from),
      to: Math.min(to, interval.to),
    }))
    .filter((interval) => interval.to > interval.from)
    .sort((a, b) => a.from - b.from || a.to - b.to)

  let covered = 0
  let currentFrom = 0
  let currentTo = 0
  for (const interval of normalized) {
    if (currentTo <= currentFrom) {
      currentFrom = interval.from
      currentTo = interval.to
    } else if (interval.from > currentTo) {
      covered += currentTo - currentFrom
      currentFrom = interval.from
      currentTo = interval.to
    } else {
      currentTo = Math.max(currentTo, interval.to)
    }
  }
  if (currentTo > currentFrom) covered += currentTo - currentFrom
  return covered
}
