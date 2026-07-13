import { describe, expect, test } from 'bun:test'

import {
  buildTaskTree,
  endOfDayIn,
  formatProjectDue,
  upcomingQuarters,
} from './focus-utils'

describe('focus utilities', () => {
  test('groups subtasks under their parent and sections by parent status', () => {
    const tree = buildTaskTree([
      { id: 'a', parentTaskId: null, status: 'todo' as const },
      { id: 'b', parentTaskId: 'a', status: 'done' as const },
      { id: 'c', parentTaskId: null, status: 'done' as const },
    ])
    expect(tree.open.map(({ task }) => task.id)).toEqual(['a'])
    expect(tree.open[0]?.subtasks.map((task) => task.id)).toEqual(['b'])
    expect(tree.done.map(({ task }) => task.id)).toEqual(['c'])
  })

  test('builds local due presets and rolls quarters across years', () => {
    const base = new Date(2026, 11, 30, 10, 0)
    expect(new Date(endOfDayIn(1, base)).getDate()).toBe(31)
    expect(upcomingQuarters(base)).toEqual([
      { year: 2026, quarter: 4 },
      { year: 2027, quarter: 1 },
      { year: 2027, quarter: 2 },
      { year: 2027, quarter: 3 },
    ])
    expect(formatProjectDue({ year: 2027, quarter: 2 })).toBe('Q2 2027')
  })
})
