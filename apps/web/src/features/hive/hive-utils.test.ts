import { describe, expect, test } from 'bun:test'

import { getGolieBeeName } from './hive-utils'

describe('GolieBee presentation', () => {
  test('keeps a stable name for a persisted seed', () => {
    expect(getGolieBeeName('focus-123')).toBe(getGolieBeeName('focus-123'))
    expect(getGolieBeeName('focus-123')).not.toBe('')
  })
})
